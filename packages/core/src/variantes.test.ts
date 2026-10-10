import { describe, expect, it } from 'vitest'
import { compararVariantes, type RegistroComparacion, type VarianteComparacion } from './variantes'

// Fixtures ficticios: no representan evidencia ambiental real.
const registro = (agua = 10, producto = 100): RegistroComparacion => ({
  litros_agua_reales: agua, ml_producto_reales: producto, cumple_criterio: true, marca: 'medido', fuente: 'manual',
})
const variante = (id: string, registros: RegistroComparacion[]): VarianteComparacion => ({ variante_id: id, nombre: id, registros })

describe('comparación con evidencia y procedencia', () => {
  it('compara promedios y observaciones, no totales de muestras distintas', () => {
    const r = compararVariantes([variante('a', [registro(8, 100), registro(12, 200)]), variante('b', [registro(15, 140), registro(15, 140), registro(15, 140)])])
    expect(r.resumen[0]).toMatchObject({ n: 2, n_medidos: 2, agua_promedio: 10, producto_promedio: 150, elegible: true })
    expect(r.recomendada).toBe('b')
  })
  it('respeta prioridad de producto aunque aumente agua, sin sumar unidades', () => {
    expect(compararVariantes([variante('agua', [registro(1, 100), registro(1, 100)]), variante('producto', [registro(100, 10), registro(100, 10)])]).recomendada).toBe('producto')
  })
  it('deja pendiente un empate sin inventar un desempate', () => {
    expect(compararVariantes([variante('a', [registro(1), registro(1)]), variante('b', [registro(10), registro(10)])])).toMatchObject({ recomendada: null, motivo: expect.stringContaining('Empate') })
  })
  it('separa medidos, estimados y simulados sin mezclar promedios', () => {
    const r = compararVariantes([variante('a', [registro(), registro(), { ...registro(1, 1), marca: 'estimado' }, { ...registro(1, 1), fuente: 'simulada' }])])
    expect(r.resumen[0]).toMatchObject({ n: 4, n_medidos: 2, n_estimados: 1, n_simulados: 1, producto_promedio: 100, base_promedios: 'medidos' })
  })
  it('acepta llamadas originales sin procedencia, sin recomendar como medido', () => {
    const { marca: _marca, fuente: _fuente, ...sinMarca } = registro()
    expect(compararVariantes([variante('a', [sinMarca, sinMarca])])).toMatchObject({ recomendada: null, resumen: [{ n: 2, n_sin_procedencia: 2, elegible: false }] })
  })
  it.each(['estimado', 'simulado'] as const)('no recomienda solo datos %s', (tipo) => {
    const r = tipo === 'estimado' ? { ...registro(), marca: 'estimado' as const } : { ...registro(), fuente: 'simulada' as const }
    expect(compararVariantes([variante('a', [r, r])]).recomendada).toBeNull()
  })
  it('excluye consumos inválidos y mantiene su conteo', () => {
    const r = compararVariantes([variante('a', [registro(), registro(), registro(NaN), registro(-1), registro(Infinity), registro(1, -1)])])
    expect(r.resumen[0]).toMatchObject({ n: 2, n_invalidos: 4, elegible: true })
  })
  it('no oculta incumplimientos con consumos inválidos ni resultados ausentes', () => {
    const falla = { ...registro(NaN), cumple_criterio: false }
    const incompleto = { ...registro(), cumple_criterio: undefined } as unknown as RegistroComparacion
    expect(compararVariantes([variante('a', [registro(), registro(), falla])]).recomendada).toBeNull()
    expect(compararVariantes([variante('a', [registro(), registro(), incompleto])]).recomendada).toBeNull()
  })
  it('explica la ausencia de registros y una lista vacía', () => {
    expect(compararVariantes([])).toMatchObject({ resumen: [], recomendada: null })
    expect(compararVariantes([variante('a', [])]).resumen[0]).toMatchObject({ n: 0, agua_promedio: 0, producto_promedio: 0, elegible: false })
  })
  it('explicita la limitación cuando se configura una sola repetición', () => {
    expect(compararVariantes([variante('a', [registro()])], { min_repeticiones: 1 }).motivo).toContain('Una única observación')
  })
  it.each([0, -1, 1.5, NaN, Infinity])('rechaza mínimo inválido %s', (minimo) => {
    expect(() => compararVariantes([], { min_repeticiones: minimo })).toThrow()
  })
  it('rechaza IDs duplicados y entrada sin lista', () => {
    expect(() => compararVariantes([variante('a', []), variante('a', [])])).toThrow()
    expect(() => compararVariantes(null as unknown as VarianteComparacion[])).toThrow()
  })
  it('no desborda promedios grandes y finitos', () => {
    const r = compararVariantes([variante('a', [registro(Number.MAX_VALUE, Number.MAX_VALUE), registro(Number.MAX_VALUE, Number.MAX_VALUE)])])
    expect(Number.isFinite(r.resumen[0].agua_promedio)).toBe(true)
  })
  it('es determinista y no modifica las entradas', () => {
    const datos = [variante('a', [registro(), registro()])]
    const original = structuredClone(datos)
    expect(compararVariantes(datos)).toEqual(compararVariantes(datos))
    expect(datos).toEqual(original)
  })
})
