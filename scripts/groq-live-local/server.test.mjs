import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { createEvaluationCases } from '../../packages/core/server/llm/testing/evaluation-cases.ts'
import { GROQ_MODEL } from '../../packages/core/server/llm/groq.ts'
import {
  createLocalSession,
  preflightGroq,
  validateAccount,
} from './session.mjs'
import { createLocalServer } from './server.mjs'

// Proveedores simulados exclusivos de pruebas de infraestructura. No acreditan Groq real.
const key = 'unit-test-key-without-a-real-provider'
const account = (patch = {}) => ({
  model: GROQ_MODEL,
  freeTierConfirmedAt: new Date().toISOString(),
  limits: {
    requestsPerMinute: 10,
    requestsPerDay: 100,
    tokensPerMinute: 100_000,
    tokensPerDay: 1_000_000,
  },
  authorizedTokenBudget: 100_000,
  maxGenerations: 11,
  syntheticOnly: true,
  ...patch,
})
const question = {
  scenarioId: 'LLM-01',
  question:
    'Describe los valores disponibles y lo que falta para interpretarlos.',
}
const modelReply = createEvaluationCases()[0].simulatedResponse
const providerResponse = (content = JSON.stringify(modelReply), status = 200) =>
  new Response(
    JSON.stringify({
      id: 'unit-only-completion',
      model: GROQ_MODEL,
      choices: [
        { finish_reason: 'stop', message: { role: 'assistant', content } },
      ],
      usage: { prompt_tokens: 30, completion_tokens: 40, total_tokens: 70 },
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
async function temporary(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'ecocleaner-groq-unit-'))
  t.after(async () => {
    const target = path.resolve(directory)
    if (
      path.dirname(target) !== path.resolve(tmpdir()) ||
      !path.basename(target).startsWith('ecocleaner-groq-unit-')
    )
      throw new Error('UNSAFE_TEST_CLEANUP')
    await rm(target, { recursive: true, force: true })
  })
  return directory
}
async function session(t, { response, budget, estimateInputTokens } = {}) {
  const directory = await temporary(t)
  const calls = []
  const local = await createLocalSession({
    apiKey: key,
    account: budget ?? account(),
    evidenceDirectory: directory,
    realProvider: false,
    estimateInputTokens,
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) })
      return response ? response() : providerResponse()
    },
  })
  return { local, calls, directory }
}

test('la configuración exige confirmación reciente del plan, límites y solo contexto sintético', () => {
  assert.equal(validateAccount(account()).model, GROQ_MODEL)
  for (const patch of [
    { syntheticOnly: false },
    { maxGenerations: 12 },
    { freeTierConfirmedAt: '2020-01-01' },
    { model: 'different-model' },
    { authorizedTokenBudget: 1_000_001 },
  ])
    assert.throws(() => validateAccount(account(patch)))
})
test('preflight consulta modelos, sin solicitud de generación ni cabeceras en la evidencia', async () => {
  const calls = []
  const result = await preflightGroq(key, async (url, options) => {
    calls.push({ url, method: options.method })
    return new Response(
      JSON.stringify({ data: [{ id: GROQ_MODEL, active: true }] }),
    )
  })
  assert.equal(result.ok, true)
  assert.equal(result.generation, false)
  assert.deepEqual(calls, [
    { url: 'https://api.groq.com/openai/v1/models', method: 'GET' },
  ])
  assert(!JSON.stringify(result).includes(key))
})
test('preflight informa autenticación rechazada y modelo ausente sin cambiar de modelo', async () => {
  assert.equal(
    (await preflightGroq(key, async () => new Response('', { status: 401 })))
      .code,
    'GROQ_AUTH_REJECTED',
  )
  assert.equal(
    (
      await preflightGroq(
        key,
        async () => new Response(JSON.stringify({ data: [] })),
      )
    ).code,
    'MODEL_UNAVAILABLE',
  )
})
test('la pregunta libre llega intacta al adaptador, sin respuestas esperadas en el prompt', async (t) => {
  const { local, calls, directory } = await session(t)
  const result = await local.ask(question)
  assert.equal(result.technical, 'PASS')
  assert.equal(result.realProvider, false)
  assert.equal(calls.length, 1)
  const payload = JSON.parse(calls[0].body.messages[1].content)
  assert.equal(payload.question, question.question)
  assert.deepEqual(Object.keys(payload).sort(), [
    'context',
    'observations',
    'question',
  ])
  assert(
    !calls[0].body.messages[1].content.includes(JSON.stringify(modelReply)),
  )
  assert.equal(result.transport[0].content, JSON.stringify(modelReply))
  assert.equal(result.transport[0].usage.totalTokens, 70)
  const saved = JSON.parse(
    await readFile(path.join(directory, `${result.id}.json`), 'utf8'),
  )
  assert.deepEqual(saved, result)
  assert.equal(saved.quality, 'NOT REVIEWED')
  assert(!JSON.stringify(saved).includes(key))
})
test('solo acepta IDs del contexto sintético y nunca datos de Supabase suministrados por el cliente', async (t) => {
  const { local, calls } = await session(t)
  await assert.rejects(
    local.ask({ ...question, context: { production: true } }),
    { code: 'INVALID_QUESTION' },
  )
  await assert.rejects(
    local.ask({ ...question, scenarioId: 'production-task' }),
    { code: 'UNKNOWN_SYNTHETIC_SCENARIO' },
  )
  await assert.rejects(local.ask({ ...question, question: `Clave ${key}` }), {
    code: 'INVALID_QUESTION',
  })
  assert.equal(calls.length, 0)
})
test('una primera generación inválida se conserva y detiene la sesión sin reintentos', async (t) => {
  const { local, calls } = await session(t, {
    response: () => providerResponse('{"broken":true}'),
  })
  const result = await local.ask(question)
  assert.equal(result.technical, 'FAIL')
  assert.equal(result.transport[0].content, '{"broken":true}')
  assert.equal(local.state().halted, 'FIRST_GENERATION_FAILED')
  await assert.rejects(local.ask({ ...question, question: 'Otra pregunta' }), {
    code: 'FIRST_GENERATION_FAILED',
  })
  assert.equal(calls.length, 1)
})
test('rechaza preguntas repetidas y respeta el máximo acotado de la sesión', async (t) => {
  const { local, calls } = await session(t)
  await local.ask(question)
  await assert.rejects(local.ask(question), { code: 'DUPLICATE_QUESTION' })
  assert.equal(calls.length, 1)
  const limited = await session(t, { budget: account({ maxGenerations: 1 }) })
  await limited.local.ask(question)
  await assert.rejects(
    limited.local.ask({ ...question, question: 'Otra pregunta' }),
    { code: 'SESSION_LIMIT' },
  )
  assert.equal(limited.calls.length, 1)
})
test('un presupuesto insuficiente bloquea antes de llamar al proveedor', async (t) => {
  const { local, calls } = await session(t, {
    budget: account({ authorizedTokenBudget: 1 }),
  })
  await assert.rejects(local.ask(question), { code: 'DAILY_TOKEN_BUDGET' })
  assert.equal(calls.length, 0)
})

test('el ejecutor aislado conserva su límite acumulado local por minuto', async (t) => {
  const { local, calls } = await session(t, {
    budget: account({ limits: { ...account().limits, tokensPerMinute: 4000 } }),
    estimateInputTokens: () => 2000,
    response: async () => {
      const reply = await providerResponse().json()
      reply.usage = {
        prompt_tokens: 1900,
        completion_tokens: 100,
        total_tokens: 2000,
      }
      return new Response(JSON.stringify(reply))
    },
  })
  await local.ask(question)
  await assert.rejects(
    local.ask({ ...question, question: '¿Qué información adicional falta?' }),
    { code: 'LOCAL_MINUTE_BUDGET' },
  )
  assert.equal(calls.length, 1)
})

test('dos preguntas concurrentes no producen dos llamadas externas', async (t) => {
  const directory = await temporary(t)
  let release
  let calls = 0
  const waiting = new Promise((resolve) => {
    release = resolve
  })
  const local = await createLocalSession({
    apiKey: key,
    account: account(),
    evidenceDirectory: directory,
    realProvider: false,
    fetchImpl: async () => {
      calls++
      await waiting
      return providerResponse()
    },
  })
  const first = local.ask(question)
  await assert.rejects(
    local.ask({ ...question, question: 'Otra pregunta simultánea' }),
    { code: 'BUSY' },
  )
  release()
  assert.equal((await first).technical, 'PASS')
  assert.equal(calls, 1)
})
test('una credencial reflejada por el proveedor se excluye de la evidencia', async (t) => {
  const { local, calls, directory } = await session(t, {
    response: () => providerResponse(`Contenido ${key}`),
  })
  const result = await local.ask(question)
  assert.equal(result.technical, 'FAIL')
  assert.equal(result.transport[0].content, null)
  assert.equal(calls.length, 1)
  for (const file of await readdir(directory))
    assert(!(await readFile(path.join(directory, file), 'utf8')).includes(key))
})
test('la revisión de calidad se guarda separada de la respuesta original', async (t) => {
  const { local, directory } = await session(t)
  const result = await local.ask(question)
  const original = await readFile(
    path.join(directory, `${result.id}.json`),
    'utf8',
  )
  const review = await local.review({
    id: result.id,
    status: 'FAIL',
    reason: 'Se revisó el significado y requiere corrección.',
  })
  assert.equal(review.status, 'FAIL')
  assert.equal(
    await readFile(path.join(directory, `${result.id}.json`), 'utf8'),
    original,
  )
  assert.equal(
    JSON.parse(
      await readFile(path.join(directory, `${result.id}.review.json`), 'utf8'),
    ).status,
    'FAIL',
  )
})

test('reanudar conserva el fallo, su consumo y el bloqueo de la pregunta repetida', async (t) => {
  const { local, directory } = await session(t, {
    response: () => providerResponse('{"broken":true}'),
  })
  const failed = await local.ask(question)
  const original = await readFile(
    path.join(directory, `${failed.id}.json`),
    'utf8',
  )
  await assert.rejects(
    createLocalSession({
      apiKey: key,
      account: account(),
      evidenceDirectory: directory,
      realProvider: false,
      resume: true,
    }),
    { code: 'RESUME_REVIEW_REQUIRED' },
  )
  await local.review({
    id: failed.id,
    status: 'FAIL',
    reason:
      'Fallo de contrato revisado; se conserva sin reintentar la pregunta.',
  })
  let calls = 0
  const resumed = await createLocalSession({
    apiKey: key,
    account: account(),
    evidenceDirectory: directory,
    realProvider: false,
    resume: true,
    fetchImpl: async () => {
      calls++
      return providerResponse()
    },
  })
  assert.equal(resumed.state().generations, 1)
  assert.equal(resumed.state().usedTokenBudget, 70)
  await assert.rejects(resumed.ask(question), { code: 'DUPLICATE_QUESTION' })
  assert.equal(calls, 0)
  assert.equal(
    (
      await resumed.ask({
        ...question,
        question: '¿Qué volúmenes están disponibles en este contexto?',
      })
    ).technical,
    'PASS',
  )
  assert.equal(calls, 1)
  assert.equal(resumed.state().usedTokenBudget, 140)
  assert.equal(
    await readFile(path.join(directory, `${failed.id}.json`), 'utf8'),
    original,
  )
})

test('reanudar no permite continuar tras un rechazo HTTP del proveedor', async (t) => {
  const { local, directory } = await session(t, {
    response: () => providerResponse('{}', 401),
  })
  const failed = await local.ask(question)
  await local.review({
    id: failed.id,
    status: 'FAIL',
    reason: 'Autenticación rechazada; no continuar.',
  })
  await assert.rejects(
    createLocalSession({
      apiKey: key,
      account: account(),
      evidenceDirectory: directory,
      realProvider: false,
      resume: true,
    }),
    { code: 'RESUME_PROVIDER_FAILURE' },
  )
})
test('HTTP se limita a loopback y exige origen exacto y sesión local para generar', async (t) => {
  let calls = 0
  const running = createLocalServer({
    state: () => ({ syntheticOnly: true }),
    ask: async () => {
      calls++
      return { ok: true }
    },
  })
  running.server.listen(0, '127.0.0.1')
  await once(running.server, 'listening')
  t.after(() => new Promise((resolve) => running.server.close(resolve)))
  const base = `http://127.0.0.1:${running.server.address().port}`
  assert.equal(running.server.address().address, '127.0.0.1')
  const root = await fetch(base)
  const cookie = root.headers.get('set-cookie').split(';')[0]
  assert.match(root.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
  assert(
    root.headers.get('content-security-policy').includes("connect-src 'self'"),
  )
  assert.equal((await fetch(`${base}/api/state`)).status, 401)
  assert.equal(
    (
      await fetch(`${base}/api/question`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          Origin: 'https://evil.invalid',
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
    ).status,
    403,
  )
  assert.equal(
    (
      await fetch(`${base}/api/question`, {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).status,
    403,
  )
  assert.equal(
    (
      await fetch(`${base}/api/question`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          Origin: base,
          'Content-Type': 'application/json',
        },
        body: 'x'.repeat(4097),
      })
    ).status,
    413,
  )
  assert.equal(calls, 0)
  assert.equal(
    (
      await fetch(`${base}/api/question`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          Origin: base,
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
    ).status,
    200,
  )
  assert.equal(calls, 1)
})
