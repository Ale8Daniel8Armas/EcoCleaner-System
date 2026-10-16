import { calcularDesvio } from '@ecocleaner/core'
import type { Receta } from '@ecocleaner/core'
import type { NuevoRegistro } from '../services/tareas'

export type SimulationScenario = 'normal' | 'fuga_agua' | 'sobredosis_producto'

export interface SimulatorInput {
  receta: Pick<Receta, 'litros_agua' | 'ml_producto' | 'ml_por_litro'>
  tiempoEstimadoMin: number
  escenario: SimulationScenario
  semilla: number
  dilucionMaxMlPorLitro: number
  toleranciaPct?: number
}

export interface SimulationReading {
  tick: number
  progress: number
  caudalAguaLMin: number
  caudalProductoMlMin: number
  litrosAguaAcumulados: number
  mlProductoAcumulados: number
  alertaAgua: boolean
  alertaProducto: boolean
  alertaAguaNueva: boolean
  alertaProductoNueva: boolean
}

export interface SimulationRun {
  readings: SimulationReading[]
  final: SimulationReading
  alertaAgua: boolean
  alertaProducto: boolean
  excesoAguaLitros: number
  desvioProductoPct: number
}

const TICKS = 40
const TOLERANCIA_DEFAULT = 10

function mulberry32(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let result = Math.imul(value ^ (value >>> 15), 1 | value)
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function positive(value: number): number {
  return Math.max(0, Number.isFinite(value) ? value : 0)
}

export function generateSimulation(input: SimulatorInput): SimulationRun {
  const random = mulberry32(input.semilla)
  const tolerance = input.toleranciaPct ?? TOLERANCIA_DEFAULT
  const aguaObjetivo = positive(input.receta.litros_agua)
  const productoObjetivo = positive(input.receta.ml_producto)
  const tickMinutes = Math.max(0.001, input.tiempoEstimadoMin / TICKS)
  const readings: SimulationReading[] = []
  let agua = 0
  let producto = 0
  let alertaAgua = false
  let alertaProducto = false

  for (let tick = 1; tick <= TICKS; tick += 1) {
    const progress = tick / TICKS
    const noise = 0.98 + random() * 0.04
    const fugaActiva = input.escenario === 'fuga_agua' && progress >= 0.4
    const bombaActiva = input.escenario === 'sobredosis_producto' && progress >= 0.3
    const multiplicadorAgua = fugaActiva ? 4 : 1
    const multiplicadorProducto = bombaActiva ? 2 : 1
    const aguaTick = (aguaObjetivo / TICKS) * noise * multiplicadorAgua
    const productoTick = (productoObjetivo / TICKS) * noise * multiplicadorProducto
    agua += positive(aguaTick)
    producto += positive(productoTick)

    const aguaNueva: boolean = !alertaAgua && agua > aguaObjetivo * (1 + tolerance / 100)
    let productoNueva = false
    try {
      const desvio = calcularDesvio({
        receta: {
          litros_agua: aguaObjetivo,
          litros_solucion: aguaObjetivo + productoObjetivo / 1000,
          ml_producto: productoObjetivo,
          ml_por_litro: input.receta.ml_por_litro,
        },
        litros_agua_reales: Math.max(agua, 0.0001),
        ml_producto_reales: producto,
        dilucion_max_ml_por_litro: input.dilucionMaxMlPorLitro,
        tolerancia_pct: tolerance,
      })
      productoNueva = !alertaProducto && desvio.sobredosis
    } catch {
    }

    alertaAgua = alertaAgua || aguaNueva
    alertaProducto = alertaProducto || productoNueva
    readings.push({
      tick,
      progress,
      caudalAguaLMin: positive(aguaTick / tickMinutes),
      caudalProductoMlMin: positive(productoTick / tickMinutes),
      litrosAguaAcumulados: agua,
      mlProductoAcumulados: producto,
      alertaAgua,
      alertaProducto,
      alertaAguaNueva: aguaNueva,
      alertaProductoNueva: productoNueva,
    })
  }

  const final = readings[readings.length - 1]
  const desvioFinal = calcularDesvio({
    receta: {
      litros_agua: aguaObjetivo,
      litros_solucion: aguaObjetivo + productoObjetivo / 1000,
      ml_producto: productoObjetivo,
      ml_por_litro: input.receta.ml_por_litro,
    },
    litros_agua_reales: Math.max(final.litrosAguaAcumulados, 0.0001),
    ml_producto_reales: final.mlProductoAcumulados,
    dilucion_max_ml_por_litro: input.dilucionMaxMlPorLitro,
    tolerancia_pct: tolerance,
  })

  return {
    readings,
    final,
    alertaAgua,
    alertaProducto,
    excesoAguaLitros: Math.max(0, final.litrosAguaAcumulados - aguaObjetivo),
    desvioProductoPct: desvioFinal.desvio_pct,
  }
}

export function buildSimulatedUsageRecord(input: {
  tareaId: string
  run: SimulationRun
  duracionMin: number
}): NuevoRegistro {
  return {
    tarea_id: input.tareaId,
    litros_agua_reales: Math.max(input.run.final.litrosAguaAcumulados, 0.001),
    ml_producto_reales: Math.max(input.run.final.mlProductoAcumulados, 0),
    duracion_min: Math.max(1, input.duracionMin),
    marca: 'medido',
    fuente: 'simulada',
    alerta_sobredosis: input.run.alertaAgua || input.run.alertaProducto,
    desvio_pct: input.run.desvioProductoPct,
  }
}
