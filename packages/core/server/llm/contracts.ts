import type {
  Desvio,
  EvaluacionEfluente,
  InformeIncompatibilidades,
  Receta,
  compararVariantes,
} from '../../src/index.ts'

export type ExplanationContext =
  | { kind: 'recipe'; result: Receta }
  | { kind: 'deviation'; result: Desvio }
  | { kind: 'comparison'; result: ReturnType<typeof compararVariantes> }
  | { kind: 'incompatibilities'; result: InformeIncompatibilidades }
  | { kind: 'effluent'; result: EvaluacionEfluente }

export interface ExplanationInput {
  context: ExplanationContext
  question: string
  observations?: string
  /** El servidor llamador debe acreditar el permiso; nunca aceptar esta marca del navegador. */
  disclosure: 'synthetic' | 'approved_for_external_processing'
}

export const REVIEW_ACTIONS = [
  'review_recipe',
  'review_records',
  'review_variant',
  'collect_measurements',
  'review_documentation',
  'consult_specialist',
] as const
export type ReviewAction = (typeof REVIEW_ACTIONS)[number]
export type EvidenceValue = string | number | boolean | null

export interface PreparedContext {
  kind: ExplanationContext['kind']
  facts: Record<string, EvidenceValue>
  allowedActions: ReviewAction[]
  recommendedVariantId: string | null
}

export interface Explanation {
  summary: string
  consumptionAnalysis: string | null
  recommendation: {
    action: ReviewAction
    targetVariantId: string | null
    text: string
    justification: string
  }
  evidenceIds: string[]
  limitations: string[]
  humanReviewRequired: true
}

export interface ProviderRequest {
  system: string
  user: string
  maxOutputTokens: number
  signal: AbortSignal
}

export interface ProviderResponse {
  json: string
  usage: { inputTokens: number; outputTokens: number }
}

/** Sin herramientas, claves, acceso a Supabase ni implementación HTTP implícita. */
export interface LLMProvider {
  /** Identificador público, sin secretos. */
  name: string
  mode: 'external' | 'simulated'
  /** Declara si el presupuesto previo es exacto o una estimación conservadora por bytes. */
  inputTokenCounting?: 'exact' | 'byte_budget'
  /** Presupuesto offline; el uso real siempre procede de la respuesta del proveedor. */
  countInputTokens: (
    request: Omit<ProviderRequest, 'signal'>,
  ) => number | Promise<number>
  generate: (request: ProviderRequest) => Promise<ProviderResponse>
}

export class ProviderFailure extends Error {
  readonly code: 'RATE_LIMIT' | 'PROVIDER_ERROR' | 'INVALID_RESPONSE'
  readonly reason:
    | 'authentication'
    | 'rate_limit'
    | 'model'
    | 'network'
    | 'format'
    | 'disabled'

  constructor(
    code: ProviderFailure['code'],
    reason: ProviderFailure['reason'],
  ) {
    super('El proveedor LLM no completó una respuesta válida.')
    this.name = 'ProviderFailure'
    this.code = code
    this.reason = reason
  }
}

export type FailureCode =
  | 'INVALID_INPUT'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'INPUT_LIMIT'
  | 'BUSY'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'PROVIDER_ERROR'
  | 'INVALID_RESPONSE'

export type ExplanationResult =
  | {
      ok: true
      source: 'llm' | 'simulation'
      explanation: Explanation
      evidence: Record<string, EvidenceValue>
      usage: ProviderResponse['usage']
    }
  | {
      ok: false
      code: FailureCode
      /** Texto estático de respaldo, identificado explícitamente como no generado. */
      fallback: { source: 'template'; text: string; humanReviewRequired: true }
    }

export interface ExplainerOptions {
  provider?: LLMProvider
  timeoutMs?: number
  maxInputTokens?: number
  maxOutputTokens?: number
  maxConcurrentRequests?: number
  maxRequestsPerMinute?: number
}
