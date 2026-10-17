import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calcularDesvio } from '@ecocleaner/core'
import { createAssistantSimulation } from './assistant-simulation'
import { buildExplainerInput } from './buildExplainerInput'
import { projectLiveData } from './live-data'
import type { DemoSnapshot } from './contracts'

const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), catalog: vi.fn() }))
vi.mock('../../../services/supervisor', () => ({
  obtenerDatosExplicadorSupervisor: mocks.snapshot,
}))
vi.mock('../../../services/productos', () => ({
  obtenerCatalogoExplicador: mocks.catalog,
}))
import { loadAssistantData } from './assistant-data'

describe('datos aislados del asistente', () => {
  beforeEach(() => {
    mocks.snapshot.mockReset().mockResolvedValue({
      origin: 'local',
      tasks: [],
      limitations: ['local'],
      catalogSimulated: true,
    })
    mocks.catalog
      .mockReset()
      .mockResolvedValue(createAssistantSimulation().catalog)
  })
  it('reutiliza el catálogo y carga el escenario solamente ante un navegador local vacío', async () => {
    const data = await loadAssistantData()
    expect(data.simulatedScenario).toBe(true)
    expect(data.catalog.products).toHaveLength(6)
    expect(data.snapshot.tasks).toHaveLength(4)
  })
  it('no oculta una respuesta remota vacía ni un fallo de lectura de Supabase', async () => {
    for (const snapshot of [
      {
        origin: 'supabase',
        tasks: [],
        limitations: [],
        catalogSimulated: false,
      },
      {
        origin: 'local',
        tasks: [],
        limitations: ['remote_unavailable'],
        catalogSimulated: true,
      },
    ]) {
      mocks.snapshot.mockResolvedValueOnce(snapshot)
      const data = await loadAssistantData()
      expect(data.simulatedScenario).toBe(false)
      expect(data.snapshot).toEqual(snapshot)
    }
  })
  it('no reemplaza tareas locales existentes y permite revisar el origen vacío', async () => {
    const snapshot = createAssistantSimulation().snapshot
    mocks.snapshot.mockResolvedValueOnce(snapshot)
    expect((await loadAssistantData()).snapshot).toBe(snapshot)
    expect((await loadAssistantData('loaded')).snapshot.tasks).toHaveLength(0)
  })
  it('el escenario explícito no consulta ni escribe servicios remotos', async () => {
    await loadAssistantData('simulation')
    expect(mocks.snapshot).not.toHaveBeenCalled()
    expect(mocks.catalog).not.toHaveBeenCalled()
  })
  it('genera recetas, desvíos y alertas mediante el core sin cambiar procedencia', () => {
    const { snapshot } = createAssistantSimulation()
    const view = buildExplainerInput(snapshot)
    expect([view.completed, view.pending, view.provenance.simulated]).toEqual([
      3, 1, 6,
    ])
    expect([view.provenance.measured, view.provenance.estimated]).toEqual([
      0, 0,
    ])
    expect(view.declared).toEqual({ waterL: 68.4, productMl: 5400, tasks: 2 })
    const task = snapshot.tasks[1],
      record = task.records[0]
    const expected = calcularDesvio({
      receta: task.recipe!,
      litros_agua_reales: record.waterL!,
      ml_producto_reales: record.productMl!,
      dilucion_max_ml_por_litro: task.productMax!,
    })
    expect(view.deviations[1].result).toEqual(expected)
    expect(expected.sobredosis).toBe(true)
    expect(expected.supera_maximo_ficha).toBe(true)
    expect(view.effluent).toHaveLength(5)
    expect(view.cleaning.failedCount).toBe(2)
  })
  it('no inventa variantes elegibles a partir de simulaciones y distingue fallos de limpieza', () => {
    const view = buildExplainerInput(createAssistantSimulation().snapshot)
    expect(view.comparisons).toHaveLength(1)
    const comparison = view.comparisons[0].result
    expect(comparison.recomendada).toBeNull()
    expect(
      comparison.resumen.every((row) => !row.elegible && row.n_medidos === 0),
    ).toBe(true)
    expect(comparison.resumen[1].motivo).toContain('Incumple')
  })
  it('anonimiza el escenario sin identidades, nombres, UUID u observaciones y no muta la fuente', () => {
    const data = createAssistantSimulation(),
      original: DemoSnapshot = structuredClone(data.snapshot)
    const payload = projectLiveData(data.snapshot, data.catalog).payload
    expect(JSON.stringify(payload)).not.toMatch(
      /sim-floors|Lavado de pisos|Producción|email|password|observaciones/,
    )
    expect(
      payload.snapshot.tasks
        .flatMap((t) => t.records)
        .every((r) => r.source === 'simulada'),
    ).toBe(true)
    expect(data.snapshot).toEqual(original)
    data.snapshot.tasks.pop()
    expect(createAssistantSimulation().snapshot.tasks).toHaveLength(4)
  })
})
