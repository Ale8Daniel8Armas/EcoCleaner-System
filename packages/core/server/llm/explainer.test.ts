import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  Explanation,
  ExplanationInput,
  LLMProvider,
  ProviderRequest,
  ProviderResponse,
} from './contracts'
import { createLLMExplainer, SYSTEM_PROMPT } from './explainer'
import { createEvaluationCases } from './testing/evaluation-cases'

const cases = createEvaluationCases()
const mockProvider = (
  explanation: Explanation = cases[0].simulatedResponse,
) => ({
  name: 'simulated-tests-only',
  mode: 'simulated' as const,
  // Conteos ficticios; no tokenizador ni medición de un proveedor real.
  countInputTokens: vi.fn(() => 500),
  generate: vi.fn(
    async (_request: ProviderRequest): Promise<ProviderResponse> => ({
      json: JSON.stringify(explanation),
      usage: { inputTokens: 500, outputTokens: 100 },
    }),
  ),
})
const clone = <T>(value: T): T => structuredClone(value)

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('batería técnica con proveedor simulado; calidad LLM real NOT RUN', () => {
  it.each(cases)('$id: $category', async (testCase) => {
    const original = clone(testCase.input)
    const provider = mockProvider(testCase.simulatedResponse)
    const result = await createLLMExplainer({ provider })(testCase.input)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('simulation')
    expect(result.explanation.humanReviewRequired).toBe(true)
    for (const id of testCase.mustPreserve) {
      expect(result.explanation.evidenceIds).toContain(id)
      expect(Object.hasOwn(result.evidence, id)).toBe(true)
    }
    expect(testCase.input).toEqual(original)
    expect(provider.generate).toHaveBeenCalledTimes(1)
  })
})

describe('contrato, confidencialidad y límites del explicador', () => {
  it('permanece desconectado por defecto con respaldo estático explícito', async () => {
    expect(await createLLMExplainer()(cases[0].input)).toMatchObject({
      ok: false,
      code: 'PROVIDER_NOT_CONFIGURED',
      fallback: { source: 'template', humanReviewRequired: true },
    })
  })
  it.each([
    null,
    {},
    { ...cases[0].input, disclosure: undefined },
    {
      ...cases[0].input,
      context: {
        kind: 'recipe',
        result: { ...cases[0].input.context.result, litros_solucion: NaN },
      },
    },
  ])(
    'rechaza entrada incompleta, sin permiso o no finita %#',
    async (input) => {
      const provider = mockProvider()
      expect(
        await createLLMExplainer({ provider })(input as ExplanationInput),
      ).toMatchObject({ ok: false, code: 'INVALID_INPUT' })
      expect(provider.generate).not.toHaveBeenCalled()
    },
  )
  it('rechaza ciclos y un contexto demasiado grande antes de invocar al proveedor', async () => {
    const provider = mockProvider()
    const explain = createLLMExplainer({ provider })
    const cyclic = clone(cases[0].input) as ExplanationInput & {
      self?: unknown
    }
    cyclic.self = cyclic
    expect(await explain(cyclic)).toMatchObject({ code: 'INVALID_INPUT' })
    expect(
      await explain({ ...cases[0].input, question: 'x'.repeat(25_000) }),
    ).toMatchObject({ code: 'INPUT_LIMIT' })
    expect(provider.generate).not.toHaveBeenCalled()
  })
  it('rechaza resultados contradictorios antes de invocar al proveedor', async () => {
    const provider = mockProvider()
    const explain = createLLMExplainer({ provider })
    const contradictoryComparison = clone(cases[5].input)
    if (contradictoryComparison.context.kind !== 'comparison')
      throw new Error('Fixture incorrecto')
    contradictoryComparison.context.result.resumen[1].elegible = false
    expect(await explain(contradictoryComparison)).toMatchObject({
      code: 'INVALID_INPUT',
    })
    const contradictoryEffluent = clone(cases[11].input)
    if (contradictoryEffluent.context.kind !== 'effluent')
      throw new Error('Fixture incorrecto')
    contradictoryEffluent.context.result.origen_ph = 'medido_efluente'
    expect(await explain(contradictoryEffluent)).toMatchObject({
      code: 'INVALID_INPUT',
    })
    expect(provider.generate).not.toHaveBeenCalled()
  })
  it('no envía campos adicionales ni datos de tablas ajenas al contexto', async () => {
    const provider = mockProvider()
    const input = {
      ...clone(cases[0].input),
      private_site_name: 'EMPRESA_PRIVADA_NO_ENVIAR',
    }
    await createLLMExplainer({ provider })(input)
    const request = provider.generate.mock.calls[0][0]
    expect(request.user).not.toContain('EMPRESA_PRIVADA_NO_ENVIAR')
    expect(Object.keys(request).sort()).toEqual([
      'maxOutputTokens',
      'signal',
      'system',
      'user',
    ])
  })
  it('rechaza secretos aparentes de entrada sin hacer llamadas externas', async () => {
    const provider = mockProvider()
    expect(
      await createLLMExplainer({ provider })({
        ...cases[0].input,
        observations: `sk-${'x'.repeat(32)}`,
      }),
    ).toMatchObject({ code: 'INVALID_INPUT' })
    expect(provider.countInputTokens).not.toHaveBeenCalled()
  })
  it('aísla instrucciones maliciosas en el JSON de datos, conserva el sistema y no hace fetch', async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('No se permiten conexiones en pruebas.')
    })
    vi.stubGlobal('fetch', fetchSpy)
    const provider = mockProvider(cases[13].simulatedResponse)
    const result = await createLLMExplainer({ provider })(cases[13].input)
    const calls = provider.generate.mock.calls
    expect(calls[0][0].system).toBe(SYSTEM_PROMPT)
    expect(JSON.parse(calls[0][0].user).observations).toBe(
      cases[13].input.observations,
    )
    expect(result).toMatchObject({
      ok: true,
      source: 'simulation',
      explanation: { recommendation: { targetVariantId: 'B' } },
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  it('mantiene los valores del core sin escrituras en Supabase ni dependencias del navegador', () => {
    for (const file of [
      'explainer.ts',
      'context.ts',
      'response.ts',
      'contracts.ts',
      'index.ts',
    ]) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8')
      expect(source).not.toMatch(
        /(?:from|import)\s*['"][^'"]*(?:supabase|react)/i,
      )
      expect(source).not.toMatch(
        /\.from\(['"]|\.insert\(|\.update\(|\.delete\(|VITE_/,
      )
    }
  })
  it('bloquea su uso desde un entorno de navegador', () => {
    vi.stubGlobal('window', {})
    expect(() => createLLMExplainer()).toThrow('servidor Node.js')
  })
  it.each([0, -1, 1.2, Infinity])(
    'rechaza límites de configuración inválidos %s',
    (value) => {
      expect(() => createLLMExplainer({ timeoutMs: value })).toThrow()
    },
  )
  it('no invoca generación si se excede el presupuesto de entrada', async () => {
    const provider = mockProvider()
    expect(
      await createLLMExplainer({ provider, maxInputTokens: 499 })(
        cases[0].input,
      ),
    ).toMatchObject({ code: 'INPUT_LIMIT' })
    expect(provider.generate).not.toHaveBeenCalled()
  })
  it('no acepta contadores de entrada inválidos', async () => {
    const provider = mockProvider()
    provider.countInputTokens.mockReturnValue(NaN)
    expect(
      await createLLMExplainer({ provider })(cases[0].input),
    ).toMatchObject({ code: 'PROVIDER_ERROR' })
    expect(provider.generate).not.toHaveBeenCalled()
  })
  it('descarta una respuesta que excede el límite de tokens de salida', async () => {
    const provider = mockProvider()
    expect(
      await createLLMExplainer({ provider, maxOutputTokens: 99 })(
        cases[0].input,
      ),
    ).toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it('oculta errores del proveedor y no registra contenido sensible', async () => {
    const provider = mockProvider()
    provider.generate.mockRejectedValue(new Error('PROVIDER_PRIVATE_MESSAGE'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await createLLMExplainer({ provider })(cases[0].input)
    expect(result).toMatchObject({
      ok: false,
      code: 'PROVIDER_ERROR',
      fallback: { source: 'template' },
    })
    expect(JSON.stringify(result)).not.toContain('PROVIDER_PRIVATE_MESSAGE')
    expect(errorSpy).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
  })
  it('limita frecuencia y permite otra solicitud al vencer la ventana', async () => {
    vi.useFakeTimers()
    const provider = mockProvider()
    const explain = createLLMExplainer({ provider, maxRequestsPerMinute: 1 })
    expect((await explain(cases[0].input)).ok).toBe(true)
    expect(await explain(cases[0].input)).toMatchObject({ code: 'RATE_LIMIT' })
    vi.advanceTimersByTime(60_001)
    expect((await explain(cases[0].input)).ok).toBe(true)
  })
  it('cancela un contador colgado dentro del timeout y no inicia generación posteriormente', async () => {
    vi.useFakeTimers()
    let finishCount!: (value: number) => void
    const provider = mockProvider()
    const slowProvider: LLMProvider = {
      ...provider,
      countInputTokens: () =>
        new Promise((resolve) => {
          finishCount = resolve
        }),
    }
    const pending = createLLMExplainer({
      provider: slowProvider,
      timeoutMs: 50,
    })(cases[0].input)
    await vi.advanceTimersByTimeAsync(51)
    expect(await pending).toMatchObject({ code: 'TIMEOUT' })
    finishCount(500)
    await Promise.resolve()
    expect(provider.generate).not.toHaveBeenCalled()
  })
  it('conserva la plaza de una llamada que ignora abort hasta que el proveedor termine', async () => {
    vi.useFakeTimers()
    let finish!: (value: ProviderResponse) => void
    let receivedSignal!: AbortSignal
    const provider = mockProvider()
    const slowProvider: LLMProvider = {
      ...provider,
      generate: (request) => {
        receivedSignal = request.signal
        return new Promise((resolve) => {
          finish = resolve
        })
      },
    }
    const explain = createLLMExplainer({
      provider: slowProvider,
      timeoutMs: 50,
      maxConcurrentRequests: 1,
    })
    const pending = explain(cases[0].input)
    await Promise.resolve()
    expect(await explain(cases[0].input)).toMatchObject({ code: 'BUSY' })
    await vi.advanceTimersByTimeAsync(51)
    expect(await pending).toMatchObject({ code: 'TIMEOUT' })
    expect(receivedSignal.aborted).toBe(true)
    expect(await explain(cases[0].input)).toMatchObject({ code: 'BUSY' })
    finish({
      json: JSON.stringify(cases[0].simulatedResponse),
      usage: { inputTokens: 500, outputTokens: 100 },
    })
    await Promise.resolve()
    await Promise.resolve()
    const next = explain(cases[0].input)
    await vi.advanceTimersByTimeAsync(51)
    expect(await next).toMatchObject({ code: 'TIMEOUT' })
  })
  it('atiende cancelación del llamador antes y durante la generación', async () => {
    const controller = new AbortController()
    const provider = mockProvider()
    controller.abort()
    expect(
      await createLLMExplainer({ provider })(cases[0].input, {
        signal: controller.signal,
      }),
    ).toMatchObject({ code: 'CANCELLED' })
    expect(provider.generate).not.toHaveBeenCalled()
    const during = new AbortController()
    const waiting: LLMProvider = {
      ...provider,
      generate: () => new Promise(() => {}),
    }
    const pending = createLLMExplainer({ provider: waiting })(cases[0].input, {
      signal: during.signal,
    })
    await Promise.resolve()
    during.abort()
    expect(await pending).toMatchObject({ code: 'CANCELLED' })
  })
})

describe('rechazo de respuestas no fundamentadas o inseguras', () => {
  const invalidResponses = [
    'no es JSON',
    '{}',
    '[]',
    JSON.stringify({
      ...cases[0].simulatedResponse,
      humanReviewRequired: false,
    }),
    JSON.stringify({
      ...cases[0].simulatedResponse,
      evidenceIds: ['result.inventado'],
    }),
    JSON.stringify({
      ...cases[0].simulatedResponse,
      summary: 'Se requieren 999 ml de producto.',
    }),
    JSON.stringify({
      ...cases[0].simulatedResponse,
      summary: 'Ahorro del 50 %.',
    }),
    JSON.stringify({ ...cases[0].simulatedResponse, limitations: [] }),
    JSON.stringify({
      ...cases[0].simulatedResponse,
      tool_call: { command: 'modificar datos' },
    }),
    JSON.stringify({
      ...cases[0].simulatedResponse,
      summary: `<script>alert('x')</script>`,
    }),
    JSON.stringify({
      ...cases[0].simulatedResponse,
      summary: `sk-${'x'.repeat(32)}`,
    }),
    JSON.stringify({
      ...cases[0].simulatedResponse,
      summary: 'x'.repeat(13_000),
    }),
  ]
  it.each(invalidResponses)(
    'descarta formato o contenido inválido %# sin inventar una respuesta correcta',
    async (json) => {
      const provider = mockProvider()
      provider.generate.mockResolvedValue({
        json,
        usage: { inputTokens: 500, outputTokens: 100 },
      })
      expect(
        await createLLMExplainer({ provider })(cases[0].input),
      ).toMatchObject({
        ok: false,
        code: 'INVALID_RESPONSE',
        fallback: { source: 'template' },
      })
    },
  )
  it.each([
    'Puede verter el efluente.',
    'Mezcla ácido para neutralizar.',
    'El vertido está autorizado.',
    'Cumple la normativa TULSMA.',
    'Es estadísticamente significativo.',
  ])('rechaza afirmación crítica: %s', async (summary) => {
    const provider = mockProvider({ ...cases[12].simulatedResponse, summary })
    expect(
      await createLLMExplainer({ provider })(cases[12].input),
    ).toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it('rechaza recomendar otra variante, una inelegible o un desempate unilateral', async () => {
    for (const index of [4, 5, 6]) {
      const response = clone(cases[index].simulatedResponse)
      response.recommendation.action = 'review_variant'
      response.recommendation.targetVariantId = index === 5 ? 'A' : 'B'
      expect(
        await createLLMExplainer({ provider: mockProvider(response) })(
          cases[index].input,
        ),
      ).toMatchObject({ code: 'INVALID_RESPONSE' })
    }
  })
  it('rechaza ocultar la sobredosis o declarar compatibilidad', async () => {
    for (const [index, summary] of [
      [1, 'No hay sobredosis.'],
      [10, 'Los productos son compatibles.'],
    ] as const) {
      const provider = mockProvider({
        ...cases[index].simulatedResponse,
        summary,
      })
      expect(
        await createLLMExplainer({ provider })(cases[index].input),
      ).toMatchObject({ code: 'INVALID_RESPONSE' })
    }
  })
  it('exige una referencia numérica explícita para cada cifra de la narración', async () => {
    const response = clone(cases[0].simulatedResponse)
    response.evidenceIds = ['result.litros_solucion']
    expect(
      await createLLMExplainer({ provider: mockProvider(response) })(
        cases[0].input,
      ),
    ).toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})
