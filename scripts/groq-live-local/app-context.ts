import { detectarIncompatibilidades } from '../../packages/core/src/index.ts'
import { CATEGORIAS_QUIMICAS } from '../../packages/schemas/src/index.ts'
import type { CategoriaQuimica } from '../../packages/schemas/src/index.ts'
import type { EvidenceValue } from '../../packages/core/server/llm/contracts.ts'
import type { LivePayload } from '../../apps/web/src/features/supervisor/explainer/live-data.ts'
import { buildExplainerInput } from '../../apps/web/src/features/supervisor/explainer/buildExplainerInput.ts'
import { referenceKey } from '../../apps/web/src/features/supervisor/explainer/references.ts'

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const keys = (
  value: unknown,
  allowed: string[],
): value is Record<string, unknown> =>
  object(value) &&
  Object.keys(value).length === allowed.length &&
  allowed.every((key) => Object.hasOwn(value, key))
const list = (value: unknown, max: number, check: (item: unknown) => boolean) =>
  Array.isArray(value) && value.length <= max && value.every(check)
const nullableNumber = (value: unknown) =>
  value === null ||
  (typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= 1e12)
const choice = (value: unknown, options: unknown[]) => options.includes(value)
const alias = (value: unknown, prefix: string, nullable = false) =>
  (nullable && value === null) ||
  (typeof value === 'string' && new RegExp(`^${prefix}[A-Z]{1,3}$`).test(value))
const categories = (value: unknown) =>
  value === null ||
  list(value, CATEGORIAS_QUIMICAS.length, (item) =>
    CATEGORIAS_QUIMICAS.includes(item as CategoriaQuimica),
  )

/** Frontera de servidor: rechaza campos extra, nombres, UUID, observaciones y contextos libres. */
export function isLivePayload(value: unknown): value is LivePayload {
  if (!keys(value, ['snapshot', 'catalog'])) return false
  const { snapshot, catalog } = value
  if (
    !keys(snapshot, ['origin', 'tasks', 'limitations', 'catalogSimulated']) ||
    !choice(snapshot.origin, ['local', 'supabase']) ||
    typeof snapshot.catalogSimulated !== 'boolean' ||
    !list(snapshot.limitations, 4, (item) =>
      choice(item, [
        'partial',
        'local',
        'catalog_simulated',
        'remote_unavailable',
      ]),
    ) ||
    !list(snapshot.tasks, 200, (item) => {
      if (
        !keys(item, [
          'id',
          'areaId',
          'productId',
          'state',
          'dirt',
          'recipe',
          'productMin',
          'productMax',
          'criticalProduct',
          'variants',
          'records',
        ])
      )
        return false
      return (
        alias(item.id, 'T') &&
        alias(item.areaId, 'A', true) &&
        alias(item.productId, 'P', true) &&
        choice(item.state, [null, 'completada', 'receta_enviada']) &&
        choice(item.dirt, [null, 'baja', 'media', 'alta']) &&
        typeof item.criticalProduct === 'boolean' &&
        nullableNumber(item.productMin) &&
        nullableNumber(item.productMax) &&
        (item.recipe === null ||
          (keys(item.recipe, [
            'litros_agua',
            'litros_solucion',
            'ml_producto',
            'ml_por_litro',
          ]) &&
            Object.values(item.recipe).every(nullableNumber))) &&
        list(
          item.variants,
          200,
          (v) =>
            keys(v, ['id', 'dilution']) &&
            alias(v.id, 'V') &&
            nullableNumber(v.dilution),
        ) &&
        list(
          item.records,
          200,
          (r) =>
            keys(r, [
              'id',
              'variantId',
              'waterL',
              'productMl',
              'mark',
              'source',
              'recordedOverdose',
              'cleaning',
              'decisions',
            ]) &&
            alias(r.id, 'R') &&
            alias(r.variantId, 'V', true) &&
            nullableNumber(r.waterL) &&
            nullableNumber(r.productMl) &&
            choice(r.mark, [null, 'medido', 'estimado']) &&
            choice(r.source, [null, 'manual', 'sensor', 'simulada']) &&
            typeof r.recordedOverdose === 'boolean' &&
            choice(r.cleaning, [null, true, false]) &&
            list(r.decisions, 20, (d) =>
              choice(d, ['verter', 'ajustar', 'reutilizar', 'gestor']),
            ),
        )
      )
    })
  )
    return false
  return (
    keys(catalog, ['products', 'simulated', 'partial']) &&
    typeof catalog.simulated === 'boolean' &&
    typeof catalog.partial === 'boolean' &&
    list(
      catalog.products,
      50,
      (p) =>
        keys(p, [
          'id',
          'categories',
          'incompatibilities',
          'minimum',
          'maximum',
          'ph',
        ]) &&
        alias(p.id, 'P') &&
        categories(p.categories) &&
        categories(p.incompatibilities) &&
        nullableNumber(p.minimum) &&
        nullableNumber(p.maximum) &&
        nullableNumber(p.ph),
    ) &&
    new Set((catalog.products as { id: string }[]).map((p) => p.id)).size ===
      (catalog.products as unknown[]).length
  )
}

export type FactGroup = {
  aliases: string[]
  priority: number
  facts: Record<string, EvidenceValue>
}

/** Conserva el resumen global y declara cualquier detalle omitido por el presupuesto. */
export function budgetAppFacts(
  data: LivePayload,
  question: string,
  fits: (facts: Record<string, EvidenceValue>) => boolean,
) {
  const full = buildAppFacts(data)
  const groups = full.groups
    .map((group, index) => ({
      ...group,
      index,
      rank:
        group.priority -
        (/variante|procedimiento|compar/i.test(question) &&
        Object.keys(group.facts).some((key) => key.endsWith('.elegible'))
          ? 8
          : 0) -
        (group.aliases.some((alias) =>
          new RegExp(`\\b${alias}\\b`, 'i').test(question),
        )
          ? 10
          : 0),
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
  const available =
    Object.keys(full.facts).length +
    groups.reduce(
      (total, group) => total + Object.keys(group.facts).length,
      0,
    ) +
    4
  while (true) {
    const facts = Object.assign(
      {},
      full.facts,
      ...groups.map((group) => group.facts),
    ) as Record<string, EvidenceValue>
    facts['alcance.hechos_disponibles'] = available
    facts['alcance.hechos_incluidos'] = Object.keys(facts).length + 3
    facts['alcance.detalle_parcial'] =
      Number(facts['alcance.hechos_incluidos']) < available
    facts['alcance.sin_filtro_de_fechas'] = true
    if (Object.keys(facts).length <= 300 && fits(facts)) return facts
    if (!groups.length) throw new Error('APP_CONTEXT_BUDGET')
    groups.pop()
  }
}

export function buildAppFacts(data: LivePayload) {
  if (!isLivePayload(data)) throw new Error('INVALID_APP_CONTEXT')
  const { snapshot, catalog } = data
  const view = buildExplainerInput(snapshot)
  const groups: FactGroup[] = []
  const facts: Record<string, EvidenceValue> = {
    'origen.tareas': snapshot.origin,
    'origen.catalogo_simulado': catalog.simulated || snapshot.catalogSimulated,
    'carga.parcial':
      snapshot.limitations.includes('partial') || catalog.partial,
    'tareas.cargadas': snapshot.tasks.length,
    'tareas.completadas': view.completed,
    'tareas.pendientes': view.pending,
    'tareas.estado_desconocido': view.unknownState,
    'variantes.cargadas': snapshot.tasks.reduce(
      (total, task) => total + task.variants.length,
      0,
    ),
    'variantes.elegibles': view.comparisons.reduce(
      (total, item) =>
        total + item.result.resumen.filter((row) => row.elegible).length,
      0,
    ),
    'consumo.agua_l': view.declared.waterL,
    'consumo.producto_ml': view.declared.productMl,
    'consumo.tareas_univocas': view.declared.tasks,
    'previsto.agua_l': view.expected.waterL,
    'previsto.producto_ml': view.expected.productMl,
    'previsto.tareas': view.expected.tasks,
    'pareado.tareas': view.paired.tasks,
    'pareado.agua_registrada_l': view.paired.declaredWaterL,
    'pareado.agua_prevista_l': view.paired.expectedWaterL,
    'pareado.producto_registrado_ml': view.paired.declaredProductMl,
    'pareado.producto_previsto_ml': view.paired.expectedProductMl,
    'pareado.diferencia_agua_l': Number(
      (view.paired.declaredWaterL - view.paired.expectedWaterL).toFixed(6),
    ),
    'pareado.diferencia_producto_ml': Number(
      (view.paired.declaredProductMl - view.paired.expectedProductMl).toFixed(
        6,
      ),
    ),
    'procedencia.medidos': view.provenance.measured,
    'procedencia.estimados': view.provenance.estimated,
    'procedencia.simulados': view.provenance.simulated,
    'procedencia.desconocidos': view.provenance.unknown,
    'limpieza.incumplimientos': view.cleaning.failedCount,
    'limpieza.sin_evaluacion': view.cleaning.unknownCount,
    'alertas.sobredosis': view.alerts.filter((a) => a.overdose || a.recorded)
      .length,
    'alertas.sobre_maximo': view.alerts.filter((a) => a.aboveMaximum).length,
    'efluente.decisiones_registradas': view.effluent.length,
    'efluente.tareas_sin_decision': view.pendingEffluent.length,
    'efluente.ph_medido_disponible': false,
    'efluente.autoriza_vertido': false,
    'catalogo.productos': catalog.products.length,
    'limites.causas':
      'No hay causas verificadas, costos, fechas ni perfiles de usuarios en este contexto.',
    'limites.efluente':
      'Una decisión registrada no es una autorización; no hay medición de pH del efluente en esta carga.',
    'limites.consumos':
      'Los totales usan tareas completadas con consumo final unívoco; las repeticiones no se suman como tareas.',
    'limites.variantes':
      'Comparaciones dentro de cada tarea; no existe una variante global recomendada.',
    'limites.procedencia': view.hasSimulation
      ? 'Hay datos o catálogo simulados; no son mediciones verificadas.'
      : 'La marca de medición es declarada, sin verificación independiente.',
  }
  for (const [index, task] of snapshot.tasks.entries()) {
    const ref = referenceKey('Tarea', task.id, index)
    const group: FactGroup = {
      aliases: [
        task.id,
        ...(task.areaId ? [task.areaId] : []),
        ...(task.productId ? [task.productId] : []),
      ],
      priority: view.alerts.some((a) => a.task === ref) ? 0 : 2,
      facts: {},
    }
    const add = (key: string, value: EvidenceValue) => {
      group.facts[`${task.id}.${key}`] = value
    }
    add('estado', task.state)
    add('area', task.areaId)
    add('producto', task.productId)
    if (
      task.recipe &&
      [
        task.recipe.litros_agua,
        task.recipe.ml_producto,
        task.recipe.litros_solucion,
        task.recipe.ml_por_litro,
      ].every((n) => typeof n === 'number' && n >= 0) &&
      task.recipe.litros_solucion > 0 &&
      task.recipe.ml_por_litro > 0 &&
      Math.abs(
        task.recipe.litros_agua +
          task.recipe.ml_producto / 1000 -
          task.recipe.litros_solucion,
      ) < 0.001
    ) {
      add('receta_agua_l', task.recipe.litros_agua)
      add('receta_producto_ml', task.recipe.ml_producto)
      add('receta_solucion_l', task.recipe.litros_solucion)
      add('receta_ml_por_litro', task.recipe.ml_por_litro)
    } else add('receta_disponible', false)
    for (const [recordIndex, record] of task.records.entries()) {
      group.aliases.push(record.id)
      const prefix = record.id
      add(`${prefix}.agua_l`, record.waterL)
      add(`${prefix}.producto_ml`, record.productMl)
      add(`${prefix}.limpieza`, record.cleaning)
      add(
        `${prefix}.procedencia`,
        record.source === 'simulada' ? 'simulada' : record.mark,
      )
      const deviation = view.deviations.find(
        (d) =>
          d.task === ref &&
          d.record === referenceKey('Registro', record.id, recordIndex),
      )
      if (deviation) {
        add(`${prefix}.desvio_pct`, deviation.result.desvio_pct)
        add(
          `${prefix}.desvio_pct_redondeado`,
          Number(deviation.result.desvio_pct.toFixed(2)),
        )
        add(`${prefix}.sobredosis`, deviation.result.sobredosis)
        add(`${prefix}.sobre_maximo`, deviation.result.supera_maximo_ficha)
      }
      if (record.decisions.length)
        add(
          `${prefix}.decisiones_registradas`,
          [...new Set(record.decisions)].join(', '),
        )
    }
    const comparison = view.comparisons.find((c) => c.task === ref)?.result
    if (comparison) {
      const comparisonGroup: FactGroup = {
        aliases: [task.id],
        priority: 2,
        facts: {},
      }
      const addComparison = (key: string, value: EvidenceValue) => {
        comparisonGroup.facts[`${task.id}.${key}`] = value
      }
      const toAlias = (key: string | null) =>
        key
          ? (task.variants.find(
              (v, i) => referenceKey('Variante', v.id, i) === key,
            )?.id ?? null)
          : null
      addComparison('variante_recomendada', toAlias(comparison.recomendada))
      for (const row of comparison.resumen) {
        const id = toAlias(row.variante_id)
        if (!id) continue
        comparisonGroup.aliases.push(id)
        addComparison(`${id}.elegible`, row.elegible)
        addComparison(`${id}.mediciones`, row.n_medidos)
        addComparison(`${id}.simulaciones`, row.n_simulados)
        addComparison(`${id}.motivo`, row.motivo)
        addComparison(`${id}.base_promedios`, row.base_promedios)
        addComparison(`${id}.producto_promedio_ml`, row.producto_promedio)
        addComparison(`${id}.agua_promedio_l`, row.agua_promedio)
      }
      groups.push(comparisonGroup)
    }
    add('datos_incompletos', view.incomplete.includes(ref))
    groups.push(group)
  }
  for (const product of catalog.products) {
    const p = product.id
    groups.push({
      aliases: [p],
      priority: 1,
      facts: {
        [`${p}.categorias`]: product.categories?.join(', ') || null,
        [`${p}.incompatibilidades`]:
          product.incompatibilities === null
            ? null
            : product.incompatibilities.join(', ') || 'ninguna documentada',
        [`${p}.min_ml_por_litro`]: product.minimum,
        [`${p}.max_ml_por_litro`]: product.maximum,
        [`${p}.ph_catalogo`]: product.ph,
      },
    })
  }
  const incompatibilities = detectarIncompatibilidades(
    catalog.products.map((p) => ({
      id: p.id,
      nombre: p.id,
      categorias: p.categories as CategoriaQuimica[],
      incompatibilidades: p.incompatibilities as CategoriaQuimica[],
    })),
    { detallado: true },
  )
  facts['incompatibilidades.estado'] = incompatibilities.estado
  facts['incompatibilidades.conflictos'] = incompatibilities.conflictos.length
  facts['incompatibilidades.datos_insuficientes'] =
    incompatibilities.datos_insuficientes.length
  facts['incompatibilidades.compatibilidad_demostrada'] = false
  for (const conflict of incompatibilities.conflictos) {
    const key = `conflicto.${conflict.producto_a_id}_${conflict.producto_b_id}_${conflict.categoria}`
    groups.push({
      aliases: [conflict.producto_a_id, conflict.producto_b_id],
      priority: 1,
      facts: {
        [`${key}.categoria_regla`]: conflict.categoria,
        [`${key}.regla_de`]: conflict.reglas
          .map((r) => r.producto_origen_id)
          .join(', '),
      },
    })
  }
  return { facts, groups }
}
