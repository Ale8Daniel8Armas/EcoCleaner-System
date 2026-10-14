import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLLMExplainer } from './explainer.ts'
import {
  createGroqProvider,
  GROQ_ENDPOINT,
  GROQ_INPUT_BUDGET,
  GROQ_MODEL,
} from './groq.ts'
import { createEvaluationCases } from './testing/evaluation-cases'
import {
  createEdgeHandler,
  type EdgeDependencies,
  type VerifiedUser,
} from '../../../../supabase/functions/llm-explainer/handler.ts'
import { buildDefaultEdgeHandler } from '../../../../supabase/functions/llm-explainer/index.ts'
import { createSupabaseReader } from '../../../../supabase/functions/llm-explainer/supabase.ts'

const cases = createEvaluationCases()
const userId = '11111111-1111-4111-8111-111111111111'
const taskId = '22222222-2222-4222-8222-222222222222'
const areaId = '33333333-3333-4333-8333-333333333333'
const productId = '44444444-4444-4444-8444-444444444444'
const token = 'test.header.signature'
const groqEnvelope = (
  content = JSON.stringify(cases[0].simulatedResponse),
) => ({
  model: GROQ_MODEL,
  choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }],
  usage: { prompt_tokens: 500, completion_tokens: 100, total_tokens: 600 },
})
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const mockFetch = (data: unknown = groqEnvelope(), status = 200) =>
  vi.fn<typeof fetch>(async () => response(data, status))
const groq = (fetchImpl: typeof fetch) =>
  createGroqProvider({
    apiKey: 'test-only-credential',
    externalCallsApproved: true,
    fetchImpl,
  })
const providerRequest = () => ({
  system: 'Instrucciones ficticias',
  user: '{}',
  maxOutputTokens: 768,
  signal: new AbortController().signal,
})
const bodyForCase = (index = 0) => ({
  kind: cases[index].input.context.kind,
  resourceId: taskId,
  question: cases[index].input.question,
  ...(cases[index].input.observations
    ? { observations: cases[index].input.observations }
    : {}),
})
const request = (
  body: unknown = bodyForCase(),
  extraHeaders: Record<string, string> = {},
) =>
  new Request('https://project.supabase.co/functions/v1/llm-explainer', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  })
const dependencies = (index = 0): EdgeDependencies => ({
  enabled: true,
  allowedOrigins: ['https://ecocleaner.example'],
  verifyIdentity: vi.fn(async () => ({
    id: userId,
    role: 'supervisor' as const,
  })),
  authorizeResource: vi.fn(async () => ({
    allowed: true,
    externalProcessingApproved: true,
    chiefSupervisorVerified: true,
  })),
  consumeDistributedQuota: vi.fn(async () => true),
  loadContext: vi.fn(async () => structuredClone(cases[index].input.context)),
  explain: vi.fn(
    async () =>
      ({
        ok: false,
        code: 'PROVIDER_NOT_CONFIGURED',
        fallback: {
          source: 'template',
          text: 'No disponible',
          humanReviewRequired: true,
        },
      }) as const,
  ),
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('adaptador Groq con HTTP simulado; ninguna llamada real', () => {
  it('envía un único POST al host fijo, JSON Schema estricto, sin herramientas ni reintentos', async () => {
    const http = mockFetch()
    const provider = groq(http)
    const result = await provider.generate(providerRequest())
    expect(result.usage).toEqual({ inputTokens: 500, outputTokens: 100 })
    expect(provider.inputTokenCounting).toBe('byte_budget')
    expect(http).toHaveBeenCalledTimes(1)
    const [url, init] = http.mock.calls[0]
    expect(url).toBe(GROQ_ENDPOINT)
    expect(init?.redirect).toBe('error')
    const body = JSON.parse(init?.body as string)
    expect(body).toMatchObject({
      model: GROQ_MODEL,
      n: 1,
      stream: false,
      max_completion_tokens: 768,
      response_format: { type: 'json_schema', json_schema: { strict: true } },
    })
    expect(body).not.toHaveProperty('tools')
    expect(body).not.toHaveProperty('tool_choice')
  })
  it('declara un presupuesto por bytes que incluye el esquema y nunca lo llama conteo real', () => {
    const provider = groq(mockFetch())
    const short = provider.countInputTokens(providerRequest()) as number
    const long = provider.countInputTokens({
      ...providerRequest(),
      user: 'á'.repeat(100),
    }) as number
    expect(long).toBeGreaterThan(short)
    expect(short).toBeGreaterThan(
      new TextEncoder().encode(providerRequest().system).length,
    )
  })
  it('no usa un modelo distinto ni cambia automáticamente a otro plan', () => {
    expect(() =>
      createGroqProvider({
        apiKey: 'test-only-credential',
        model: 'modelo-no-aprobado',
        externalCallsApproved: true,
      }),
    ).toThrow()
  })
  it('no invoca HTTP sin autorización expresa para llamadas externas', async () => {
    const http = mockFetch()
    const provider = createGroqProvider({
      apiKey: 'test-only-credential',
      externalCallsApproved: false,
      fetchImpl: http,
    })
    await expect(provider.generate(providerRequest())).rejects.toMatchObject({
      reason: 'disabled',
    })
    expect(http).not.toHaveBeenCalled()
  })
  it.each([
    [401, 'authentication'],
    [403, 'authentication'],
    [404, 'model'],
    [429, 'rate_limit'],
    [500, 'network'],
  ] as const)(
    'controla HTTP %s y descarta su contenido privado',
    async (status, reason) => {
      const http = mockFetch({ message: 'PRIVATE_PROVIDER_ERROR' }, status)
      await expect(
        groq(http).generate(providerRequest()),
      ).rejects.toMatchObject({ reason })
      expect(http).toHaveBeenCalledTimes(1)
      const result = await createLLMExplainer({
        provider: groq(
          mockFetch({ message: 'PRIVATE_PROVIDER_ERROR' }, status),
        ),
        maxInputTokens: GROQ_INPUT_BUDGET,
      })(cases[0].input)
      expect(result).toMatchObject({
        ok: false,
        code: status === 429 ? 'RATE_LIMIT' : 'PROVIDER_ERROR',
      })
      expect(JSON.stringify(result)).not.toContain('PRIVATE_PROVIDER_ERROR')
    },
  )
  it('propaga cancelación, no invoca tras abort y controla desconexión', async () => {
    const http = mockFetch()
    const controller = new AbortController()
    controller.abort()
    await expect(
      groq(http).generate({ ...providerRequest(), signal: controller.signal }),
    ).rejects.toMatchObject({ reason: 'network' })
    expect(http).not.toHaveBeenCalled()
    const offline = mockFetch()
    offline.mockRejectedValue(new Error('PRIVATE_NETWORK_ERROR'))
    await expect(
      groq(offline).generate(providerRequest()),
    ).rejects.toMatchObject({ reason: 'network' })
  })
  it('aplica timeout del explicador a una petición HTTP colgada', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const http = vi.fn<typeof fetch>((_url, init) => {
      signal = init?.signal as AbortSignal
      return new Promise(() => {})
    })
    const pending = createLLMExplainer({
      provider: groq(http),
      maxInputTokens: GROQ_INPUT_BUDGET,
      timeoutMs: 40,
    })(cases[0].input)
    await vi.advanceTimersByTimeAsync(41)
    expect(await pending).toMatchObject({ code: 'TIMEOUT' })
    expect(signal?.aborted).toBe(true)
  })
  it.each([
    'JSON inválido',
    JSON.stringify({}),
    JSON.stringify({ ...groqEnvelope(), model: 'otro' }),
    JSON.stringify({
      ...groqEnvelope(),
      usage: { prompt_tokens: -1, completion_tokens: 100 },
    }),
    JSON.stringify({
      ...groqEnvelope(),
      choices: [
        {
          finish_reason: 'length',
          message: { role: 'assistant', content: '{}' },
        },
      ],
    }),
  ])('rechaza el sobre del proveedor inválido %#', async (text) => {
    const http = vi.fn<typeof fetch>(async () => new Response(text))
    await expect(groq(http).generate(providerRequest())).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })
  it('rechaza cuerpos demasiado grandes y consumo que supera el máximo', async () => {
    const huge = vi.fn<typeof fetch>(
      async () => new Response('x'.repeat(32_001)),
    )
    await expect(groq(huge).generate(providerRequest())).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
    const data = groqEnvelope()
    data.usage.completion_tokens = 769
    await expect(
      groq(mockFetch(data)).generate(providerRequest()),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it.each([
    '{}',
    JSON.stringify({ ...cases[0].simulatedResponse, evidenceIds: [] }),
    JSON.stringify({
      ...cases[0].simulatedResponse,
      summary: 'Puede verter el efluente.',
    }),
  ])(
    'reutiliza el validador del explicador para contenido rechazado %#',
    async (content) => {
      const result = await createLLMExplainer({
        provider: groq(mockFetch(groqEnvelope(content))),
        maxInputTokens: GROQ_INPUT_BUDGET,
      })(cases[0].input)
      expect(result).toMatchObject({ code: 'INVALID_RESPONSE' })
    },
  )
  it('bloquea claves Groq aparentes en observaciones y respuestas', async () => {
    const result = await createLLMExplainer({
      provider: groq(mockFetch()),
      maxInputTokens: GROQ_INPUT_BUDGET,
    })({ ...cases[0].input, observations: `gsk_${'x'.repeat(25)}` })
    expect(result).toMatchObject({ code: 'INVALID_INPUT' })
  })
  it('rechaza herramientas no solicitadas y totales de uso inconsistentes', async () => {
    const withTool = groqEnvelope()
    Object.assign(withTool.choices[0].message, {
      function_call: { name: 'write_data' },
    })
    await expect(
      groq(mockFetch(withTool)).generate(providerRequest()),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    const wrongTotal = groqEnvelope()
    wrongTotal.usage.total_tokens = 1
    await expect(
      groq(mockFetch(wrongTotal)).generate(providerRequest()),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it('admite un servidor Deno incluso si el runtime expone window', () => {
    vi.stubGlobal('Deno', { version: { deno: 'runtime-ficticio' } })
    vi.stubGlobal('window', {})
    expect(typeof createLLMExplainer()).toBe('function')
  })
})

describe('contrato HTTP Edge y reutilización de los 15 casos, todo con mocks', () => {
  it.each(cases)(
    '$id: Edge → Groq HTTP simulado → validador existente',
    async (testCase) => {
      const index = cases.indexOf(testCase)
      const deps = dependencies(index)
      const original = structuredClone(testCase.input.context)
      const http = mockFetch(
        groqEnvelope(JSON.stringify(testCase.simulatedResponse)),
      )
      deps.explain = createLLMExplainer({
        provider: groq(http),
        maxInputTokens: GROQ_INPUT_BUDGET,
      })
      const result = await createEdgeHandler(deps)(request(bodyForCase(index)))
      expect(result.status).toBe(200)
      expect(await result.json()).toMatchObject({
        ok: true,
        explanation: { humanReviewRequired: true },
      })
      expect(http).toHaveBeenCalledTimes(1)
      expect(testCase.input.context).toEqual(original)
      expect(deps.authorizeResource).toHaveBeenCalled()
      expect(deps.consumeDistributedQuota).toHaveBeenCalled()
    },
  )
  it('mantiene el punto de entrada cerrado aunque haya configuración de proveedor', async () => {
    const http = vi.fn(() => {
      throw new Error('No se autoriza red')
    })
    vi.stubGlobal('fetch', http)
    const handler = buildDefaultEdgeHandler((name) =>
      name === 'GROQ_API_KEY'
        ? 'test-only-credential'
        : name === 'LLM_EXTERNAL_CALLS_APPROVED'
          ? 'true'
          : undefined,
    )
    expect((await handler(request())).status).toBe(503)
    expect(http).not.toHaveBeenCalled()
  })
  it.each(['', 'Bearer sb_publishable_fixture', 'Bearer fake_local_session'])(
    'rechaza clave publicable o sesión local como identidad: %#',
    async (authorization) => {
      const deps = dependencies()
      expect(
        (await createEdgeHandler(deps)(request(undefined, { authorization })))
          .status,
      ).toBe(401)
      expect(deps.verifyIdentity).not.toHaveBeenCalled()
      expect(deps.explain).not.toHaveBeenCalled()
    },
  )
  it('rechaza JWT no verificado y rol sin confianza de servidor', async () => {
    const deps = dependencies()
    deps.verifyIdentity = vi.fn(async () => null)
    expect((await createEdgeHandler(deps)(request())).status).toBe(401)
    deps.verifyIdentity = vi.fn(async () => ({ id: userId, role: null }))
    expect((await createEdgeHandler(deps)(request())).status).toBe(403)
    expect(deps.loadContext).not.toHaveBeenCalled()
  })
  it('rechaza operarios aunque un callback conceda permiso sobre el recurso', async () => {
    const deps = dependencies()
    deps.verifyIdentity = vi.fn(async () => ({
      id: userId,
      role: 'operario' as const,
    }))
    expect((await createEdgeHandler(deps)(request())).status).toBe(403)
    expect(deps.authorizeResource).not.toHaveBeenCalled()
    expect(deps.loadContext).not.toHaveBeenCalled()
    expect(deps.explain).not.toHaveBeenCalled()
  })
  it.each([false, undefined])(
    'no considera al supervisor jefe sin confirmación del servidor: %s',
    async (verified) => {
      const deps = dependencies()
      deps.authorizeResource = vi.fn(async () => ({
        allowed: true,
        externalProcessingApproved: true,
        chiefSupervisorVerified: verified as boolean,
      }))
      expect((await createEdgeHandler(deps)(request())).status).toBe(403)
      expect(deps.consumeDistributedQuota).not.toHaveBeenCalled()
      expect(deps.loadContext).not.toHaveBeenCalled()
      expect(deps.explain).not.toHaveBeenCalled()
    },
  )
  it.each([
    {
      allowed: false,
      externalProcessingApproved: true,
      chiefSupervisorVerified: true,
    },
    {
      allowed: true,
      externalProcessingApproved: false,
      chiefSupervisorVerified: true,
    },
  ])(
    'no consulta datos ni invoca LLM sin permiso de recurso y de exportación %#',
    async (access) => {
      const deps = dependencies()
      deps.authorizeResource = vi.fn(async () => access)
      expect((await createEdgeHandler(deps)(request())).status).toBe(403)
      expect(deps.loadContext).not.toHaveBeenCalled()
      expect(deps.explain).not.toHaveBeenCalled()
    },
  )
  it('exige la reserva de cuota global/usuario antes de consultar datos y generar', async () => {
    const deps = dependencies()
    deps.consumeDistributedQuota = vi.fn(async () => false)
    expect((await createEdgeHandler(deps)(request())).status).toBe(429)
    expect(deps.loadContext).not.toHaveBeenCalled()
    expect(deps.explain).not.toHaveBeenCalled()
  })
  it.each(['context', 'rol', 'disclosure', 'query', 'chiefSupervisorVerified'])(
    'rechaza evidencia, permisos o consultas controladas por el navegador: %s',
    async (key) => {
      const deps = dependencies()
      expect(
        (
          await createEdgeHandler(deps)(
            request({ ...bodyForCase(), [key]: 'CLIENT_FORGED_VALUE' }),
          )
        ).status,
      ).toBe(400)
      expect(deps.verifyIdentity).not.toHaveBeenCalled()
    },
  )
  it('valida método, tipo, tamaño, origen y preflight sin acceder al proveedor', async () => {
    const deps = dependencies()
    const handler = createEdgeHandler(deps)
    expect(
      (await handler(new Request('https://example.invalid', { method: 'GET' })))
        .status,
    ).toBe(405)
    expect(
      (await handler(request(undefined, { 'Content-Type': 'text/plain' })))
        .status,
    ).toBe(415)
    expect(
      (await handler(request(undefined, { 'Content-Length': '4097' }))).status,
    ).toBe(413)
    expect(
      (await handler(request(undefined, { Origin: 'https://hostile.example' })))
        .status,
    ).toBe(403)
    const preflight = await handler(
      new Request('https://example.invalid', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://ecocleaner.example',
          'Access-Control-Request-Method': 'POST',
        },
      }),
    )
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://ecocleaner.example',
    )
    expect(deps.explain).not.toHaveBeenCalled()
  })
  it('rechaza JSON inválido, cuerpo chunked grande y datos incompletos', async () => {
    const handler = createEdgeHandler(dependencies())
    const bad = (text: string) =>
      new Request('https://example.invalid', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: text,
      })
    expect((await handler(bad('malformado'))).status).toBe(400)
    expect((await handler(bad('x'.repeat(4097)))).status).toBe(400)
    expect(
      (await handler(request({ ...bodyForCase(), resourceId: 'no-uuid' })))
        .status,
    ).toBe(400)
  })
  it('no sustituye un contexto inaccesible por datos inventados', async () => {
    const deps = dependencies()
    deps.loadContext = vi.fn(async () => null)
    expect((await createEdgeHandler(deps)(request())).status).toBe(404)
    expect(deps.explain).not.toHaveBeenCalled()
  })
  it('no expone excepciones ni datos de autenticación', async () => {
    const deps = dependencies()
    deps.authorizeResource = vi.fn(async () => {
      throw new Error('PRIVATE_AUTH_ERROR')
    })
    const result = await createEdgeHandler(deps)(request())
    expect(result.status).toBe(503)
    expect(await result.text()).not.toContain('PRIVATE_AUTH_ERROR')
  })
  it('el timeout no permite que una verificación tardía dispare consultas o LLM', async () => {
    vi.useFakeTimers()
    const deps = dependencies()
    let finish!: (value: { id: string; role: 'supervisor' }) => void
    deps.verifyIdentity = vi.fn(
      () =>
        new Promise<VerifiedUser>((resolve) => {
          finish = resolve
        }),
    )
    const pending = createEdgeHandler(deps)(request())
    // Esperar a la lectura asíncrona del cuerpo, sin efectuar ninguna llamada real.
    await vi.advanceTimersByTimeAsync(1)
    await vi.advanceTimersByTimeAsync(12_001)
    expect((await pending).status).toBe(504)
    finish({ id: userId, role: 'supervisor' })
    await Promise.resolve()
    expect(deps.authorizeResource).not.toHaveBeenCalled()
  })
})

describe('Supabase Auth y lectura RLS con HTTP simulado', () => {
  it('verifica el JWT contra Auth y solo acepta rol en app_metadata del servidor', async () => {
    const http = mockFetch({
      id: userId,
      app_metadata: { ecocleaner_role: 'supervisor' },
      user_metadata: { rol: 'operario' },
    })
    const reader = createSupabaseReader({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_fixture',
      fetchImpl: http,
    })
    expect(
      await reader.verifyIdentity(token, new AbortController().signal),
    ).toEqual({ id: userId, role: 'supervisor' })
    expect(String(http.mock.calls[0][0])).toBe(
      'https://project.supabase.co/auth/v1/user',
    )
    expect(http.mock.calls[0][1]?.method).toBe('GET')
    http.mockImplementation(async () =>
      response({
        id: userId,
        user_metadata: { ecocleaner_role: 'supervisor' },
      }),
    )
    expect(
      await reader.verifyIdentity(token, new AbortController().signal),
    ).toEqual({ id: userId, role: null })
  })
  it('rechaza credencial administrativa y respuestas Auth inválidas', async () => {
    expect(() =>
      createSupabaseReader({
        url: 'https://project.supabase.co',
        publishableKey: 'sb_secret_test',
      }),
    ).toThrow()
    const reader = createSupabaseReader({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_fixture',
      fetchImpl: mockFetch({ message: 'PRIVATE' }, 401),
    })
    expect(
      await reader.verifyIdentity(token, new AbortController().signal),
    ).toBeNull()
  })
  it('obtiene entradas autorizadas por GET con JWT de usuario y reutiliza calcularReceta', async () => {
    const http = vi.fn<typeof fetch>(async (url) => {
      const path = new URL(String(url)).pathname
      return response(
        path.endsWith('/tareas')
          ? [
              {
                id: taskId,
                area_id: areaId,
                producto_id: productId,
                nivel_suciedad: 'media',
              },
            ]
          : path.endsWith('/areas')
            ? [{ superficie_m2: 100, litros_solucion_por_m2: 0.1 }]
            : [
                {
                  dilucion_min_ml_por_litro: 20,
                  dilucion_ml_por_litro: 50,
                  dilucion_max_ml_por_litro: 100,
                },
              ],
      )
    })
    const reader = createSupabaseReader({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_fixture',
      fetchImpl: http,
    })
    const result = await reader.loadContext(
      { id: userId, role: 'supervisor' },
      bodyForCase() as Parameters<typeof reader.loadContext>[1],
      token,
      new AbortController().signal,
    )
    expect(result).toEqual(cases[0].input.context)
    for (const [, init] of http.mock.calls) {
      expect(init?.method).toBe('GET')
      expect(init?.headers).toMatchObject({ Authorization: `Bearer ${token}` })
    }
    expect(http.mock.calls.map(([url]) => String(url)).join('\n')).not.toMatch(
      /usuarios|password_hash/,
    )
  })
  it('no inventa mediciones finales ni reglas de efluentes que faltan en el esquema', async () => {
    const http = mockFetch()
    const reader = createSupabaseReader({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_fixture',
      fetchImpl: http,
    })
    expect(
      await reader.loadContext(
        { id: userId, role: 'supervisor' },
        bodyForCase(12) as Parameters<typeof reader.loadContext>[1],
        token,
        new AbortController().signal,
      ),
    ).toBeNull()
    expect(http).not.toHaveBeenCalled()
  })
  it('reutiliza calcularDesvio solo cuando existe un registro inequívoco', async () => {
    const http = vi.fn<typeof fetch>(async (url) => {
      const path = new URL(String(url)).pathname
      return response(
        path.endsWith('/tareas')
          ? [
              {
                id: taskId,
                area_id: areaId,
                producto_id: productId,
                nivel_suciedad: 'media',
              },
            ]
          : path.endsWith('/areas')
            ? [{ superficie_m2: 100, litros_solucion_por_m2: 0.1 }]
            : path.endsWith('/productos')
              ? [
                  {
                    dilucion_min_ml_por_litro: 20,
                    dilucion_ml_por_litro: 50,
                    dilucion_max_ml_por_litro: 100,
                  },
                ]
              : [{ litros_agua_reales: 9.5, ml_producto_reales: 500 }],
      )
    })
    const reader = createSupabaseReader({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_fixture',
      fetchImpl: http,
    })
    const input = { ...bodyForCase(), kind: 'deviation' as const }
    expect(
      await reader.loadContext(
        { id: userId, role: 'supervisor' },
        input,
        token,
        new AbortController().signal,
      ),
    ).toMatchObject({
      kind: 'deviation',
      result: { sobredosis: false, ml_por_litro_real: 50 },
    })
    http.mockImplementation(async (url) => {
      if (new URL(String(url)).pathname.endsWith('/registros_uso'))
        return response([
          { litros_agua_reales: 9.5, ml_producto_reales: 500 },
          { litros_agua_reales: 10, ml_producto_reales: 100 },
        ])
      return response([])
    })
    expect(
      await reader.loadContext(
        { id: userId, role: 'supervisor' },
        input,
        token,
        new AbortController().signal,
      ),
    ).toBeNull()
  })
  it('no oculta una repetición que incumple al construir la comparación desde registros autorizados', async () => {
    const variantA = '55555555-5555-4555-8555-555555555555'
    const variantB = '66666666-6666-4666-8666-666666666666'
    const recordIds = [
      '77777777-7777-4777-8777-777777777777',
      '88888888-8888-4888-8888-888888888888',
      '99999999-9999-4999-8999-999999999999',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ]
    const http = vi.fn<typeof fetch>(async (url) => {
      const parsed = new URL(String(url))
      const path = parsed.pathname
      return response(
        path.endsWith('/tareas')
          ? [
              {
                id: taskId,
                area_id: areaId,
                producto_id: productId,
                nivel_suciedad: 'media',
              },
            ]
          : path.endsWith('/areas')
            ? [{ superficie_m2: 100, litros_solucion_por_m2: 0.1 }]
            : path.endsWith('/productos')
              ? [
                  {
                    dilucion_min_ml_por_litro: 20,
                    dilucion_ml_por_litro: 50,
                    dilucion_max_ml_por_litro: 100,
                  },
                ]
              : path.endsWith('/variantes')
                ? [
                    { id: variantA, nombre: 'A' },
                    { id: variantB, nombre: 'B' },
                  ]
                : path.endsWith('/registros_uso')
                  ? recordIds.map((id, index) => ({
                      id,
                      variante_id: index < 2 ? variantA : variantB,
                      litros_agua_reales: 10,
                      ml_producto_reales: index < 2 ? 80 : 10,
                      marca: 'medido',
                      fuente: 'manual',
                    }))
                  : [
                      {
                        cumple_criterio:
                          parsed.searchParams.get('registro_uso_id') !==
                          `eq.${recordIds[3]}`,
                      },
                    ],
      )
    })
    const reader = createSupabaseReader({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_fixture',
      fetchImpl: http,
    })
    const result = await reader.loadContext(
      { id: userId, role: 'supervisor' },
      { ...bodyForCase(), kind: 'comparison' },
      token,
      new AbortController().signal,
    )
    expect(result).toMatchObject({
      kind: 'comparison',
      result: { recomendada: variantA },
    })
    if (result?.kind !== 'comparison') throw new Error('Resultado inesperado')
    expect(
      result.result.resumen.find((row) => row.variante_id === variantB)
        ?.elegible,
    ).toBe(false)
  })
  it('conserva verify_jwt predeterminado y configura importaciones Deno sin cambiar P0', () => {
    const configuration = readFileSync(
      new URL('../../../../supabase/config.toml', import.meta.url),
      'utf8',
    )
    expect(configuration).not.toMatch(
      /\[functions\.llm-explainer\][\s\S]*?verify_jwt\s*=\s*false/,
    )
    const imports = JSON.parse(
      readFileSync(
        new URL(
          '../../../../supabase/functions/llm-explainer/deno.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ).imports
    expect(imports['@ecocleaner/schemas']).toBe(
      '../../../packages/schemas/src/index.ts',
    )
    expect(imports['../../../packages/core/src/receta']).toBe(
      '../../../packages/core/src/receta.ts',
    )
  })
})
