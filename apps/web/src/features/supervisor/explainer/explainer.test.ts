import { describe, expect, it, vi } from 'vitest'
import * as core from '@ecocleaner/core'
import { buildExplainerInput } from './buildExplainerInput'
import { numeric, projectLocalTasks, projectSupabaseTasks } from './data'
import { canShowDemo, resolveDemoMode } from './config'
import { DEMO_QUESTIONS, explainDemo } from './explainDemo'
import { demoRecord, demoSnapshot, demoTask } from './fixtures'

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    Object.values(value).forEach(freeze)
  }
  return value
}

describe('buildExplainerInput', () => {
  it('es determinista e inmutable, incluso con entradas congeladas', () => {
    const source = freeze(demoSnapshot())
    expect(buildExplainerInput(source)).toEqual(buildExplainerInput(source))
    expect(source).toEqual(demoSnapshot())
  })
  it('excluye pendientes y estados desconocidos de toda métrica final', () => {
    const output = buildExplainerInput(
      demoSnapshot([
        demoTask(),
        demoTask({
          id: 'pending',
          state: 'receta_enviada',
          records: [demoRecord({ productMl: 9000, cleaning: false })],
        }),
        demoTask({ id: 'unknown', state: null }),
      ]),
    )
    expect([output.completed, output.pending, output.unknownState]).toEqual([
      1, 1, 1,
    ])
    expect(output.declared).toEqual({ waterL: 9.5, productMl: 500, tasks: 1 })
    expect(output.cleaning.failed).toEqual([])
    expect(output.provenance.total).toBe(1)
  })
  it('calcula desvíos con la función existente y conserva sus resultados', () => {
    const spy = vi.spyOn(core, 'calcularDesvio')
    const output = buildExplainerInput(
      demoSnapshot([demoTask({ records: [demoRecord({ productMl: 2000 })] })]),
    )
    expect(spy).toHaveBeenCalled()
    expect(output.deviations[0].result).toEqual(
      core.calcularDesvio({
        receta: demoTask().recipe!,
        litros_agua_reales: 9.5,
        ml_producto_reales: 2000,
        dilucion_max_ml_por_litro: 100,
      }),
    )
    expect(output.alerts[0]).toMatchObject({
      overdose: true,
      aboveMaximum: true,
    })
    spy.mockRestore()
  })
  it('conserva una alerta registrada sin inventar un cálculo cuando falta la ficha', () => {
    const output = buildExplainerInput(
      demoSnapshot([
        demoTask({
          productMax: null,
          records: [demoRecord({ recordedOverdose: true })],
        }),
      ]),
    )
    expect(output.deviations).toHaveLength(0)
    expect(output.alerts).toEqual([
      {
        task: 'Tarea 1',
        record: 'Registro 1',
        recorded: true,
        overdose: false,
        aboveMaximum: false,
      },
    ])
  })
  it('separa medidos, estimados, simulados y desconocidos sin duplicar categorías', () => {
    const output = buildExplainerInput(
      demoSnapshot([
        demoTask({
          records: [
            demoRecord(),
            demoRecord({ id: 'b', mark: 'estimado' }),
            demoRecord({ id: 'c', source: 'simulada' }),
            demoRecord({ id: 'd', source: null }),
          ],
        }),
      ]),
    )
    expect(output.provenance).toEqual({
      measured: 1,
      estimated: 1,
      simulated: 1,
      unknown: 1,
      total: 4,
      measuredPct: 25,
      estimatedPct: 25,
    })
    expect(output.hasSimulation).toBe(true)
    expect(output.declared.tasks).toBe(0)
  })
  it('no equipara una evaluación ausente con cumplimiento', () => {
    const output = buildExplainerInput(
      demoSnapshot([demoTask({ records: [demoRecord({ cleaning: null })] })]),
    )
    expect(output.cleaning).toEqual({
      failed: [],
      passed: [],
      unknown: ['Tarea 1'],
      failedCount: 0,
      unknownCount: 1,
    })
  })
  it('cuenta un incumplimiento por tarea aunque varias repeticiones fallen', () => {
    const output = buildExplainerInput(
      demoSnapshot([
        demoTask({
          records: [
            demoRecord({ cleaning: false }),
            demoRecord({ id: 'b', cleaning: false }),
          ],
        }),
      ]),
    )
    expect(output.cleaning.failed).toEqual(['Tarea 1'])
  })
  it('no suma las repeticiones como consumos finales ni multiplica la receta', () => {
    const output = buildExplainerInput(
      demoSnapshot([
        demoTask({ records: [demoRecord(), demoRecord({ id: 'b' })] }),
      ]),
    )
    expect(output.declared.tasks).toBe(0)
    expect(output.expected).toEqual({ waterL: 9.5, productMl: 500, tasks: 1 })
    expect(output.paired.tasks).toBe(0)
  })
  it('distingue coberturas de consumo declarado, receta y base común', () => {
    const output = buildExplainerInput(
      demoSnapshot([demoTask(), demoTask({ id: 'b', recipe: null })]),
    )
    expect(output.declared.tasks).toBe(2)
    expect(output.expected.tasks).toBe(1)
    expect(output.paired.tasks).toBe(1)
  })
  it('retiene decisiones históricas y marca las ausentes', () => {
    const output = buildExplainerInput(
      demoSnapshot([
        demoTask({ records: [demoRecord({ decisions: ['verter'] })] }),
        demoTask({ id: 'b', records: [demoRecord({ decisions: [] })] }),
      ]),
    )
    expect(output.effluent[0].decision).toBe('verter')
    expect(output.pendingEffluent).toEqual(['Tarea 2'])
  })
  it('maneja datos vacíos e incompletos sin valores por defecto inventados', () => {
    expect(
      buildExplainerInput(demoSnapshot([])).provenance.measuredPct,
    ).toBeNull()
    const output = buildExplainerInput(
      demoSnapshot([demoTask({ records: [], recipe: null, productMax: null })]),
    )
    expect(output.declared.tasks).toBe(0)
    expect(output.deviations).toEqual([])
    expect(output.incomplete).toEqual(['Tarea 1'])
  })
  it.each([NaN, Infinity, -2, null])(
    'rechaza un consumo inválido: %s',
    (value) => {
      const output = buildExplainerInput(
        demoSnapshot([demoTask({ records: [demoRecord({ waterL: value })] })]),
      )
      expect(output.declared.tasks).toBe(0)
      expect(output.deviations).toEqual([])
    },
  )
  it('solo compara áreas de condiciones equivalentes y mediciones no simuladas', () => {
    const tasks = [
      demoTask(),
      demoTask({
        id: 'b',
        areaId: 'area-b',
        records: [demoRecord({ productMl: 1000 })],
      }),
    ]
    expect(
      buildExplainerInput(demoSnapshot(tasks)).areas[0].winners[0].area,
    ).toBe('Área 2')
    expect(
      buildExplainerInput(
        demoSnapshot([tasks[0], { ...tasks[1], productId: 'different' }]),
      ).areas,
    ).toEqual([])
    expect(
      buildExplainerInput(
        demoSnapshot([
          tasks[0],
          { ...tasks[1], records: [demoRecord({ source: 'simulada' })] },
        ]),
      ).areas,
    ).toEqual([])
  })
  it('no inventa un ganador cuando varias áreas empatan', () => {
    const output = buildExplainerInput(
      demoSnapshot([demoTask(), demoTask({ id: 'b', areaId: 'area-b' })]),
    )
    expect(output.areas[0].winners).toHaveLength(2)
  })
  it('reutiliza compararVariantes, sus motivos y su mínimo real de mediciones', () => {
    const spy = vi.spyOn(core, 'compararVariantes')
    const records = [
      demoRecord(),
      demoRecord({ id: 'b' }),
      demoRecord({ id: 'c', variantId: 'variant-b', cleaning: false }),
    ]
    const output = buildExplainerInput(
      demoSnapshot([
        demoTask({
          variants: [
            { id: 'variant-a', dilution: 50 },
            { id: 'variant-b', dilution: 80 },
          ],
          records,
        }),
      ]),
    )
    expect(spy).toHaveBeenCalled()
    expect(output.comparisons[0].result.recomendada).toBe('Variante 1')
    expect(output.comparisons[0].result.resumen[1].motivo).toBe(
      'Incumple el criterio en al menos una repetición.',
    )
    spy.mockRestore()
  })
  it('no fusiona variantes de tareas diferentes aunque sus condiciones parezcan iguales', () => {
    const output = buildExplainerInput(
      demoSnapshot([demoTask(), demoTask({ id: 'b' })]),
    )
    expect(output.comparisons.every((c) => c.result.recomendada === null)).toBe(
      true,
    )
  })
  it.each([10, 150])(
    'no recomienda variantes fuera de ficha: %s',
    (dilution) => {
      expect(
        buildExplainerInput(
          demoSnapshot([
            demoTask({ variants: [{ id: 'variant-a', dilution }] }),
          ]),
        ).comparisons,
      ).toEqual([])
    },
  )
  it('una procedencia incompleta o simulada no respalda una recomendación', () => {
    for (const source of [null, 'simulada'] as const) {
      const output = buildExplainerInput(
        demoSnapshot([
          demoTask({
            records: [demoRecord({ source }), demoRecord({ id: 'b', source })],
          }),
        ]),
      )
      expect(output.comparisons[0].result.recomendada).toBeNull()
    }
  })
})

describe('proyección de servicios y privacidad', () => {
  it.each([null, undefined, '', ' ', false, {}, 'Infinity'])(
    'no transforma ausencia en cero: %j',
    (value) => {
      expect(numeric(value)).toBeNull()
    },
  )
  it('preserva cero explícito y convierte numéricos de PostgREST', () => {
    expect(numeric('0')).toBe(0)
    expect(numeric('3.5')).toBe(3.5)
  })
  it('proyecta relaciones de Supabase sin nombres, observaciones ni credenciales', () => {
    const rows = [
      {
        id: 'a',
        estado: 'completada',
        area_id: 'b',
        producto_id: 'c',
        nivel_suciedad: 'media',
        litros_solucion_esperados: '10',
        ml_producto_esperados: '500',
        nombre: 'Persona Privada',
        email: 'persona@example.com',
        password_hash: 'NO_PUBLICAR',
        observaciones: '<script>privado</script>',
        productos: {
          tipo_quimico: 'clorado',
          dilucion_min_ml_por_litro: 20,
          dilucion_max_ml_por_litro: 100,
        },
        registros_uso: [],
      },
    ]
    const snapshot = projectSupabaseTasks(rows)
    expect(snapshot.tasks[0].recipe).toEqual(demoTask().recipe)
    const serialized = JSON.stringify(buildExplainerInput(snapshot))
    expect(serialized).not.toMatch(
      /Persona Privada|persona@|NO_PUBLICAR|<script>|"observaciones":|password/,
    )
    expect(snapshot.tasks[0].criticalProduct).toBe(true)
  })
  it('no confunde fallback local ni catálogo simulado con Supabase', () => {
    const output = buildExplainerInput(projectLocalTasks({}, []))
    expect(output.origin).toBe('local')
    expect(output.hasSimulation).toBe(true)
  })
  it('una relación ambigua no crea cumplimiento', () => {
    const snapshot = projectSupabaseTasks([
      {
        id: 'a',
        registros_uso: [
          {
            id: 'r',
            resultados: [{ cumple_criterio: true }, { cumple_criterio: false }],
          },
        ],
      },
    ])
    expect(snapshot.tasks[0].records[0].cleaning).toBeNull()
  })
  it('advierte cargas truncadas', () => {
    expect(projectSupabaseTasks([], true).limitations.join(' ')).toContain(
      'partial',
    )
  })
})

describe('explainDemo', () => {
  it('ofrece exactamente las nueve preguntas previstas', () => {
    expect(DEMO_QUESTIONS).toHaveLength(9)
    expect(new Set(DEMO_QUESTIONS.map((q) => q.id)).size).toBe(9)
  })
  it.each(DEMO_QUESTIONS)(
    '$id conserva cuatro secciones, determinismo e inmutabilidad',
    (question) => {
      const input = freeze(buildExplainerInput(demoSnapshot()))
      const answer = explainDemo(question.id, input)
      expect(Object.keys(answer)).toEqual([
        'summary',
        'evidence',
        'preliminaryRecommendation',
        'limitations',
      ])
      expect(
        Object.values(answer).every(
          (value) => typeof value === 'string' && value.length,
        ),
      ).toBe(true)
      expect(answer).toEqual(explainDemo(question.id, input))
    },
  )
  it.each(DEMO_QUESTIONS)(
    '$id solo muestra cifras presentes en el input',
    (question) => {
      const input = buildExplainerInput(demoSnapshot())
      const numbers: string[] =
        JSON.stringify(input).match(/-?\d+(?:\.\d+)?/g) ?? []
      const answerNumbers: string[] =
        Object.values(explainDemo(question.id, input))
          .join(' ')
          .match(/-?\d+(?:\.\d+)?/g) ?? []
      expect(answerNumbers.every((n) => numbers.includes(n))).toBe(true)
    },
  )
  it.each(DEMO_QUESTIONS)(
    '$id maneja ausencia de datos y explica lo que falta',
    (question) => {
      const answer = explainDemo(
        question.id,
        buildExplainerInput(demoSnapshot([])),
      )
      expect(answer.summary).toBe('No hay datos suficientes para responder')
      expect(answer.limitations).toContain('Información faltante:')
    },
  )
  it.each(['desinfectante', 'cloro', 'desconocido'])(
    'mantiene una recomendación conservadora para %s',
    (productType) => {
      const snapshot = projectSupabaseTasks([
        {
          id: 'a',
          productos:
            productType === 'desconocido' ? {} : { tipo_quimico: productType },
        },
      ])
      expect(snapshot.tasks[0].criticalProduct).toBe(true)
      const input = buildExplainerInput(
        demoSnapshot([
          demoTask({ records: [demoRecord({ productMl: 2000 })] }),
        ]),
      )
      for (const question of DEMO_QUESTIONS) {
        const text = Object.values(explainDemo(question.id, input)).join(' ')
        expect(text).not.toMatch(
          /certifica|ahorro|reducir.*dosis|disminuir.*dosis|mezclar|diluci[oó]n alternativa/i,
        )
        expect(text).toContain('revisión humana')
        expect(text).toContain('ficha técnica')
      }
    },
  )
  it('el vertido registrado no se presenta como autorización', () => {
    const answer = explainDemo(
      'effluent',
      buildExplainerInput(
        demoSnapshot([
          demoTask({ records: [demoRecord({ decisions: ['verter'] })] }),
        ]),
      ),
    )
    expect(answer.evidence).toContain('no lo autoriza ni valida')
  })
  it('prioriza evidencia documentada en un orden reproducible', () => {
    const answer = explainDemo(
      'priorities',
      buildExplainerInput(
        demoSnapshot([
          demoTask({
            records: [
              demoRecord({ productMl: 2000, cleaning: false, decisions: [] }),
            ],
          }),
        ]),
      ),
    )
    expect(answer.evidence.indexOf('Alerta')).toBeLessThan(
      answer.evidence.indexOf('Incumplimiento'),
    )
    expect(answer.evidence.indexOf('Incumplimiento')).toBeLessThan(
      answer.evidence.indexOf('Decisión'),
    )
  })
  it('no inicia tráfico al construir ni ejecutar las nueve preguntas', () => {
    const fetch = vi.fn(() => {
      throw new Error('Red no permitida')
    })
    vi.stubGlobal('fetch', fetch)
    const input = buildExplainerInput(demoSnapshot())
    DEMO_QUESTIONS.forEach((q) => explainDemo(q.id, input))
    expect(fetch).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('configuración y visibilidad', () => {
  it.each([undefined, 'demo'])('activa demo para %s', (value) => {
    expect(resolveDemoMode(value)).toBe('demo')
    expect(canShowDemo('supervisor', value)).toBe(true)
  })
  it.each(['off', 'real', '', null, 'DEMO', 'otro'])(
    'desactiva valores no permitidos: %s',
    (value) => {
      expect(resolveDemoMode(value)).toBe('off')
      expect(canShowDemo('supervisor', value)).toBe(false)
    },
  )
  it.each(['operario', 'revisor', null, undefined, 'jefe_supervisor'])(
    'oculta el explicador para %s',
    (role) => {
      expect(canShowDemo(role, 'demo')).toBe(false)
    },
  )
})
