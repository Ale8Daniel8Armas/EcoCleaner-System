import { describe, expect, it } from 'vitest'
import {
  crearSitioConAreas,
  listarAreasDeSitio,
  listarSitios,
  obtenerArea,
} from './sitios'

describe('sitios service (fallback local)', () => {
  it('crea un sitio con áreas y las deja consultables', async () => {
    const { sitio, areas } = await crearSitioConAreas({
      nombre: 'Sitio de prueba QR',
      tipo: 'Planta industrial',
      criterios_limpieza: ['Sin residuos visibles'],
      areas: [
        {
          nombre: 'Área QR',
          superficie_m2: 50,
          tipo_superficie: 'Piso industrial',
          litros_solucion_por_m2: 0.4,
        },
      ],
    })

    expect(sitio.nombre).toBe('Sitio de prueba QR')
    expect(areas).toHaveLength(1)

    const area = await obtenerArea(areas[0].id)
    expect(area?.nombre).toBe('Área QR')

    const areasDelSitio = await listarAreasDeSitio(sitio.id)
    expect(areasDelSitio.map((a) => a.id)).toContain(areas[0].id)

    const sitios = await listarSitios()
    expect(sitios.some((s) => s.id === sitio.id)).toBe(true)
  })
})
