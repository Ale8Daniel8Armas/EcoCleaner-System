import type {
  EvidenceValue,
  Explanation,
  ExplanationResult,
} from '../../../../../../packages/core/server/llm/contracts'

export type LiveChatResult =
  | {
      ok: true
      kind: 'chat'
      source: 'llm' | 'simulation'
      answer: string
      evidence: Record<string, EvidenceValue>
      contextFacts: Record<string, EvidenceValue>
      warnings: string[]
      responseType?: 'social' | 'general' | 'analysis'
      explanation?: Explanation
      usage: { inputTokens: number; outputTokens: number }
    }
  | Extract<ExplanationResult, { ok: false }>
