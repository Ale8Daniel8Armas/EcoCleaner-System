import type { Orientacion, Producto } from '@ecocleaner/schemas'
import { esFinito, esObjeto } from './validacion'

export interface ReglaDisposicion {
  orientacion: Exclude<Orientacion, 'no_disponible'>
  fuente: string
  verificada: boolean
  aplica_al_caso: boolean
  /** Revisión de aspectos distintos del pH, necesaria para verter o reutilizar. */
  criterios_adicionales_verificados?: boolean
}
export interface EntradaEfluente {
  producto: Pick<Producto, 'ph' | 'ph_medido_a_ml_por_litro'>
  ml_por_litro_preparado: number
  rango_ph_descarga: { min: number; max: number }
  quedan_sobrantes_concentrados: boolean
  permite_reuso?: boolean
  /** Extensiones opcionales locales: la ficha del producto nunca sustituye esta medición. */
  medicion_ph_efluente?: { valor: number; fuente: string }
  validacion_rango?: { verificado: boolean; fuente: string; jurisdiccion: string; aplica_al_caso: boolean }
  /** Regla estructurada revisada fuera del core, no inferida de texto libre ni de un LLM. */
  regla_disposicion?: ReglaDisposicion
}
export interface EvaluacionEfluente {
  orientacion: Orientacion
  ph_estimado: null
  motivo: string
  ph_efluente: number | null
  origen_ph: 'medido_efluente' | 'declarado_producto' | 'desconocido'
  referencias: string[]
  requiere_revision: true
  autoriza_vertido: false
}
const textoDisponible = (valor: unknown): valor is string => typeof valor === 'string' && valor.trim() !== ''
const phValido = (valor: unknown): valor is number => esFinito(valor) && valor >= 0 && valor <= 14

/** Orientación preliminar: no contiene umbrales legales ni un modelo de estimación de pH. */
export function evaluarEfluente(e: EntradaEfluente): EvaluacionEfluente {
  const medicion = esObjeto(e) && esObjeto(e.medicion_ph_efluente) &&
    phValido(e.medicion_ph_efluente.valor) && textoDisponible(e.medicion_ph_efluente.fuente) ? e.medicion_ph_efluente : null
  const phCatalogo = esObjeto(e) && esObjeto(e.producto) && phValido(e.producto.ph)
  const respuesta = (orientacion: Orientacion, motivo: string, referencias: string[] = []): EvaluacionEfluente => ({
    orientacion, ph_estimado: null, motivo, ph_efluente: medicion?.valor ?? null,
    origen_ph: medicion ? 'medido_efluente' : phCatalogo ? 'declarado_producto' : 'desconocido',
    referencias: [...(medicion ? [medicion.fuente] : []), ...referencias],
    requiere_revision: true, autoriza_vertido: false,
  })
  if (!esObjeto(e) || !esObjeto(e.producto) || typeof e.quedan_sobrantes_concentrados !== 'boolean') {
    return respuesta('no_disponible', 'Faltan datos estructurados del producto o del efluente.')
  }
  if (e.quedan_sobrantes_concentrados) {
    return respuesta('gestor', 'Hay sobrantes concentrados: solicitar evaluación de un gestor autorizado. No se autoriza vertido ni se indica un tratamiento químico.', ['precaucion:sobrantes_concentrados'])
  }
  if (!esFinito(e.ml_por_litro_preparado) || e.ml_por_litro_preparado <= 0 || e.ml_por_litro_preparado > 1000 ||
    (e.permite_reuso !== undefined && typeof e.permite_reuso !== 'boolean') ||
    (e.producto.ph != null && !phValido(e.producto.ph)) ||
    (e.producto.ph_medido_a_ml_por_litro != null && (!esFinito(e.producto.ph_medido_a_ml_por_litro) ||
      e.producto.ph_medido_a_ml_por_litro <= 0 || e.producto.ph_medido_a_ml_por_litro > 1000))) {
    return respuesta('no_disponible', 'Hay datos de dosificación, pH o reúso inválidos.')
  }
  const regla = e.regla_disposicion
  const reglaValida = esObjeto(regla) && regla.verificada === true && regla.aplica_al_caso === true &&
    textoDisponible(regla.fuente) && ['verter', 'ajustar', 'reutilizar', 'gestor'].includes(regla.orientacion)
  if (reglaValida && regla.orientacion === 'gestor') {
    return respuesta('gestor', 'La regla documentada remite a un gestor autorizado para revisión.', [regla.fuente])
  }
  if (!medicion) {
    return respuesta('no_disponible', 'No hay pH medido del efluente. El pH declarado del producto, incluso a la misma dilución, no describe el agua residual; no existe un modelo válido de estimación.')
  }
  if (reglaValida && regla.orientacion === 'reutilizar') {
    if (e.permite_reuso !== true || regla.criterios_adicionales_verificados !== true) {
      return respuesta('no_disponible', 'El reúso requiere permiso técnico para el caso y criterios adicionales al pH verificados.', [regla.fuente])
    }
    return respuesta('reutilizar', 'La regla documentada contempla reúso para este caso, sujeto a revisión del responsable. El rango de descarga no se usa como criterio de reúso.', [regla.fuente])
  }
  const rango = e.rango_ph_descarga
  if (!esObjeto(rango) || !phValido(rango.min) || !phValido(rango.max) || rango.min > rango.max) {
    return respuesta('no_disponible', 'El rango configurable de pH falta o es inválido.')
  }
  const validacion = e.validacion_rango
  if (!esObjeto(validacion) || validacion.verificado !== true || validacion.aplica_al_caso !== true ||
    !textoDisponible(validacion.fuente) || !textoDisponible(validacion.jurisdiccion)) {
    return respuesta('no_disponible', 'El rango de descarga no está verificado para la jurisdicción y este caso. Un valor de ejemplo no constituye una regla aplicable.')
  }
  if (medicion.valor < rango.min || medicion.valor > rango.max) {
    return respuesta('ajustar', 'El pH medido está fuera del rango configurado y verificado. Requiere evaluación técnica antes de cualquier descarga; no se prescribe neutralización ni tratamiento.', [validacion.fuente])
  }
  if (!reglaValida) {
    return respuesta('no_disponible', 'El pH dentro del rango no basta para determinar disposición. Falta una regla documentada y aplicable al efluente.', [validacion.fuente])
  }
  if (regla.orientacion === 'ajustar') {
    return respuesta('ajustar', 'La regla documentada requiere evaluación o ajuste por el responsable técnico.', [validacion.fuente, regla.fuente])
  }
  if (regla.criterios_adicionales_verificados !== true) {
    return respuesta('no_disponible', 'Falta verificar criterios adicionales al pH; no se puede orientar el vertido.', [validacion.fuente, regla.fuente])
  }
  return respuesta('verter', 'La regla documentada contempla vertido para este caso. Esta orientación preliminar requiere revisión y no constituye autorización legal ni certificación de seguridad.', [validacion.fuente, regla.fuente])
}
