import type { Producto, NivelSuciedad, Orientacion } from '@ecocleaner/schemas'

export type { NivelSuciedad, Orientacion }
export type ProductoFila = Producto & { id: string }

export interface Receta {
  litros_solucion: number
  ml_por_litro: number
  ml_producto: number
  litros_agua: number
}
