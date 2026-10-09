import type { Receta } from './tipos'

export function calcularDesvio(_e: {
  receta: Receta
  litros_agua_reales: number
  ml_producto_reales: number
  dilucion_max_ml_por_litro: number
  tolerancia_pct?: number
}): { ml_por_litro_real: number; desvio_pct: number; sobredosis: boolean; supera_maximo_ficha: boolean } {
  throw new Error('pendiente')
}
