import { expect, it } from 'vitest'
import { projectSupabaseTasks } from './data'
import { buildExplainerInput } from './buildExplainerInput'
import { demoSnapshot, demoTask } from './fixtures'
import type { DemoSnapshot } from './contracts'

it('acepta las relaciones uno a uno como objeto de PostgREST', () => {
  const snapshot = projectSupabaseTasks([
    {
      id: 'a',
      registros_uso: [
        {
          id: 'r',
          resultados: {
            cumple_criterio: false,
            decisiones_efluente: { decision_final: 'gestor' },
          },
        },
      ],
    },
  ])
  expect(snapshot.tasks[0].records[0].cleaning).toBe(false)
  expect(snapshot.tasks[0].records[0].decisions).toEqual(['gestor'])
})

it('elimina el ruido decimal de agregados en el input, antes de explicar', () => {
  const snapshot = demoSnapshot([
    demoTask(),
    demoTask({ id: 'b' }),
    demoTask({ id: 'c' }),
  ])
  expect(buildExplainerInput(snapshot).expected.waterL).toBe(28.5)
  snapshot.tasks.forEach((t) => {
    t.recipe = {
      litros_solucion: 10,
      ml_por_litro: 20,
      ml_producto: 200,
      litros_agua: 9.8,
    }
  })
  expect(buildExplainerInput(snapshot).expected.waterL).toBe(29.4)
})

it('no propaga texto libre inyectado como limitación de transporte', () => {
  const snapshot = {
    ...demoSnapshot(),
    limitations: ['Persona Privada persona@example.com <script>'],
  } as unknown as DemoSnapshot
  expect(JSON.stringify(buildExplainerInput(snapshot))).not.toMatch(
    /Persona Privada|persona@|<script>/,
  )
})
