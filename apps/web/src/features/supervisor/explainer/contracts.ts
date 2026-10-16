import type { Desvio, Receta, compararVariantes } from '@ecocleaner/core'

export type DataOrigin = 'supabase' | 'local'
export type DataLimitation =
  'partial' | 'local' | 'catalog_simulated' | 'remote_unavailable'
export type EffluentDecision = 'verter' | 'ajustar' | 'reutilizar' | 'gestor'

/** Proyección permitida: solo nombres operativos, sin identidad, sesión ni observaciones. */
export interface DemoRecord {
  id: string
  variantId: string | null
  waterL: number | null
  productMl: number | null
  mark: 'medido' | 'estimado' | null
  source: 'manual' | 'sensor' | 'simulada' | null
  recordedOverdose: boolean
  cleaning: boolean | null
  decisions: EffluentDecision[]
}

export interface DemoTask {
  id: string
  name?: string | null
  areaId: string | null
  areaName?: string | null
  productId: string | null
  state: string | null
  dirt: string | null
  recipe: Receta | null
  productMin: number | null
  productMax: number | null
  criticalProduct: boolean
  variants: { id: string; name?: string | null; dilution: number | null }[]
  records: DemoRecord[]
}

export interface DemoSnapshot {
  origin: DataOrigin
  tasks: DemoTask[]
  limitations: DataLimitation[]
  catalogSimulated: boolean
}

export interface ExplainerInput {
  references?: DemoReference[]
  origin: DataOrigin
  completed: number
  pending: number
  unknownState: number
  declared: { waterL: number; productMl: number; tasks: number }
  expected: { waterL: number; productMl: number; tasks: number }
  paired: {
    declaredWaterL: number
    declaredProductMl: number
    expectedWaterL: number
    expectedProductMl: number
    tasks: number
  }
  provenance: {
    measured: number
    estimated: number
    simulated: number
    unknown: number
    total: number
    measuredPct: number | null
    estimatedPct: number | null
  }
  hasSimulation: boolean
  cleaning: {
    failed: string[]
    passed: string[]
    unknown: string[]
    failedCount: number
    unknownCount: number
  }
  deviations: { task: string; area: string; record: string; result: Desvio }[]
  alerts: {
    task: string
    record: string
    overdose: boolean
    aboveMaximum: boolean
    recorded: boolean
  }[]
  areas: { group: string; winners: { area: string; deviationPct: number }[] }[]
  comparisons: { task: string; result: ReturnType<typeof compararVariantes> }[]
  effluent: { task: string; record: string; decision: EffluentDecision }[]
  pendingEffluent: string[]
  incomplete: string[]
  limitations: string[]
}

export interface DemoReference {
  key: string
  kind: 'Tarea' | 'Área' | 'Variante' | 'Registro'
  label: string
  id: string | null
  taskKey?: string
}

/** Contrato propio del navegador: el contrato P1 describe una respuesta distinta y vive en servidor. */
export interface DemoExplanation {
  summary: string
  evidence: string
  preliminaryRecommendation: string
  limitations: string
}
