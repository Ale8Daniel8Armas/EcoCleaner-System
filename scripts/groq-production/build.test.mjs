import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createProductionHandler } from '../../apps/web/server/llm-production.mjs'

const origin = 'https://eco-cleaner-system.vercel.app'

test('el entrypoint de Vercel carga el backend compilado y permanece cerrado', async () => {
  const previous = process.env.LLM_PRODUCTION_ENABLED
  process.env.LLM_PRODUCTION_ENABLED = 'false'
  try {
    const entry = await import('../../apps/web/api/app/[action].ts')
    const response = await entry.default.fetch(
      new Request(origin + '/api/app/state'),
    )
    assert.equal(response.status, 503)
    assert.equal((await response.json()).code, 'PRODUCTION_NOT_CONFIGURED')
  } finally {
    if (previous === undefined) delete process.env.LLM_PRODUCTION_ENABLED
    else process.env.LLM_PRODUCTION_ENABLED = previous
  }
})

test('el backend compilado recupera estado simulado sin transporte externo', async () => {
  let calls = 0
  const handler = createProductionHandler(
    {
      LLM_PRODUCTION_ENABLED: 'true',
      LLM_EXTERNAL_CALLS_APPROVED: 'true',
      LLM_ALLOWED_ORIGIN: origin,
      GROQ_API_KEY: 'fake-build-test',
    },
    {
      store: {
        identity: async () => '10000000-0000-4000-8000-000000000001',
        state: async () => ({ usedTokenBudget: 78635, generations: 33 }),
      },
      transport: async () => {
        calls++
        throw new Error(
          'El transporte externo está deshabilitado en esta prueba',
        )
      },
    },
  )
  const response = await handler(
    new Request(origin + '/api/app/state', {
      headers: { Authorization: 'Bearer ' + 'a'.repeat(40) },
    }),
  )
  assert.equal(response.status, 200)
  assert.equal((await response.json()).usedTokenBudget, 78635)
  assert.equal(calls, 0)
})
