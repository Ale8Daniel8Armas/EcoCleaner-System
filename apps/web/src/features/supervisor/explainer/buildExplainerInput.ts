import { calcularDesvio, compararVariantes } from '@ecocleaner/core'
import type {
  DemoRecord,
  DemoSnapshot,
  DemoTask,
  ExplainerInput,
  DataLimitation,
} from './contracts'
import {
  buildDemoReferences,
  displayTaskLimitation,
  referenceKey as reference,
} from './references'

const sourceLimitations: Record<DataLimitation, string> = {
  partial:
    'La carga está limitada; el resumen describe únicamente las tareas y relaciones cargadas.',
  local:
    'Origen local del navegador; no acredita una lectura actual de Supabase.',
  catalog_simulated: 'El catálogo local de referencia es simulado.',
  remote_unavailable:
    'La consulta del explicador a Supabase no estuvo disponible; se utiliza únicamente el estado local.',
}

const validNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
const validRecord = (r: DemoRecord) =>
  validNumber(r.waterL) && r.waterL > 0 && validNumber(r.productMl)
const validRecipe = (task: DemoTask) => {
  const r = task.recipe
  return (
    r !== null &&
    [r.litros_agua, r.ml_producto, r.litros_solucion, r.ml_por_litro].every(
      validNumber,
    ) &&
    r.litros_solucion > 0 &&
    r.ml_por_litro > 0 &&
    r.ml_por_litro <= 1000 &&
    Math.abs(r.litros_agua + r.ml_producto / 1000 - r.litros_solucion) <
      0.001 &&
    Math.abs(r.ml_producto / r.litros_solucion - r.ml_por_litro) < 0.001
  )
}

export function buildExplainerInput(snapshot: DemoSnapshot): ExplainerInput {
  const output: ExplainerInput = {
    references: buildDemoReferences(snapshot),
    origin: snapshot.origin,
    completed: 0,
    pending: 0,
    unknownState: 0,
    declared: { waterL: 0, productMl: 0, tasks: 0 },
    expected: { waterL: 0, productMl: 0, tasks: 0 },
    paired: {
      declaredWaterL: 0,
      declaredProductMl: 0,
      expectedWaterL: 0,
      expectedProductMl: 0,
      tasks: 0,
    },
    provenance: {
      measured: 0,
      estimated: 0,
      simulated: 0,
      unknown: 0,
      total: 0,
      measuredPct: null,
      estimatedPct: null,
    },
    hasSimulation: snapshot.catalogSimulated,
    cleaning: {
      failed: [],
      passed: [],
      unknown: [],
      failedCount: 0,
      unknownCount: 0,
    },
    deviations: [],
    alerts: [],
    areas: [],
    comparisons: [],
    effluent: [],
    pendingEffluent: [],
    incomplete: [],
    limitations: [
      ...snapshot.limitations.flatMap((code) =>
        Object.hasOwn(sourceLimitations, code) ? [sourceLimitations[code]] : [],
      ),
      'Alcance: todas las áreas y tareas cargadas, sin filtro de fechas. Las métricas finales excluyen tareas pendientes y de estado desconocido.',
      'Se muestran nombres operativos y etiquetas de la carga actual; los identificadores completos están en las referencias de los registros. No se consultan perfiles de usuarios ni observaciones.',
    ],
  }
  const areaIds = [...new Set(snapshot.tasks.map((t) => t.areaId))]
  const areaGroups = new Map<string, Map<string, number>>()
  const taskIds = new Set<string>()
  for (const [taskIndex, task] of snapshot.tasks.entries()) {
    const taskRef = reference('Tarea', task.id, taskIndex)
    if (!task.id || taskIds.has(task.id)) {
      output.incomplete.push(taskRef)
      output.limitations.push(
        `${taskRef}: identificador ausente o duplicado; registro excluido.`,
      )
      continue
    }
    taskIds.add(task.id)
    if (task.state === 'receta_enviada') {
      output.pending++
      continue
    }
    if (task.state !== 'completada') {
      output.unknownState++
      output.incomplete.push(taskRef)
      continue
    }
    output.completed++
    const missing: string[] = []
    const recipeValid = validRecipe(task)
    if (!recipeValid) missing.push('receta válida')
    if (!validNumber(task.productMax) || task.productMax <= 0)
      missing.push('máximo de ficha')
    if (
      !task.areaId ||
      !task.productId ||
      !['baja', 'media', 'alta'].includes(task.dirt ?? '')
    )
      missing.push('área, producto o nivel de suciedad')
    if (!task.records.length) missing.push('registro de consumo')
    if (task.records.length !== 1)
      missing.push(
        'consumo final unívoco; las repeticiones no se suman como tareas',
      )
    const finalRecord =
      task.records.length === 1 && validRecord(task.records[0])
        ? task.records[0]
        : null
    if (finalRecord) {
      output.declared.waterL += finalRecord.waterL!
      output.declared.productMl += finalRecord.productMl!
      output.declared.tasks++
      if (recipeValid) {
        output.paired.declaredWaterL += finalRecord.waterL!
        output.paired.declaredProductMl += finalRecord.productMl!
        output.paired.expectedWaterL += task.recipe!.litros_agua
        output.paired.expectedProductMl += task.recipe!.ml_producto
        output.paired.tasks++
      }
    }
    if (recipeValid) {
      output.expected.waterL += task.recipe!.litros_agua
      output.expected.productMl += task.recipe!.ml_producto
      output.expected.tasks++
    }
    const seenRecords = new Set<string>()
    const records = task.records.filter((r) => {
      if (!r.id || seenRecords.has(r.id)) {
        missing.push('identificadores únicos de registro')
        return false
      }
      seenRecords.add(r.id)
      return true
    })
    if (records.some((r) => r.cleaning === false))
      output.cleaning.failed.push(taskRef)
    else if (records.length && records.every((r) => r.cleaning === true))
      output.cleaning.passed.push(taskRef)
    else {
      output.cleaning.unknown.push(taskRef)
      missing.push('evaluación de limpieza completa')
    }
    if (!records.length || records.some((r) => !r.decisions.length))
      output.pendingEffluent.push(taskRef)
    for (const [recordIndex, record] of records.entries()) {
      const recordRef = reference('Registro', record.id, recordIndex)
      output.provenance.total++
      if (record.source === 'simulada') {
        output.provenance.simulated++
        output.hasSimulation = true
      } else if (
        record.mark === 'medido' &&
        ['manual', 'sensor'].includes(record.source ?? '')
      )
        output.provenance.measured++
      else if (
        record.mark === 'estimado' &&
        ['manual', 'sensor'].includes(record.source ?? '')
      )
        output.provenance.estimated++
      else {
        output.provenance.unknown++
        missing.push('procedencia completa')
      }
      for (const decision of record.decisions)
        output.effluent.push({ task: taskRef, record: recordRef, decision })
      if (!validRecord(record))
        missing.push('cantidades válidas de agua y producto')
      let result: ReturnType<typeof calcularDesvio> | null = null
      if (
        recipeValid &&
        validRecord(record) &&
        validNumber(task.productMax) &&
        task.productMax > 0
      ) {
        try {
          result = calcularDesvio({
            receta: task.recipe!,
            litros_agua_reales: record.waterL!,
            ml_producto_reales: record.productMl!,
            dilucion_max_ml_por_litro: task.productMax,
          })
          const area = reference(
            'Área',
            task.areaId,
            areaIds.indexOf(task.areaId),
          )
          output.deviations.push({
            task: taskRef,
            area,
            record: recordRef,
            result,
          })
          if (
            task.areaId &&
            task.productId &&
            ['baja', 'media', 'alta'].includes(task.dirt ?? '') &&
            record.mark === 'medido' &&
            ['manual', 'sensor'].includes(record.source ?? '')
          ) {
            const key = JSON.stringify([
              task.productId,
              task.dirt,
              task.recipe!.ml_por_litro,
            ])
            const group = areaGroups.get(key) ?? new Map<string, number>()
            const previous = group.get(area)
            if (
              previous === undefined ||
              Math.abs(result.desvio_pct) > Math.abs(previous)
            )
              group.set(area, result.desvio_pct)
            areaGroups.set(key, group)
          }
        } catch {
          missing.push('entradas aceptadas por core para desvío')
        }
      }
      if (
        record.recordedOverdose ||
        result?.sobredosis ||
        result?.supera_maximo_ficha
      )
        output.alerts.push({
          task: taskRef,
          record: recordRef,
          overdose: result?.sobredosis ?? false,
          aboveMaximum: result?.supera_maximo_ficha ?? false,
          recorded: record.recordedOverdose,
        })
    }
    // Las variantes pertenecen a la misma tarea: no se infieren condiciones entre tareas.
    if (
      task.variants.length &&
      recipeValid &&
      validNumber(task.productMin) &&
      task.productMin > 0 &&
      validNumber(task.productMax) &&
      task.productMax >= task.productMin
    ) {
      const known = new Set(task.variants.map((v) => v.id))
      const validVariants = task.variants.every(
        (v) =>
          v.id &&
          validNumber(v.dilution) &&
          v.dilution >= task.productMin! &&
          v.dilution <= task.productMax!,
      )
      if (
        validVariants &&
        known.size === task.variants.length &&
        records.every((r) => r.variantId !== null && known.has(r.variantId))
      ) {
        try {
          const result = compararVariantes(
            task.variants.map((v, index) => ({
              variante_id: reference('Variante', v.id, index),
              nombre: reference('Variante', v.id, index),
              registros: records
                .filter((r) => r.variantId === v.id)
                .map((r) => ({
                  litros_agua_reales: r.waterL as number,
                  ml_producto_reales: r.productMl as number,
                  cumple_criterio: r.cleaning as boolean,
                  ...(r.mark ? { marca: r.mark } : {}),
                  ...(r.source ? { fuente: r.source } : {}),
                })),
            })),
          )
          output.comparisons.push({ task: taskRef, result })
        } catch {
          missing.push('entradas de comparación aceptadas por core')
        }
      } else
        missing.push(
          'variantes vinculadas y dosis documentadas dentro del máximo',
        )
    } else missing.push('variantes y ficha suficientes para comparar')
    if (missing.length) {
      output.incomplete.push(taskRef)
      output.limitations.push(
        `${taskRef}: falta ${[...new Set(missing)].join('; ')}.`,
      )
    }
  }
  for (const group of areaGroups.values()) {
    if (group.size < 2) continue
    const maximum = Math.max(...[...group.values()].map(Math.abs))
    output.areas.push({
      group: `Grupo ${output.areas.length + 1}`,
      winners: [...group]
        .filter(([, value]) => Math.abs(value) === maximum)
        .map(([area, deviationPct]) => ({ area, deviationPct })),
    })
  }
  const p = output.provenance
  output.cleaning.failedCount = output.cleaning.failed.length
  output.cleaning.unknownCount = output.cleaning.unknown.length
  if (p.total > 0) {
    p.measuredPct = Number(((p.measured / p.total) * 100).toFixed(4))
    p.estimatedPct = Number(((p.estimated / p.total) * 100).toFixed(4))
  }
  if (
    ![
      ...Object.values(output.declared),
      ...Object.values(output.expected),
      ...Object.values(output.paired),
    ].every(Number.isFinite)
  )
    throw new Error('Totales fuera del rango numérico representable.')
  // Presentación decimal de agregados, sin modificar resultados ni fórmulas del core.
  for (const values of [output.declared, output.expected, output.paired]) {
    for (const key of Object.keys(values)) {
      const field = key as keyof typeof values
      values[field] = Number(values[field].toFixed(6))
    }
  }
  if (output.hasSimulation)
    output.limitations.push(
      'Hay datos simulados o un catálogo local simulado; no equivalen a mediciones verificadas.',
    )
  output.limitations.push(
    'La comparación por área usa el mayor desvío absoluto de concentración en mediciones del mismo producto, suciedad y dosis de receta; no compara consumos absolutos ni grupos diferentes.',
    'Las variantes solo se comparan dentro de cada tarea; no se infiere una dosis alternativa ni una recomendación global.',
  )
  output.limitations = output.limitations.map((text) =>
    displayTaskLimitation(output, text),
  )
  return output
}
