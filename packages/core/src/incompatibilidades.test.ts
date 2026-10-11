import { describe, expect, it } from 'vitest'
import { detectarIncompatibilidades, type ProductoIncompatibilidad } from './incompatibilidades'

// Categorías y reglas ficticias: validan software, no seguridad química real.
const a: ProductoIncompatibilidad = { id: 'a', nombre: 'Ficticio A', categorias: ['alcalino'], incompatibilidades: ['acido'], url_hoja_seguridad: 'https://example.invalid/ficha-a' }
const b: ProductoIncompatibilidad = { id: 'b', nombre: 'Ficticio B', categorias: ['acido'], incompatibilidades: [] }

describe('incompatibilidades y datos desconocidos', () => {
  it('detecta una regla unidireccional y conserva fuente y origen', () => {
    expect(detectarIncompatibilidades([b, a], { detallado: true })).toMatchObject({
      estado: 'incompatibilidades_documentadas', compatibilidad_demostrada: false,
      conflictos: [{ producto_a_id: 'a', producto_b_id: 'b', categoria: 'acido', reglas: [{ producto_origen_id: 'a', fuente: a.url_hoja_seguridad }] }],
    })
  })
  it('no convierte la ausencia de coincidencias en compatibilidad demostrada', () => {
    expect(detectarIncompatibilidades([{ ...a, incompatibilidades: [] }, b], { detallado: true })).toMatchObject({ conflictos: [], estado: 'sin_coincidencias_documentadas', compatibilidad_demostrada: false })
  })
  it.each(['categorias', 'incompatibilidades'] as const)('informa ausencia de %s sin perder conflictos conocidos', (campo) => {
    const incompleto = { ...b, id: 'c', [campo]: undefined } as unknown as ProductoIncompatibilidad
    const r = detectarIncompatibilidades([a, b, incompleto], { detallado: true })
    expect(r.estado).toBe('datos_insuficientes')
    expect(r.datos_insuficientes.some((d) => d.producto_id === 'c' && d.campo === campo)).toBe(true)
    expect(r.conflictos.length).toBeGreaterThan(0)
  })
  it('informa categorías vacías, productos nulos y lista vacía', () => {
    for (const datos of [[], [null], [{ ...a, categorias: [] }]]) {
      expect(detectarIncompatibilidades(datos as ProductoIncompatibilidad[], { detallado: true }).estado).toBe('datos_insuficientes')
    }
  })
  it('no infiere categorías por nombres comerciales', () => {
    const r = detectarIncompatibilidades([{ ...a, nombre: 'Ácido comercial', categorias: [], incompatibilidades: [] }, b], { detallado: true })
    expect(r.conflictos).toEqual([])
    expect(r.estado).toBe('datos_insuficientes')
  })
  it('informa categorías desconocidas', () => {
    const desconocido = { ...b, categorias: ['desconocida'] } as unknown as ProductoIncompatibilidad
    expect(detectarIncompatibilidades([a, desconocido], { detallado: true }).estado).toBe('datos_insuficientes')
  })
  it('no duplica advertencias por categorías repetidas', () => {
    expect(detectarIncompatibilidades([{ ...a, incompatibilidades: ['acido', 'acido'] }, b])).toHaveLength(1)
  })
  it('no requiere fuente inventada cuando el catálogo no incluye URL', () => {
    expect(detectarIncompatibilidades([{ ...a, url_hoja_seguridad: undefined }, b])[0].reglas[0]).toMatchObject({ fuente: null, campo: 'productos[a].incompatibilidades' })
  })
  it('rechaza IDs duplicados y entradas no estructuradas', () => {
    expect(() => detectarIncompatibilidades([a, a])).toThrow()
    expect(() => detectarIncompatibilidades(null as unknown as ProductoIncompatibilidad[])).toThrow()
  })
  it('es determinista y no modifica entradas', () => {
    const datos = [b, a], original = structuredClone(datos)
    expect(detectarIncompatibilidades(datos, { detallado: true })).toEqual(detectarIncompatibilidades(datos, { detallado: true }))
    expect(datos).toEqual(original)
  })
})
