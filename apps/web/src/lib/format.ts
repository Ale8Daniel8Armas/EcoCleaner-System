const numberFormatter = new Intl.NumberFormat('es-EC', {
  maximumFractionDigits: 1,
})

/** Formato numérico único de la aplicación (evita repetir el locale por pantalla). */
export const formatNumber = (value: number): string =>
  numberFormatter.format(value)

/** Formato con decimales fijos, para desvíos y porcentajes. */
export const formatPercent = (value: number, fractionDigits = 1): string =>
  new Intl.NumberFormat('es-EC', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
