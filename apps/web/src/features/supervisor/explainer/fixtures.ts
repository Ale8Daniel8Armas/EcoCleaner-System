import type { DemoRecord, DemoSnapshot, DemoTask } from './contracts'

/** Fixtures exclusivas de pruebas; nunca se cargan desde el panel. */
export const demoRecord = (patch: Partial<DemoRecord> = {}): DemoRecord => ({
  id: 'record-a',
  variantId: 'variant-a',
  waterL: 9.5,
  productMl: 500,
  mark: 'medido',
  source: 'manual',
  recordedOverdose: false,
  cleaning: true,
  decisions: ['gestor'],
  ...patch,
})
export const demoTask = (patch: Partial<DemoTask> = {}): DemoTask => ({
  id: 'task-a',
  areaId: 'area-a',
  productId: 'product-a',
  state: 'completada',
  dirt: 'media',
  recipe: {
    litros_solucion: 10,
    ml_producto: 500,
    litros_agua: 9.5,
    ml_por_litro: 50,
  },
  productMin: 20,
  productMax: 100,
  criticalProduct: true,
  variants: [{ id: 'variant-a', dilution: 50 }],
  records: [demoRecord()],
  ...patch,
})
export const demoSnapshot = (
  tasks: DemoTask[] = [demoTask()],
): DemoSnapshot => ({
  origin: 'supabase',
  tasks,
  limitations: [],
  catalogSimulated: false,
})
