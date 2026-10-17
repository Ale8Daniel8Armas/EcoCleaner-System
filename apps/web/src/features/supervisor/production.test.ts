import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProductionHandler } from '../../../../../server/llm-production/handler'
import {
  createProductionStore,
  ProductionFailure,
  type ProductionStore,
} from '../../../../../server/llm-production/store'
import { createAssistantSimulation } from './explainer/assistant-simulation'
import { projectLiveData } from './explainer/live-data'

const origin = 'https://eco-cleaner-system.vercel.app'
const actor = '10000000-0000-4000-8000-000000000001'
const key = 'gsk_' + 'f'.repeat(50)
const env = {
  LLM_PRODUCTION_ENABLED: 'true',
  LLM_EXTERNAL_CALLS_APPROVED: 'true',
  LLM_ALLOWED_ORIGIN: origin,
  GROQ_API_KEY: key,
}
const state = {
  provider: 'groq',
  model: 'openai/gpt-oss-20b',
  appDataApproved: true,
  generations: 32,
  maxGenerations: 100,
  usedTokenBudget: 73706,
  authorizedTokenBudget: 80000,
  maxOutputTokens: 768,
  minimumRequestTokenBudget: 1468,
  busy: false,
  halted: null,
}
let store: ProductionStore
let transport: ReturnType<typeof vi.fn<typeof fetch>>
const data = () => {
  const fixture = createAssistantSimulation()
  return projectLiveData(fixture.snapshot, fixture.catalog).payload
}
const question = (
  body: unknown = { question: 'Hola', data: data() },
  extra: HeadersInit = {},
) =>
  new Request(origin + '/api/app/question', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + 'a'.repeat(40),
      Origin: origin,
      'Content-Type': 'application/json',
      ...extra,
    },
    body: JSON.stringify(body),
  })
const handler = (overrides = {}) =>
  createProductionHandler({ ...env, ...overrides }, { store, transport })
beforeEach(() => {
  store = {
    identity: vi.fn().mockResolvedValue(actor),
    state: vi.fn().mockResolvedValue({ ...state }),
    history: vi.fn().mockResolvedValue([]),
    reserve: vi.fn().mockResolvedValue(state),
    finish: vi
      .fn()
      .mockResolvedValue({ ...state, generations: 33, usedTokenBudget: 74126 }),
  }
  transport = vi.fn<typeof fetch>().mockImplementation(() =>
    Promise.resolve(
      Response.json({
        id: 'chatcmpl_test',
        model: state.model,
        choices: [
          {
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'Hola, ¿en qué te ayudo?',
            },
          },
        ],
        usage: {
          prompt_tokens: 400,
          completion_tokens: 20,
          total_tokens: 420,
        },
      }),
    ),
  )
})

describe('backend público: autorización antes de consumir tokens', () => {
  it('permanece cerrado sin aprobación de servidor aunque el navegador active la vista', async () => {
    expect(
      (await handler({ LLM_PRODUCTION_ENABLED: 'false' })(question())).status,
    ).toBe(503)
    expect(store.identity).not.toHaveBeenCalled()
    expect(transport).not.toHaveBeenCalled()
  })
  it('exige bearer y no acepta el rol del localStorage o de una cabecera', async () => {
    const request = new Request(origin + '/api/app/state', {
      headers: { 'X-Role': 'supervisor' },
    })
    expect((await handler()(request)).status).toBe(401)
    expect(store.state).not.toHaveBeenCalled()
    vi.mocked(store.identity).mockResolvedValue(null)
    expect((await handler()(question())).status).toBe(403)
    expect(transport).not.toHaveBeenCalled()
  })
  it('rechaza orígenes ajenos antes de verificar la sesión', async () => {
    expect(
      (await handler()(question(undefined, { Origin: 'https://otro.example' })))
        .status,
    ).toBe(403)
    expect(store.identity).not.toHaveBeenCalled()
  })
  it('leer estado no consulta el modelo ni modifica la cuota', async () => {
    const response = await handler()(
      new Request(origin + '/api/app/state', {
        headers: { Authorization: 'Bearer ' + 'a'.repeat(40) },
      }),
    )
    expect(await response.json()).toMatchObject({
      generations: 32,
      usedTokenBudget: 73706,
    })
    expect(store.reserve).not.toHaveBeenCalled()
    expect(transport).not.toHaveBeenCalled()
  })
  it('rechaza datos personales o campos extra del contexto', async () => {
    expect(
      (
        await handler()(
          question({ question: 'persona@example.com', data: data() }),
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await handler()(
          question({
            question: 'Hola',
            data: { ...data(), observations: 'dato privado' },
          }),
        )
      ).status,
    ).toBe(400)
    expect(store.reserve).not.toHaveBeenCalled()
    expect(transport).not.toHaveBeenCalled()
  })
  it('no llama al proveedor si otro proceso ya reservó la sesión', async () => {
    vi.mocked(store.reserve).mockRejectedValue(
      new ProductionFailure('BUSY', 409),
    )
    expect((await handler()(question())).status).toBe(409)
    expect(transport).not.toHaveBeenCalled()
  })
  it('no llama al proveedor si el saldo no alcanza', async () => {
    vi.mocked(store.state).mockResolvedValue({
      ...state,
      usedTokenBudget: 79900,
    })
    expect((await handler()(question())).status).toBe(429)
    expect(store.reserve).not.toHaveBeenCalled()
    expect(transport).not.toHaveBeenCalled()
  })
  it('reserva antes de una única llamada y registra el uso coherente', async () => {
    const response = await handler()(question())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.result).toMatchObject({
      ok: true,
      answer: 'Hola, ¿en qué te ayudo?',
    })
    expect(transport).toHaveBeenCalledTimes(1)
    expect(vi.mocked(store.reserve).mock.invocationCallOrder[0]).toBeLessThan(
      transport.mock.invocationCallOrder[0],
    )
    expect(store.finish).toHaveBeenCalledWith(
      expect.any(String),
      420,
      expect.any(Object),
      expect.any(Object),
      false,
    )
    expect(JSON.stringify(body)).not.toContain(key)
    expect(JSON.parse(String(transport.mock.calls[0][1]?.body))).toMatchObject({
      model: state.model,
      max_completion_tokens: 768,
      reasoning_effort: 'low',
    })
  })
  it('mantiene la reserva completa si falta uso verificable', async () => {
    transport.mockResolvedValue(
      Response.json({
        choices: [{ message: { content: 'Hola' } }],
        usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 900 },
      }),
    )
    await handler()(question())
    expect(store.finish).toHaveBeenCalledWith(
      expect.any(String),
      null,
      expect.any(Object),
      expect.any(Object),
      false,
    )
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it('conserva el fallo del proveedor, detiene la sesión y no reintenta', async () => {
    transport.mockResolvedValue(
      Response.json(
        { error: { message: 'private diagnostic' } },
        { status: 429 },
      ),
    )
    const response = await handler()(question())
    const body = await response.json()
    expect(body.result.ok).toBe(false)
    expect(store.finish).toHaveBeenCalledWith(
      expect.any(String),
      null,
      expect.any(Object),
      expect.any(Object),
      true,
    )
    expect(JSON.stringify(body)).not.toContain('private diagnostic')
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it('no acepta referencias al historial de otro usuario o contexto', async () => {
    vi.mocked(store.history).mockRejectedValue(
      new ProductionFailure('INVALID_HISTORY', 400),
    )
    expect(
      (
        await handler()(
          question({
            question: 'Y por qué',
            data: data(),
            historyIds: [actor],
          }),
        )
      ).status,
    ).toBe(400)
    expect(transport).not.toHaveBeenCalled()
  })
})

describe('identidad Supabase verificada por Auth', () => {
  it('ignora user_metadata y acepta solo el rol administrado del servidor', async () => {
    const auth = vi.fn().mockResolvedValue(
      Response.json({
        id: actor,
        user_metadata: { ecocleaner_role: 'supervisor' },
        app_metadata: { ecocleaner_role: 'operario' },
      }),
    )
    const backend = createProductionStore(
      {
        url: 'https://project.supabase.co',
        publicKey: 'public',
        secretKey: 'sb_secret_server',
      },
      auth,
    )
    expect(await backend.identity('jwt', AbortSignal.timeout(1000))).toBeNull()
    auth.mockResolvedValue(
      Response.json({
        id: actor,
        app_metadata: { ecocleaner_role: 'supervisor' },
      }),
    )
    expect(await backend.identity('jwt', AbortSignal.timeout(1000))).toBe(actor)
    expect(auth.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt')
    expect(auth.mock.calls[0][1].headers.apikey).toBe('public')
  })
  it('restringe el historial a identidad y huella verificadas', async () => {
    const database = vi.fn().mockResolvedValue(Response.json([]))
    const backend = createProductionStore(
      {
        url: 'https://project.supabase.co',
        publicKey: 'public',
        secretKey: 'sb_secret_server',
      },
      database,
    )
    await expect(
      backend.history(actor, [actor], 'f'.repeat(64)),
    ).rejects.toMatchObject({ code: 'INVALID_HISTORY' })
    const url = new URL(database.mock.calls[0][0])
    expect(url.searchParams.get('actor')).toBe('eq.' + actor)
    expect(url.searchParams.get('fingerprint')).toBe('eq.' + 'f'.repeat(64))
    expect(database.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })
})
