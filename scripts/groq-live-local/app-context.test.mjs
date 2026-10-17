import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { projectLiveData } from '../../apps/web/src/features/supervisor/explainer/live-data.ts'
import {
  demoSnapshot,
  demoTask,
} from '../../apps/web/src/features/supervisor/explainer/fixtures.ts'
import { isLivePayload, buildAppFacts, budgetAppFacts } from './app-context.ts'
import { estimateTokens } from './token-budget.mjs'
import { createLocalSession } from './session.mjs'
import { createLocalServer } from './server.mjs'
import { GROQ_MODEL } from '../../packages/core/server/llm/groq.ts'
import { classifyChat } from './chat.ts'

const catalog = {
  simulated: false,
  partial: false,
  products: [
    {
      id: 'product-a',
      name: 'Producto privado A',
      categories: ['hipoclorito'],
      incompatibilities: ['acido'],
      minimum: 20,
      maximum: 100,
      ph: 12,
    },
    {
      id: 'product-b',
      name: 'Producto privado B',
      categories: ['acido'],
      incompatibilities: null,
      minimum: null,
      maximum: null,
      ph: null,
    },
  ],
}
const snapshot = () =>
  demoSnapshot([
    demoTask({ name: 'Actividad privada', areaName: 'Área privada' }),
    demoTask({ id: 'task-pending', state: 'receta_enviada', records: [] }),
  ])
const payload = () => projectLiveData(snapshot(), catalog).payload
const account = {
  model: GROQ_MODEL,
  freeTierConfirmedAt: new Date().toISOString(),
  syntheticOnly: true,
  maxGenerations: 11,
  authorizedTokenBudget: 10000,
  limits: {
    requestsPerMinute: 5,
    requestsPerDay: 1000,
    tokensPerMinute: 4000,
    tokensPerDay: 40000,
  },
}
async function makeSession(
  t,
  approved = true,
  contentOverride = null,
  budgetTest = {},
) {
  const directory = await mkdtemp(path.join(tmpdir(), 'ecocleaner-app-unit-'))
  t.after(async () => {
    const absolute = path.resolve(directory)
    assert.equal(path.dirname(absolute), path.resolve(tmpdir()))
    assert(path.basename(absolute).startsWith('ecocleaner-app-unit-'))
    await rm(absolute, { recursive: true, force: true })
  })
  const calls = []
  const session = await createLocalSession({
    apiKey: 'unit-app-only-not-real-key',
    account,
    evidenceDirectory: directory,
    realProvider: false,
    appDataApproved: approved,
    estimateInputTokens: budgetTest.estimateInputTokens ?? estimateTokens,
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(init.body)
      calls.push(request)
      const question = JSON.parse(request.messages.at(-1).content).question
      const content =
        classifyChat(question, request.messages.slice(1, -1)) === 'analysis'
          ? JSON.stringify({
              summary: 'Hay datos cargados; falta verificar las causas.',
              consumptionAnalysis: null,
              recommendation: {
                action: 'review_records',
                targetVariantId: null,
                text: 'Revisar los registros.',
                justification: 'Faltan causas verificadas.',
              },
              evidenceIds: ['limites.causas'],
              limitations: ['Solo datos de prueba.'],
              humanReviewRequired: true,
            })
          : '¡Hola! ¿En qué puedo ayudarte?'
      // Respuesta simulada exclusiva de esta prueba, no evidencia de Groq real.
      return new Response(
        JSON.stringify({
          id: 'unit-only-app',
          model: GROQ_MODEL,
          choices: [
            {
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: contentOverride ?? content,
              },
            },
          ],
          usage: {
            prompt_tokens: budgetTest.promptTokens ?? 100,
            completion_tokens: 100,
            total_tokens: (budgetTest.promptTokens ?? 100) + 100,
          },
        }),
        { headers: budgetTest.headers },
      )
    },
  })
  return { session, calls, directory }
}
test('la proyección elimina nombres, UUID, observaciones y campos extra antes de enviar', () => {
  const original = snapshot()
  original.tasks[0].observations = 'observación que no debe salir'
  const projected = projectLiveData(original, catalog)
  assert(isLivePayload(projected.payload))
  const serialized = JSON.stringify(projected.payload)
  for (const privateText of [
    'Actividad privada',
    'Área privada',
    'Producto privado A',
    'task-a',
    'record-a',
    'observación',
  ])
    assert(!serialized.includes(privateText))
  assert.equal(
    projected.anonymizeQuestion(
      'Revisa Actividad privada en Área privada con Producto privado A',
    ),
    'Revisa TA en AA con PA',
  )
  assert(projected.labels.TA.includes('Actividad privada'))
})
test('la frontera rechaza campos extra, identificadores originales, categorías y estados libres', () => {
  for (const change of [
    (p) => {
      p.password = 'unit-only'
    },
    (p) => {
      p.snapshot.tasks[0].name = 'persona'
    },
    (p) => {
      p.snapshot.tasks[0].id = 'uuid-real'
    },
    (p) => {
      p.catalog.products[0].categories = ['inventada']
    },
  ]) {
    const p = payload()
    change(p)
    assert(!isLivePayload(p))
  }
})
test('el resumen combina resultados core sin sumar una tarea pendiente ni inventar pH o causas', () => {
  const { facts, groups } = buildAppFacts(payload())
  assert.equal(facts['tareas.completadas'], 1)
  assert.equal(facts['tareas.pendientes'], 1)
  assert.equal(facts['consumo.agua_l'], 9.5)
  assert.equal(facts['consumo.producto_ml'], 500)
  assert.equal(facts['pareado.tareas'], 1)
  assert.equal(facts['pareado.diferencia_agua_l'], 0)
  assert.equal(facts['pareado.diferencia_producto_ml'], 0)
  assert.equal(facts['incompatibilidades.conflictos'], 1)
  assert.equal(facts['efluente.ph_medido_disponible'], false)
  assert.equal(facts['efluente.autoriza_vertido'], false)
  assert(groups.some((group) => group.facts['PA.categorias'] === 'hipoclorito'))
  assert(groups.some((group) => group.facts['TA.RA.desvio_pct'] === 0))
})
test('el presupuesto conserva el resumen global y declara detalles omitidos', () => {
  const facts = budgetAppFacts(
    payload(),
    'Revisa TA',
    (data) => Object.keys(data).length <= 50,
  )
  assert.equal(facts['consumo.producto_ml'], 500)
  assert.equal(facts['alcance.detalle_parcial'], true)
  assert(
    Number(facts['alcance.hechos_disponibles']) >
      Number(facts['alcance.hechos_incluidos']) - 4,
  )
  assert.throws(
    () => budgetAppFacts(payload(), 'Revisa', () => false),
    /APP_CONTEXT_BUDGET/,
  )
  const complete = budgetAppFacts(payload(), 'Revisa', () => true)
  assert.equal(
    complete['alcance.hechos_incluidos'],
    complete['alcance.hechos_disponibles'],
  )
  assert.equal(complete['alcance.detalle_parcial'], false)
})
test('el tokenizador estima localmente con margen, sin llamadas externas', () => {
  assert(estimateTokens('Resumen de consumos y variantes.') > 512)
})
test('ningún cliente puede habilitar por JSON el envío de datos operativos', async (t) => {
  const { session, calls } = await makeSession(t, false)
  await assert.rejects(
    session.ask({
      mode: 'app',
      data: payload(),
      question: 'Resume estos datos.',
    }),
    { code: 'APP_DATA_NOT_APPROVED' },
  )
  assert.equal(calls.length, 0)
})
test('la pregunta abierta usa el contexto combinado, sin respuestas esperadas ni datos identificables', async (t) => {
  const { session, calls, directory } = await makeSession(t)
  const result = await session.ask({
    mode: 'app',
    data: payload(),
    question: '¿Qué se puede concluir sobre estos registros?',
  })
  assert.equal(result.technical, 'PASS')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].max_completion_tokens, 768)
  assert.equal(calls[0].response_format, undefined)
  assert.equal(calls[0].include_reasoning, false)
  const serialized = JSON.stringify(calls[0])
  assert(!serialized.includes('Actividad privada'))
  assert(!serialized.includes('simulatedResponse'))
  assert.equal(
    JSON.parse(calls[0].messages[1].content).facts['consumo.agua_l'],
    9.5,
  )
  const record = JSON.parse(
    await readFile(path.join(directory, `${result.id}.json`), 'utf8'),
  )
  assert.equal(record.realProvider, false)
  assert.equal(record.input.disclosure, 'approved_for_external_processing')
  assert.equal(session.state().usedTokenBudget, 200)
})
test('el historial solo contiene respuestas propias del mismo contexto y se cuenta en la solicitud', async (t) => {
  const { session, calls } = await makeSession(t)
  const first = await session.ask({
    mode: 'app',
    data: payload(),
    question: 'Hola, ¿qué datos tienes?',
  })
  const next = await session.ask({
    mode: 'app',
    data: payload(),
    question: '¿Y qué causas faltan?',
    historyIds: [first.id],
  })
  assert.equal(next.result.kind, 'chat')
  assert.equal(calls[1].messages.length, 4)
  assert.equal(calls[1].messages[1].role, 'user')
  assert.equal(calls[1].messages[2].role, 'assistant')
  assert(calls[1].messages[2].content.includes('verificar las causas'))
  const changed = payload()
  changed.snapshot.tasks.pop()
  await assert.rejects(
    session.ask({
      mode: 'app',
      data: changed,
      question: 'Continúa',
      historyIds: [first.id],
    }),
    { code: 'INVALID_HISTORY' },
  )
  assert.equal(calls.length, 2)
})
test('un saludo tras un análisis no reenvía hechos ni el informe anterior al proveedor', async (t) => {
  const { session, calls } = await makeSession(t)
  const first = await session.ask({
    mode: 'app',
    data: payload(),
    question: 'Resume estos datos.',
  })
  const next = await session.ask({
    mode: 'app',
    data: payload(),
    question: 'Hola',
    historyIds: [first.id],
  })
  assert.equal(next.result.responseType, 'social')
  assert.equal(calls[1].messages.length, 2)
  assert.deepEqual(JSON.parse(calls[1].messages[1].content), {
    question: 'Hola',
  })
  assert.deepEqual(next.result.contextFacts, {})
})

test('el historial rechaza IDs repetidos, más de tres intercambios y respuestas descartadas', async (t) => {
  const { session, calls } = await makeSession(
    t,
    true,
    'Respuesta sin contrato válido',
  )
  const first = await session.ask({
    mode: 'app',
    data: payload(),
    question: 'Resume los registros.',
  })
  assert.equal(first.result.ok, false)
  for (const historyIds of [
    [first.id],
    [first.id, first.id],
    Array(4).fill(first.id),
  ])
    await assert.rejects(
      session.ask({
        mode: 'app',
        data: payload(),
        question: 'Continúa',
        historyIds,
      }),
      { code: 'INVALID_HISTORY' },
    )
  assert.equal(calls.length, 1)
})

test('el chat permite consultas consecutivas por encima del antiguo acumulado local de tokens por minuto', async (t) => {
  const { session, calls } = await makeSession(t, true, null, {
    estimateInputTokens: () => 2000,
    promptTokens: 1900,
  })
  for (const question of ['Resume los registros.', '¿Qué causas faltan?']) {
    const result = await session.ask({ mode: 'app', data: payload(), question })
    assert.equal(result.result.ok, true)
  }
  assert.equal(calls.length, 2)
  assert.equal(session.state().usedTokenBudget, 4000)
})

test('quitar el acumulado local de tokens no elimina el máximo de solicitudes por minuto', async (t) => {
  const { session, calls } = await makeSession(t)
  for (let index = 0; index < 5; index++)
    await session.ask({ mode: 'app', data: payload(), question: 'Hola' })
  await assert.rejects(
    session.ask({ mode: 'app', data: payload(), question: 'Hola' }),
    { code: 'LOCAL_MINUTE_BUDGET' },
  )
  assert.equal(calls.length, 5)
})

test('el chat conserva el presupuesto total aunque permita más tokens acumulados por minuto', async (t) => {
  const { session, calls } = await makeSession(t, true, null, {
    estimateInputTokens: () => 2000,
    promptTokens: 1900,
  })
  for (let index = 0; index < 4; index++)
    await session.ask({ mode: 'app', data: payload(), question: 'Hola' })
  await assert.rejects(
    session.ask({ mode: 'app', data: payload(), question: 'Hola' }),
    { code: 'APP_CONTEXT_BUDGET' },
  )
  assert.equal(calls.length, 4)
  assert.equal(session.state().usedTokenBudget, 8000)
})

test('el chat sigue respetando los tokens restantes informados por Groq', async (t) => {
  const { session, calls } = await makeSession(t, true, null, {
    estimateInputTokens: () => 2000,
    headers: { 'x-ratelimit-remaining-tokens': '1000' },
  })
  await session.ask({ mode: 'app', data: payload(), question: 'Hola' })
  await assert.rejects(
    session.ask({ mode: 'app', data: payload(), question: 'Hola' }),
    { code: 'LOCAL_MINUTE_BUDGET' },
  )
  assert.equal(calls.length, 1)
})

test('la ampliación de consultas se conserva al reanudar sin borrar consumo', async (t) => {
  const { session, directory } = await makeSession(t)
  await session.ask({ mode: 'app', data: payload(), question: 'Hola.' })
  const options = {
    apiKey: 'unit-app-only-not-real-key',
    account,
    evidenceDirectory: directory,
    realProvider: false,
    resume: true,
    appDataApproved: true,
  }
  const expanded = await createLocalSession({
    ...options,
    approvedMaxGenerations: 100,
  })
  assert.equal(expanded.state().maxGenerations, 100)
  const resumed = await createLocalSession(options)
  assert.equal(resumed.state().maxGenerations, 100)
  assert.equal(resumed.state().usedTokenBudget, 200)
})
test('repetir manualmente una pregunta del chat cuenta como una nueva consulta sin reintentos automáticos', async (t) => {
  const { session, calls } = await makeSession(t)
  const question = { mode: 'app', data: payload(), question: 'Hola.' }
  const first = await session.ask(question)
  const second = await session.ask(question)
  assert.notEqual(first.id, second.id)
  assert.equal(calls.length, 2)
  assert.equal(session.state().generations, 2)
  assert.equal(session.state().usedTokenBudget, 400)
})
test('una ampliación explícita conserva consumos y queda registrada sin reiniciar el presupuesto', async (t) => {
  const { session, directory } = await makeSession(t)
  await session.ask({
    mode: 'app',
    data: payload(),
    question: 'Resume estos datos.',
  })
  const options = {
    apiKey: 'unit-app-only-not-real-key',
    account,
    evidenceDirectory: directory,
    realProvider: false,
    resume: true,
    appDataApproved: true,
    estimateInputTokens: estimateTokens,
    fetchImpl: async () => {
      throw new Error('No se espera generación en esta prueba')
    },
  }
  const expanded = await createLocalSession({
    ...options,
    approvedTokenBudget: 20000,
  })
  assert.equal(expanded.state().usedTokenBudget, 200)
  assert.equal(expanded.state().authorizedTokenBudget, 20000)
  const preserved = await createLocalSession(options)
  assert.equal(preserved.state().usedTokenBudget, 200)
  assert.equal(preserved.state().authorizedTokenBudget, 20000)
  await assert.rejects(
    createLocalSession({ ...options, approvedTokenBudget: 40001 }),
    { code: 'INVALID_APPROVED_BUDGET' },
  )
})

test('un HTTP 400 de configuración requiere revisión y conserva su reserva al reanudar', async (t) => {
  const { session, directory } = await makeSession(t)
  await session.ask({
    mode: 'app',
    data: payload(),
    question: 'Resumen de control.',
  })
  const { readdir, writeFile } = await import('node:fs/promises')
  const first = (await readdir(directory)).find((file) =>
    /^[a-f\d-]{36}\.json$/i.test(file),
  )
  const original = JSON.parse(
    await readFile(path.join(directory, first), 'utf8'),
  )
  const failedId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const failed = {
    ...original,
    id: failedId,
    at: new Date(Date.now() + 1).toISOString(),
    question: 'Pregunta de configuración.',
    reservedTokenBudget: 3900,
    transport: [{ httpStatus: 400, model: GROQ_MODEL, usage: null }],
    technical: 'FAIL',
  }
  await writeFile(
    path.join(directory, `${failedId}.json`),
    JSON.stringify(failed),
  )
  await writeFile(
    path.join(directory, `${failedId}.review.json`),
    JSON.stringify({ status: 'FAIL' }),
  )
  const options = {
    apiKey: 'unit-app-only-not-real-key',
    account,
    evidenceDirectory: directory,
    realProvider: false,
    resume: true,
    appDataApproved: true,
    estimateInputTokens: estimateTokens,
  }
  await assert.rejects(createLocalSession(options), {
    code: 'RESUME_PROVIDER_FAILURE',
  })
  const resumed = await createLocalSession({
    ...options,
    resumeReviewedConfiguration: true,
  })
  assert.equal(resumed.state().usedTokenBudget, 4100)
  const preserved = await createLocalSession(options)
  assert.equal(preserved.state().usedTokenBudget, 4100)
})

test('la aplicación comparte origen y cookie, permite leer estado sin generar y rechaza orígenes externos', async (t) => {
  let calls = 0
  const session = {
    state: () => ({
      provider: 'groq',
      model: GROQ_MODEL,
      appDataApproved: true,
    }),
    ask: async () => {
      calls++
      return {
        id: 'unit',
        transport: [],
        result: { ok: false },
        preparedFacts: {},
      }
    },
  }
  const running = createLocalServer(session, {
    application: (_request, response) => response.end('app-test-only'),
  })
  running.server.listen(0, '127.0.0.1')
  await once(running.server, 'listening')
  t.after(() => new Promise((resolve) => running.server.close(resolve)))
  const origin = `http://127.0.0.1:${running.server.address().port}`
  assert.equal(await (await fetch(origin)).text(), 'app-test-only')
  const state = await fetch(`${origin}/api/app/state`)
  const cookie = state.headers.get('set-cookie').split(';')[0]
  assert.equal(calls, 0)
  const body = JSON.stringify({ data: payload(), question: 'Resume' })
  assert.equal(
    (
      await fetch(`${origin}/api/app/question`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          Origin: 'https://evil.invalid',
          'Content-Type': 'application/json',
        },
        body,
      })
    ).status,
    403,
  )
  assert.equal(calls, 0)
  assert.equal(
    (
      await fetch(`${origin}/api/app/question`, {
        method: 'POST',
        headers: {
          Cookie: cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body,
      })
    ).status,
    200,
  )
  assert.equal(calls, 1)
})
