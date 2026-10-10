import type { ProductoFila } from './tipos'
import { CATEGORIAS_QUIMICAS, type CategoriaQuimica } from '@ecocleaner/schemas'
import { esObjeto, exigir } from './validacion'

export type ProductoIncompatibilidad = Pick<ProductoFila, 'id' | 'nombre' | 'categorias' | 'incompatibilidades'> &
  Partial<Pick<ProductoFila, 'url_hoja_seguridad'>>
export interface ConflictoIncompatibilidad {
  producto_a_id: string
  producto_b_id: string
  categoria: string
  reglas: { producto_origen_id: string; campo: string; fuente: string | null }[]
}
export interface InformeIncompatibilidades {
  conflictos: ConflictoIncompatibilidad[]
  estado: 'incompatibilidades_documentadas' | 'sin_coincidencias_documentadas' | 'datos_insuficientes'
  datos_insuficientes: { producto_id: string | null; campo: string; motivo: string }[]
  compatibilidad_demostrada: false
}
/**
 * Solo consulta categorías y reglas del catálogo; nunca infiere por el nombre.
 * La llamada original devuelve coincidencias, y [] NO significa mezcla segura.
 * Usar { detallado: true } para conocer la disponibilidad y trazabilidad de datos.
 */
export function detectarIncompatibilidades(
  productos: ProductoIncompatibilidad[], opciones: { detallado: true }
): InformeIncompatibilidades
export function detectarIncompatibilidades(
  productos: ProductoIncompatibilidad[], opciones?: { detallado?: false }
): ConflictoIncompatibilidad[]
export function detectarIncompatibilidades(
  productos: ProductoIncompatibilidad[], opciones?: { detallado?: boolean }
): InformeIncompatibilidades | ConflictoIncompatibilidad[]
export function detectarIncompatibilidades(
  productos: ProductoIncompatibilidad[], opciones?: { detallado?: boolean }
): InformeIncompatibilidades | ConflictoIncompatibilidad[] {
  exigir(Array.isArray(productos), 'productos', 'se requiere una lista')
  exigir(opciones === undefined || (esObjeto(opciones) && (opciones.detallado === undefined || typeof opciones.detallado === 'boolean')),
    'opciones', 'detallado debe ser booleano')
  const faltantes: InformeIncompatibilidades['datos_insuficientes'] = []
  const ids = new Set<string>()
  if (!productos.length) faltantes.push({ producto_id: null, campo: 'productos', motivo: 'No hay productos para analizar.' })
  const catalogo = productos.flatMap((p) => {
    if (!esObjeto(p) || typeof p.id !== 'string' || p.id.trim() === '') {
      faltantes.push({ producto_id: null, campo: 'id', motivo: 'Producto sin identificador válido.' })
      return []
    }
    exigir(!ids.has(p.id), 'productos.id', 'no se permiten identificadores duplicados')
    ids.add(p.id)
    const listas = { categorias: [] as CategoriaQuimica[], incompatibilidades: [] as CategoriaQuimica[] }
    for (const campo of ['categorias', 'incompatibilidades'] as const) {
      const lista = p[campo]
      if (!Array.isArray(lista) || (campo === 'categorias' && !lista.length)) {
        faltantes.push({ producto_id: p.id, campo, motivo: 'Información de catálogo no disponible.' })
        continue
      }
      for (const valor of lista) {
        if (CATEGORIAS_QUIMICAS.includes(valor)) listas[campo].push(valor)
        else faltantes.push({ producto_id: p.id, campo, motivo: 'Categoría desconocida; no se infiere su compatibilidad.' })
      }
    }
    return [{ id: p.id, ...listas, fuente: typeof p.url_hoja_seguridad === 'string' && p.url_hoja_seguridad.trim() ? p.url_hoja_seguridad : null }]
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const conflictos: ConflictoIncompatibilidad[] = []
  for (let i = 0; i < catalogo.length; i++) {
    for (let j = i + 1; j < catalogo.length; j++) {
      const a = catalogo[i], b = catalogo[j]
      const porCategoria = new Map<CategoriaQuimica, ConflictoIncompatibilidad['reglas']>()
      for (const [origen, destino] of [[a, b], [b, a]]) {
        for (const categoria of new Set(origen.incompatibilidades)) {
          if (!destino.categorias.includes(categoria)) continue
          const reglas = porCategoria.get(categoria) ?? []
          reglas.push({ producto_origen_id: origen.id, campo: `productos[${origen.id}].incompatibilidades`, fuente: origen.fuente })
          porCategoria.set(categoria, reglas)
        }
      }
      for (const categoria of [...porCategoria.keys()].sort()) {
        conflictos.push({ producto_a_id: a.id, producto_b_id: b.id, categoria, reglas: porCategoria.get(categoria)! })
      }
    }
  }
  const informe: InformeIncompatibilidades = {
    conflictos,
    estado: faltantes.length ? 'datos_insuficientes' : conflictos.length ? 'incompatibilidades_documentadas' : 'sin_coincidencias_documentadas',
    datos_insuficientes: faltantes,
    compatibilidad_demostrada: false,
  }
  return opciones?.detallado ? informe : conflictos
}
