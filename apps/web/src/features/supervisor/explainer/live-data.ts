import type { DemoSnapshot } from './contracts'
import { buildDemoReferences, referenceKey } from './references'

export interface LiveCatalog {
  simulated: boolean
  partial: boolean
  products: {
    id: string
    name: string | null
    categories: string[] | null
    incompatibilities: string[] | null
    minimum: number | null
    maximum: number | null
    ph: number | null
  }[]
}

export interface LivePayload {
  snapshot: DemoSnapshot
  catalog: Omit<LiveCatalog, 'products'> & {
    products: Omit<LiveCatalog['products'][number], 'name'>[]
  }
}

export function letterAlias(prefix: string, index: number): string {
  let suffix = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    suffix = String.fromCharCode(65 + ((n - 1) % 26)) + suffix
  return prefix + suffix
}

/** Los nombres y UUID se quedan en el navegador; solo viajan aliases y campos permitidos. */
export function projectLiveData(snapshot: DemoSnapshot, catalog: LiveCatalog) {
  const labels: Record<string, string> = {}
  const identifiers = new Map<string, Map<string, string>>()
  const replacements = new Map<string, Set<string>>()
  const refs = buildDemoReferences(snapshot)
  const name = (value: string | null | undefined, alias: string) => {
    if (!value?.trim()) return
    const choices = replacements.get(value) ?? new Set<string>()
    choices.add(alias)
    replacements.set(value, choices)
  }
  const alias = (prefix: string, id: string | null, label?: string) => {
    if (!id) return null
    const group = identifiers.get(prefix) ?? new Map<string, string>()
    identifiers.set(prefix, group)
    if (!group.has(id)) group.set(id, letterAlias(prefix, group.size))
    const result = group.get(id)!
    labels[result] = label ?? labels[result] ?? result
    name(id, result)
    return result
  }
  const payload: LivePayload = {
    snapshot: {
      origin: snapshot.origin,
      catalogSimulated: snapshot.catalogSimulated,
      limitations: snapshot.limitations,
      tasks: snapshot.tasks.map((task, index) => {
        const taskLabel = refs.find(
          (r) => r.key === referenceKey('Tarea', task.id, index),
        )?.label
        const taskAlias = alias('T', task.id, taskLabel)!
        name(task.name, taskAlias)
        const area = alias('A', task.areaId, task.areaName ?? undefined)
        if (area) name(task.areaName, area)
        return {
          id: taskAlias,
          areaId: area,
          productId: alias('P', task.productId),
          state: ['completada', 'receta_enviada'].includes(task.state ?? '')
            ? task.state
            : null,
          dirt: ['baja', 'media', 'alta'].includes(task.dirt ?? '')
            ? task.dirt
            : null,
          recipe: task.recipe
            ? {
                litros_agua: task.recipe.litros_agua,
                litros_solucion: task.recipe.litros_solucion,
                ml_producto: task.recipe.ml_producto,
                ml_por_litro: task.recipe.ml_por_litro,
              }
            : null,
          productMin: task.productMin,
          productMax: task.productMax,
          criticalProduct: task.criticalProduct,
          variants: task.variants.map((v) => {
            const key = alias(
              'V',
              v.id,
              v.name ? `Variante «${v.name}»` : undefined,
            )!
            name(v.name, key)
            return { id: key, dilution: v.dilution }
          }),
          records: task.records.map((record, recordIndex) => ({
            id: alias(
              'R',
              record.id,
              `Registro ${recordIndex + 1} · ${taskLabel ?? taskAlias}`,
            )!,
            variantId: alias('V', record.variantId),
            waterL: record.waterL,
            productMl: record.productMl,
            mark: record.mark,
            source: record.source,
            recordedOverdose: record.recordedOverdose,
            cleaning: record.cleaning,
            decisions: record.decisions,
          })),
        }
      }),
    },
    catalog: {
      simulated: catalog.simulated,
      partial: catalog.partial,
      products: catalog.products.map((product) => {
        const key = alias('P', product.id, product.name ?? undefined)!
        name(product.name, key)
        return {
          id: key,
          categories: product.categories,
          incompatibilities: product.incompatibilities,
          minimum: product.minimum,
          maximum: product.maximum,
          ph: product.ph,
        }
      }),
    },
  }
  const anonymizeQuestion = (question: string) => {
    let result = question
    for (const [original, choices] of [...replacements].sort(
      ([a], [b]) => b.length - a.length,
    )) {
      const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      result = result.replace(
        new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'giu'),
        [...choices].join(' o '),
      )
    }
    return result
  }
  return { payload, labels, anonymizeQuestion }
}

export function displayLiveText(text: string, labels: Record<string, string>) {
  return text.replace(
    /\b[ATPRV][A-Z]{1,3}\b/g,
    (alias) => labels[alias] ?? alias,
  )
}
