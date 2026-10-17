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

/** La ausencia de conflictos no acredita compatibilidad; se admiten límites explícitos. */
export function hasUnsupportedCompatibilityClaim(normalized: string): boolean {
  const claims = normalized.matchAll(
    /\b(?:(?:son|es|se considera[n]?|resulta[n]?) compatibles?|(?:productos?|pares?|combinaciones?|sustancias?) compatibles?|compatibles? (?:son|entre)|compatibilidad (?:demostrada|confirmada|garantizada))\b/g,
  )
  return [...claims].some((match) => {
    const before =
      normalized
        .slice(Math.max(0, match.index! - 150), match.index)
        .split(/[;.!?\n]|\b(?:pero|sin embargo|por tanto|por lo que)\b/)
        .at(-1) ?? ''
    return !/(?:\bno (?:puedo|podemos|se puede|es posible) (?:confirmar|asegurar|afirmar|identificar|determinar)(?: (?:que|cuales|si))?(?: (?:los |las )?(?:productos?|pares?|combinaciones?|sustancias?))?(?: p[a-z]{1,3}(?: y p[a-z]{1,3})?)?|\b(?:sin|no hay|falta) (?:evidencia|prueba|evidencias|pruebas)(?: de)?(?: que)?|\bno (?:hay|existe) (?:una )?)\s*$/.test(
      before,
    )
  })
}

/** Filtros compartidos por el análisis y las explicaciones generales de química. */
export function hasChemicalSafetyViolation(normalized: string): boolean {
  return (
    /\b(?:vierta|vierte|verter|vertir|mezcle|mezcla|mezclar|mezclarse|neutralice|neutraliza|neutralizar|agregue|agrega|anada|anade|diluya|diluye|descargue)\b/.test(
      normalized,
    ) ||
    /\b(?:autorizad[oa]s?|certificad[oa]s?|inocu[oa]s?|garantiza|tulsma|iso\s*\d+)\b/.test(
      normalized,
    ) ||
    /(?:estadisticamente significativo|demuestra significacion estadistica|cumple (?:la )?normativa)/.test(
      normalized,
    ) ||
    hasUnsupportedCompatibilityClaim(normalized)
  )
}

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
  if (hasChemicalSafetyViolation(normalized)) return null
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
  if (
    text.includes('%') &&
    !value.evidenceIds.some(
      (key) =>
        key === 'result.desvio_pct' ||
        (context.kind === 'overview' &&
          /(?:desvio_pct|porcentaje)(?:_redondeado)?$/.test(key)),
    )
  )
    return null
  if (context.kind === 'overview') {
    if (/\b(?:tarea|producto|variante|area|registro)\s+\d+\b/.test(normalized))
      return null
    if (
      Number(context.facts['alertas.sobredosis']) > 0 &&
      /(?:no hay|sin|no existe) sobredosis/.test(normalized)
    )
      return null
    // El contexto combinado no contiene causas verificadas del consumo.
    if (
      /(?:causa (?:probable|principal)|se debe a|debido a|por descuido|por negligencia)/.test(
        normalized,
      )
    )
      return null
  }
  return value as unknown as Explanation
}
