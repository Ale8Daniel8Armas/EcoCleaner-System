import type { Orientacion, Producto } from '@ecocleaner/schemas'

export function evaluarEfluente(_e: {
  producto: Pick<Producto, 'ph' | 'ph_medido_a_ml_por_litro'>
  ml_por_litro_preparado: number
  rango_ph_descarga: { min: number; max: number }
  quedan_sobrantes_concentrados: boolean
  permite_reuso?: boolean
}): { orientacion: Orientacion; ph_estimado: number | null; motivo: string } {
  throw new Error('pendiente')
}
