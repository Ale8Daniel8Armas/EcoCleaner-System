import type { ProductoFila } from './tipos'

export function detectarIncompatibilidades(
  _productos: Pick<ProductoFila, 'id' | 'nombre' | 'categorias' | 'incompatibilidades'>[]
): { producto_a_id: string; producto_b_id: string; categoria: string }[] {
  throw new Error('pendiente')
}
