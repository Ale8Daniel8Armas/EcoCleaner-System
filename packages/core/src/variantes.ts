import { esFinito, esObjeto, exigir, precisar } from './validacion'

export interface RegistroComparacion {
  litros_agua_reales: number
  ml_producto_reales: number
  cumple_criterio: boolean
  /** Sin estos metadatos la llamada sigue siendo válida, pero no respalda una recomendación. */
  marca?: 'medido' | 'estimado'
  fuente?: 'manual' | 'simulada' | 'sensor'
}
export interface VarianteComparacion {
  variante_id: string
  nombre: string
  registros: RegistroComparacion[]
}
function promedio(valores: number[]): number {
  let media = 0
  valores.forEach((valor, i) => { media += (valor - media) / (i + 1) })
  return precisar(media)
}
/**
 * El llamador agrupa pruebas de la misma tarea y condiciones equivalentes.
 * Política existente en pendientes.test.ts: menor producto promedio. El agua
 * se informa por separado; un empate requiere decisión del supervisor.
 * Mínimo por defecto 2: barrera operativa ante una observación aislada, no
 * prueba de significación estadística. Solo mediciones no simuladas respaldan la recomendación.
 */
export function compararVariantes(variantes: VarianteComparacion[], opciones?: { min_repeticiones?: number }) {
  exigir(Array.isArray(variantes), 'variantes', 'se requiere una lista')
  exigir(opciones === undefined || esObjeto(opciones), 'opciones', 'debe ser un objeto')
  const minimo = opciones?.min_repeticiones ?? 2
  exigir(Number.isSafeInteger(minimo) && minimo > 0, 'min_repeticiones', 'debe ser un entero positivo')
  const ids = new Set<string>()
  const resumen = variantes.map((variante) => {
    exigir(esObjeto(variante) && typeof variante.variante_id === 'string' && variante.variante_id.trim() !== '',
      'variante_id', 'debe identificar una variante')
    exigir(!ids.has(variante.variante_id), 'variante_id', 'no se permiten identificadores duplicados')
    ids.add(variante.variante_id)
    const registros: RegistroComparacion[] = Array.isArray(variante.registros) ? variante.registros : []
    const validos = registros.filter((r) => esObjeto(r) &&
      esFinito(r.litros_agua_reales) && r.litros_agua_reales > 0 &&
      esFinito(r.ml_producto_reales) && r.ml_producto_reales >= 0 && typeof r.cumple_criterio === 'boolean' &&
      (r.marca === undefined || r.marca === 'medido' || r.marca === 'estimado') &&
      (r.fuente === undefined || ['manual', 'simulada', 'sensor'].includes(r.fuente)))
    const medidos = validos.filter((r) => r.marca === 'medido' && (r.fuente === 'manual' || r.fuente === 'sensor'))
    const incumple = registros.some((r) => esObjeto(r) && r.cumple_criterio === false)
    const incompletos = registros.some((r) => !esObjeto(r) || typeof r.cumple_criterio !== 'boolean')
    const base = medidos.length ? medidos : validos
    return {
      variante_id: variante.variante_id, n: validos.length,
      tasa_cumplimiento: validos.length ? precisar(validos.filter((r) => r.cumple_criterio).length / validos.length) : 0,
      agua_promedio: promedio(base.map((r) => r.litros_agua_reales)),
      producto_promedio: promedio(base.map((r) => r.ml_producto_reales)),
      elegible: medidos.length >= minimo && !incumple && !incompletos,
      n_medidos: medidos.length,
      n_estimados: validos.filter((r) => r.marca === 'estimado').length,
      n_simulados: validos.filter((r) => r.fuente === 'simulada').length,
      n_sin_procedencia: validos.filter((r) => r.marca === undefined || r.fuente === undefined).length,
      n_invalidos: registros.length - validos.length,
      base_promedios: medidos.length ? 'medidos' as const : 'provisional' as const,
      motivo: incumple ? 'Incumple el criterio en al menos una repetición.' : incompletos ?
        'Hay resultados de limpieza incompletos.' : medidos.length < minimo ?
          `Requiere ${minimo} repeticiones medidas no simuladas; tiene ${medidos.length}.` :
          'Cumple el criterio y el mínimo de observaciones medidas no simuladas.',
    }
  })
  const elegibles = resumen.filter((r) => r.elegible)
  if (!elegibles.length) return { resumen, recomendada: null, motivo: 'No hay variantes elegibles con resultados y mediciones suficientes.' }
  const menor = elegibles.reduce((minimo, r) => Math.min(minimo, r.producto_promedio), Infinity)
  const candidatas = elegibles.filter((r) => r.producto_promedio === menor)
  if (candidatas.length !== 1) return {
    resumen, recomendada: null,
    motivo: 'Empate en producto promedio. Decisión pendiente del supervisor; el agua se presenta por separado.',
  }
  const candidata = candidatas[0]
  return {
    resumen, recomendada: candidata.variante_id,
    motivo: `Menor producto promedio según la política del proyecto, con ${candidata.n_medidos} observaciones medidas no simuladas. ` +
      'El consumo de agua se informa por separado. Recomendación observacional; no implica significación estadística.' +
      (candidata.n_medidos === 1 ? ' Una única observación no es evidencia experimental concluyente.' : ''),
  }
}
