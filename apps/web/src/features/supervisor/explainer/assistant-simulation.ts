import { calcularReceta } from '@ecocleaner/core'
import { areas, productos } from '../../../services/operarioMock'
import type { DemoRecord, DemoSnapshot, DemoTask } from './contracts'
import type { LiveCatalog } from './live-data'

/** Escenario aislado: reutiliza el catálogo ficticio, sin guardar ni simular mediciones físicas. */
export function createAssistantSimulation(): {
  snapshot: DemoSnapshot
  catalog: LiveCatalog
} {
  const product = productos.find((item) => item.id === 'prod-alcalino')!
  const recipeFor = (index: number, dirt: 'baja' | 'media' = 'media') =>
    calcularReceta({
      superficie_m2: areas[index].superficie_m2!,
      litros_solucion_por_m2: areas[index].litros_solucion_por_m2!,
      nivel_suciedad: dirt,
      producto: product,
    })
  const task = (id: string, name: string, areaIndex: number): DemoTask => ({
    id,
    name,
    areaId: areas[areaIndex].id,
    areaName: areas[areaIndex].nombre,
    productId: product.id,
    state: 'completada',
    dirt: 'media',
    recipe: recipeFor(areaIndex),
    productMin: product.dilucion_min_ml_por_litro,
    productMax: product.dilucion_max_ml_por_litro,
    criticalProduct: false,
    variants: [],
    records: [],
  })
  const record = (
    id: string,
    waterL: number,
    productMl: number,
    cleaning = true,
  ): DemoRecord => ({
    id,
    variantId: null,
    waterL,
    productMl,
    mark: 'estimado',
    source: 'simulada',
    recordedOverdose: false,
    cleaning,
    decisions: ['gestor'],
  })
  const floors = task('sim-floors', 'Lavado de pisos (simulado)', 0)
  floors.records = [
    record(
      'sim-floor-use',
      floors.recipe!.litros_agua,
      floors.recipe!.ml_producto,
    ),
  ]
  const storage = task('sim-storage', 'Limpieza de almacén (simulada)', 1)
  storage.records = [
    record('sim-storage-use', storage.recipe!.litros_agua, 3000, false),
  ]
  const comparison = task(
    'sim-comparison',
    'Comparación de procedimientos (simulada)',
    0,
  )
  comparison.variants = [
    {
      id: 'sim-standard',
      name: 'Procedimiento de referencia',
      dilution: comparison.recipe!.ml_por_litro,
    },
    {
      id: 'sim-alternative',
      name: 'Procedimiento alternativo',
      dilution: product.dilucion_min_ml_por_litro,
    },
  ]
  const alternative = recipeFor(0, 'baja')
  comparison.records = [0, 1, 2, 3].map((index) => {
    const recipe = index < 2 ? comparison.recipe! : alternative
    return {
      ...record(
        `sim-repeat-${index}`,
        recipe.litros_agua,
        recipe.ml_producto,
        index !== 3,
      ),
      variantId: comparison.variants[index < 2 ? 0 : 1].id,
      decisions: index === 3 ? [] : ['gestor'],
    }
  })
  const pending = task('sim-pending', 'Limpieza pendiente (simulada)', 1)
  pending.state = 'receta_enviada'
  return {
    snapshot: {
      origin: 'local',
      catalogSimulated: true,
      limitations: ['local', 'catalog_simulated'],
      tasks: [floors, storage, comparison, pending],
    },
    catalog: {
      simulated: true,
      partial: false,
      products: productos.map((item) => ({
        id: item.id,
        name: item.nombre,
        categories: item.categorias,
        incompatibilities: item.incompatibilidades ?? null,
        minimum: item.dilucion_min_ml_por_litro,
        maximum: item.dilucion_max_ml_por_litro,
        ph: item.ph ?? null,
      })),
    },
  }
}
