import { obtenerDatosExplicadorSupervisor } from '../../../services/supervisor'
import { obtenerCatalogoExplicador } from '../../../services/productos'
import { createAssistantSimulation } from './assistant-simulation'

export type AssistantDataMode = 'auto' | 'loaded' | 'simulation'

/** No reemplaza una carga remota vacía ni oculta fallos de permisos o conexión. */
export async function loadAssistantData(mode: AssistantDataMode = 'auto') {
  if (mode === 'simulation')
    return { ...createAssistantSimulation(), simulatedScenario: true }
  const [snapshot, catalog] = await Promise.all([
    obtenerDatosExplicadorSupervisor(),
    obtenerCatalogoExplicador(),
  ])
  if (
    mode === 'auto' &&
    snapshot.origin === 'local' &&
    !snapshot.tasks.length &&
    !snapshot.limitations.includes('remote_unavailable') &&
    catalog.simulated
  )
    return { ...createAssistantSimulation(), simulatedScenario: true }
  return { snapshot, catalog, simulatedScenario: false }
}
