/** Solo metadatos estructurales; nunca guarda texto fallido ni razonamiento. */
export function describeFormatFailure(value) {
  if (typeof value !== 'string' || value.length > 32000) return null
  const output = {
    bytes: new TextEncoder().encode(value).length,
    jsonParseable: false,
    endsWithObject: value.trimEnd().endsWith('}'),
    expectedRootFields: false,
    summaryIsText: false,
    evidenceIsArray: false,
    limitationsIsArray: false,
    recommendationIsObject: false,
  }
  try {
    const parsed = JSON.parse(value)
    output.jsonParseable = true
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return output
    const required = [
      'summary',
      'consumptionAnalysis',
      'recommendation',
      'evidenceIds',
      'limitations',
      'humanReviewRequired',
    ]
    output.expectedRootFields =
      Object.keys(parsed).length === required.length &&
      required.every((key) => Object.hasOwn(parsed, key))
    output.summaryIsText = typeof parsed.summary === 'string'
    output.evidenceIsArray = Array.isArray(parsed.evidenceIds)
    output.limitationsIsArray = Array.isArray(parsed.limitations)
    output.recommendationIsObject =
      !!parsed.recommendation &&
      typeof parsed.recommendation === 'object' &&
      !Array.isArray(parsed.recommendation)
  } catch {
    /* La estructura incompleta queda identificada sin copiar su contenido. */
  }
  return output
}
