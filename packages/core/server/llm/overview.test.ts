import { describe, expect, it } from 'vitest'
import { prepareContext } from './context.ts'
import { validateExplanation } from './response.ts'
import { createGroqProvider, GROQ_MODEL } from './groq.ts'

const context = prepareContext({
  question: '¿Qué sabemos sobre estos resultados?',
  disclosure: 'approved_for_external_processing',
  context: {
    kind: 'overview',
    result: {
      facts: {
        'TA.desvio_pct_redondeado': 37.25,
        'alertas.sobredosis': 1,
        'limites.causas': 'No hay causas verificadas.',
      },
    },
  },
})!
const answer = {
  summary: 'TA tiene un desvío de 37,25 %; la causa no está documentada.',
  consumptionAnalysis: null,
  evidenceIds: ['TA.desvio_pct_redondeado', 'limites.causas'],
  limitations: ['Falta una causa verificada.'],
  humanReviewRequired: true,
  recommendation: {
    action: 'review_records',
    targetVariantId: null,
    text: 'Revisar los registros de TA.',
    justification: 'Falta evidencia de las causas.',
  },
}
describe('contexto general de servidor', () => {
  it('el modo de chat envía texto e historial sin imponer JSON ni exponer razonamiento', async () => {
    let body: Record<string, any> = {}
    const provider = createGroqProvider({
      apiKey: 'unit-chat-only',
      externalCallsApproved: true,
      responseFormat: 'text',
      fetchImpl: async (_url, init) => {
        body = JSON.parse(String(init?.body))
        return new Response(
          JSON.stringify({
            model: GROQ_MODEL,
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  role: 'assistant',
                  content: 'Hola, puedo ayudarte.',
                },
              },
            ],
            usage: {
              prompt_tokens: 20,
              completion_tokens: 10,
              total_tokens: 30,
            },
          }),
        )
      },
    })
    const response = await provider.generate({
      system: 'Conversa.',
      user: 'Gracias',
      history: [
        { role: 'user', content: 'Hola' },
        { role: 'assistant', content: 'Hola.' },
      ],
      maxOutputTokens: 768,
      signal: new AbortController().signal,
    })
    expect(body.response_format).toBeUndefined()
    expect(body.include_reasoning).toBe(false)
    expect(body.messages).toHaveLength(4)
    expect(response.json).toBe('Hola, puedo ayudarte.')
  })
  it('identifica json_validate_failed como formato inválido sin reintentar ni mostrar mensajes privados', async () => {
    let calls = 0
    const provider = createGroqProvider({
      apiKey: 'unit-format-error-only',
      externalCallsApproved: true,
      fetchImpl: async () => {
        calls++
        return new Response(
          JSON.stringify({
            error: {
              code: 'json_validate_failed',
              message: 'detalle privado del proveedor',
            },
          }),
          { status: 400 },
        )
      },
    })
    await expect(
      provider.generate({
        system: 'Explica.',
        user: '{}',
        maxOutputTokens: 768,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE', reason: 'format' })
    expect(calls).toBe(1)
  })
  it('permite cifras de presentación citadas sin recalcular ni elegir variantes globales', () => {
    expect(context.allowedActions).not.toContain('review_variant')
    expect(validateExplanation(JSON.stringify(answer), context)).toEqual(answer)
  })
  it.each([
    'La causa probable es la variación del proceso.',
    'El desvío se debe a la suciedad.',
  ])('rechaza inferencias causales no disponibles: %s', (summary) => {
    expect(
      validateExplanation(JSON.stringify({ ...answer, summary }), context),
    ).toBeNull()
  })
  it('rechaza negar alertas existentes, números nuevos y referencias inexistentes', () => {
    for (const patch of [
      { summary: 'No hay sobredosis.' },
      { summary: 'Se consumieron 999 litros.' },
      { summary: 'La tarea 1 supera el máximo.' },
      { evidenceIds: ['no.existe'] },
      { limitations: [] },
    ])
      expect(
        validateExplanation(JSON.stringify({ ...answer, ...patch }), context),
      ).toBeNull()
  })
  it('rechaza recomendaciones de vertido incluso con el infinitivo incorrecto observado en la prueba real', () => {
    expect(
      validateExplanation(
        JSON.stringify({
          ...answer,
          recommendation: {
            ...answer.recommendation,
            text: 'Solicitar mediciones de pH antes de vertir.',
          },
        }),
        context,
      ),
    ).toBeNull()
  })
  it('rechaza objetos, secretos y claves arbitrarias en hechos preparados', () => {
    for (const facts of [
      { campo: {} },
      { 'nombre@correo': 'dato' },
      { campo: 'persona@example.invalid' },
    ])
      expect(
        prepareContext({
          question: 'Describe',
          disclosure: 'synthetic',
          context: { kind: 'overview', result: { facts } },
        } as never),
      ).toBeNull()
  })
  it('conserva el esquema original del adaptador y permite una estimación local de tokens', async () => {
    let body: Record<string, any> = {}
    const provider = createGroqProvider({
      apiKey: 'unit-overview-only',
      externalCallsApproved: true,
      estimateInputTokens: () => 100,
      fetchImpl: async (_url, init) => {
        body = JSON.parse(String(init?.body))
        return new Response(
          JSON.stringify({
            model: GROQ_MODEL,
            choices: [
              {
                finish_reason: 'stop',
                message: { role: 'assistant', content: JSON.stringify(answer) },
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30,
            },
          }),
        )
      },
    })
    const request = {
      system: 'Explica hechos.',
      user: '{}',
      maxOutputTokens: 768,
      signal: new AbortController().signal,
    }
    expect(provider.countInputTokens(request)).toBe(100)
    await provider.generate(request)
    expect(body.response_format.json_schema.strict).toBe(true)
    expect(
      body.response_format.json_schema.schema.properties.evidenceIds.items.type,
    ).toBe('string')
    expect(body.response_format.json_schema.schema.required).toContain(
      'limitations',
    )
  })
})
