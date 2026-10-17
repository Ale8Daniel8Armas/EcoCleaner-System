import test from 'node:test'
import assert from 'node:assert/strict'
import { describeFormatFailure } from './format-diagnostics.mjs'
test('los diagnósticos no conservan el contenido privado de una generación fallida', () => {
  const value = JSON.stringify({
    summary: 'PRIVATE-CONTENT',
    consumptionAnalysis: null,
    recommendation: {},
    evidenceIds: [],
    limitations: [],
    humanReviewRequired: true,
  })
  const diagnostic = describeFormatFailure(value)
  assert.equal(diagnostic.jsonParseable, true)
  assert.equal(diagnostic.expectedRootFields, true)
  assert(!JSON.stringify(diagnostic).includes('PRIVATE-CONTENT'))
})
test('detecta JSON incompleto sin convertirlo en una respuesta', () => {
  const diagnostic = describeFormatFailure('{"summary":"texto incompleto')
  assert.equal(diagnostic.jsonParseable, false)
  assert.equal(diagnostic.endsWithObject, false)
})
test('rechaza valores ausentes o excesivos y solo informa tipos previstos', () => {
  assert.equal(describeFormatFailure(undefined), null)
  assert.equal(describeFormatFailure('x'.repeat(32001)), null)
  assert.equal(
    describeFormatFailure('{"evidenceIds":"wrong"}').evidenceIsArray,
    false,
  )
})
