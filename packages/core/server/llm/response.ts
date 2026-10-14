import type { Explanation, PreparedContext, ReviewAction } from './contracts.ts'
import {
  containsSecret,
  isObject,
  isText,
  MAX_RESPONSE_BYTES,
} from './context.ts'

const exactKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key))

/** Validación estructural y filtros conservadores; no constituyen verificación semántica completa. */
export function validateExplanation(
  json: string,
  context: PreparedContext,
): Explanation | null {
  if (
    typeof json !== 'string' ||
    new TextEncoder().encode(json).length > MAX_RESPONSE_BYTES
  )
    return null
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return null
  }
  if (
    !isObject(value) ||
    !exactKeys(value, [
      'summary',
      'consumptionAnalysis',
      'recommendation',
      'evidenceIds',
      'limitations',
      'humanReviewRequired',
    ]) ||
    !isText(value.summary) ||
    (value.consumptionAnalysis !== null &&
      !isText(value.consumptionAnalysis)) ||
    value.humanReviewRequired !== true ||
    !isObject(value.recommendation)
  )
    return null

  const recommendation = value.recommendation
  if (
    !exactKeys(recommendation, [
      'action',
      'targetVariantId',
      'text',
      'justification',
    ]) ||
    !context.allowedActions.includes(recommendation.action as ReviewAction) ||
    !isText(recommendation.text) ||
    !isText(recommendation.justification)
  )
    return null
  if (recommendation.action === 'review_variant') {
    if (
      !context.recommendedVariantId ||
      recommendation.targetVariantId !== context.recommendedVariantId
    )
      return null
  } else if (recommendation.targetVariantId !== null) return null

  if (
    !Array.isArray(value.evidenceIds) ||
    !value.evidenceIds.length ||
    value.evidenceIds.length > 40 ||
    new Set(value.evidenceIds).size !== value.evidenceIds.length ||
    !value.evidenceIds.every(
      (reference) =>
        typeof reference === 'string' &&
        Object.hasOwn(context.facts, reference),
    )
  )
    return null
  if (
    !Array.isArray(value.limitations) ||
    !value.limitations.length ||
    value.limitations.length > 8 ||
    !value.limitations.every((limitation) => isText(limitation, 500))
  )
    return null

  const text = [
    value.summary,
    value.consumptionAnalysis ?? '',
    recommendation.text,
    recommendation.justification,
    ...value.limitations,
  ].join('\n')
  if (containsSecret(text) || /<[^>]*>|javascript:/i.test(text)) return null
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  // Se rechazan incluso algunas narraciones ambiguas: los verbos químicos no son acciones admitidas.
  if (
    /\b(?:vierta|vierte|verter|mezcle|mezcla|mezclar|mezclarse|neutralice|neutraliza|neutralizar|agregue|agrega|anada|anade|diluya|diluye|descargue)\b/.test(
      normalized,
    ) ||
    /\b(?:autorizad[oa]s?|certificad[oa]s?|inocu[oa]s?|garantiza|tulsma|iso\s*\d+)\b/.test(
      normalized,
    ) ||
    /(?:estadisticamente significativo|demuestra significacion estadistica|son compatibles|es compatible|compatibilidad demostrada|cumple (?:la )?normativa)/.test(
      normalized,
    )
  )
    return null
  if (
    context.facts['result.sobredosis'] === true &&
    /(?:no hay|sin|no existe) sobredosis/.test(normalized)
  )
    return null
  if (
    context.facts['result.supera_maximo_ficha'] === true &&
    /(?:no supera|dentro de) (?:el )?(?:maximo|rango)/.test(normalized)
  )
    return null
  if (
    context.kind === 'effluent' &&
    context.facts['result.ph_efluente'] === null &&
    /ph (?:del )?efluente (?:es|vale|[=:])\s*\d/.test(normalized)
  )
    return null

  // Solo se permiten literales numéricos ya presentes en los resultados, sin calcular porcentajes nuevos.
  const numbers = new Set(
    value.evidenceIds
      .map((id) => context.facts[id])
      .filter((fact) => typeof fact === 'number'),
  )
  const numericTokens = text.match(/[-+]?\d+(?:[.,]\d+)?(?:e[-+]?\d+)?/gi) ?? []
  if (
    numericTokens.some((token) => !numbers.has(Number(token.replace(',', '.'))))
  )
    return null
  if (text.includes('%') && !value.evidenceIds.includes('result.desvio_pct'))
    return null
  return value as unknown as Explanation
}
