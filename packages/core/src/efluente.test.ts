import { describe, expect, it } from 'vitest'
import { evaluarEfluente, type EntradaEfluente, type ReglaDisposicion } from './efluente'

// Todos los datos, fuentes y límites son FICTICIOS; no representan normativa ni seguridad real.
const entrada: EntradaEfluente = { producto: { ph: 7, ph_medido_a_ml_por_litro: 50 }, ml_por_litro_preparado: 50,
  rango_ph_descarga: { min: 6, max: 9 }, quedan_sobrantes_concentrados: false }
const medicion = { valor: 7, fuente: 'medición ficticia de ensayo' }
const validacion = { verificado: true, fuente: 'regla ficticia de ensayo', jurisdiccion: 'prueba no regulatoria', aplica_al_caso: true }
const regla = (orientacion: ReglaDisposicion['orientacion']): ReglaDisposicion => ({ orientacion, fuente: 'disposición ficticia', verificada: true, aplica_al_caso: true, criterios_adicionales_verificados: true })
const conMedicion = { ...entrada, medicion_ph_efluente: medicion, validacion_rango: validacion }

describe('orientación de efluente conservadora', () => {
  it('no usa el pH de la ficha aunque coincida exactamente la dosis preparada', () => {
    expect(evaluarEfluente(entrada)).toMatchObject({ orientacion: 'no_disponible', ph_estimado: null, ph_efluente: null, origen_ph: 'declarado_producto', autoriza_vertido: false })
  })
  it('distingue pH desconocido y pH medido sin inventar una estimación', () => {
    expect(evaluarEfluente({ ...entrada, producto: {} }).origen_ph).toBe('desconocido')
    expect(evaluarEfluente(conMedicion)).toMatchObject({ origen_ph: 'medido_efluente', ph_efluente: 7, ph_estimado: null })
  })
  it('pH en rango y permiso de reúso aislado no autorizan nada', () => {
    expect(evaluarEfluente({ ...conMedicion, permite_reuso: true })).toMatchObject({ orientacion: 'no_disponible', autoriza_vertido: false })
  })
  it('requiere procedencia, jurisdicción y aplicabilidad del rango', () => {
    for (const rango of [undefined, { ...validacion, verificado: false }, { ...validacion, aplica_al_caso: false }, { ...validacion, fuente: '' }, { ...validacion, jurisdiccion: '' }]) {
      expect(evaluarEfluente({ ...conMedicion, validacion_rango: rango }).orientacion).toBe('no_disponible')
    }
  })
  it('evalúa solo el rango configurado y reconoce extremos inclusivos', () => {
    const completo = { ...conMedicion, regla_disposicion: regla('verter') }
    for (const valor of [6, 9]) expect(evaluarEfluente({ ...completo, medicion_ph_efluente: { ...medicion, valor } }).orientacion).toBe('verter')
    expect(evaluarEfluente({ ...completo, rango_ph_descarga: { min: 8, max: 10 } }).orientacion).toBe('ajustar')
  })
  it.each([NaN, Infinity, -1, 15])('rechaza medición inválida %s', (valor) => {
    expect(evaluarEfluente({ ...conMedicion, medicion_ph_efluente: { ...medicion, valor } }).orientacion).toBe('no_disponible')
  })
  it('rechaza medición sin fuente', () => {
    expect(evaluarEfluente({ ...conMedicion, medicion_ph_efluente: { valor: 7, fuente: '' } }).orientacion).toBe('no_disponible')
  })
  it('no convierte una medición declarada o estimada sin contrato en medición final', () => {
    expect(evaluarEfluente({ ...entrada, ph_estimado: 7 } as EntradaEfluente).orientacion).toBe('no_disponible')
  })
  it.each([{ min: 10, max: 6 }, { min: NaN, max: 9 }, { min: -1, max: 14 }, { min: 0, max: Infinity }])('rechaza rango inválido %o', (rango) => {
    expect(evaluarEfluente({ ...conMedicion, rango_ph_descarga: rango }).orientacion).toBe('no_disponible')
  })
  it.each([0, -1, NaN, Infinity, 1001])('rechaza dosis inválida %s', (valor) => {
    expect(evaluarEfluente({ ...conMedicion, ml_por_litro_preparado: valor }).orientacion).toBe('no_disponible')
  })
  it('devuelve dato no disponible para producto o entrada incompletos', () => {
    for (const dato of [null, {}, { ...entrada, producto: null }, { ...entrada, quedan_sobrantes_concentrados: undefined }]) {
      expect(evaluarEfluente(dato as EntradaEfluente).orientacion).toBe('no_disponible')
    }
  })
  it('prioriza gestor para sobrantes o disposición documentada incluso sin pH', () => {
    expect(evaluarEfluente({ ...entrada, quedan_sobrantes_concentrados: true }).orientacion).toBe('gestor')
    expect(evaluarEfluente({ ...entrada, regla_disposicion: regla('gestor') }).orientacion).toBe('gestor')
  })
  it('orienta reúso solo con regla específica, permiso y criterios adicionales', () => {
    const e = { ...conMedicion, permite_reuso: true, regla_disposicion: regla('reutilizar') }
    expect(evaluarEfluente(e)).toMatchObject({ orientacion: 'reutilizar', autoriza_vertido: false, requiere_revision: true })
    expect(evaluarEfluente({ ...e, permite_reuso: false }).orientacion).toBe('no_disponible')
    expect(evaluarEfluente({ ...e, regla_disposicion: { ...regla('reutilizar'), criterios_adicionales_verificados: false } }).orientacion).toBe('no_disponible')
  })
  it('no usa el rango de descarga para decidir el reúso', () => {
    expect(evaluarEfluente({ ...conMedicion, rango_ph_descarga: { min: 8, max: 9 }, permite_reuso: true,
      regla_disposicion: regla('reutilizar'), validacion_rango: undefined }).orientacion).toBe('reutilizar')
  })
  it('no bloquea una regla válida de reúso por un rango de descarga inválido', () => {
    expect(evaluarEfluente({ ...conMedicion, rango_ph_descarga: { min: 10, max: 6 }, permite_reuso: true,
      regla_disposicion: regla('reutilizar'), validacion_rango: undefined })).toMatchObject({
      orientacion: 'reutilizar', autoriza_vertido: false, requiere_revision: true,
    })
  })
  it('no interpreta reglas no verificadas o no aplicables', () => {
    for (const r of [{ ...regla('verter'), verificada: false }, { ...regla('verter'), aplica_al_caso: false }, { ...regla('verter'), fuente: '' }]) {
      expect(evaluarEfluente({ ...conMedicion, regla_disposicion: r }).orientacion).toBe('no_disponible')
    }
  })
  it('no orienta vertido con pH aislado, ni con criterios adicionales pendientes', () => {
    expect(evaluarEfluente(conMedicion).orientacion).toBe('no_disponible')
    expect(evaluarEfluente({ ...conMedicion, regla_disposicion: { ...regla('verter'), criterios_adicionales_verificados: false } }).orientacion).toBe('no_disponible')
  })
  it('la orientación documentada de vertido siempre exige revisión y nunca autoriza', () => {
    const r = evaluarEfluente({ ...conMedicion, regla_disposicion: regla('verter') })
    expect(r).toMatchObject({ orientacion: 'verter', requiere_revision: true, autoriza_vertido: false, ph_estimado: null })
    expect(r.motivo).toContain('no constituye autorización legal')
    expect(r.referencias).toContain('disposición ficticia')
  })
  it('respeta una regla documentada de ajuste sin indicar dosificaciones químicas', () => {
    expect(evaluarEfluente({ ...conMedicion, regla_disposicion: regla('ajustar') }).orientacion).toBe('ajustar')
  })
  it('no requiere conexiones ni altera entradas y es determinista', () => {
    const original = structuredClone(conMedicion)
    expect(evaluarEfluente(conMedicion)).toEqual(evaluarEfluente(conMedicion))
    expect(conMedicion).toEqual(original)
  })
})
