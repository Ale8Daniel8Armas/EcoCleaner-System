import type {
  EvidenceValue,
  ExplanationInput,
  PreparedContext,
  ReviewAction,
} from './contracts.ts'

export const MAX_CONTEXT_BYTES = 24_000
export const MAX_RESPONSE_BYTES = 12_000

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
export const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
export const isText = (value: unknown, max = 1000): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max

export const containsSecret = (text: string): boolean =>
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{40,}|\bgsk_[A-Za-z0-9]{20,}|\bsk-[A-Za-z0-9_-]{24,}|\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|(?:api[_ -]?key|service[_ -]?role[_ -]?key|password)\s*[:=]\s*\S{8,}/i.test(
    text,
  )

/** Solo proyecta los campos necesarios; no recalcula ni vuelve a decidir en el dominio. */
export function prepareContext(
  input: ExplanationInput,
): PreparedContext | null {
  if (
    !isObject(input) ||
    !isText(input.question, 700) ||
    (input.observations !== undefined && !isText(input.observations, 1200)) ||
    !['synthetic', 'approved_for_external_processing'].includes(
      input.disclosure,
    ) ||
    !isObject(input.context) ||
    !isObject(input.context.result)
  )
    return null

  const result: Record<string, unknown> = input.context.result
  const facts: Record<string, EvidenceValue> = {}
  let valid = true
  const field = (
    object: Record<string, unknown>,
    key: string,
    path: string,
    check: (value: unknown) => boolean,
  ) => {
    const value = object[key]
    if (!check(value)) valid = false
    else facts[`${path}.${key}`] = value as EvidenceValue
  }
  const positive = (value: unknown) => isNumber(value) && value > 0
  const nonnegative = (value: unknown) => isNumber(value) && value >= 0
  const count = (value: unknown) =>
    Number.isSafeInteger(value) && (value as number) >= 0
  const boolean = (value: unknown) => typeof value === 'boolean'
  const id = (value: unknown) =>
    isText(value, 80) && /^[\p{L}\p{N}_-]+$/u.test(value)
  const text = (value: unknown) => isText(value)
  let allowedActions: ReviewAction[] = []
  let recommendedVariantId: string | null = null

  switch (input.context.kind) {
    case 'recipe':
      for (const key of ['litros_solucion', 'ml_por_litro', 'ml_producto'])
        field(result, key, 'result', positive)
      field(result, 'litros_agua', 'result', nonnegative)
      allowedActions = ['review_recipe', 'review_records']
      break
    case 'deviation':
      field(result, 'ml_por_litro_real', 'result', nonnegative)
      field(result, 'desvio_pct', 'result', isNumber)
      field(result, 'sobredosis', 'result', boolean)
      field(result, 'supera_maximo_ficha', 'result', boolean)
      allowedActions = ['review_recipe', 'review_records', 'consult_specialist']
      break
    case 'comparison': {
      if (!Array.isArray(result.resumen) || result.resumen.length > 20)
        return null
      const ids = new Set<string>()
      for (const [index, row] of result.resumen.entries()) {
        if (!isObject(row)) return null
        const path = `result.resumen[${index}]`
        field(row, 'variante_id', path, id)
        if (ids.has(row.variante_id as string)) return null
        ids.add(row.variante_id as string)
        for (const key of [
          'n',
          'n_medidos',
          'n_estimados',
          'n_simulados',
          'n_sin_procedencia',
          'n_invalidos',
        ]) {
          field(row, key, path, count)
        }
        field(
          row,
          'tasa_cumplimiento',
          path,
          (value) => isNumber(value) && value >= 0 && value <= 1,
        )
        for (const key of ['agua_promedio', 'producto_promedio'])
          field(row, key, path, nonnegative)
        field(row, 'elegible', path, boolean)
        field(
          row,
          'base_promedios',
          path,
          (value) => value === 'medidos' || value === 'provisional',
        )
        field(row, 'motivo', path, text)
      }
      field(
        result,
        'recomendada',
        'result',
        (value) => value === null || id(value),
      )
      field(result, 'motivo', 'result', text)
      if (typeof result.recomendada === 'string') {
        const chosen = result.resumen.find(
          (row) => row.variante_id === result.recomendada,
        )
        if (!chosen || chosen.elegible !== true) return null
        recommendedVariantId = result.recomendada
      }
      allowedActions = ['review_records', 'collect_measurements']
      if (recommendedVariantId) allowedActions.push('review_variant')
      break
    }
    case 'incompatibilities': {
      field(result, 'estado', 'result', (value) =>
        [
          'incompatibilidades_documentadas',
          'sin_coincidencias_documentadas',
          'datos_insuficientes',
        ].includes(value as string),
      )
      field(
        result,
        'compatibilidad_demostrada',
        'result',
        (value) => value === false,
      )
      if (
        !Array.isArray(result.conflictos) ||
        result.conflictos.length > 30 ||
        !Array.isArray(result.datos_insuficientes) ||
        result.datos_insuficientes.length > 30
      )
        return null
      for (const [index, conflict] of result.conflictos.entries()) {
        if (
          !isObject(conflict) ||
          !Array.isArray(conflict.reglas) ||
          !conflict.reglas.length ||
          conflict.reglas.length > 10
        )
          return null
        const path = `result.conflictos[${index}]`
        field(conflict, 'producto_a_id', path, id)
        field(conflict, 'producto_b_id', path, id)
        field(conflict, 'categoria', path, text)
        for (const [ruleIndex, rule] of conflict.reglas.entries()) {
          if (!isObject(rule)) return null
          const rulePath = `${path}.reglas[${ruleIndex}]`
          field(rule, 'producto_origen_id', rulePath, id)
          field(rule, 'campo', rulePath, text)
          field(
            rule,
            'fuente',
            rulePath,
            (value) => value === null || text(value),
          )
        }
      }
      for (const [index, missing] of result.datos_insuficientes.entries()) {
        if (!isObject(missing)) return null
        const path = `result.datos_insuficientes[${index}]`
        field(
          missing,
          'producto_id',
          path,
          (value) => value === null || id(value),
        )
        field(missing, 'campo', path, text)
        field(missing, 'motivo', path, text)
      }
      allowedActions = ['review_documentation', 'consult_specialist']
      break
    }
    case 'effluent':
      field(result, 'orientacion', 'result', (value) =>
        ['verter', 'ajustar', 'reutilizar', 'gestor', 'no_disponible'].includes(
          value as string,
        ),
      )
      field(result, 'ph_estimado', 'result', (value) => value === null)
      field(
        result,
        'ph_efluente',
        'result',
        (value) =>
          value === null || (isNumber(value) && value >= 0 && value <= 14),
      )
      field(result, 'origen_ph', 'result', (value) =>
        ['medido_efluente', 'declarado_producto', 'desconocido'].includes(
          value as string,
        ),
      )
      field(result, 'motivo', 'result', text)
      field(result, 'requiere_revision', 'result', (value) => value === true)
      field(result, 'autoriza_vertido', 'result', (value) => value === false)
      if (
        (result.origen_ph === 'medido_efluente') !==
        (result.ph_efluente !== null)
      )
        return null
      if (!Array.isArray(result.referencias) || result.referencias.length > 20)
        return null
      result.referencias.forEach((reference, index) => {
        if (!text(reference)) valid = false
        else facts[`result.referencias[${index}]`] = reference
      })
      allowedActions = [
        'review_documentation',
        'collect_measurements',
        'consult_specialist',
      ]
      break
    default:
      return null
  }
  if (!valid) return null
  return {
    kind: input.context.kind,
    facts,
    allowedActions,
    recommendedVariantId,
  }
}
