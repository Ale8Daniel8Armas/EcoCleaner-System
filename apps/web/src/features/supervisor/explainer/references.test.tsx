import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildExplainerInput } from './buildExplainerInput'
import { projectLocalTasks, projectSupabaseTasks } from './data'
import { DemoAnswer } from './DemoExplainer'
import { DEMO_QUESTIONS, explainDemo } from './explainDemo'
import { createReferenceFormatter, operationalName } from './references'
import { demoRecord, demoSnapshot, demoTask } from './fixtures'

const taskId = '10000000-0000-4000-8000-000000000001'
const areaId = '20000000-0000-4000-8000-000000000001'
const firstVariant = '30000000-0000-4000-8000-000000000001'
const secondVariant = '30000000-0000-4000-8000-000000000002'
const recordId = '40000000-0000-4000-8000-000000000001'
const uuidPattern = /[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}/i
const named = () =>
  demoTask({
    id: taskId,
    name: 'Lavado de pisos',
    areaId,
    areaName: 'Producción A',
    variants: [
      { id: firstVariant, name: 'Económica', dilution: 50 },
      { id: secondVariant, name: 'Intensiva', dilution: 80 },
    ],
    records: [
      demoRecord({
        id: recordId,
        variantId: firstVariant,
        cleaning: false,
        productMl: 2000,
      }),
      demoRecord({ id: 'second', variantId: secondVariant }),
    ],
  })

describe('referencias operativas legibles', () => {
  it('identifica tarea, área y variante sin UUID en la respuesta de descartadas', () => {
    const input = buildExplainerInput(demoSnapshot([named()]))
    const answer = explainDemo('discarded', input)
    expect(answer.evidence).toContain(
      'Lavado de pisos · Producción A (Tarea 1)',
    )
    expect(answer.evidence).toContain('Variante «Económica»')
    expect(answer.evidence).toContain(
      'Incumple el criterio en al menos una repetición.',
    )
    expect(Object.values(answer).join(' ')).not.toMatch(uuidPattern)
    expect(input.references?.find((ref) => ref.kind === 'Tarea')?.id).toBe(
      taskId,
    )
  })
  it.each(DEMO_QUESTIONS)(
    '$id mantiene los identificadores completos fuera de las cuatro secciones',
    (question) => {
      const input = buildExplainerInput(demoSnapshot([named()]))
      expect(
        Object.values(explainDemo(question.id, input)).join(' '),
      ).not.toMatch(uuidPattern)
    },
  )
  it('conserva resultados, elegibilidad e identidades internas aunque cambien los nombres', () => {
    const task = named()
    const before = buildExplainerInput(demoSnapshot([task]))
    const after = buildExplainerInput(
      demoSnapshot([
        {
          ...task,
          name: 'Actividad actualizada',
          areaName: 'Otra etiqueta',
          variants: task.variants.map((v) => ({
            ...v,
            name: 'Nombre compartido',
          })),
        },
      ]),
    )
    const {
      references: beforeRefs,
      limitations: beforeLimitations,
      ...beforeMetrics
    } = before
    const {
      references: afterRefs,
      limitations: afterLimitations,
      ...afterMetrics
    } = after
    expect(beforeMetrics).toEqual(afterMetrics)
    expect(beforeRefs).not.toEqual(afterRefs)
    expect(beforeLimitations).not.toEqual(afterLimitations)
    expect(
      before.comparisons[0].result.resumen.map((row) => row.variante_id),
    ).toEqual([`Variante ${firstVariant}`, `Variante ${secondVariant}`])
  })
  it('distingue variantes de nombres iguales sin fusionar sus mediciones', () => {
    const task = named()
    task.variants.forEach((v) => {
      v.name = 'Misma etiqueta'
    })
    const input = buildExplainerInput(demoSnapshot([task]))
    const answer = explainDemo('discarded', input)
    expect(answer.evidence).toContain('Variante «Misma etiqueta» (opción 1)')
    expect(answer.evidence).toContain('Variante «Misma etiqueta» (opción 2)')
    expect(input.comparisons[0].result.resumen).toHaveLength(2)
  })
  it('resuelve los alias de variantes y registros dentro de su propia tarea', () => {
    const first = demoTask({
      name: 'Primera actividad',
      areaName: 'Producción',
      variants: [{ id: 'var-a', name: 'Eco', dilution: 50 }],
      records: [demoRecord({ variantId: 'var-a', cleaning: false })],
    })
    const second = demoTask({
      id: 'task-b',
      name: 'Segunda actividad',
      areaName: 'Producción',
      variants: [{ id: 'var-b', name: 'Intensiva', dilution: 50 }],
      records: [demoRecord({ variantId: 'var-b', cleaning: false })],
    })
    const answer = explainDemo(
      'discarded',
      buildExplainerInput(demoSnapshot([first, second])),
    )
    const lines = answer.evidence.split('\n')
    expect(lines[0]).toContain('Primera actividad')
    expect(lines[0]).toContain('Variante «Eco»')
    expect(lines[1]).toContain('Segunda actividad')
    expect(lines[1]).toContain('Variante «Intensiva»')
  })
  it('distingue tareas y áreas homónimas con etiquetas cortas', () => {
    const first = named()
    const second = {
      ...named(),
      id: '10000000-0000-4000-8000-000000000002',
      areaId: '20000000-0000-4000-8000-000000000002',
    }
    const input = buildExplainerInput(demoSnapshot([first, second]))
    const tasks = input.references?.filter((ref) => ref.kind === 'Tarea') ?? []
    const areas = input.references?.filter((ref) => ref.kind === 'Área') ?? []
    expect(new Set(tasks.map((ref) => ref.label)).size).toBe(2)
    expect(new Set(areas.map((ref) => ref.label)).size).toBe(2)
  })
  it('usa etiquetas explícitas cuando faltan nombres, sin atribuir una actividad inventada', () => {
    const task = named()
    task.name = null
    task.areaName = null
    task.variants.forEach((v) => {
      v.name = null
    })
    const input = buildExplainerInput(demoSnapshot([task]))
    const answer = explainDemo('discarded', input)
    expect(answer.evidence).toContain('Tarea 1 · Área 1 sin nombre')
    expect(answer.evidence).toContain('Variante 1 sin nombre')
    expect(answer.evidence).not.toContain('Lavado')
    expect(answer.evidence).not.toMatch(uuidPattern)
  })
  it('conserva el componente de referencias para consumidores que lo soliciten explícitamente', () => {
    const input = buildExplainerInput(demoSnapshot([named()]))
    const html = renderToStaticMarkup(
      <DemoAnswer
        answer={explainDemo('discarded', input)}
        references={input.references}
        showReferences
      />,
    )
    expect(html).toContain('Ver referencias de los registros')
    expect(html).not.toMatch(uuidPattern)
    expect(html.match(/<h4>/g)).toHaveLength(4)
    expect(html).not.toContain('<table')
  })
  it('mantiene la selección del área por identidad, incluso si comparten nombre', () => {
    const first = demoTask({ id: taskId, areaId, areaName: 'Área compartida' })
    const second = demoTask({
      id: '10000000-0000-4000-8000-000000000002',
      areaId: '20000000-0000-4000-8000-000000000002',
      areaName: 'Área compartida',
      records: [demoRecord({ productMl: 1000 })],
    })
    const input = buildExplainerInput(demoSnapshot([first, second]))
    expect(input.areas[0].winners).toHaveLength(1)
    const answer = explainDemo('deviation', input)
    expect(answer.evidence).toContain('Área compartida (Área 2)')
    expect(answer.evidence).not.toMatch(uuidPattern)
  })
  it('conserva determinismo e inmutabilidad de los metadatos', () => {
    const snapshot = demoSnapshot([named()])
    const copy = structuredClone(snapshot)
    expect(buildExplainerInput(snapshot)).toEqual(buildExplainerInput(snapshot))
    expect(snapshot).toEqual(copy)
  })
})

describe('proyección de nombres operativos', () => {
  it('proyecta áreas y variantes de Supabase, sin tomar nombres de personas ni observaciones', () => {
    const snapshot = projectSupabaseTasks([
      {
        id: taskId,
        area_id: areaId,
        nombre: 'Persona Privada',
        operario: { nombre: 'Otra Persona' },
        observaciones: 'NO_MOSTRAR',
        areas: { nombre: 'Producción A' },
        variantes: [
          {
            id: firstVariant,
            nombre: 'Lavado de pisos',
            dilucion_ml_por_litro: 50,
          },
        ],
      },
    ])
    expect(snapshot.tasks[0].name).toBe('Lavado de pisos')
    expect(snapshot.tasks[0].areaName).toBe('Producción A')
    expect(snapshot.tasks[0].variants[0].name).toBe('Lavado de pisos')
    expect(JSON.stringify(snapshot)).not.toMatch(
      /Persona Privada|Otra Persona|NO_MOSTRAR/,
    )
  })
  it('no elige el nombre de una variante arbitraria como actividad cuando hay varias', () => {
    const snapshot = projectSupabaseTasks([
      {
        id: taskId,
        areas: [{ nombre: 'Almacén' }],
        variantes: [
          { id: firstVariant, nombre: 'Económica' },
          { id: secondVariant, nombre: 'Intensiva' },
        ],
      },
    ])
    expect(snapshot.tasks[0].name).toBeNull()
    expect(snapshot.tasks[0].areaName).toBe('Almacén')
  })
  it('reutiliza nombre de actividad y catálogo de áreas en el fallback local', () => {
    const snapshot = projectLocalTasks(
      {
        tareas: [
          {
            id: taskId,
            tipo_tarea: 'Limpieza de pasillos',
            area_id: areaId,
            variante_id: firstVariant,
          },
        ],
      },
      [],
      [{ id: areaId, nombre: 'Logística' }],
    )
    expect(snapshot.tasks[0].name).toBe('Limpieza de pasillos')
    expect(snapshot.tasks[0].areaName).toBe('Logística')
    expect(snapshot.origin).toBe('local')
  })
  it.each([
    'persona@example.com',
    '<img src=x>',
    'gsk_' + 'x'.repeat(30),
    'https://example.com',
    'x'.repeat(121),
    taskId,
  ])('rechaza una etiqueta no operativa: %s', (value) => {
    expect(operationalName(value)).toBeNull()
    const task = named()
    task.name = value
    task.areaName = value
    task.variants.forEach((v) => {
      v.name = value
    })
    const input = buildExplainerInput(demoSnapshot([task]))
    expect(
      Object.values(explainDemo('discarded', input)).join(' '),
    ).not.toContain(value)
  })
  it('normaliza espaciado sin modificar el catálogo', () => {
    const value = '  Producción   A '
    expect(operationalName(value)).toBe('Producción A')
    expect(value).toBe('  Producción   A ')
  })
  it('el formateador conserva una referencia segura cuando falta el catálogo de nombres', () => {
    expect(createReferenceFormatter({})(`Tarea ${taskId}`)).toBe(
      'Tarea sin nombre',
    )
  })
})
