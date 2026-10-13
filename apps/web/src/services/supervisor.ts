import {
  effluentDecision as mockEffluentDecision,
  supervisorConsumption as mockConsumption,
  variantComparisons as mockVariantComparisons,
  type ConsumptionRow,
  type EffluentDecision,
  type VariantComparison,
} from './supervisorMock'
import { isSupabaseConfigured, supabase } from './supabase'

/**
 * Consulta y consolida las filas de consumo para el Panel del Supervisor.
 * Si Supabase está disponible, realiza un join entre tareas, registros_uso y áreas;
 * de lo contrario, devuelve los registros de prueba / demostración.
 */
export async function obtenerConsumoSupervisor(): Promise<ConsumptionRow[]> {
  if (isSupabaseConfigured && supabase) {
    const { data: registros, error: regError } = await supabase
      .from('registros_uso')
      .select(`
        id,
        litros_agua_reales,
        ml_producto_reales,
        marca,
        tarea_id,
        tareas (
          id,
          nivel_suciedad,
          area_id,
          areas (
            nombre,
            superficie_m2
          )
        ),
        resultados (
          cumple_criterio
        )
      `)
      .order('created_at', { ascending: false })

    if (!regError && registros && registros.length > 0) {
      const localState = typeof localStorage !== 'undefined'
        ? (() => {
            try {
              return JSON.parse(localStorage.getItem('ecocleaner:operario') || '{}')
            } catch {
              return {}
            }
          })()
        : {}

      return registros.map((reg: any) => {
        const tarea = reg.tareas
        const area = tarea?.areas
        const resultado = reg.resultados
        const cumple = resultado?.cumple_criterio ?? true

        // Buscar tarea guardada localmente para obtener la superficie digitada por el operario
        const localTarea = localState.tareas?.find((t: any) => t.id === reg.tarea_id)
        const superficieReal = localTarea?.superficie_m2 ?? area?.superficie_m2 ?? 100

        return {
          task: `Limpieza ${tarea?.nivel_suciedad ?? 'estándar'}`,
          area: area?.nombre ?? 'Área general',
          surface: Number(superficieReal),
          water: Number(reg.litros_agua_reales),
          product: Number((reg.ml_producto_reales / 1000).toFixed(2)),
          compliance: cumple ? 'Cumple' : 'Revisar',
          source: reg.marca === 'medido' ? 'Medido' : 'Estimado',
        }
      })
    }
  }

  // Fallback transparente a datos locales del operario o simulados
  if (typeof localStorage !== 'undefined') {
    try {
      const s = JSON.parse(localStorage.getItem('ecocleaner:operario') || '{}')
      if (s.registros && s.registros.length > 0) {
        return s.registros.map((reg: any) => {
          const t = s.tareas?.find((x: any) => x.id === reg.tarea_id)
          return {
            task: `Limpieza ${t?.nivel_suciedad ?? 'estándar'}`,
            area: 'Área registrada',
            surface: Number(t?.superficie_m2 ?? 100),
            water: Number(reg.litros_agua_reales),
            product: Number((reg.ml_producto_reales / 1000).toFixed(2)),
            compliance: 'Cumple',
            source: reg.marca === 'medido' ? 'Medido' : 'Estimado',
          }
        })
      }
    } catch {
      // ignorar
    }
  }

  return mockConsumption
}

/**
 * Consulta la última decisión de efluente registrada en el sistema.
 */
export async function obtenerUltimaDecisionEfluente(): Promise<EffluentDecision> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('decisiones_efluente')
      .select(`
        id,
        orientacion,
        decision_final,
        observaciones,
        resultados (
          id,
          registro_uso_id,
          registros_uso (
            tareas (
              areas (
                nombre,
                sitios (
                  nombre
                )
              )
            )
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      const resultado = data.resultados as any
      const registro = resultado?.registros_uso
      const tarea = registro?.tareas
      const area = tarea?.areas
      const sitio = area?.sitios

      const orientacionTexto =
        data.orientacion === 'ajustar'
          ? 'Revisión técnica'
          : data.orientacion === 'gestor'
            ? 'Gestor autorizado'
            : data.orientacion === 'verter'
              ? 'Verter'
              : 'No disponible'

      const decisionTexto =
        data.decision_final === 'gestor'
          ? 'Enviar a gestor'
          : data.decision_final === 'ajustar'
            ? 'Ajuste técnico'
            : data.decision_final === 'verter'
              ? 'Vertido autorizado'
              : 'Pendiente de registro'

      return {
        site: sitio?.nombre ?? 'Planta Norte',
        area: area?.nombre ?? 'Producción A',
        task: 'Lavado de pisos',
        orientation: orientacionTexto as any,
        decision: decisionTexto as any,
        ph: null,
        phOrigin: 'Sin medición analítica final',
        reason: data.observaciones ?? 'Decisión documentada en el flujo de operario.',
      }
    }
  }

  return mockEffluentDecision
}

/**
 * Consulta las comparaciones de variantes registradas.
 */
export async function obtenerComparacionVariantes(): Promise<VariantComparison[]> {
  return mockVariantComparisons
}
