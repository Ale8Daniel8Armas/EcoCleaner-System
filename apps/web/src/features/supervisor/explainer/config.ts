export function resolveDemoMode(value: unknown): 'demo' | 'off' {
  return value === undefined || value === 'demo' ? 'demo' : 'off'
}

export function canShowDemo(role: unknown, mode: unknown): boolean {
  return role === 'supervisor' && resolveDemoMode(mode) === 'demo'
}

/** Solo el lanzador de desarrollo local activa esta interfaz; los builds conservan el demo. */
export const isLocalLLMEnabled = () =>
  import.meta.env.DEV && import.meta.env.VITE_LOCAL_LLM === 'true'

/** La marca pública solo elige la vista; el servidor comprueba identidad y cuota. */
export const isProductionLLMEnabled = () =>
  import.meta.env.PROD && import.meta.env.VITE_PRODUCTION_LLM === 'true'

export const isLiveLLMEnabled = () =>
  isLocalLLMEnabled() || isProductionLLMEnabled()
