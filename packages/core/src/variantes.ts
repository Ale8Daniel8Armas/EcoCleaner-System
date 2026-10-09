export function compararVariantes(
  _variantes: {
    variante_id: string
    nombre: string
    registros: { litros_agua_reales: number; ml_producto_reales: number; cumple_criterio: boolean }[]
  }[],
  _opciones?: { min_repeticiones?: number }
): {
  resumen: {
    variante_id: string
    n: number
    tasa_cumplimiento: number
    agua_promedio: number
    producto_promedio: number
    elegible: boolean
  }[]
  recomendada: string | null
  motivo: string
} {
  throw new Error('pendiente')
}
