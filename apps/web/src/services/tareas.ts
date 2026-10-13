import type { NivelSuciedad, Orientacion } from '@ecocleaner/schemas'
import type { Receta } from '@ecocleaner/core'
import { isSupabaseConfigured, supabase } from './supabase'

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

export type DecisionFinalOperario =
  'verter' | 'ajustar' | 'reutilizar' | 'gestor'

export interface DecisionEfluenteOperario {
  id: string
  resultado_id: string
  orientacion: Orientacion
  decision_final: DecisionFinalOperario
  ph_estimado: number | null
  observaciones: string | null
  created_at: string
}

export interface NuevaDecisionEfluente {
  resultado_id: string
  orientacion: Orientacion
  decision_final: DecisionFinalOperario
  ph_estimado: number | null
  observaciones: string | null
}

interface OperarioState {
  tareas: TareaOperario[]
  registros: RegistroUsoOperario[]
  resultados: ResultadoOperario[]
  decisiones: DecisionEfluenteOperario[]
}

const STORAGE_KEY = 'ecocleaner:operario'

const emptyState = (): OperarioState => ({
  tareas: [],
  registros: [],
  resultados: [],
  decisiones: [],
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
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('tareas')
      .insert({
        area_id: input.area_id,
        producto_id: input.producto_id,
        nivel_suciedad: input.nivel_suciedad,
        litros_solucion_esperados: input.receta.litros_solucion,
        ml_producto_esperados: input.receta.ml_producto,
      })
      .select('*')
      .single()

    if (!error && data) {
      const tareaMapeada: TareaOperario = {
        id: data.id,
        area_id: data.area_id,
        producto_id: data.producto_id,
        nivel_suciedad: data.nivel_suciedad,
        superficie_m2: input.superficie_m2,
        litros_solucion_por_m2: input.litros_solucion_por_m2,
        receta: input.receta,
        created_at: data.created_at,
      }
      // Mantener copia local en cache de navegador
      const state = readState()
      state.tareas = state.tareas.filter((t) => t.id !== tareaMapeada.id)
      state.tareas.push(tareaMapeada)
      writeState(state)
      return tareaMapeada
    }
  }

  // Fallback local
  const state = readState()
  const tarea: TareaOperario = {
    id: createId(),
    created_at: new Date().toISOString(),
    ...input,
  }
  state.tareas = state.tareas.filter((t) => t.id !== tarea.id)
  state.tareas.push(tarea)
  writeState(state)
  return tarea
}

export async function listarTareas(): Promise<TareaOperario[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('tareas')
      .select('*, areas(superficie_m2, litros_solucion_por_m2)')
      .order('created_at', { ascending: false })

    if (!error && data && data.length > 0) {
      // Reconciliar con recetas guardadas en memoria local si las hay
      const localState = readState()
      return data.map((item: any) => {
        const local = localState.tareas.find((t) => t.id === item.id)
        if (local) return local
        const area = item.areas
        const sup = Number(area?.superficie_m2 ?? 100)
        const litPorM2 = Number(area?.litros_solucion_por_m2 ?? 0.4)
        return {
          id: item.id,
          area_id: item.area_id,
          producto_id: item.producto_id,
          nivel_suciedad: item.nivel_suciedad,
          superficie_m2: sup,
          litros_solucion_por_m2: litPorM2,
          receta: {
            litros_solucion: Number(item.litros_solucion_esperados),
            ml_por_litro:
              Number(item.litros_solucion_esperados) > 0
                ? Number(item.ml_producto_esperados) / Number(item.litros_solucion_esperados)
                : 50,
            ml_producto: Number(item.ml_producto_esperados),
            litros_agua:
              Number(item.litros_solucion_esperados) -
              Number(item.ml_producto_esperados) / 1000,
          },
          created_at: item.created_at,
        }
      })
    }
  }

  return readState().tareas.slice().reverse()
}

export async function obtenerTarea(id: string): Promise<TareaOperario | null> {
  const local = readState().tareas.find((tarea) => tarea.id === id)
  if (local) return local

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('tareas')
      .select('*, areas(superficie_m2, litros_solucion_por_m2)')
      .eq('id', id)
      .single()

    if (!error && data) {
      const area = (data as any).areas
      return {
        id: data.id,
        area_id: data.area_id,
        producto_id: data.producto_id,
        nivel_suciedad: data.nivel_suciedad,
        superficie_m2: Number(area?.superficie_m2 ?? 100),
        litros_solucion_por_m2: Number(area?.litros_solucion_por_m2 ?? 0.4),
        receta: {
          litros_solucion: Number(data.litros_solucion_esperados),
          ml_por_litro:
            Number(data.litros_solucion_esperados) > 0
              ? Number(data.ml_producto_esperados) / Number(data.litros_solucion_esperados)
              : 50,
          ml_producto: Number(data.ml_producto_esperados),
          litros_agua:
            Number(data.litros_solucion_esperados) -
            Number(data.ml_producto_esperados) / 1000,
        },
        created_at: data.created_at,
      }
    }
  }

  return null
}

export async function registrarUso(
  input: NuevoRegistro,
): Promise<RegistroUsoOperario> {
  const litrosAgua = Number(input.litros_agua_reales)
  const mlProducto = Number(input.ml_producto_reales)
  const duracion = input.duracion_min !== null && input.duracion_min !== undefined
    ? Number(input.duracion_min)
    : null

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('registros_uso')
      .insert({
        tarea_id: input.tarea_id,
        litros_agua_reales: litrosAgua,
        ml_producto_reales: mlProducto,
        duracion_min: duracion,
        marca: input.marca,
        fuente: input.fuente,
        alerta_sobredosis: input.alerta_sobredosis,
      })
      .select('*')
      .single()

    if (!error && data) {
      const registro: RegistroUsoOperario = {
        id: data.id,
        tarea_id: data.tarea_id,
        litros_agua_reales: Number(data.litros_agua_reales),
        ml_producto_reales: Number(data.ml_producto_reales),
        duracion_min: data.duracion_min !== null ? Number(data.duracion_min) : null,
        marca: data.marca,
        fuente: data.fuente,
        alerta_sobredosis: data.alerta_sobredosis,
        desvio_pct: input.desvio_pct,
        created_at: data.created_at,
      }
      const state = readState()
      state.registros = state.registros.filter((r) => r.id !== registro.id)
      state.registros.push(registro)
      writeState(state)
      return registro
    }
  }

  const state = readState()
  const registro: RegistroUsoOperario = {
    id: createId(),
    created_at: new Date().toISOString(),
    ...input,
    litros_agua_reales: litrosAgua,
    ml_producto_reales: mlProducto,
    duracion_min: duracion,
  }
  state.registros = state.registros.filter((r) => r.id !== registro.id)
  state.registros.push(registro)
  writeState(state)
  return registro
}

export async function obtenerRegistro(
  id: string,
): Promise<RegistroUsoOperario | null> {
  const local = readState().registros.find((registro) => registro.id === id)
  if (local) return local

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('registros_uso')
      .select('*')
      .eq('id', id)
      .single()

    if (!error && data) {
      return {
        id: data.id,
        tarea_id: data.tarea_id,
        litros_agua_reales: data.litros_agua_reales,
        ml_producto_reales: data.ml_producto_reales,
        duracion_min: data.duracion_min,
        marca: data.marca,
        fuente: data.fuente,
        alerta_sobredosis: data.alerta_sobredosis,
        desvio_pct: 0,
        created_at: data.created_at,
      }
    }
  }

  return null
}

export async function guardarResultado(
  input: NuevoResultado,
): Promise<ResultadoOperario> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('resultados')
      .upsert(
        {
          registro_uso_id: input.registro_uso_id,
          cumple_criterio: input.cumple_criterio,
          observaciones: input.observaciones,
        },
        { onConflict: 'registro_uso_id' },
      )
      .select('*')
      .single()

    if (!error && data) {
      const resultado: ResultadoOperario = {
        id: data.id,
        registro_uso_id: data.registro_uso_id,
        cumple_criterio: data.cumple_criterio,
        criterios_evaluados: input.criterios_evaluados,
        observaciones: data.observaciones,
        created_at: data.created_at,
      }
      const state = readState()
      state.resultados = state.resultados.filter(
        (item) => item.registro_uso_id !== input.registro_uso_id,
      )
      state.resultados.push(resultado)
      writeState(state)
      return resultado
    }
  }

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

export async function obtenerResultadoPorRegistro(
  registroId: string,
): Promise<ResultadoOperario | null> {
  const local = readState().resultados.find(
    (resultado) => resultado.registro_uso_id === registroId,
  )
  if (local) return local

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('resultados')
      .select('*')
      .eq('registro_uso_id', registroId)
      .maybeSingle()

    if (!error && data) {
      return {
        id: data.id,
        registro_uso_id: data.registro_uso_id,
        cumple_criterio: data.cumple_criterio,
        criterios_evaluados: [],
        observaciones: data.observaciones,
        created_at: data.created_at,
      }
    }
  }

  return null
}

export async function guardarDecisionEfluente(
  input: NuevaDecisionEfluente,
): Promise<DecisionEfluenteOperario> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('decisiones_efluente')
      .upsert(
        {
          resultado_id: input.resultado_id,
          orientacion: input.orientacion,
          decision_final: input.decision_final,
          observaciones: input.observaciones,
        },
        { onConflict: 'resultado_id' },
      )
      .select('*')
      .single()

    if (!error && data) {
      const decision: DecisionEfluenteOperario = {
        id: data.id,
        resultado_id: data.resultado_id,
        orientacion: data.orientacion,
        decision_final: data.decision_final as DecisionFinalOperario,
        ph_estimado: input.ph_estimado,
        observaciones: data.observaciones,
        created_at: data.created_at,
      }
      const state = readState()
      state.decisiones = state.decisiones.filter(
        (item) => item.resultado_id !== input.resultado_id,
      )
      state.decisiones.push(decision)
      writeState(state)
      return decision
    }
  }

  const state = readState()
  const decision: DecisionEfluenteOperario = {
    id: createId(),
    created_at: new Date().toISOString(),
    ...input,
  }
  state.decisiones = state.decisiones.filter(
    (item) => item.resultado_id !== input.resultado_id,
  )
  state.decisiones.push(decision)
  writeState(state)
  return decision
}
