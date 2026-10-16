import type { DemoReference, DemoSnapshot, ExplainerInput } from './contracts'

const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
export const referenceKey = (kind: string, id: string | null, index: number) =>
  `${kind} ${id && uuid.test(id) ? id : String(index + 1)}`

/** Solo etiquetas de catálogos operativos; el resto de campos se excluye en la proyección. */
export function operationalName(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    value.length > 120 ||
    /[<>@]|https?:|password|contrase[nñ]a|api[_ -]?key|gsk_|ghp_|certifica|ahorro|-----BEGIN|eyJ[\w-]{20,}/i.test(
      value,
    )
  )
    return null
  if (
    [...value].some(
      (char) =>
        char.charCodeAt(0) < 32 && ![9, 10, 13].includes(char.charCodeAt(0)),
    )
  )
    return null
  const name = value.replace(/\s+/g, ' ').trim()
  return name && !uuid.test(name) ? name : null
}

export function buildDemoReferences(snapshot: DemoSnapshot): DemoReference[] {
  const refs: DemoReference[] = []
  const seen = new Set<string>()
  const areas = [...new Set(snapshot.tasks.map((task) => task.areaId))]
  const areaNames = areas.map((id) =>
    operationalName(
      snapshot.tasks.find(
        (task) => task.areaId === id && operationalName(task.areaName),
      )?.areaName,
    ),
  )
  const add = (ref: DemoReference) => {
    const key = JSON.stringify([ref.key, ref.taskKey ?? null])
    if (!seen.has(key)) {
      seen.add(key)
      refs.push(ref)
    }
  }
  for (const [index, task] of snapshot.tasks.entries()) {
    const taskKey = referenceKey('Tarea', task.id, index)
    const areaIndex = areas.indexOf(task.areaId)
    const areaKey = referenceKey('Área', task.areaId, areaIndex)
    const name = areaNames[areaIndex]
    const areaLabel = name
      ? `${name}${areaNames.filter((value) => value === name).length > 1 ? ` (Área ${areaIndex + 1})` : ''}`
      : task.areaId
        ? `Área ${areaIndex + 1} sin nombre`
        : 'Área no identificada'
    const taskName = operationalName(task.name)
    const label = taskName
      ? `${taskName} · ${areaLabel} (Tarea ${index + 1})`
      : `Tarea ${index + 1} · ${areaLabel}`
    add({
      key: taskKey,
      kind: 'Tarea',
      label,
      id: uuid.test(task.id) ? task.id : null,
    })
    add({
      key: areaKey,
      kind: 'Área',
      label: areaLabel,
      id: task.areaId && uuid.test(task.areaId) ? task.areaId : null,
    })
    const names = task.variants.map((variant) => operationalName(variant.name))
    for (const [variantIndex, variant] of task.variants.entries()) {
      const name = names[variantIndex]
      const label = name
        ? `Variante «${name}»${names.filter((value) => value === name).length > 1 ? ` (opción ${variantIndex + 1})` : ''}`
        : `Variante ${variantIndex + 1} sin nombre`
      add({
        key: referenceKey('Variante', variant.id, variantIndex),
        kind: 'Variante',
        label,
        id: uuid.test(variant.id) ? variant.id : null,
        taskKey,
      })
    }
    for (const [recordIndex, record] of task.records.entries())
      add({
        key: referenceKey('Registro', record.id, recordIndex),
        kind: 'Registro',
        label: `Registro ${recordIndex + 1}`,
        id: uuid.test(record.id) ? record.id : null,
        taskKey,
      })
  }
  return refs
}

export function createReferenceFormatter(
  input: Pick<ExplainerInput, 'references'>,
) {
  const labels = new Map(
    input.references?.map((ref) => [
      JSON.stringify([ref.key, ref.taskKey ?? null]),
      ref.label,
    ]),
  )
  return (key: string, taskKey?: string): string =>
    labels.get(JSON.stringify([key, taskKey ?? null])) ??
    (uuid.test(key.split(' ').at(-1) ?? '')
      ? `${key.split(' ')[0]} sin nombre`
      : key)
}

export function displayTaskLimitation(
  input: Pick<ExplainerInput, 'references'>,
  text: string,
): string {
  const ref = input.references?.find(
    (ref) => ref.kind === 'Tarea' && text.startsWith(`${ref.key}:`),
  )
  return ref ? `${ref.label}${text.slice(ref.key.length)}` : text
}
