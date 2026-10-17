export function baselineSql(state: {
  provider: string
  model: string
  authorizedTokenBudget: number
  usedTokenBudget: number
  maxGenerations: number
  generations: number
  busy: boolean
  halted?: string | null
}): string
