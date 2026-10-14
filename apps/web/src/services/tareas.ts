import type { NivelSuciedad, Orientacion } from '@ecocleaner/schemas'
import type { Receta } from '@ecocleaner/core'
import { isSupabaseConfigured, supabase } from './supabase'

export type EstadoTarea = 'receta_enviada' | 'completada'

export interface TareaOperario {
  id: string
  area_id: string
  producto_id: string
  tipo_tarea?: string
  variante_id?: string
  nivel_suciedad: NivelSuciedad
  superficie_m2: number
  litros_solucion_por_m2: number
  receta: Receta
  estado?: EstadoTarea
  hora_inicio?: string | null
  tiempo_estimado_min?: number | null
  operario_id?: string | null
  revisor_id?: string | null
  validada_en?: string | null
  created_at: string
}

export interface RegistroUsoOperario {
  id: string
  tarea_id: string
  variante_id?: string | null
  litros_agua_reales: number
  ml_producto_reales: number
  duracion_min: number | null
  marca: 'medido' | 'estimado'
  fuente: 'manual' | 'simulada' | 'sensor'
  alerta_sobredosis: boolean
  desvio_pct: number
  validado_por?: string | null
  validado_en?: string | null
  declarado_operario?: {
    litros_agua_reales: number
    ml_producto_reales: number
    corregido_en?: string
  } | null
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
  tipo_tarea?: string
  variante_id?: string
  nivel_suciedad: NivelSuciedad
  superficie_m2: number
  litros_solucion_por_m2: number
  receta: Receta
  estado?: EstadoTarea
  hora_inicio?: string
  tiempo_estimado_min?: number
  operario_id?: string
}

export interface NuevoRegistro {
  tarea_id: string
  variante_id?: string | null
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

export interface ValidarTareaInput {
  tarea_id: string
  revisor_id: string
  litros_agua_reales: number
  ml_producto_reales: number
  marca: 'medido' | 'estimado'
  fuente?: 'manual' | 'simulada' | 'sensor'
  declarado_operario?: any
  cumple_criterio: boolean
  criterios_evaluados: { criterio: string; cumple: boolean }[]
  observaciones_criterio?: string | null
  orientacion: Orientacion
  decision_final: DecisionFinalOperario
  ph_estimado?: number | null
  observaciones_efluente?: string | null
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
  const superficieNum = Number(input.superficie_m2) || 100
  const litrosPorM2Num = Number(input.litros_solucion_por_m2) || 0.4
  const tipoTareaStr = input.tipo_tarea?.trim() || 'Lavado de pisos'
  const estadoStr: EstadoTarea = input.estado ?? 'receta_enviada'
  const horaInicioStr = input.hora_inicio ?? new Date().toISOString()
  const tiempoEstimadoNum = input.tiempo_estimado_min ?? 30

  if (isSupabaseConfigured && supabase) {
    const insertPayload: any = {
      area_id: input.area_id,
      producto_id: input.producto_id,
      nivel_suciedad: input.nivel_suciedad,
      litros_solucion_esperados: input.receta.litros_solucion,
      ml_producto_esperados: input.receta.ml_producto,
      estado: estadoStr,
      hora_inicio: horaInicioStr,
      tiempo_estimado_min: tiempoEstimadoNum,
    }
    if (input.operario_id) {
      insertPayload.operario_id = input.operario_id
    }

    const { data, error } = await supabase
      .from('tareas')
      .insert(insertPayload)
      .select('*')
      .single()

    if (!error && data) {
      let varianteId: string | undefined = undefined
      try {
        const { data: varData } = await supabase
          .from('variantes')
          .insert({
            tarea_id: data.id,
            nombre: tipoTareaStr,
            dilucion_ml_por_litro: Number(input.receta.ml_por_litro) || 50,
            repeticiones: Math.round(superficieNum) || 1,
          })
          .select('id')
          .single()
        if (varData?.id) {
          varianteId = varData.id
        }
      } catch (err) {
        console.warn('Error al registrar variante en Supabase:', err)
      }

      const tareaMapeada: TareaOperario = {
        id: data.id,
        area_id: data.area_id,
        producto_id: data.producto_id,
        tipo_tarea: tipoTareaStr,
        variante_id: varianteId,
        nivel_suciedad: data.nivel_suciedad,
        superficie_m2: superficieNum,
        litros_solucion_por_m2: litrosPorM2Num,
        receta: input.receta,
        estado: (data.estado as EstadoTarea) ?? estadoStr,
        hora_inicio: data.hora_inicio ?? horaInicioStr,
        tiempo_estimado_min: data.tiempo_estimado_min ?? tiempoEstimadoNum,
        operario_id: data.operario_id ?? input.operario_id ?? null,
        revisor_id: data.revisor_id ?? null,
        validada_en: data.validada_en ?? null,
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
    tipo_tarea: tipoTareaStr,
    superficie_m2: superficieNum,
    litros_solucion_por_m2: litrosPorM2Num,
    estado: estadoStr,
    hora_inicio: horaInicioStr,
    tiempo_estimado_min: tiempoEstimadoNum,
    operario_id: input.operario_id ?? null,
    revisor_id: null,
    validada_en: null,
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
      .select('*, areas(superficie_m2, litros_solucion_por_m2), variantes(id, nombre, repeticiones)')
      .order('created_at', { ascending: false })

    if (!error && data && data.length > 0) {
      // Reconciliar con recetas guardadas en memoria local si las hay
      const localState = readState()
      return data.map((item: any) => {
        const local = localState.tareas.find((t) => t.id === item.id)
        if (local) return local
        const area = item.areas
        const variante = Array.isArray(item.variantes) && item.variantes.length > 0 ? item.variantes[0] : null
        const litEsp = Number(item.litros_solucion_esperados)
        const litPorM2 = Number(area?.litros_solucion_por_m2 ?? 0.4)
        const supCalc = litEsp > 0 && litPorM2 > 0 ? Math.round((litEsp / litPorM2) * 10) / 10 : null
        const sup = (variante?.repeticiones && Number(variante.repeticiones) > 0 ? Number(variante.repeticiones) : null) ?? supCalc ?? Number(area?.superficie_m2 ?? 100)
        return {
          id: item.id,
          area_id: item.area_id,
          producto_id: item.producto_id,
          tipo_tarea: variante?.nombre ?? undefined,
          variante_id: variante?.id ?? undefined,
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
          estado: (item.estado as EstadoTarea) ?? 'receta_enviada',
          hora_inicio: item.hora_inicio ?? item.created_at,
          tiempo_estimado_min: item.tiempo_estimado_min ?? 30,
          operario_id: item.operario_id ?? null,
          revisor_id: item.revisor_id ?? null,
          validada_en: item.validada_en ?? null,
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
      .select('*, areas(superficie_m2, litros_solucion_por_m2), variantes(id, nombre, repeticiones)')
      .eq('id', id)
      .single()

    if (!error && data) {
      const area = (data as any).areas
      const variante = Array.isArray((data as any).variantes) && (data as any).variantes.length > 0
        ? (data as any).variantes[0]
        : null
      const litEsp = Number(data.litros_solucion_esperados)
      const litPorM2 = Number(area?.litros_solucion_por_m2 ?? 0.4)
      const supCalc = litEsp > 0 && litPorM2 > 0 ? Math.round((litEsp / litPorM2) * 10) / 10 : null
      const sup = (variante?.repeticiones && Number(variante.repeticiones) > 0 ? Number(variante.repeticiones) : null) ?? supCalc ?? Number(area?.superficie_m2 ?? 100)
      return {
        id: data.id,
        area_id: data.area_id,
        producto_id: data.producto_id,
        tipo_tarea: variante?.nombre ?? undefined,
        variante_id: variante?.id ?? undefined,
        nivel_suciedad: data.nivel_suciedad,
        superficie_m2: sup,
        litros_solucion_por_m2: litPorM2,
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
        estado: (data.estado as EstadoTarea) ?? 'receta_enviada',
        hora_inicio: data.hora_inicio ?? data.created_at,
        tiempo_estimado_min: data.tiempo_estimado_min ?? 30,
        operario_id: data.operario_id ?? null,
        revisor_id: data.revisor_id ?? null,
        validada_en: data.validada_en ?? null,
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
        variante_id: input.variante_id || null,
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
          ph_estimado: input.ph_estimado,
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

export async function obtenerRegistroPorTarea(
  tareaId: string,
): Promise<RegistroUsoOperario | null> {
  const local = readState().registros.find((registro) => registro.tarea_id === tareaId)
  if (local) return local

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('registros_uso')
      .select('*')
      .eq('tarea_id', tareaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      return {
        id: data.id,
        tarea_id: data.tarea_id,
        variante_id: data.variante_id,
        litros_agua_reales: Number(data.litros_agua_reales),
        ml_producto_reales: Number(data.ml_producto_reales),
        duracion_min: data.duracion_min !== null ? Number(data.duracion_min) : null,
        marca: data.marca,
        fuente: data.fuente,
        alerta_sobredosis: Boolean(data.alerta_sobredosis),
        desvio_pct: 0,
        validado_por: data.validado_por ?? null,
        validado_en: data.validado_en ?? null,
        declarado_operario: data.declarado_operario ?? null,
        created_at: data.created_at,
      }
    }
  }

  return null
}

export async function validarTareaTransaccional(
  input: ValidarTareaInput,
): Promise<{ ok: boolean; error?: string }> {
  const nowIso = new Date().toISOString()

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.rpc('validar_tarea_transaccional', {
        p_tarea_id: input.tarea_id,
        p_litros_agua: input.litros_agua_reales,
        p_ml_producto: input.ml_producto_reales,
        p_marca: input.marca,
        p_fuente: input.fuente || 'manual',
        p_declarado_original: input.declarado_operario ?? null,
        p_cumple_criterio: input.cumple_criterio,
        p_criterios_evaluados: input.criterios_evaluados,
        p_observaciones_resultado: input.observaciones_criterio ?? null,
        p_orientacion: input.orientacion,
        p_decision_final: input.decision_final,
        p_ph_estimado: input.ph_estimado ?? null,
        p_observaciones_efluente: input.observaciones_efluente ?? null,
      })

      if (error) {
        console.warn('RPC validar_tarea_transaccional en Supabase:', error.message)
      }
    } catch (rpcErr: any) {
      console.warn('Excepción en RPC Supabase validar_tarea_transaccional:', rpcErr?.message)
    }
  }

  // Actualizar la persistencia local/cache
  const state = readState()
  let reg = state.registros.find((r) => r.tarea_id === input.tarea_id)
  if (!reg) {
    reg = {
      id: createId(),
      tarea_id: input.tarea_id,
      litros_agua_reales: input.litros_agua_reales,
      ml_producto_reales: input.ml_producto_reales,
      duracion_min: 30,
      marca: input.marca,
      fuente: input.fuente || 'manual',
      alerta_sobredosis: false,
      desvio_pct: 0,
      validado_por: input.revisor_id,
      validado_en: nowIso,
      declarado_operario: input.declarado_operario ?? null,
      created_at: nowIso,
    }
    state.registros.push(reg)
  } else {
    reg.litros_agua_reales = input.litros_agua_reales
    reg.ml_producto_reales = input.ml_producto_reales
    reg.marca = input.marca
    reg.validado_por = input.revisor_id
    reg.validado_en = nowIso
    if (input.declarado_operario) {
      reg.declarado_operario = input.declarado_operario
    }
  }

  // Upsert resultado
  const resultadoId = createId()
  state.resultados = state.resultados.filter((r) => r.registro_uso_id !== reg!.id)
  state.resultados.push({
    id: resultadoId,
    registro_uso_id: reg.id,
    cumple_criterio: input.cumple_criterio,
    criterios_evaluados: input.criterios_evaluados,
    observaciones: input.observaciones_criterio ?? null,
    created_at: nowIso,
  })

  // Upsert decision efluente
  state.decisiones = state.decisiones.filter((d) => d.resultado_id !== resultadoId)
  state.decisiones.push({
    id: createId(),
    resultado_id: resultadoId,
    orientacion: input.orientacion,
    decision_final: input.decision_final,
    ph_estimado: input.ph_estimado ?? null,
    observaciones: input.observaciones_efluente ?? null,
    created_at: nowIso,
  })

  // Actualizar estado de la tarea a 'completada'
  const t = state.tareas.find((item) => item.id === input.tarea_id)
  if (t) {
    t.estado = 'completada'
    t.revisor_id = input.revisor_id
    t.validada_en = nowIso
  }

  writeState(state)
  return { ok: true }
}

