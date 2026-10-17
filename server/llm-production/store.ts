import { readBoundedText } from '../../packages/core/server/llm/groq.ts'

export class ProductionFailure extends Error {
  code: string
  status: number
  constructor(code: string, status = 503) {
    super(code)
    this.code = code
    this.status = status
  }
}

export interface PoolState {
  provider: string
  model: string
  appDataApproved: boolean
  generations: number
  maxGenerations: number
  usedTokenBudget: number
  authorizedTokenBudget: number
  maxOutputTokens: number
  minimumRequestTokenBudget: number
  busy: boolean
  halted: string | null
}

export interface ProductionStore {
  identity(token: string, signal: AbortSignal): Promise<string | null>
  state(): Promise<PoolState>
  history(
    actor: string,
    ids: string[],
    fingerprint: string,
  ): Promise<
    Array<{
      question: string
      result: { answer: string }
    }>
  >
  reserve(args: {
    id: string
    actor: string
    tokens: number
    fingerprint: string
    question: string
  }): Promise<PoolState>
  finish(
    id: string,
    usage: number | null,
    result: unknown,
    telemetry: unknown,
    halt: boolean,
  ): Promise<PoolState>
}

const quotaErrors = new Set([
  'BUSY',
  'SESSION_LIMIT',
  'DAILY_TOKEN_BUDGET',
  'LOCAL_MINUTE_BUDGET',
  'INPUT_BUDGET',
  'PROVIDER_REJECTED_SESSION',
  'PRODUCTION_NOT_CONFIGURED',
])

export function createProductionStore(
  config: { url: string; publicKey: string; secretKey: string },
  transport: typeof fetch = fetch,
): ProductionStore {
  const base = new URL(config.url)
  if (
    base.protocol !== 'https:' ||
    base.pathname !== '/' ||
    base.username ||
    base.password
  )
    throw new ProductionFailure('PRODUCTION_NOT_CONFIGURED')
  const call = async (path: string, init: RequestInit, admin = true) => {
    const signal = init.signal ?? AbortSignal.timeout(10000)
    const response = await transport(new URL(path, base), {
      ...init,
      redirect: 'error',
      signal,
      headers: {
        apikey: admin ? config.secretKey : config.publicKey,
        ...(!config.secretKey.startsWith('sb_secret_')
          ? { Authorization: `Bearer ${config.secretKey}` }
          : {}),
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })
    const text = await readBoundedText(response, 64_000, signal)
    if (!response.ok) {
      let code = 'PERSISTENCE_UNAVAILABLE'
      try {
        const message = JSON.parse(text).message
        if (quotaErrors.has(message)) code = message
      } catch {
        /* No revelar errores privados. */
      }
      throw new ProductionFailure(
        code,
        quotaErrors.has(code) ? (code === 'BUSY' ? 409 : 429) : 503,
      )
    }
    return JSON.parse(text)
  }
  const rpc = (name: string, body: unknown = {}) =>
    call(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(body) })
  return {
    async identity(token, signal) {
      try {
        const user = await call(
          '/auth/v1/user',
          {
            method: 'GET',
            signal,
            headers: { Authorization: `Bearer ${token}` },
          },
          false,
        )
        return /^[a-f\d-]{36}$/i.test(user.id) &&
          user.app_metadata?.ecocleaner_role === 'supervisor'
          ? user.id
          : null
      } catch {
        return null
      }
    },
    state: () => rpc('ecocleaner_llm_state'),
    async history(actor, ids, fingerprint) {
      if (!ids.length) return []
      const query = new URLSearchParams({
        select: 'id,question,result',
        actor: `eq.${actor}`,
        id: `in.(${ids.join(',')})`,
        fingerprint: `eq.${fingerprint}`,
        status: 'eq.completed',
        limit: '3',
      })
      const rows = await call(`/rest/v1/ecocleaner_llm_requests?${query}`, {
        method: 'GET',
      })
      return ids.map((id) => {
        const row = rows.find((entry: { id: string }) => entry.id === id)
        if (
          !row ||
          row.result?.ok !== true ||
          typeof row.result.answer !== 'string'
        )
          throw new ProductionFailure('INVALID_HISTORY', 400)
        return row
      })
    },
    reserve: (args) =>
      rpc('ecocleaner_llm_reserve', {
        p_id: args.id,
        p_actor: args.actor,
        p_tokens: args.tokens,
        p_fingerprint: args.fingerprint,
        p_question: args.question,
      }),
    finish: (id, usage, result, telemetry, halt) =>
      rpc('ecocleaner_llm_finish', {
        p_id: id,
        p_usage: usage,
        p_result: result,
        p_telemetry: telemetry,
        p_halt: halt,
      }),
  }
}
