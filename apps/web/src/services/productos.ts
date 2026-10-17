import type { CategoriaQuimica } from '@ecocleaner/schemas'
import { productos as productosMock, type ProductoOperario } from './operarioMock'
import { isSupabaseConfigured, supabase } from './supabase'
import type { LiveCatalog } from '../features/supervisor/explainer/live-data'

/** Lectura acotada del catálogo para el asistente; sin usuarios ni observaciones. */
export async function obtenerCatalogoExplicador(): Promise<LiveCatalog> {
  let rows: Record<string, unknown>[] = productosMock
  let simulated = true
  let partial = false
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('productos')
        .select('id,nombre,categorias,incompatibilidades,dilucion_min_ml_por_litro,dilucion_max_ml_por_litro,ph')
        .order('id').limit(51).abortSignal(AbortSignal.timeout(15000))
      if (!error && Array.isArray(data)) {
        rows = data
        simulated = false
        partial = data.length > 50
      }
    } catch { /* La indisponibilidad conserva el catálogo local rotulado. */ }
  }
  const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null
  const strings = (value: unknown) => Array.isArray(value) && value.every(v => typeof v === 'string') ? value as string[] : null
  return {
    simulated, partial,
    products: rows.slice(0, 50).map(row => ({
      id: typeof row.id === 'string' ? row.id : '',
      name: typeof row.nombre === 'string' ? row.nombre : null,
      categories: strings(row.categorias), incompatibilities: strings(row.incompatibilidades),
      minimum: number(row.dilucion_min_ml_por_litro), maximum: number(row.dilucion_max_ml_por_litro), ph: number(row.ph),
    })),
  }
}

export type NuevoProductoInput = {
  nombre: string
  tipo_quimico?: string | null
  categorias: CategoriaQuimica[]
  incompatibilidades?: CategoriaQuimica[]
  dilucion_min_ml_por_litro: number
  dilucion_ml_por_litro: number
  dilucion_max_ml_por_litro: number
  dilucion_texto_ficha?: string | null
  ph?: number | null
  concentracion_ph?: string | null
  ph_medido_a_ml_por_litro?: number | null
  indicaciones_disposicion?: string | null
  url_ficha_tecnica?: string | null
  url_hoja_seguridad?: string | null
}

/**
 * Consulta el catálogo de productos químicos.
 * Si Supabase está disponible, consulta la tabla 'productos';
 * de lo contrario, recurre a los productos iniciales validados.
 */
export async function listarProductos(): Promise<ProductoOperario[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('nombre')

    if (!error && data && data.length > 0) {
      return data as ProductoOperario[]
    }
  }

  return productosMock
}

/**
 * Obtiene un producto por su id.
 */
export async function obtenerProducto(
  id: string,
): Promise<ProductoOperario | undefined> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('id', id)
      .single()

    if (!error && data) {
      return data as ProductoOperario
    }
  }

  return productosMock.find((producto) => producto.id === id)
}

/**
 * Registra un nuevo producto químico en el catálogo (usado por el Supervisor).
 * Si Supabase está configurado, persiste en la base de datos; de lo contrario,
 * lo agrega a la memoria de productos local.
 */
export async function crearProducto(
  input: NuevoProductoInput,
): Promise<ProductoOperario> {
  const payload = {
    nombre: input.nombre,
    tipo_quimico: input.tipo_quimico || null,
    categorias: input.categorias,
    incompatibilidades: input.incompatibilidades || [],
    dilucion_min_ml_por_litro: input.dilucion_min_ml_por_litro,
    dilucion_ml_por_litro: input.dilucion_ml_por_litro,
    dilucion_max_ml_por_litro: input.dilucion_max_ml_por_litro,
    dilucion_texto_ficha: input.dilucion_texto_ficha || null,
    ph: input.ph ?? null,
    concentracion_ph: input.concentracion_ph || null,
    ph_medido_a_ml_por_litro: input.ph_medido_a_ml_por_litro ?? null,
    indicaciones_disposicion: input.indicaciones_disposicion || null,
    url_ficha_tecnica: input.url_ficha_tecnica || null,
    url_hoja_seguridad: input.url_hoja_seguridad || null,
  }

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('productos')
      .insert(payload)
      .select('*')
      .single()

    if (error || !data) {
      throw error ?? new Error('No se pudo registrar el producto en Supabase')
    }

    return data as ProductoOperario
  }

  // Fallback local en memoria
  const nuevoProducto: ProductoOperario = {
    id: `prod-local-${Date.now()}`,
    ...payload,
  }

  productosMock.push(nuevoProducto)
  return nuevoProducto
}

