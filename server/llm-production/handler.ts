import { createHash, randomUUID } from 'node:crypto'
import {
  containsSecret,
  prepareContext,
} from '../../packages/core/server/llm/context.ts'
import {
  createGroqProvider,
  GROQ_ENDPOINT,
  GROQ_MODEL,
  readBoundedText,
} from '../../packages/core/server/llm/groq.ts'
import {
  budgetAppFacts,
  isLivePayload,
} from '../../scripts/groq-live-local/app-context.ts'
import {
  createChatResponder,
  prepareChatRequest,
} from '../../scripts/groq-live-local/chat.ts'
import { estimateTokens } from '../../scripts/groq-live-local/token-budget.mjs'
import {
  createProductionStore,
  ProductionFailure,
  type ProductionStore,
} from './store.ts'

type Environment = Record<string, string | undefined>
const MAX_OUTPUT = 768
const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i
const json = (status: number, body: unknown) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Authorization',
      'Referrer-Policy': 'no-referrer',
    },
  })

async function readBody(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json')
    throw new ProductionFailure('JSON_REQUIRED', 415)
  if (Number(request.headers.get('content-length')) > 256_000)
    throw new ProductionFailure('BODY_TOO_LARGE', 413)
  const reader = request.body?.getReader()
  if (!reader) throw new ProductionFailure('INVALID_BODY', 400)
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 256_000) {
        await reader.cancel()
        throw new ProductionFailure('BODY_TOO_LARGE', 413)
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof ProductionFailure) throw error
    throw new ProductionFailure('INVALID_BODY', 400)
  } finally {
    reader.releaseLock()
  }
}

export function createProductionHandler(
  env: Environment,
  options: { store?: ProductionStore; transport?: typeof fetch } = {},
) {
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url)
      const stateRequest =
        url.pathname === '/api/app/state' && request.method === 'GET'
      const questionRequest =
        url.pathname === '/api/app/question' && request.method === 'POST'
      if (!stateRequest && !questionRequest)
        return json(404, { code: 'NOT_FOUND' })
      if (
        env.LLM_PRODUCTION_ENABLED !== 'true' ||
        env.LLM_EXTERNAL_CALLS_APPROVED !== 'true' ||
        !env.GROQ_API_KEY
      )
        throw new ProductionFailure('PRODUCTION_NOT_CONFIGURED')
      if (
        !env.LLM_ALLOWED_ORIGIN ||
        new URL(env.LLM_ALLOWED_ORIGIN).protocol !== 'https:' ||
        url.origin !== env.LLM_ALLOWED_ORIGIN
      )
        throw new ProductionFailure('ORIGIN_NOT_ALLOWED', 403)
      if (url.search || url.hash)
        throw new ProductionFailure('INVALID_URL', 400)
      const origin = request.headers.get('origin')
      if (
        (origin && origin !== env.LLM_ALLOWED_ORIGIN) ||
        (questionRequest && !origin)
      )
        throw new ProductionFailure('ORIGIN_NOT_ALLOWED', 403)
      const authorization = request.headers.get('authorization') ?? ''
      if (!/^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(authorization))
        throw new ProductionFailure('AUTH_REQUIRED', 401)
      const token = authorization.slice(7)
      const store =
        options.store ??
        createProductionStore(
          {
            url: env.SUPABASE_URL ?? '',
            publicKey: env.SUPABASE_ANON_KEY ?? '',
            secretKey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
          },
          options.transport,
        )
      const actor = await store.identity(token, AbortSignal.timeout(8000))
      if (!actor) throw new ProductionFailure('SUPERVISOR_REQUIRED', 403)
      if (stateRequest) return json(200, await store.state())
      const body = await readBody(request)
      if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).some(
          (key) => !['question', 'data', 'historyIds'].includes(key),
        )
      )
        throw new ProductionFailure('INVALID_BODY', 400)
      if (
        typeof body.question !== 'string' ||
        !body.question.trim() ||
        body.question.length > 700 ||
        containsSecret(body.question) ||
        body.question.includes(env.GROQ_API_KEY) ||
        /[<>@]|https?:\/\//i.test(body.question)
      )
        throw new ProductionFailure('INVALID_QUESTION', 400)
      if (!isLivePayload(body.data))
        throw new ProductionFailure('INVALID_APP_CONTEXT', 400)
      const ids: string[] = body.historyIds ?? []
      if (
        !Array.isArray(ids) ||
        ids.length > 3 ||
        new Set(ids).size !== ids.length ||
        !ids.every((id) => typeof id === 'string' && uuid.test(id))
      )
        throw new ProductionFailure('INVALID_HISTORY', 400)
      const fingerprint = createHash('sha256')
        .update(JSON.stringify(body.data))
        .digest('hex')
      const previous = await store.history(actor, ids, fingerprint)
      const history = previous.flatMap((turn) => [
        { role: 'user' as const, content: turn.question },
        {
          role: 'assistant' as const,
          content: turn.result.answer.slice(0, 1600),
        },
      ])
      const state = await store.state()
      if (!state.appDataApproved || state.halted)
        throw new ProductionFailure(
          state.halted ?? 'PRODUCTION_NOT_CONFIGURED',
          503,
        )
      const capacity = Math.min(
        8000,
        state.authorizedTokenBudget - state.usedTokenBudget,
      )
      if (capacity < 1468)
        throw new ProductionFailure('DAILY_TOKEN_BUDGET', 429)
      let telemetry: {
        model: string
        httpStatus: number
        elapsedMs: number
        responseId: string
        usage: { totalTokens: number } | null
      } | null = null
      const started = performance.now()
      let calls = 0
      const provider = createGroqProvider({
        apiKey: env.GROQ_API_KEY,
        externalCallsApproved: true,
        reasoningEffort: 'low',
        responseFormat: 'text',
        estimateInputTokens: estimateTokens,
        fetchImpl: async (endpoint, init) => {
          if (
            endpoint !== GROQ_ENDPOINT ||
            init?.method !== 'POST' ||
            ++calls !== 1
          )
            throw new Error('UNEXPECTED_PROVIDER_CALL')
          const response = await (options.transport ?? fetch)(endpoint, {
            ...init,
            redirect: 'error',
          })
          telemetry = {
            model: GROQ_MODEL,
            httpStatus: response.status,
            elapsedMs: Math.round(performance.now() - started),
            responseId: '',
            usage: null,
          }
          const text = await readBoundedText(
            response.clone(),
            32_000,
            init.signal ?? AbortSignal.timeout(20000),
          )
          if (text.includes(env.GROQ_API_KEY!) || containsSecret(text)) {
            await response.body?.cancel()
            throw new Error('RESPONSE_WITHHELD')
          }
          try {
            const decoded = JSON.parse(text)
            const usage = decoded.usage
            if (
              usage &&
              [
                usage.prompt_tokens,
                usage.completion_tokens,
                usage.total_tokens,
              ].every((value) => Number.isSafeInteger(value) && value >= 0) &&
              usage.total_tokens > 0 &&
              usage.total_tokens ===
                usage.prompt_tokens + usage.completion_tokens
            )
              telemetry.usage = { totalTokens: usage.total_tokens }
            if (
              typeof decoded.id === 'string' &&
              /^[A-Za-z0-9_-]{1,120}$/.test(decoded.id)
            )
              telemetry.responseId = decoded.id
          } catch {
            /* No persistir errores privados ni razonamiento del proveedor. */
          }
          return response
        },
      })
      const countInput = (
        request: Parameters<typeof provider.countInputTokens>[0],
      ) => {
        const count = provider.countInputTokens(request)
        if (typeof count !== 'number')
          throw new ProductionFailure('INPUT_BUDGET', 413)
        return count
      }
      let facts
      try {
        facts = budgetAppFacts(body.data, body.question, (candidate) => {
          const context = prepareContext({
            context: { kind: 'overview', result: { facts: candidate } },
            question: body.question,
            disclosure: 'approved_for_external_processing',
          })
          return (
            !!context &&
            countInput({
              ...prepareChatRequest(body.question, context, history),
              maxOutputTokens: MAX_OUTPUT,
            }) +
              MAX_OUTPUT <=
              capacity
          )
        })
      } catch {
        throw new ProductionFailure(
          capacity < 8000 ? 'DAILY_TOKEN_BUDGET' : 'APP_CONTEXT_BUDGET',
          413,
        )
      }
      const input = {
        context: { kind: 'overview' as const, result: { facts } },
        question: body.question,
        disclosure: 'approved_for_external_processing' as const,
      }
      const context = prepareContext(input)
      if (!context) throw new ProductionFailure('INVALID_APP_CONTEXT', 400)
      const reserve =
        countInput({
          ...prepareChatRequest(body.question, context, history),
          maxOutputTokens: MAX_OUTPUT,
        }) + MAX_OUTPUT
      if (
        !Number.isSafeInteger(reserve) ||
        reserve > capacity ||
        reserve - MAX_OUTPUT > 7000
      )
        throw new ProductionFailure('INPUT_BUDGET', 413)
      const id = randomUUID()
      await store.reserve({
        id,
        actor,
        tokens: reserve,
        fingerprint,
        question: body.question,
      })
      // Desde este punto un aborto conserva la reserva, incluso si la función no llega a finalizar.
      const result = await createChatResponder(provider, MAX_OUTPUT)(input, {
        signal: request.signal,
        history,
      })
      const captured = telemetry as {
        model: string
        httpStatus: number
        elapsedMs: number
        responseId: string
        usage: { totalTokens: number } | null
      } | null
      const next = await store.finish(
        id,
        captured?.usage?.totalTokens ?? null,
        result,
        captured,
        !!captured && [401, 403, 429].includes(captured.httpStatus),
      )
      return json(200, {
        id,
        result,
        telemetry: captured,
        coverage: {
          available: facts['alcance.hechos_disponibles'],
          included: facts['alcance.hechos_incluidos'],
          partial: facts['alcance.detalle_parcial'],
        },
        state: next,
      })
    } catch (error) {
      return error instanceof ProductionFailure
        ? json(error.status, { code: error.code })
        : json(503, { code: 'SERVER_UNAVAILABLE' })
    }
  }
}
