import type { DemoExplanation, ExplainerInput } from './contracts'
import { DEMO_QUESTIONS, explainDemo } from './explainDemo'
import type { DemoQuestionId } from './explainDemo'
import { DEMO_ERROR } from './view'

export const MAX_DEMO_QUESTION_LENGTH = 500
export const UNSUPPORTED_DEMO_QUESTION =
  'Esta pregunta no está disponible en el modo demostración. Puedes consultar tareas, consumos, desvíos, variantes, limpieza o efluentes.'

const normalize = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const rules: Record<DemoQuestionId, (text: string) => boolean> = {
  period: (text) =>
    /\b(resumen|balance|consumos?)\b|\bcomo vamos\b|\bestado de (?:las )?tareas\b|\bcuant[oa] (agua|producto)\b|\bcuantas tareas (hay|tenemos|completadas|pendientes)\b/.test(
      text,
    ),
  deviation: (text) =>
    /\bareas?\b.*\b(desvios?|desviacion(?:es)?)\b|\b(desvios?|desviacion(?:es)?)\b.*\bareas?\b/.test(
      text,
    ),
  overdose: (text) =>
    /\bsobredosis\b|\bexceso de (dosis|producto)\b|\b(sobre|supera\w*|encima|exced\w*)\b.*\b(maximo|limite|ficha)\b/.test(
      text,
    ),
  recommended: (text) =>
    /\bvariantes?\b/.test(text) &&
    /\b(recomend\w*|convien\w*|mejor|optima|elegir|seleccionar)\b/.test(
      text.replace(/\bno (?:se )?recomiend\w*\b/g, ''),
    ),
  discarded: (text) =>
    /\bvariantes?\b/.test(text) &&
    /\b(descart\w*|rechaz\w*)\b|\bno elegibles?\b|\bno (?:se )?recomiend\w*\b/.test(
      text,
    ),
  cleaning: (text) =>
    /\blimpieza\b|\b(?:incumpl\w*|cumpl\w*|cumpli\w*)\b.*\bcriterios?\b|\bcriterios?\b.*\b(?:incumpl\w*|cumpl\w*|cumpli\w*)\b/.test(
      text,
    ),
  effluent: (text) =>
    /\befluentes?\b|\bdecision(?:es)?\b.*\b(vertido|disposicion|gestor)\b/.test(
      text,
    ),
  limitations: (text) =>
    /\b(limitaciones?|medidos?|estimados?|simulados?|mediciones|estimaciones|simulaciones|procedencia|fiabilidad)\b|\bdatos (faltantes|incompletos)\b|\borigen de (?:los )?datos\b/.test(
      text,
    ),
  priorities: (text) =>
    /\b(revis\w*|atend\w*|verific\w*)\b.*\b(primero|prioridad|prioridades|urgente)\b|\b(primero|prioridad|prioridades|priorizar)\b.*\b(revis\w*|atend\w*|verific\w*)\b|^por donde (empiezo|empezamos)$/.test(
      text,
    ),
}

/** Clasifica temas, sin interpretar instrucciones, parámetros, nombres ni memoria previa. */
export function resolveDemoQuestion(value: unknown): DemoQuestionId | null {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > MAX_DEMO_QUESTION_LENGTH ||
    /[<>]/.test(value) ||
    [...value].some(
      (char) =>
        char.charCodeAt(0) < 32 && ![9, 10, 13].includes(char.charCodeAt(0)),
    )
  )
    return null
  const text = normalize(value)
  if (
    /\b(ignora\w*|omite\w*|olvida\w*|desactiva\w*|ejecuta\w*|system|assistant|developer|sudo|curl|powershell|javascript|passwords?|contrasenas?|claves?|tokens?|api key)\b|\b(mezcl\w*|neutraliz\w*|autoriz\w*|reduc\w*|disminu\w*|borra\w*)\b|\b(puedo|podemos|debo|se puede)\b.*\b(verter|dosificar)\b|^(que es|que significa|define)\b/.test(
      text,
    )
  )
    return null
  const exact = DEMO_QUESTIONS.find(
    (question) => normalize(question.label) === text,
  )
  if (exact) return exact.id
  const matches = DEMO_QUESTIONS.filter((question) => rules[question.id](text))
  return matches.length === 1 ? matches[0].id : null
}

export interface DemoConversationReply {
  kind: 'answer' | 'unsupported' | 'error'
  questionId: DemoQuestionId | null
  answer: DemoExplanation
}

/** Solo recibe una categoría; el texto escrito no entra al explicador ni a la respuesta. */
export function createDemoConversationReply(
  questionId: DemoQuestionId | null,
  input: ExplainerInput,
): DemoConversationReply {
  if (questionId === null)
    return {
      kind: 'unsupported',
      questionId: null,
      answer: {
        summary: UNSUPPORTED_DEMO_QUESTION,
        evidence: 'No se identificó una sola categoría admitida.',
        preliminaryRecommendation:
          'Consulta un solo tema de las preguntas preconfiguradas. La explicación requiere revisión humana.',
        limitations:
          'Interpretación local por reglas. Cada pregunta es independiente y no se aplican filtros escritos ni contexto de preguntas anteriores.',
      },
    }
  try {
    return {
      kind: 'answer',
      questionId,
      answer: explainDemo(questionId, input),
    }
  } catch {
    return {
      kind: 'error',
      questionId: null,
      answer: {
        summary: DEMO_ERROR,
        evidence: 'No fue posible interpretar los datos cargados.',
        preliminaryRecommendation:
          'Revisa los registros desde las vistas habituales con el responsable.',
        limitations:
          'No se generó una explicación válida. Requiere revisión humana.',
      },
    }
  }
}
