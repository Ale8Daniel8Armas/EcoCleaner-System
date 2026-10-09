import type { NivelSuciedad, Producto } from '@ecocleaner/schemas'
import type { Receta } from './tipos'

export function calcularReceta(_e: {
    superficie_m2: number
    litros_solucion_por_m2: number
    nivel_suciedad: NivelSuciedad
    producto: Pick<Producto, 'dilucion_min_ml_por_litro' | 'dilucion_ml_por_litro' | 'dilucion_max_ml_por_litro'>
}): Receta {
    throw new Error('pendiente')
}