import { describe, expect, it } from 'vitest'
import { calcularReceta } from './receta'
import { compararVariantes } from './variantes'
import { detectarIncompatibilidades } from './incompatibilidades'
import { evaluarEfluente } from './efluente'

const entradaReceta = {
  superficie_m2: 100, litros_solucion_por_m2: 0.1, nivel_suciedad: 'media' as const,
  producto: { dilucion_min_ml_por_litro: 20, dilucion_ml_por_litro: 50, dilucion_max_ml_por_litro: 100 },
}

describe('calcularReceta', () => {
  it('10 L de solución a 50 ml/L da 500 ml de producto y 9,5 L de agua', () => {
    expect(calcularReceta(entradaReceta)).toEqual({ litros_solucion: 10, ml_por_litro: 50, ml_producto: 500, litros_agua: 9.5 })
  })
  it('baja usa el mínimo, media el recomendado y alta el máximo', () => {
    for (const [nivel, dosis] of [['baja', 20], ['media', 50], ['alta', 100]] as const) {
      expect(calcularReceta({ ...entradaReceta, nivel_suciedad: nivel }).ml_por_litro).toBe(dosis)
    }
  })
  it('rechaza superficies o litros por m² menores o iguales a cero', () => {
    for (const valor of [0, -1]) {
      expect(() => calcularReceta({ ...entradaReceta, superficie_m2: valor })).toThrow()
      expect(() => calcularReceta({ ...entradaReceta, litros_solucion_por_m2: valor })).toThrow()
    }
  })
})
describe('calcularDesvio', () => {
  it.todo('500 ml con 9,5 L de agua da 50 ml/L reales y no hay sobredosis')
  it.todo('marca sobredosis al superar la tolerancia sobre la receta')
  it.todo('marca supera_maximo_ficha si excede el máximo del fabricante')
})
describe('compararVariantes', () => {
  const variante = (id: string, ml: number, cumple = true, n = 2) => ({
    variante_id: id, nombre: id, registros: Array.from({ length: n }, () => ({
      litros_agua_reales: 10, ml_producto_reales: ml, cumple_criterio: cumple,
      marca: 'medido' as const, fuente: 'manual' as const,
    })),
  })
  it('descarta variantes que no cumplen el criterio en todas sus repeticiones', () => {
    const falla = variante('falla', 1)
    falla.registros[1].cumple_criterio = false
    expect(compararVariantes([falla, variante('cumple', 100)]).recomendada).toBe('cumple')
  })
  it('no recomienda una variante con menos repeticiones que el mínimo', () => {
    expect(compararVariantes([variante('una', 1, true, 1)]).recomendada).toBeNull()
  })
  it('entre las elegibles recomienda la de menor producto promedio', () => {
    expect(compararVariantes([variante('alta', 100), variante('baja', 50)]).recomendada).toBe('baja')
  })
  it('si ninguna es elegible, recomendada es null con el motivo explicado', () => {
    expect(compararVariantes([variante('falla', 1, false)])).toMatchObject({ recomendada: null, motivo: expect.stringContaining('No hay') })
  })
})
describe('detectarIncompatibilidades', () => {
  // Reglas ficticias del catálogo para pruebas, no una demostración de reacciones químicas.
  const a = { id: 'a', nombre: 'Ejemplo A', categorias: ['hipoclorito'] as const, incompatibilidades: ['acido'] as const }
  const b = { id: 'b', nombre: 'Ejemplo B', categorias: ['acido'] as const, incompatibilidades: ['hipoclorito'] as const }
  const productos = [a, b].map((p) => ({ ...p, categorias: [...p.categorias], incompatibilidades: [...p.incompatibilidades] }))
  it('detecta reglas de hipoclorito y ácido en ambos sentidos', () => {
    expect(detectarIncompatibilidades(productos).map((c) => c.categoria)).toEqual(['acido', 'hipoclorito'])
    expect(detectarIncompatibilidades([...productos].reverse())).toEqual(detectarIncompatibilidades(productos))
  })
  it('no marca conflicto entre productos sin categorías prohibidas en común', () => {
    expect(detectarIncompatibilidades(productos.map((p) => ({ ...p, incompatibilidades: [] })))).toEqual([])
  })
})
describe('evaluarEfluente', () => {
  // Rango ficticio, sin validez regulatoria. Nunca trasladar a configuración real.
  const entrada = { producto: { ph: null, ph_medido_a_ml_por_litro: null }, ml_por_litro_preparado: 50,
    rango_ph_descarga: { min: 6, max: 9 }, quedan_sobrantes_concentrados: false }
  it('devuelve no_disponible si el pH es nulo', () => {
    expect(evaluarEfluente(entrada)).toMatchObject({ orientacion: 'no_disponible', ph_estimado: null })
  })
  it('devuelve no_disponible si la concentración preparada está muy lejos de la del pH', () => {
    expect(evaluarEfluente({ ...entrada, producto: { ph: 8, ph_medido_a_ml_por_litro: 1 } }).orientacion).toBe('no_disponible')
  })
  it('devuelve gestor si quedan sobrantes concentrados', () => {
    expect(evaluarEfluente({ ...entrada, quedan_sobrantes_concentrados: true }).orientacion).toBe('gestor')
  })
  it('devuelve ajustar si el pH del efluente medido está fuera del rango verificado', () => {
    expect(evaluarEfluente({ ...entrada, medicion_ph_efluente: { valor: 10, fuente: 'medicion ficticia' },
      validacion_rango: { verificado: true, fuente: 'regla ficticia', jurisdiccion: 'prueba', aplica_al_caso: true } })).toMatchObject({ orientacion: 'ajustar', ph_estimado: null, autoriza_vertido: false })
  })
})
