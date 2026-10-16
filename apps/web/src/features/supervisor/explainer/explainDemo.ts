import type { DemoExplanation, ExplainerInput } from './contracts'
import { createReferenceFormatter } from './references'

export const DEMO_NOTICE =
  'Modo demostración: respuestas preconfiguradas a partir de los datos calculados. Explicación preliminar, requiere revisión humana.'
export const DEMO_QUESTIONS = [
  { id: 'period', label: 'Resumen del periodo' },
  {
    id: 'deviation',
    label: '¿Qué área presenta mayor desvío frente a la receta?',
  },
  {
    id: 'overdose',
    label:
      '¿Hubo sobredosis o valores sobre el máximo de la ficha? ¿En qué tareas?',
  },
  { id: 'recommended', label: '¿Qué variante se recomienda y por qué?' },
  { id: 'discarded', label: '¿Qué variantes se descartan y por qué?' },
  {
    id: 'cleaning',
    label: '¿Cuántas tareas no cumplieron el criterio de limpieza?',
  },
  { id: 'effluent', label: '¿Qué decisiones de efluente se registraron?' },
  { id: 'limitations', label: '¿Qué limitaciones tienen estos datos?' },
  { id: 'priorities', label: '¿Qué debería revisar primero?' },
] as const
export type DemoQuestionId = (typeof DEMO_QUESTIONS)[number]['id']
const insufficient = 'No hay datos suficientes para responder'
const review =
  'Verificar la ficha técnica y solicitar al responsable la revisión del procedimiento. Toda recomendación es preliminar y requiere revisión humana.'
const decisionText = {
  verter:
    'Se registró una decisión de vertido; esta explicación no lo autoriza ni valida.',
  ajustar:
    'Se registró una decisión de revisión o ajuste técnico; requiere responsable competente.',
  reutilizar:
    'Se registró una decisión de reutilización; requiere revisión humana de las condiciones.',
  gestor: 'Se registró una decisión de envío a gestor.',
} as const

export function explainDemo(
  questionId: DemoQuestionId,
  input: ExplainerInput,
): DemoExplanation {
  const show = createReferenceFormatter(input)
  const answer: DemoExplanation = {
    summary: insufficient,
    evidence: 'No hay evidencia suficiente en las tareas cargadas.',
    preliminaryRecommendation: review,
    limitations: input.limitations.join('\n'),
  }
  if (!DEMO_QUESTIONS.some((q) => q.id === questionId))
    throw new Error('Pregunta no disponible.')
  const origin =
    input.origin === 'supabase'
      ? 'Origen: lectura de Supabase.'
      : 'Origen: almacenamiento local del navegador.'
  const insufficientFor = (missing: string) => {
    answer.limitations += `\nInformación faltante: ${missing}.`
  }
  switch (questionId) {
    case 'period':
      answer.summary = `Tareas completadas: ${input.completed}. Tareas pendientes: ${input.pending}. Estado desconocido: ${input.unknownState}.`
      answer.evidence = `Consumo declarado: ${input.declared.waterL} L de agua y ${input.declared.productMl} ml de producto, en ${input.declared.tasks} tareas con consumo final unívoco.\nReceta registrada: ${input.expected.waterL} L de agua y ${input.expected.productMl} ml de producto, en ${input.expected.tasks} tareas.\nBase común de ${input.paired.tasks} tareas: declarado ${input.paired.declaredWaterL} L de agua y ${input.paired.declaredProductMl} ml de producto; esperado ${input.paired.expectedWaterL} L de agua y ${input.paired.expectedProductMl} ml de producto.`
      if (!input.completed && !input.pending) {
        answer.summary = insufficient
        insufficientFor('tareas con estado reconocido')
      }
      break
    case 'deviation':
      if (input.areas.length) {
        answer.summary =
          'Mayor desvío absoluto de concentración observado dentro de cada grupo comparable; se conserva el signo del desvío.'
        answer.evidence = input.areas
          .map(
            (g) =>
              `${g.group}: ${g.winners.map((w) => `${show(w.area)}: ${w.deviationPct} %`).join('; ')}.`,
          )
          .join('\n')
      } else
        insufficientFor(
          'mediciones no simuladas de distintas áreas con el mismo producto, suciedad y dosis de receta',
        )
      break
    case 'overdose':
      if (input.alerts.length) {
        answer.summary =
          'Se encontraron alertas documentadas o calculadas por core.'
        answer.evidence = input.alerts
          .map(
            (a) =>
              `${show(a.task)}, ${show(a.record, a.task)}: ${[a.overdose ? 'sobredosis calculada' : '', a.aboveMaximum ? 'supera el máximo de ficha' : '', a.recorded ? 'alerta registrada' : ''].filter(Boolean).join('; ')}.`,
          )
          .join('\n')
      } else if (input.deviations.length) {
        answer.summary =
          'No se detectaron alertas en los registros que pudieron evaluarse con core.'
        answer.evidence = input.deviations
          .map(
            (d) =>
              `${show(d.task)}, ${show(d.record, d.task)}: desvío ${d.result.desvio_pct} %.`,
          )
          .join('\n')
      } else
        insufficientFor(
          'receta, consumo válido y máximo de ficha, o alertas registradas',
        )
      answer.limitations +=
        '\nLos registros sin cálculo válido no acreditan ausencia de sobredosis. No se propone una dosificación correctiva.'
      break
    case 'recommended':
      if (input.comparisons.length) {
        answer.summary =
          'La selección observacional corresponde exclusivamente al resultado de compararVariantes por tarea.'
        answer.evidence = input.comparisons
          .map(
            (c) =>
              `${show(c.task)}: ${c.result.recomendada ? show(c.result.recomendada, c.task) : 'sin variante recomendada'}. ${c.result.motivo}`,
          )
          .join('\n')
        answer.preliminaryRecommendation = `Revisar la evidencia de la variante seleccionada antes de cualquier decisión operativa. ${review}`
      } else
        insufficientFor(
          'variantes vinculadas a una misma tarea, consumos, ficha técnica y evaluaciones de limpieza',
        )
      break
    case 'discarded': {
      const rejected = input.comparisons.flatMap((c) =>
        c.result.resumen
          .filter((v) => !v.elegible)
          .map(
            (v) =>
              `${show(c.task)}, ${show(v.variante_id, c.task)}: ${v.motivo}`,
          ),
      )
      if (rejected.length) {
        answer.summary = 'Variantes no elegibles según compararVariantes.'
        answer.evidence = rejected.join('\n')
      } else if (input.comparisons.length) {
        answer.summary =
          'No hay variantes descartadas en las comparaciones disponibles.'
        answer.evidence = input.comparisons
          .map((c) => `${show(c.task)}: ${c.result.motivo}`)
          .join('\n')
      } else
        insufficientFor(
          'una comparación válida del core con variantes y registros vinculados',
        )
      break
    }
    case 'cleaning':
      if (input.completed) {
        answer.summary = `Tareas con incumplimiento registrado: ${input.cleaning.failedCount}. Tareas sin evaluación completa: ${input.cleaning.unknownCount}.`
        answer.evidence = input.cleaning.failed.length
          ? input.cleaning.failed.map((task) => show(task)).join('\n')
          : 'No se registraron incumplimientos en las evaluaciones disponibles.'
        answer.limitations +=
          '\nUna evaluación ausente no equivale a cumplimiento. Una tarea con alguna repetición incumplida se cuenta una sola vez.'
      } else insufficientFor('tareas completadas y resultados de limpieza')
      break
    case 'effluent':
      if (input.effluent.length) {
        answer.summary =
          'Decisiones registradas, sin autorización química o ambiental emitida por el explicador.'
        answer.evidence = input.effluent
          .map(
            (e) =>
              `${show(e.task)}, ${show(e.record, e.task)}: ${decisionText[e.decision]}`,
          )
          .join('\n')
      } else
        insufficientFor(
          'decisiones de efluente vinculadas a resultados de tareas completadas',
        )
      answer.limitations +=
        '\nLas decisiones históricas no demuestran cumplimiento ambiental ni autorización de disposición.'
      break
    case 'limitations': {
      const p = input.provenance
      answer.summary = input.hasSimulation
        ? 'Hay datos simulados o un catálogo de referencia simulado.'
        : 'La evidencia describe registros declarados; no equivale a verificación independiente.'
      answer.evidence = `Registros de tareas completadas: ${p.total}. Medidos no simulados: ${p.measured}. Estimados no simulados: ${p.estimated}. Simulados: ${p.simulated}. Procedencia desconocida: ${p.unknown}.`
      if (p.measuredPct !== null && p.estimatedPct !== null)
        answer.evidence += `\nProporción medida: ${p.measuredPct} %. Proporción estimada: ${p.estimatedPct} %. Las categorías son excluyentes; los simulados se cuentan por separado.`
      if (!p.total) {
        answer.summary = insufficient
        insufficientFor('registros de consumo con procedencia')
      }
      break
    }
    case 'priorities': {
      const priorities = [
        ...input.alerts.map(
          (a) =>
            `Alerta documentada: ${show(a.task)}, ${show(a.record, a.task)}.`,
        ),
        ...input.cleaning.failed.map(
          (t) => `Incumplimiento de limpieza: ${show(t)}.`,
        ),
        ...input.pendingEffluent.map(
          (t) => `Decisión de efluente no disponible: ${show(t)}.`,
        ),
        ...input.incomplete.map((t) => `Registro incompleto: ${show(t)}.`),
      ]
      if (priorities.length) {
        answer.summary =
          'Orden de revisión: alertas documentadas, incumplimientos, decisiones de efluente no disponibles y registros incompletos.'
        answer.evidence = [...new Set(priorities)].join('\n')
      } else if (input.completed) {
        answer.summary =
          'No se identificaron prioridades adicionales en la evidencia cargada.'
        answer.evidence =
          'Sin alertas documentadas, incumplimientos ni registros incompletos identificados.'
      } else
        insufficientFor(
          'tareas completadas y evidencia que sustente una prioridad',
        )
      break
    }
  }
  answer.limitations = `${origin}\n${answer.limitations}`
  return answer
}
