import { createLLMExplainer } from '../../../packages/core/server/llm/index.ts'
import {
  createGroqProvider,
  GROQ_INPUT_BUDGET,
  GROQ_MODEL,
} from '../../../packages/core/server/llm/groq.ts'
import { createEdgeHandler, type EdgeDependencies } from './handler.ts'
import { createSupabaseReader } from './supabase.ts'

/** Cerrado por defecto: el login demo y las RLS abiertas NO constituyen autorización. */
export function buildDefaultEdgeHandler(
  getEnvironment: (name: string) => string | undefined,
) {
  let provider
  let reader: Pick<EdgeDependencies, 'verifyIdentity' | 'loadContext'> = {
    verifyIdentity: async () => null,
    loadContext: async () => null,
  }
  try {
    const apiKey = getEnvironment('GROQ_API_KEY')
    if (apiKey)
      provider = createGroqProvider({
        apiKey,
        model: getEnvironment('LLM_MODEL') ?? GROQ_MODEL,
        externalCallsApproved:
          getEnvironment('LLM_EXTERNAL_CALLS_APPROVED') === 'true',
      })
    const url = getEnvironment('SUPABASE_URL')
    const publicKey =
      getEnvironment('SUPABASE_PUBLISHABLE_KEY') ??
      getEnvironment('SUPABASE_ANON_KEY')
    if (url && publicKey)
      reader = createSupabaseReader({ url, publishableKey: publicKey })
  } catch {
    /* La configuración incompleta no habilita el endpoint ni filtra secretos. */
  }
  const explain = createLLMExplainer({
    provider,
    maxInputTokens: GROQ_INPUT_BUDGET,
  })
  return createEdgeHandler({
    enabled: false,
    allowedOrigins: (getEnvironment('LLM_ALLOWED_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    ...reader,
    authorizeResource: async () => ({
      allowed: false,
      externalProcessingApproved: false,
      chiefSupervisorVerified: false,
    }),
    consumeDistributedQuota: async () => false,
    explain,
  })
}

const runtime = (
  globalThis as typeof globalThis & {
    Deno?: {
      env: { get: (name: string) => string | undefined }
      serve: (handler: (request: Request) => Promise<Response>) => unknown
    }
  }
).Deno
if (runtime)
  runtime.serve(buildDefaultEdgeHandler((name) => runtime.env.get(name)))
