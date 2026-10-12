import type { Receta } from './tipos'
import { esFinito, esObjeto, exigir, precisar } from './validacion'

export interface Desvio {
  ml_por_litro_real: number
  desvio_pct: number
  sobredosis: boolean
  supera_maximo_ficha: boolean
}

/**
 * RN-05: la concentración real se calcula sobre la solución final preparada
 * (agua + producto). El desvío compara esa concentración con la receta.
 * Hay sobredosis si el desvío positivo supera la tolerancia configurable;
 * también se marca si se excede el máximo de la ficha del fabricante.
 */
export function calcularDesvio(e: {
  receta: Receta
  litros_agua_reales: number
  ml_producto_reales: number
  dilucion_max_ml_por_litro: number
  tolerancia_pct?: number
}): Desvio {
  exigir(esObjeto(e), 'entrada', 'se requiere una entrada completa')
  exigir(esObjeto(e.receta) && esFinito(e.receta.ml_por_litro) && e.receta.ml_por_litro > 0,
    'receta.ml_por_litro', 'debe ser positivo y finito')
  exigir(esFinito(e.litros_agua_reales) && e.litros_agua_reales > 0,
    'litros_agua_reales', 'debe ser positivo y finito')
  exigir(esFinito(e.ml_producto_reales) && e.ml_producto_reales >= 0,
    'ml_producto_reales', 'debe ser no negativo y finito')
  exigir(esFinito(e.dilucion_max_ml_por_litro) && e.dilucion_max_ml_por_litro > 0,
    'dilucion_max_ml_por_litro', 'debe ser positivo y finito')
  const tolerancia = e.tolerancia_pct ?? 10
  exigir(esFinito(tolerancia) && tolerancia >= 0, 'tolerancia_pct', 'debe ser no negativa y finita')

  const litros_solucion_real = e.litros_agua_reales + e.ml_producto_reales / 1000
  const ml_por_litro_real = e.ml_producto_reales / litros_solucion_real
  const desvio_pct = (ml_por_litro_real - e.receta.ml_por_litro) / e.receta.ml_por_litro * 100
  exigir(esFinito(litros_solucion_real) && litros_solucion_real > 0 && esFinito(ml_por_litro_real) && esFinito(desvio_pct),
    'resultado', 'los cálculos deben producir cantidades positivas y finitas')

  return {
    ml_por_litro_real: precisar(ml_por_litro_real),
    desvio_pct: precisar(desvio_pct),
    sobredosis: desvio_pct > tolerancia,
    supera_maximo_ficha: ml_por_litro_real > e.dilucion_max_ml_por_litro,
  }
}
