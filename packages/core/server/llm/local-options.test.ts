import { describe, expect, it, vi } from 'vitest'
import type { LLMProvider, ProviderRequest } from './contracts.ts'
import { createLLMExplainer, SYSTEM_PROMPT } from './explainer.ts'
import { createGroqProvider, GROQ_MODEL } from './groq.ts'
import { createEvaluationCases } from './testing/evaluation-cases.ts'

const sample = createEvaluationCases()[0]

describe('opciones de servidor para la validación local; sin proveedor real', () => {
  it.each([undefined, 'Explica únicamente los hechos en español.'])(
    'utiliza el mensaje de servidor solicitado conservando el valor predeterminado: %s',
    async (systemPrompt) => {
      const generate = vi.fn(async (_request: ProviderRequest) => ({
        json: JSON.stringify(sample.simulatedResponse),
        usage: { inputTokens: 100, outputTokens: 100 },
      }))
      const provider: LLMProvider = {
        name: 'simulated-options-only',
        mode: 'simulated',
        countInputTokens: () => 100,
        generate,
      }
      expect(
        (await createLLMExplainer({ provider, systemPrompt })(sample.input)).ok,
      ).toBe(true)
      expect(generate.mock.calls[0]?.[0]?.system).toBe(
        systemPrompt ?? SYSTEM_PROMPT,
      )
    },
  )
  it.each(['', 'x'.repeat(5001)])(
    'rechaza un mensaje de sistema inválido',
    (systemPrompt) => {
      expect(() => createLLMExplainer({ systemPrompt })).toThrow()
    },
  )
  it('conserva el validador de respuesta con un mensaje local diferente', async () => {
    const provider: LLMProvider = {
      name: 'simulated-invalid-only',
      mode: 'simulated',
      countInputTokens: () => 100,
      generate: async () => ({
        json: JSON.stringify({
          ...sample.simulatedResponse,
          summary: 'La receta indica 999 litros.',
        }),
        usage: { inputTokens: 100, outputTokens: 100 },
      }),
    }
    expect(
      await createLLMExplainer({
        provider,
        systemPrompt: 'Explica los hechos.',
      })(sample.input),
    ).toMatchObject({ ok: false, code: 'INVALID_RESPONSE' })
  })
  it('envía low al adaptador y lo incluye en el presupuesto del cuerpo', async () => {
    let sent: Record<string, unknown> | undefined
    const provider = createGroqProvider({
      apiKey: 'unit-options-only',
      externalCallsApproved: true,
      reasoningEffort: 'low',
      fetchImpl: async (_url, init) => {
        sent = JSON.parse(String(init?.body))
        return new Response(
          JSON.stringify({
            model: GROQ_MODEL,
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  role: 'assistant',
                  content: JSON.stringify(sample.simulatedResponse),
                },
              },
            ],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 100,
              total_tokens: 200,
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
    const budget = provider.countInputTokens(request)
    await provider.generate(request)
    expect(sent?.reasoning_effort).toBe('low')
    expect(budget).toBe(
      new TextEncoder().encode(JSON.stringify(sent)).length + 1024,
    )
  })
  it('rechaza un esfuerzo no admitido sin invocar HTTP', () => {
    const fetchImpl = vi.fn<typeof fetch>()
    expect(() =>
      createGroqProvider({
        apiKey: 'unit-options-only',
        externalCallsApproved: true,
        reasoningEffort: 'unsupported' as never,
        fetchImpl,
      }),
    ).toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
