import { describe, expect, it } from 'vitest'
import { calcularReceta } from './receta'
import { ErrorValidacionCore } from './validacion'

// Fixture ficticio, no es una ficha de fabricante ni evidencia química.
const entrada = {
  superficie_m2: 100, litros_solucion_por_m2: 0.1, nivel_suciedad: 'media' as const,
  producto: { dilucion_min_ml_por_litro: 20, dilucion_ml_por_litro: 50, dilucion_max_ml_por_litro: 100 },
}

describe('receta y límites del dominio', () => {
  it.each([10, 101])('rechaza recomendación %s fuera de la ficha', (dosis) => {
    expect(() => calcularReceta({ ...entrada, producto: { ...entrada.producto, dilucion_ml_por_litro: dosis } })).toThrow(ErrorValidacionCore)
  })
  it.each([NaN, Infinity, -Infinity])('rechaza superficie no finita %s', (valor) => {
    expect(() => calcularReceta({ ...entrada, superficie_m2: valor })).toThrow(ErrorValidacionCore)
    expect(() => calcularReceta({ ...entrada, litros_solucion_por_m2: valor })).toThrow(ErrorValidacionCore)
  })
  it.each([0, -1, NaN, Infinity, 1001])('rechaza dosis inválida %s', (valor) => {
    for (const campo of ['dilucion_min_ml_por_litro', 'dilucion_ml_por_litro', 'dilucion_max_ml_por_litro']) {
      expect(() => calcularReceta({ ...entrada, producto: { ...entrada.producto, [campo]: valor } })).toThrow(ErrorValidacionCore)
    }
  })
  it('rechaza datos incompletos y niveles desconocidos con error estructurado', () => {
    for (const valor of [undefined, null, {}, { ...entrada, producto: null }, { ...entrada, nivel_suciedad: 'otro' }]) {
      expect(() => calcularReceta(valor as Parameters<typeof calcularReceta>[0])).toThrow(ErrorValidacionCore)
    }
  })
  it('rechaza overflow y underflow de las operaciones', () => {
    expect(() => calcularReceta({ ...entrada, superficie_m2: Number.MAX_VALUE, litros_solucion_por_m2: 2 })).toThrow()
    expect(() => calcularReceta({ ...entrada, superficie_m2: Number.MIN_VALUE, litros_solucion_por_m2: Number.MIN_VALUE })).toThrow()
  })
  it('no pierde cantidades pequeñas ni introduce ruido decimal', () => {
    expect(calcularReceta({ ...entrada, superficie_m2: 0.1, litros_solucion_por_m2: 0.2 }).litros_solucion).toBe(0.02)
    expect(calcularReceta({ ...entrada, superficie_m2: 1e-12 }).litros_solucion).toBe(1e-13)
  })
  it('es pura, repetible y no necesita UI ni conexión externa', () => {
    const original = structuredClone(entrada)
    Object.freeze(entrada.producto)
    Object.freeze(entrada)
    expect(calcularReceta(entrada)).toEqual(calcularReceta(entrada))
    expect(entrada).toEqual(original)
  })
})
