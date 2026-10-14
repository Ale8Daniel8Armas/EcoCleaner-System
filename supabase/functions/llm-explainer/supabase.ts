import {
  calcularReceta,
  calcularDesvio,
  compararVariantes,
} from '../../../packages/core/src/index.ts'
import type { NivelSuciedad } from '../../../packages/core/src/tipos.ts'
import type { RegistroComparacion } from '../../../packages/core/src/variantes.ts'
import { isObject } from '../../../packages/core/server/llm/context.ts'
import { readBoundedText } from '../../../packages/core/server/llm/groq.ts'
import { isUUID, type EdgeDependencies } from './handler.ts'

export function createSupabaseReader(options: {
  url: string
  publishableKey: string
  fetchImpl?: typeof fetch
}): Pick<EdgeDependencies, 'verifyIdentity' | 'loadContext'> {
  const base = new URL(options.url)
  const localHttp =
    base.protocol === 'http:' &&
    (base.hostname === 'localhost' || base.hostname === '127.0.0.1')
  if (
    base.pathname !== '/' ||
    (base.protocol !== 'https:' && !localHttp) ||
    base.username ||
    base.password ||
    !options.publishableKey ||
    options.publishableKey.startsWith('sb_secret_')
  )
    throw new Error(
      'Se requiere URL de proyecto y clave publicable de servidor, sin privilegios administrativos.',
    )
  if (!options.publishableKey.startsWith('sb_publishable_')) {
    try {
      const payload = options.publishableKey.split('.')[1]
      const decoded = JSON.parse(
        atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
      )
      if (decoded.role !== 'anon') throw new Error('Clave no publicable')
    } catch {
      throw new Error('La clave legacy debe ser anon; no usar service_role.')
    }
  }
  const fetchImpl = options.fetchImpl ?? fetch
  const read = async (
    path: string,
    token: string,
    signal: AbortSignal,
  ): Promise<unknown> => {
    const response = await fetchImpl(new URL(path, base), {
      method: 'GET',
      redirect: 'error',
      signal,
      headers: {
        apikey: options.publishableKey,
        Authorization: `Bearer ${token}`,
      },
    })
    if (!response.ok) {
      await response.body?.cancel()
      return null
    }
    return JSON.parse(await readBoundedText(response, 48_000, signal))
  }
  const row = async (
    table: string,
    select: string,
    key: string,
    id: string,
    token: string,
    signal: AbortSignal,
  ) => {
    const query = new URLSearchParams({
      select,
      [key]: `eq.${id}`,
      limit: '21',
    })
    const data = await read(`/rest/v1/${table}?${query}`, token, signal)
    if (!Array.isArray(data) || data.length > 20 || !data.every(isObject))
      return null
    return data as Record<string, unknown>[]
  }
  const numeric = (value: unknown): number =>
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN
  return {
    verifyIdentity: async (token, signal) => {
      try {
        // El servidor Auth verifica el JWT; nunca se confía en decodificar su payload localmente.
        const user = await read('/auth/v1/user', token, signal)
        if (!isObject(user) || !isUUID(user.id)) return null
        const role = isObject(user.app_metadata)
          ? user.app_metadata.ecocleaner_role
          : null
        return {
          id: user.id,
          role: role === 'operario' || role === 'supervisor' ? role : null,
        }
      } catch {
        return null
      }
    },
    loadContext: async (_user, resource, token, signal) => {
      // Este lector se invoca SOLO después de la autorización por recurso y la reserva de cuota.
      // Las tablas actuales carecen de medición final/reglas verificadas suficientes para efluentes.
      if (!['recipe', 'deviation', 'comparison'].includes(resource.kind))
        return null
      try {
        const task = (
          await row(
            'tareas',
            'id,area_id,producto_id,nivel_suciedad',
            'id',
            resource.resourceId,
            token,
            signal,
          )
        )?.[0]
        if (
          !task ||
          task.id !== resource.resourceId ||
          !isUUID(task.area_id) ||
          !isUUID(task.producto_id)
        )
          return null
        const area = (
          await row(
            'areas',
            'superficie_m2,litros_solucion_por_m2',
            'id',
            task.area_id,
            token,
            signal,
          )
        )?.[0]
        const product = (
          await row(
            'productos',
            'dilucion_min_ml_por_litro,dilucion_ml_por_litro,dilucion_max_ml_por_litro',
            'id',
            task.producto_id,
            token,
            signal,
          )
        )?.[0]
        if (!area || !product) return null
        const recipe = calcularReceta({
          superficie_m2: numeric(area.superficie_m2),
          litros_solucion_por_m2: numeric(area.litros_solucion_por_m2),
          nivel_suciedad: task.nivel_suciedad as NivelSuciedad,
          producto: {
            dilucion_min_ml_por_litro: numeric(
              product.dilucion_min_ml_por_litro,
            ),
            dilucion_ml_por_litro: numeric(product.dilucion_ml_por_litro),
            dilucion_max_ml_por_litro: numeric(
              product.dilucion_max_ml_por_litro,
            ),
          },
        })
        if (resource.kind === 'recipe')
          return { kind: 'recipe', result: recipe }
        const records = await row(
          'registros_uso',
          'id,variante_id,litros_agua_reales,ml_producto_reales,marca,fuente',
          'tarea_id',
          resource.resourceId,
          token,
          signal,
        )
        if (!records?.length) return null
        if (resource.kind === 'deviation') {
          // No se elige arbitrariamente entre múltiples registros de una tarea.
          if (records.length !== 1) return null
          return {
            kind: 'deviation',
            result: calcularDesvio({
              receta: recipe,
              litros_agua_reales: numeric(records[0].litros_agua_reales),
              ml_producto_reales: numeric(records[0].ml_producto_reales),
              dilucion_max_ml_por_litro: numeric(
                product.dilucion_max_ml_por_litro,
              ),
            }),
          }
        }
        const variants = await row(
          'variantes',
          'id,nombre',
          'tarea_id',
          resource.resourceId,
          token,
          signal,
        )
        if (!variants) return null
        const enriched: (RegistroComparacion & { variantId: unknown })[] = []
        for (const record of records) {
          if (!isUUID(record.id)) return null
          const result = (
            await row(
              'resultados',
              'cumple_criterio',
              'registro_uso_id',
              record.id,
              token,
              signal,
            )
          )?.[0]
          if (!result || typeof result.cumple_criterio !== 'boolean')
            return null
          enriched.push({
            variantId: record.variante_id,
            litros_agua_reales: numeric(record.litros_agua_reales),
            ml_producto_reales: numeric(record.ml_producto_reales),
            cumple_criterio: result.cumple_criterio,
            marca: record.marca as RegistroComparacion['marca'],
            fuente: record.fuente as RegistroComparacion['fuente'],
          })
        }
        if (
          enriched.some(
            (record) =>
              !isUUID(record.variantId) ||
              !variants.some((variant) => variant.id === record.variantId),
          )
        )
          return null
        return {
          kind: 'comparison',
          result: compararVariantes(
            variants.map((variant) => {
              if (!isUUID(variant.id) || typeof variant.nombre !== 'string')
                throw new Error('Variante inválida')
              return {
                variante_id: variant.id,
                nombre: variant.nombre,
                registros: enriched.filter(
                  (record) => record.variantId === variant.id,
                ),
              }
            }),
          ),
        }
      } catch {
        return null
      }
    },
  }
}
