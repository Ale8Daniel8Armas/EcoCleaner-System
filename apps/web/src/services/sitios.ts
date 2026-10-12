import {
  areas as areasMock,
  sitios as sitiosMock,
  type AreaOperario,
  type SitioOperario,
} from './operarioMock'
import { isSupabaseConfigured, supabase } from './supabase'

/**
 * Consulta la lista de sitios registrados.
 */
export async function listarSitios(): Promise<SitioOperario[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('sitios').select('*').order('nombre')
    if (!error && data && data.length > 0) {
      return data as SitioOperario[]
    }
  }

  return sitiosMock
}

/**
 * Consulta las áreas pertenecientes a un sitio.
 */
export async function listarAreasDeSitio(
  sitioId: string,
): Promise<AreaOperario[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('areas')
      .select('*')
      .eq('sitio_id', sitioId)
      .order('nombre')

    if (!error && data && data.length > 0) {
      return data as AreaOperario[]
    }
  }

  return areasMock.filter((area) => area.sitio_id === sitioId)
}

/**
 * Obtiene un sitio por su ID.
 */
export async function obtenerSitio(id: string): Promise<SitioOperario | undefined> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('sitios')
      .select('*')
      .eq('id', id)
      .single()

    if (!error && data) {
      return data as SitioOperario
    }
  }

  return sitiosMock.find((s) => s.id === id)
}

/**
 * Obtiene un área por su ID.
 */
export async function obtenerArea(id: string): Promise<AreaOperario | undefined> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('areas')
      .select('*')
      .eq('id', id)
      .single()

    if (!error && data) {
      return data as AreaOperario
    }
  }

  return areasMock.find((a) => a.id === id)
}

/**
 * Crea un nuevo sitio con sus áreas asociadas (usado por el Supervisor).
 */
export async function crearSitioConAreas(input: {
  nombre: string
  tipo: string
  criterios_limpieza: string[]
  areas: Array<{
    nombre: string
    superficie_m2: number
    tipo_superficie: string
    litros_solucion_por_m2?: number | null
  }>
}): Promise<{ sitio: SitioOperario; areas: AreaOperario[] }> {
  if (isSupabaseConfigured && supabase) {
    // 1. Insertar sitio
    const { data: sitioData, error: sitioError } = await supabase
      .from('sitios')
      .insert({
        nombre: input.nombre,
        tipo: input.tipo,
        criterios_limpieza: input.criterios_limpieza,
      })
      .select('*')
      .single()

    if (sitioError || !sitioData) {
      throw sitioError ?? new Error('No se pudo crear el sitio en Supabase')
    }

    // 2. Insertar áreas vinculadas al sitio
    const areasPayload = input.areas.map((area) => ({
      sitio_id: sitioData.id,
      nombre: area.nombre,
      superficie_m2: area.superficie_m2,
      tipo_superficie: area.tipo_superficie,
      litros_solucion_por_m2: area.litros_solucion_por_m2 ?? null,
    }))

    const { data: areasData, error: areasError } = await supabase
      .from('areas')
      .insert(areasPayload)
      .select('*')

    if (areasError || !areasData) {
      throw areasError ?? new Error('No se pudieron crear las áreas en Supabase')
    }

    return {
      sitio: sitioData as SitioOperario,
      areas: areasData as AreaOperario[],
    }
  }

  // Fallback local si no hay conexión
  const nuevoSitio: SitioOperario = {
    id: `sitio-local-${Date.now()}`,
    nombre: input.nombre,
    tipo: input.tipo,
    criterios_limpieza: input.criterios_limpieza,
  }

  const nuevasAreas: AreaOperario[] = input.areas.map((area, index) => ({
    id: `area-local-${Date.now()}-${index}`,
    sitio_id: nuevoSitio.id,
    nombre: area.nombre,
    superficie_m2: area.superficie_m2,
    tipo_superficie: area.tipo_superficie,
    litros_solucion_por_m2: area.litros_solucion_por_m2 ?? null,
  }))

  sitiosMock.push(nuevoSitio)
  areasMock.push(...nuevasAreas)

  return { sitio: nuevoSitio, areas: nuevasAreas }
}
