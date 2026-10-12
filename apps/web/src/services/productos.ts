import type { CategoriaQuimica } from '@ecocleaner/schemas'
import { productos as productosMock, type ProductoOperario } from './operarioMock'
import { isSupabaseConfigured, supabase } from './supabase'

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

