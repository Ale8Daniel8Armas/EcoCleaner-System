import { describe, expect, it } from 'vitest'
import { buildSimulatedUsageRecord, generateSimulation } from './simulator'

const input = {
  receta: { litros_agua: 9.5, ml_producto: 500, ml_por_litro: 50 },
  tiempoEstimadoMin: 30,
  dilucionMaxMlPorLitro: 100,
}

describe('simulador de medición automática', () => {
  it('es determinista con la misma semilla', () => {
    expect(generateSimulation({ ...input, escenario: 'normal', semilla: 42 }))
      .toEqual(generateSimulation({ ...input, escenario: 'normal', semilla: 42 }))
  })

  it('mantiene el uso normal dentro de ±5%', () => {
    const result = generateSimulation({ ...input, escenario: 'normal', semilla: 42 })
    expect(result.final.litrosAguaAcumulados).toBeGreaterThan(input.receta.litros_agua * 0.95)
    expect(result.final.litrosAguaAcumulados).toBeLessThan(input.receta.litros_agua * 1.05)
  })

  it('detecta una fuga una sola vez y nunca produce acumulados negativos', () => {
    const result = generateSimulation({ ...input, escenario: 'fuga_agua', semilla: 42 })
    expect(result.alertaAgua).toBe(true)
    expect(result.readings.filter((reading) => reading.alertaAguaNueva)).toHaveLength(1)
    expect(result.readings.every((reading) => reading.litrosAguaAcumulados >= 0)).toBe(true)
    expect(result.final.litrosAguaAcumulados).toBeGreaterThan(input.receta.litros_agua)
  })

  it('detecta la sobredosis de producto y construye un registro simulado medido', () => {
    const result = generateSimulation({ ...input, escenario: 'sobredosis_producto', semilla: 42 })
    const record = buildSimulatedUsageRecord({ tareaId: 'tarea-demo', run: result, duracionMin: 30 })
    expect(result.alertaProducto).toBe(true)
    expect(result.readings.filter((reading) => reading.alertaProductoNueva)).toHaveLength(1)
    expect(record.fuente).toBe('simulada')
    expect(record.marca).toBe('medido')
    expect(record.litros_agua_reales).toBeGreaterThan(0)
  })
})
