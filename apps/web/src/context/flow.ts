import type { Step } from '../components/ui/StepIndicator'

/** Pasos del flujo del operario (Paso X de 4). Local al operario. */
export const OPERARIO_STEPS: Step[] = [
  { label: 'Receta', to: '/operario/receta' },
  { label: 'Registro' },
  { label: 'Criterio' },
  { label: 'Efluente' },
]
