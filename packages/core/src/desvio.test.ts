import { describe, expect, it } from 'vitest'
import { calcularDesvio } from './desvio'
import type { Receta } from './tipos'

// Fixture ficticio: no es una ficha de fabricante ni evidencia química.
const receta: Receta = { litros_solucion: 10, ml_por_litro: 50, ml_producto: 500, litros_agua: 9.5 }

describe('calcularDesvio', () => {
  it('500 ml con 9,5 L de agua da 50 ml/L reales y no hay sobredosis', () => {
    const r = calcularDesvio({ receta, litros_agua_reales: 9.5, ml_producto_reales: 500, dilucion_max_ml_por_litro: 100 })
    expect(r).toEqual({ ml_por_litro_real: 50, desvio_pct: 0, sobredosis: false, supera_maximo_ficha: false })
  })
  it('marca sobredosis al superar la tolerancia sobre la receta', () => {
    const sobre = calcularDesvio({ receta, litros_agua_reales: 9.5, ml_producto_reales: 600, dilucion_max_ml_por_litro: 100 })
    expect(sobre.sobredosis).toBe(true)
    expect(sobre.desvio_pct).toBeGreaterThan(10)
    expect(calcularDesvio({ receta, litros_agua_reales: 9.5, ml_producto_reales: 510, dilucion_max_ml_por_litro: 100 }).sobredosis).toBe(false)
  })
  it('marca supera_maximo_ficha si excede el máximo del fabricante', () => {
    expect(calcularDesvio({ receta, litros_agua_reales: 9.5, ml_producto_reales: 700, dilucion_max_ml_por_litro: 60 }).supera_maximo_ficha).toBe(true)
    expect(calcularDesvio({ receta, litros_agua_reales: 9.5, ml_producto_reales: 500, dilucion_max_ml_por_litro: 60 }).supera_maximo_ficha).toBe(false)
  })
  it('respeta una tolerancia configurable', () => {
    const e = { receta, litros_agua_reales: 9.5, ml_producto_reales: 530, dilucion_max_ml_por_litro: 100 }
    // ~5,7 % de desvío sobre la receta.
    expect(calcularDesvio({ ...e, tolerancia_pct: 10 }).sobredosis).toBe(false)
    expect(calcularDesvio({ ...e, tolerancia_pct: 5 }).sobredosis).toBe(true)
  })
  it('rechaza entradas inválidas con error estructurado', () => {
    for (const valor of [0, -1, NaN, Infinity]) {
      expect(() => calcularDesvio({ receta, litros_agua_reales: valor, ml_producto_reales: 500, dilucion_max_ml_por_litro: 100 })).toThrow()
    }
    expect(() => calcularDesvio({ receta, litros_agua_reales: 9.5, ml_producto_reales: -1, dilucion_max_ml_por_litro: 100 })).toThrow()
    expect(() => calcularDesvio({ receta, litros_agua_reales: 9.5, ml_producto_reales: 500, dilucion_max_ml_por_litro: 0 })).toThrow()
    expect(() => calcularDesvio({ receta, litros_agua_reales: 9.5, ml_producto_reales: 500, dilucion_max_ml_por_litro: 100, tolerancia_pct: -1 })).toThrow()
  })
})
