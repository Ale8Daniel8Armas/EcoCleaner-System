import type { NivelSuciedad } from '@ecocleaner/schemas'
import type { Receta } from '@ecocleaner/core'

export interface TareaOperario {
  id: string
  area_id: string
  producto_id: string
  nivel_suciedad: NivelSuciedad
  superficie_m2: number
  litros_solucion_por_m2: number
  receta: Receta
  created_at: string
}

export interface RegistroUsoOperario {
  id: string
  tarea_id: string
  litros_agua_reales: number
  ml_producto_reales: number
  duracion_min: number | null
  marca: 'medido' | 'estimado'
  fuente: 'manual' | 'simulada' | 'sensor'
  alerta_sobredosis: boolean
  desvio_pct: number
  created_at: string
}

export interface ResultadoOperario {
  id: string
  registro_uso_id: string
  cumple_criterio: boolean
  criterios_evaluados: { criterio: string; cumple: boolean }[]
  observaciones: string | null
  created_at: string
}

export interface NuevaTarea {
  area_id: string
  producto_id: string
  nivel_suciedad: NivelSuciedad
  superficie_m2: number
  litros_solucion_por_m2: number
  receta: Receta
}

export interface NuevoRegistro {
  tarea_id: string
  litros_agua_reales: number
  ml_producto_reales: number
  duracion_min: number | null
  marca: 'medido' | 'estimado'
  fuente: 'manual' | 'simulada' | 'sensor'
  alerta_sobredosis: boolean
  desvio_pct: number
}

export interface NuevoResultado {
  registro_uso_id: string
  cumple_criterio: boolean
  criterios_evaluados: { criterio: string; cumple: boolean }[]
  observaciones: string | null
}

interface OperarioState {
  tareas: TareaOperario[]
  registros: RegistroUsoOperario[]
  resultados: ResultadoOperario[]
}

/**
 * Persistencia local de demostración (RF-04, RF-07). Las pantallas solo llaman
 * a estas funciones async; al conectar Supabase se reemplaza la implementación
 * sin tocar la interfaz. No es un singleton mutable consumido por componentes.
 */
const STORAGE_KEY = 'ecocleaner:operario'

const emptyState = (): OperarioState => ({
  tareas: [],
  registros: [],
  resultados: [],
})

const readState = (): OperarioState => {
  if (typeof localStorage === 'undefined') return emptyState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw
      ? { ...emptyState(), ...(JSON.parse(raw) as OperarioState) }
      : emptyState()
  } catch {
    return emptyState()
  }
}

const writeState = (state: OperarioState): void => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const createId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`

export async function crearTarea(input: NuevaTarea): Promise<TareaOperario> {
  const state = readState()
  const tarea: TareaOperario = {
    id: createId(),
    created_at: new Date().toISOString(),
    ...input,
  }
  state.tareas.push(tarea)
  writeState(state)
  return tarea
}

export async function listarTareas(): Promise<TareaOperario[]> {
  return readState().tareas.slice().reverse()
}

export async function obtenerTarea(id: string): Promise<TareaOperario | null> {
  return readState().tareas.find((tarea) => tarea.id === id) ?? null
}

export async function registrarUso(
  input: NuevoRegistro,
): Promise<RegistroUsoOperario> {
  const state = readState()
  const registro: RegistroUsoOperario = {
    id: createId(),
    created_at: new Date().toISOString(),
    ...input,
  }
  state.registros.push(registro)
  writeState(state)
  return registro
}

export async function obtenerRegistro(
  id: string,
): Promise<RegistroUsoOperario | null> {
  return readState().registros.find((registro) => registro.id === id) ?? null
}

export async function guardarResultado(
  input: NuevoResultado,
): Promise<ResultadoOperario> {
  const state = readState()
  const resultado: ResultadoOperario = {
    id: createId(),
    created_at: new Date().toISOString(),
    ...input,
  }
  state.resultados = state.resultados.filter(
    (item) => item.registro_uso_id !== input.registro_uso_id,
  )
  state.resultados.push(resultado)
  writeState(state)
  return resultado
}
