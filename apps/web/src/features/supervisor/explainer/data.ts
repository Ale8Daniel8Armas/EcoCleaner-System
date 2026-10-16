import type { Receta } from '@ecocleaner/core'
import type {
  DemoRecord,
  DemoSnapshot,
  DemoTask,
  EffluentDecision,
} from './contracts'
import { operationalName } from './references'

type Row = Record<string, unknown>
const object = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Row)
    : {}
const list = (value: unknown): Row[] =>
  Array.isArray(value) ? value.map(object) : []
const relation = (value: unknown): Row[] =>
  Array.isArray(value)
    ? list(value)
    : value && typeof value === 'object'
      ? [object(value)]
      : []
const one = (value: unknown): Row =>
  Array.isArray(value)
    ? value.length === 1
      ? object(value[0])
      : {}
    : object(value)
const text = (value: unknown): string | null =>
  typeof value === 'string' ? value : null
export const numeric = (value: unknown): number | null => {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !value.trim())
  )
    return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
const critical = (product: Row) =>
  /clor|hipoclor|desinfect|amonio|perox/i.test(
    `${text(product.tipo_quimico) ?? ''} ${Array.isArray(product.categorias) ? product.categorias.join(' ') : ''}`,
  )

function record(row: Row, results: Row[], decisions: Row[]): DemoRecord {
  // Una relación ambigua se considera ausente, nunca se elige arbitrariamente.
  const result = results.length === 1 ? results[0] : {}
  return {
    id: text(row.id) ?? '',
    variantId: text(row.variante_id),
    waterL: numeric(row.litros_agua_reales),
    productMl: numeric(row.ml_producto_reales),
    mark: row.marca === 'medido' || row.marca === 'estimado' ? row.marca : null,
    source: ['manual', 'sensor', 'simulada'].includes(String(row.fuente))
      ? (row.fuente as DemoRecord['source'])
      : null,
    recordedOverdose: row.alerta_sobredosis === true,
    cleaning:
      typeof result.cumple_criterio === 'boolean'
        ? result.cumple_criterio
        : null,
    decisions: decisions.flatMap((d) =>
      ['verter', 'ajustar', 'reutilizar', 'gestor'].includes(
        String(d.decision_final),
      )
        ? [d.decision_final as EffluentDecision]
        : [],
    ),
  }
}

export function projectSupabaseTasks(
  rows: unknown[],
  truncated = false,
): DemoSnapshot {
  let partial = truncated
  const tasks = rows.map((value) => {
    const row = object(value)
    const product = one(row.productos)
    const area = one(row.areas)
    const solution = numeric(row.litros_solucion_esperados)
    const amount = numeric(row.ml_producto_esperados)
    const variants = list(row.variantes)
    const records = list(row.registros_uso)
    if (variants.length > 200 || records.length > 200) partial = true
    return {
      id: text(row.id) ?? '',
      // El flujo actual guarda la actividad en su única variante; no se elige entre varias.
      name: variants.length === 1 ? operationalName(variants[0].nombre) : null,
      areaId: text(row.area_id),
      areaName: operationalName(area.nombre),
      productId: text(row.producto_id),
      state: text(row.estado),
      dirt: text(row.nivel_suciedad),
      // Convención de volumen del core; no se infiere una dosis por defecto.
      recipe:
        solution !== null && solution > 0 && amount !== null && amount > 0
          ? {
              litros_solucion: solution,
              ml_producto: amount,
              ml_por_litro: amount / solution,
              litros_agua: solution - amount / 1000,
            }
          : null,
      productMin: numeric(product.dilucion_min_ml_por_litro),
      productMax: numeric(product.dilucion_max_ml_por_litro),
      criticalProduct: critical(product) || !text(product.tipo_quimico),
      variants: variants.slice(0, 200).map((v) => ({
        id: text(v.id) ?? '',
        name: operationalName(v.nombre),
        dilution: numeric(v.dilucion_ml_por_litro),
      })),
      records: records.slice(0, 200).map((r) => {
        const results = relation(r.resultados)
        return record(
          r,
          results,
          results.length === 1 ? relation(results[0].decisiones_efluente) : [],
        )
      }),
    } satisfies DemoTask
  })
  return {
    origin: 'supabase',
    tasks,
    catalogSimulated: false,
    limitations: partial ? ['partial'] : [],
  }
}

export function projectLocalTasks(
  stateValue: unknown,
  productsValue: unknown[],
  areasValue: unknown[] = [],
): DemoSnapshot {
  const state = object(stateValue)
  const products = productsValue.map(object)
  const areas = areasValue.map(object)
  const tasks = list(state.tareas).map((row) => {
    const product = products.find((p) => p.id === row.producto_id) ?? {}
    const recipe = object(row.receta)
    const values = [
      'litros_solucion',
      'ml_por_litro',
      'ml_producto',
      'litros_agua',
    ] as const
    const normalized = Object.fromEntries(
      values.map((key) => [key, numeric(recipe[key])]),
    )
    const variantId = text(row.variante_id)
    return {
      id: text(row.id) ?? '',
      name: operationalName(row.tipo_tarea),
      areaId: text(row.area_id),
      areaName: operationalName(
        areas.find((area) => area.id === row.area_id)?.nombre,
      ),
      productId: text(row.producto_id),
      state: text(row.estado),
      dirt: text(row.nivel_suciedad),
      recipe: values.every((key) => normalized[key] !== null)
        ? (normalized as unknown as Receta)
        : null,
      productMin: numeric(product.dilucion_min_ml_por_litro),
      productMax: numeric(product.dilucion_max_ml_por_litro),
      criticalProduct: critical(product) || !text(product.tipo_quimico),
      variants: variantId
        ? [
            {
              id: variantId,
              name: operationalName(row.tipo_tarea),
              dilution: numeric(recipe.ml_por_litro),
            },
          ]
        : [],
      records: list(state.registros)
        .filter((r) => r.tarea_id === row.id)
        .map((r) => {
          const results = list(state.resultados).filter(
            (result) => result.registro_uso_id === r.id,
          )
          const decisions =
            results.length === 1
              ? list(state.decisiones).filter(
                  (d) => d.resultado_id === results[0].id,
                )
              : []
          return record(r, results, decisions)
        }),
    } satisfies DemoTask
  })
  return {
    origin: 'local',
    tasks,
    catalogSimulated: true,
    limitations: ['local', 'catalog_simulated'],
  }
}
