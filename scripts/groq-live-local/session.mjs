import { randomUUID, createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import {
  createLLMExplainer,
  SYSTEM_PROMPT,
} from '../../packages/core/server/llm/explainer.ts'
import {
  containsSecret,
  prepareContext,
} from '../../packages/core/server/llm/context.ts'
import {
  createGroqProvider,
  GROQ_ENDPOINT,
  GROQ_INPUT_BUDGET,
  GROQ_MODEL,
  readBoundedText,
} from '../../packages/core/server/llm/groq.ts'
import { createEvaluationCases } from '../../packages/core/server/llm/testing/evaluation-cases.ts'

export class LocalFailure extends Error {
  constructor(code, status = 400, retryAfterMs = null) {
    super(code)
    this.code = code
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

const positive = (value) => Number.isSafeInteger(value) && value > 0
export function validateAccount(account) {
  if (
    account?.model !== GROQ_MODEL ||
    account.syntheticOnly !== true ||
    !Number.isFinite(Date.parse(account.freeTierConfirmedAt)) ||
    Date.now() - Date.parse(account.freeTierConfirmedAt) > 86_400_000 ||
    Date.parse(account.freeTierConfirmedAt) > Date.now() + 60_000 ||
    !positive(account.maxGenerations) ||
    account.maxGenerations > 11 ||
    !positive(account.authorizedTokenBudget) ||
    ![
      'requestsPerMinute',
      'requestsPerDay',
      'tokensPerMinute',
      'tokensPerDay',
    ].every((key) => positive(account.limits?.[key])) ||
    account.maxGenerations > account.limits.requestsPerDay ||
    account.authorizedTokenBudget > account.limits.tokensPerDay
  )
    throw new LocalFailure('ACCOUNT_CONFIRMATION_REQUIRED', 503)
  return account
}

export async function preflightGroq(apiKey, fetchImpl = fetch) {
  if (typeof apiKey !== 'string' || apiKey.trim().length < 20)
    throw new LocalFailure('GROQ_KEY_MISSING', 503)
  const started = performance.now()
  let response
  try {
    response = await fetchImpl('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${apiKey}` },
    })
  } catch {
    throw new LocalFailure('GROQ_CONNECTION_FAILED', 503)
  }
  const metadata = {
    at: new Date().toISOString(),
    provider: 'groq',
    realProvider: true,
    operation: 'list_models',
    generation: false,
    httpStatus: response.status,
    elapsedMs: Math.round(performance.now() - started),
    model: GROQ_MODEL,
  }
  if (!response.ok) {
    await response.body?.cancel()
    return {
      ...metadata,
      ok: false,
      code:
        response.status === 401
          ? 'GROQ_AUTH_REJECTED'
          : 'GROQ_PREFLIGHT_FAILED',
    }
  }
  try {
    const data = JSON.parse(
      await readBoundedText(response, 128_000, AbortSignal.timeout(10_000)),
    )
    const found =
      Array.isArray(data.data) &&
      data.data.some(
        (model) => model.id === GROQ_MODEL && model.active !== false,
      )
    return { ...metadata, ok: found, code: found ? null : 'MODEL_UNAVAILABLE' }
  } catch {
    return { ...metadata, ok: false, code: 'INVALID_MODEL_LIST' }
  }
}

const safeId = (value) =>
  typeof value === 'string' && /^[A-Za-z0-9._-]{1,160}$/.test(value)
    ? value
    : null
const usage = (value) =>
  value &&
  ['prompt_tokens', 'completion_tokens', 'total_tokens'].every(
    (key) => Number.isSafeInteger(value[key]) && value[key] >= 0,
  )
    ? {
        promptTokens: value.prompt_tokens,
        completionTokens: value.completion_tokens,
        totalTokens: value.total_tokens,
      }
    : null
const writeJson = (file, value) =>
  writeFile(file, JSON.stringify(value, null, 2), {
    encoding: 'utf8',
    flag: 'wx',
  })

export async function createLocalSession({
  apiKey,
  account,
  evidenceDirectory,
  fetchImpl = fetch,
  realProvider = true,
}) {
  validateAccount(account)
  if (!apiKey || apiKey.length < 20)
    throw new LocalFailure('GROQ_KEY_MISSING', 503)
  await mkdir(evidenceDirectory, { recursive: true })
  let pending = false
  let halted = null
  let usedBudget = 0
  let remainingProviderTokens = null
  let remainingProviderRequests = null
  const attempts = []
  const reservations = []
  const seen = new Set()
  let activeTransport = null
  const provider = createGroqProvider({
    apiKey,
    externalCallsApproved: true,
    fetchImpl: async (url, init) => {
      if (url !== GROQ_ENDPOINT || !activeTransport || init.method !== 'POST')
        throw new Error('UNEXPECTED_PROVIDER_CALL')
      const telemetry = {
        at: new Date().toISOString(),
        provider: 'groq',
        realProvider,
        endpoint: GROQ_ENDPOINT,
        model: GROQ_MODEL,
        reportedModel: null,
        httpStatus: null,
        elapsedMs: null,
        responseId: null,
        usage: null,
        content: null,
        errorCode: null,
        rateLimits: {},
      }
      activeTransport.push(telemetry)
      const started = performance.now()
      try {
        const response = await fetchImpl(url, init)
        telemetry.httpStatus = response.status
        for (const name of [
          'x-ratelimit-limit-requests',
          'x-ratelimit-limit-tokens',
          'x-ratelimit-remaining-requests',
          'x-ratelimit-remaining-tokens',
          'x-ratelimit-reset-requests',
          'x-ratelimit-reset-tokens',
          'retry-after',
        ]) {
          const value = response.headers.get(name)
          if (value && /^[\d.,a-z -]{1,80}$/i.test(value))
            telemetry.rateLimits[name] = value
        }
        const remainingTokens = response.headers.get(
          'x-ratelimit-remaining-tokens',
        )
        const remainingRequests = response.headers.get(
          'x-ratelimit-remaining-requests',
        )
        if (
          remainingTokens !== null &&
          Number.isFinite(Number(remainingTokens))
        )
          remainingProviderTokens = Number(remainingTokens)
        if (
          remainingRequests !== null &&
          Number.isFinite(Number(remainingRequests))
        )
          remainingProviderRequests = Number(remainingRequests)
        const text = await readBoundedText(
          response.clone(),
          32_000,
          init.signal,
        )
        if (text.includes(apiKey) || containsSecret(text)) {
          telemetry.errorCode = 'RESPONSE_WITHHELD_SECRET_PATTERN'
          await response.body?.cancel()
          throw new Error('RESPONSE_WITHHELD')
        }
        try {
          const data = JSON.parse(text)
          telemetry.responseId = safeId(data.id)
          telemetry.reportedModel =
            typeof data.model === 'string' &&
            /^[A-Za-z0-9_./-]{1,100}$/.test(data.model)
              ? data.model
              : null
          telemetry.usage = usage(data.usage)
          telemetry.content =
            typeof data.choices?.[0]?.message?.content === 'string'
              ? data.choices[0].message.content
              : null
          telemetry.errorCode = response.ok ? null : 'PROVIDER_HTTP_ERROR'
          // No se conserva el campo reasoning ni los mensajes privados de error del proveedor.
        } catch {
          telemetry.errorCode = 'PROVIDER_NON_JSON'
        }
        return response
      } catch (error) {
        telemetry.errorCode ??=
          error?.name === 'AbortError'
            ? 'REQUEST_ABORTED'
            : 'PROVIDER_TRANSPORT_ERROR'
        throw new Error(telemetry.errorCode)
      } finally {
        telemetry.elapsedMs = Math.round(performance.now() - started)
      }
    },
  })
  const maxOutputTokens = 1024
  const explain = createLLMExplainer({
    provider,
    timeoutMs: 20_000,
    maxInputTokens: GROQ_INPUT_BUDGET,
    maxOutputTokens,
    maxConcurrentRequests: 1,
    maxRequestsPerMinute: Math.min(10, account.limits.requestsPerMinute),
  })
  const scenarios = () =>
    createEvaluationCases().map(({ id, category, input }) => ({
      id,
      category,
      context: input.context,
    }))
  const state = () => ({
    provider: 'groq',
    model: GROQ_MODEL,
    realProvider,
    syntheticOnly: true,
    maxGenerations: account.maxGenerations,
    generations: attempts.filter((a) => a.transport.length).length,
    submissions: attempts.length,
    busy: pending,
    halted,
    usedTokenBudget: usedBudget,
    authorizedTokenBudget: account.authorizedTokenBudget,
    scenarios: scenarios(),
    attempts,
  })

  await writeJson(path.join(evidenceDirectory, 'session.json'), {
    createdAt: new Date().toISOString(),
    provider: 'groq',
    model: GROQ_MODEL,
    realProvider,
    data: 'Contextos sintéticos calculados por core. Las marcas manuales son fixtures, no mediciones físicas.',
    account: { ...account },
    autoRetries: 0,
    externalWrites: false,
    productionEndpointEnabled: false,
  })
  return {
    state,
    async ask(body, signal) {
      if (
        !body ||
        Object.keys(body).some(
          (key) => !['scenarioId', 'question'].includes(key),
        ) ||
        typeof body.question !== 'string' ||
        !body.question.trim() ||
        body.question.length > 700 ||
        containsSecret(body.question) ||
        body.question.includes(apiKey) ||
        /[<>@]|https?:\/\//i.test(body.question)
      )
        throw new LocalFailure('INVALID_QUESTION')
      const scenario = scenarios().find((s) => s.id === body.scenarioId)
      if (!scenario) throw new LocalFailure('UNKNOWN_SYNTHETIC_SCENARIO')
      if (pending) throw new LocalFailure('BUSY', 409)
      if (halted) throw new LocalFailure(halted, 409)
      if (attempts.length >= account.maxGenerations)
        throw new LocalFailure('SESSION_LIMIT', 429)
      const fingerprint = createHash('sha256')
        .update(JSON.stringify(body))
        .digest('hex')
      if (seen.has(fingerprint))
        throw new LocalFailure('DUPLICATE_QUESTION', 409)
      const input = {
        context: scenario.context,
        question: body.question,
        disclosure: 'synthetic',
      }
      const context = prepareContext(input)
      if (!context) throw new LocalFailure('INVALID_SYNTHETIC_CONTEXT')
      const estimated = provider.countInputTokens({
        system: SYSTEM_PROMPT,
        user: JSON.stringify({
          question: input.question,
          observations: null,
          context,
        }),
        maxOutputTokens,
      })
      if (!Number.isSafeInteger(estimated) || estimated <= 0)
        throw new LocalFailure('INVALID_INPUT_BUDGET', 500)
      const reserve = estimated + maxOutputTokens
      const window = reservations.filter(
        (item) => Date.now() - item.at < 60_000,
      )
      if (estimated > GROQ_INPUT_BUDGET)
        throw new LocalFailure('INPUT_BUDGET', 413)
      if (usedBudget + reserve > account.authorizedTokenBudget)
        throw new LocalFailure('DAILY_TOKEN_BUDGET', 429)
      if (reserve > account.limits.tokensPerMinute)
        throw new LocalFailure('ACCOUNT_TPM_TOO_LOW', 429)
      if (remainingProviderRequests !== null && remainingProviderRequests < 1)
        throw new LocalFailure('PROVIDER_DAILY_QUOTA', 429)
      if (
        window.length >= Math.min(10, account.limits.requestsPerMinute) ||
        window.reduce((sum, item) => sum + item.tokens, 0) + reserve >
          account.limits.tokensPerMinute ||
        (window.length &&
          remainingProviderTokens !== null &&
          remainingProviderTokens < reserve)
      ) {
        throw new LocalFailure(
          'LOCAL_MINUTE_BUDGET',
          429,
          Math.max(1000, 60_100 - (Date.now() - window[0].at)),
        )
      }
      pending = true
      seen.add(fingerprint)
      usedBudget += reserve
      reservations.push({ at: Date.now(), tokens: reserve })
      const attempt = {
        id: randomUUID(),
        at: new Date().toISOString(),
        scenarioId: scenario.id,
        question: body.question,
        input,
        preparedFacts: context.facts,
        provider: 'groq',
        realProvider,
        transport: [],
        result: null,
        technical: 'NOT RUN',
        quality: 'NOT REVIEWED',
        elapsedMs: null,
      }
      const started = performance.now()
      let persisted = true
      try {
        activeTransport = attempt.transport
        attempt.result = await explain(input, { signal })
        const liveTransport =
          attempt.transport.length === 1 &&
          attempt.transport[0].httpStatus === 200 &&
          attempt.transport[0].usage !== null &&
          attempt.transport[0].content !== null
        attempt.technical = attempt.result.ok && liveTransport ? 'PASS' : 'FAIL'
        if (attempt.technical === 'FAIL' && attempts.length === 0)
          halted = 'FIRST_GENERATION_FAILED'
        if (
          attempt.transport.some(
            (t) =>
              t.httpStatus === 429 ||
              t.httpStatus === 401 ||
              t.httpStatus === 403,
          )
        )
          halted = 'PROVIDER_REJECTED_SESSION'
      } finally {
        attempt.elapsedMs = Math.round(performance.now() - started)
        attempts.push(attempt)
        activeTransport = null
        try {
          await writeJson(
            path.join(evidenceDirectory, `${attempt.id}.json`),
            attempt,
          )
        } catch {
          halted = 'EVIDENCE_WRITE_FAILED'
          persisted = false
        }
        pending = false
      }
      if (!persisted) throw new LocalFailure('EVIDENCE_WRITE_FAILED', 500)
      return attempt
    },
    async review(body) {
      if (
        !body ||
        Object.keys(body).some(
          (key) => !['id', 'status', 'reason'].includes(key),
        ) ||
        !attempts.some((a) => a.id === body.id) ||
        !['PASS', 'FAIL'].includes(body.status) ||
        typeof body.reason !== 'string' ||
        !body.reason.trim() ||
        body.reason.length > 1500 ||
        containsSecret(body.reason) ||
        body.reason.includes(apiKey)
      )
        throw new LocalFailure('INVALID_REVIEW')
      const review = {
        id: body.id,
        at: new Date().toISOString(),
        status: body.status,
        reason: body.reason,
        source: 'manual_local_review',
        technicalPassDoesNotImplyQuality: true,
      }
      await writeJson(
        path.join(evidenceDirectory, `${body.id}.review.json`),
        review,
      )
      return review
    },
  }
}
