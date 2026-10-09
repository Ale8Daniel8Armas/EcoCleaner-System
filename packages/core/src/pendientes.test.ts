import { describe, it } from 'vitest'

describe('calcularReceta', () => {
  it.todo('10 L de solución a 50 ml/L da 500 ml de producto y 9,5 L de agua')
  it.todo('baja usa el mínimo, media el recomendado y alta el máximo')
  it.todo('rechaza superficies o litros por m² menores o iguales a cero')
})
describe('calcularDesvio', () => {
  it.todo('500 ml con 9,5 L de agua da 50 ml/L reales y no hay sobredosis')
  it.todo('marca sobredosis al superar la tolerancia sobre la receta')
  it.todo('marca supera_maximo_ficha si excede el máximo del fabricante')
})
describe('compararVariantes', () => {
  it.todo('descarta variantes que no cumplen el criterio en todas sus repeticiones')
  it.todo('no recomienda una variante con menos repeticiones que el mínimo')
  it.todo('entre las elegibles recomienda la de menor producto promedio')
  it.todo('si ninguna es elegible, recomendada es null con el motivo explicado')
})
describe('detectarIncompatibilidades', () => {
  it.todo('detecta que hipoclorito y ácido no deben mezclarse, en ambos sentidos')
  it.todo('no marca conflicto entre productos sin categorías prohibidas en común')
})
describe('evaluarEfluente', () => {
  it.todo('devuelve no_disponible si el pH es nulo')
  it.todo('devuelve no_disponible si la concentración preparada está muy lejos de la del pH')
  it.todo('devuelve gestor si quedan sobrantes concentrados')
  it.todo('devuelve ajustar si el pH estimado está fuera del rango de descarga')
})
