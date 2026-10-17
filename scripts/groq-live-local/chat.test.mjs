import test from 'node:test'
import assert from 'node:assert/strict'
import { createChatResponder, readChatAnswer } from './chat.ts'
import { prepareContext } from '../../packages/core/server/llm/context.ts'

const input = {
  question: '¿Qué sabes?',
  disclosure: 'synthetic',
  context: {
    kind: 'overview',
    result: {
      facts: {
        'PA.incompatibilidades': 'acido',
        'limites.causas': 'No verificadas',
      },
    },
  },
}
const context = prepareContext(input)
test('admite advertencias con mezclar y fuentes existentes sin imponer el esquema de informes', () => {
  const answer = readChatAnswer(
    'No se debe mezclar PA con ácidos. [PA.incompatibilidades]',
    context,
  )
  assert(answer)
  assert.equal(answer.evidence['PA.incompatibilidades'], 'acido')
})
test('las referencias inexistentes generan un aviso, no fuentes fabricadas', () => {
  const answer = readChatAnswer('Revisa este dato [TA.no_existe]', context)
  assert.equal(answer.warnings.length, 1)
  assert.deepEqual(answer.evidence, {})
})
test('rechaza respuestas vacías, secretos y razonamiento incrustado', () => {
  for (const text of [
    '',
    'gsk_' + 'x'.repeat(24),
    '<think>razonamiento</think>',
  ])
    assert.equal(readChatAnswer(text, context), null)
})
test('aclara la categoría genérica otro sin atribuirle todas las sustancias', () => {
  const answer = readChatAnswer('PE figura con otro.', {
    ...context,
    facts: { 'PE.incompatibilidades': 'otro' },
  })
  assert(answer.warnings.some((warning) => warning.includes('No significa')))
})
test('permite conversación general y conocimientos fuera de los hechos operativos con proveedor simulado rotulado', async () => {
  const provider = {
    name: 'unit-chat-only',
    mode: 'simulated',
    countInputTokens: () => 100,
    generate: async () => ({
      json: 'Hola. Dos más dos son 4.',
      usage: { inputTokens: 100, outputTokens: 20 },
    }),
  }
  const result = await createChatResponder(provider, 768)(input)
  assert.equal(result.ok, true)
  assert.equal(result.source, 'simulation')
  assert(result.answer.includes('4'))
})
test('una consulta cancelada no llama al proveedor', async () => {
  let calls = 0
  const provider = {
    name: 'unit-chat-only',
    mode: 'simulated',
    countInputTokens: () => 100,
    generate: async () => {
      calls++
      throw Error('No llamada')
    },
  }
  const result = await createChatResponder(provider, 768)(input, {
    signal: AbortSignal.abort(),
  })
  assert.equal(result.code, 'CANCELLED')
  assert.equal(calls, 0)
})
