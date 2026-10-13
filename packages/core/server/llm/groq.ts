import {
  ProviderFailure,
  REVIEW_ACTIONS,
  type LLMProvider,
  type ProviderRequest,
} from './contracts.ts'
import { isNumber, isObject } from './context.ts'

export const GROQ_MODEL = 'openai/gpt-oss-20b'
export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
export const GROQ_INPUT_BUDGET = 7000

const string = { type: 'string' }
const schema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'consumptionAnalysis',
    'recommendation',
    'evidenceIds',
    'limitations',
    'humanReviewRequired',
  ],
  properties: {
    summary: string,
    consumptionAnalysis: { anyOf: [string, { type: 'null' }] },
    recommendation: {
      type: 'object',
      additionalProperties: false,
      required: ['action', 'targetVariantId', 'text', 'justification'],
      properties: {
        action: { type: 'string', enum: [...REVIEW_ACTIONS] },
        targetVariantId: { anyOf: [string, { type: 'null' }] },
        text: string,
        justification: string,
      },
    },
    evidenceIds: { type: 'array', items: string },
    limitations: { type: 'array', items: string },
    humanReviewRequired: { type: 'boolean', enum: [true] },
  },
}

/** Lectura acotada también para cuerpos chunked; no conserva mensajes internos del proveedor. */
export async function readBoundedText(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  if (!response.body) throw new ProviderFailure('INVALID_RESPONSE', 'format')
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body.cancel()
    throw new ProviderFailure('INVALID_RESPONSE', 'format')
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  const cancel = () => {
    void reader.cancel().catch(() => {})
  }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    while (true) {
      if (signal.aborted) throw new ProviderFailure('PROVIDER_ERROR', 'network')
      const { value, done } = await reader.read()
      if (signal.aborted) throw new ProviderFailure('PROVIDER_ERROR', 'network')
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new ProviderFailure('INVALID_RESPONSE', 'format')
      }
      chunks.push(value)
    }
  } finally {
    signal.removeEventListener('abort', cancel)
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

export function createGroqProvider(options: {
  apiKey: string
  model?: string
  externalCallsApproved: boolean
  fetchImpl?: typeof fetch
}): LLMProvider {
  if (!options.apiKey.trim() || (options.model ?? GROQ_MODEL) !== GROQ_MODEL) {
    throw new Error(
      'Se requiere credencial de servidor y el modelo Groq aprobado.',
    )
  }
  const fetchImpl = options.fetchImpl ?? fetch
  const apiKey = options.apiKey
  const externalCallsApproved = options.externalCallsApproved === true
  const bodyFor = (request: Omit<ProviderRequest, 'signal'>) => ({
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.user },
    ],
    max_completion_tokens: request.maxOutputTokens,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'ecocleaner_explanation', strict: true, schema },
    },
    stream: false,
    n: 1,
  })
  return {
    name: 'groq-gpt-oss-20b',
    mode: 'external',
    inputTokenCounting: 'byte_budget',
    // Presupuesto conservador por bytes del cuerpo completo y margen de encuadre; NO es un tokenizador.
    countInputTokens: (request) =>
      new TextEncoder().encode(JSON.stringify(bodyFor(request))).length + 1024,
    generate: async (request) => {
      if (!externalCallsApproved)
        throw new ProviderFailure('PROVIDER_ERROR', 'disabled')
      if (request.signal.aborted)
        throw new ProviderFailure('PROVIDER_ERROR', 'network')
      if (
        !Number.isSafeInteger(request.maxOutputTokens) ||
        request.maxOutputTokens <= 0 ||
        request.maxOutputTokens > 1024
      ) {
        throw new ProviderFailure('INVALID_RESPONSE', 'format')
      }
      let response: Response
      try {
        response = await fetchImpl(GROQ_ENDPOINT, {
          method: 'POST',
          redirect: 'error',
          signal: request.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyFor(request)),
        })
      } catch {
        throw new ProviderFailure('PROVIDER_ERROR', 'network')
      }
      if (!response.ok) {
        await response.body?.cancel()
        if (response.status === 429)
          throw new ProviderFailure('RATE_LIMIT', 'rate_limit')
        throw new ProviderFailure(
          'PROVIDER_ERROR',
          response.status === 401 || response.status === 403
            ? 'authentication'
            : response.status === 404
              ? 'model'
              : 'network',
        )
      }
      try {
        const data: unknown = JSON.parse(
          await readBoundedText(response, 32_000, request.signal),
        )
        if (
          !isObject(data) ||
          data.model !== GROQ_MODEL ||
          !Array.isArray(data.choices) ||
          data.choices.length !== 1 ||
          !isObject(data.choices[0]) ||
          data.choices[0].finish_reason !== 'stop' ||
          !isObject(data.choices[0].message) ||
          data.choices[0].message.role !== 'assistant' ||
          typeof data.choices[0].message.content !== 'string' ||
          data.choices[0].message.tool_calls != null ||
          data.choices[0].message.function_call != null ||
          !isObject(data.usage)
        ) {
          throw new ProviderFailure('INVALID_RESPONSE', 'format')
        }
        const inputTokens = data.usage.prompt_tokens
        const outputTokens = data.usage.completion_tokens
        if (
          !isNumber(inputTokens) ||
          !isNumber(outputTokens) ||
          !Number.isSafeInteger(inputTokens) ||
          !Number.isSafeInteger(outputTokens) ||
          inputTokens <= 0 ||
          inputTokens > GROQ_INPUT_BUDGET ||
          outputTokens <= 0 ||
          outputTokens > request.maxOutputTokens ||
          data.usage.total_tokens !== inputTokens + outputTokens
        )
          throw new ProviderFailure('INVALID_RESPONSE', 'format')
        return {
          json: data.choices[0].message.content,
          usage: { inputTokens, outputTokens },
        }
      } catch (error) {
        throw error instanceof ProviderFailure
          ? error
          : new ProviderFailure('INVALID_RESPONSE', 'format')
      }
    },
  }
}
