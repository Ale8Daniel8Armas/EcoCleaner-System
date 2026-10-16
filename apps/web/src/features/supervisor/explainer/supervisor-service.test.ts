import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  reply: { data: [] as unknown[] | null, error: null as unknown },
  select: vi.fn(),
  limit: vi.fn(),
  abortSignal: vi.fn(),
}))
vi.mock('../../../services/supabase', () => {
  const query = {
    select: mocks.select,
    order: vi.fn(),
    limit: mocks.limit,
    abortSignal: mocks.abortSignal,
  }
  mocks.select.mockReturnValue(query)
  query.order.mockReturnValue(query)
  mocks.limit.mockReturnValue(query)
  mocks.abortSignal.mockImplementation(() => Promise.resolve(mocks.reply))
  return { isSupabaseConfigured: true, supabase: { from: vi.fn(() => query) } }
})
import { obtenerDatosExplicadorSupervisor } from '../../../services/supervisor'

describe('carga de solo lectura del servicio supervisor', () => {
  beforeEach(() => {
    mocks.reply = { data: [], error: null }
    vi.stubGlobal('localStorage', {
      getItem: () =>
        JSON.stringify({ tareas: [{ id: 'cached', estado: 'completada' }] }),
    })
  })
  it('mantiene Supabase como origen incluso cuando su respuesta es vacía', async () => {
    const snapshot = await obtenerDatosExplicadorSupervisor()
    expect(snapshot.origin).toBe('supabase')
    expect(snapshot.tasks).toEqual([])
  })
  it('solicita nombres operativos y excluye observaciones, identidad y sesión', async () => {
    await obtenerDatosExplicadorSupervisor()
    const query = mocks.select.mock.calls.at(-1)![0]
    expect(query).not.toMatch(
      /observaciones|email|password|operario_id|revisor_id|auth|usuarios|profiles|\*/,
    )
    expect(query).toContain('decision_final')
    expect(query.replace(/\s+/g, ' ')).toContain('areas (nombre)')
    expect(query.replace(/\s+/g, ' ')).toContain(
      'variantes (id, nombre, dilucion_ml_por_litro)',
    )
    expect(mocks.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
  })
  it('indica el fallback local ante error y no disfraza el origen', async () => {
    mocks.reply = { data: null, error: { message: 'No disponible' } }
    const snapshot = await obtenerDatosExplicadorSupervisor()
    expect(snapshot.origin).toBe('local')
    expect(snapshot.tasks[0].id).toBe('cached')
    expect(snapshot.limitations).toContain('remote_unavailable')
  })
  it('tolera una excepción de red sin propagarla al panel', async () => {
    mocks.abortSignal.mockRejectedValueOnce(new Error('Conexión interrumpida'))
    expect((await obtenerDatosExplicadorSupervisor()).origin).toBe('local')
  })
  it('limita la carga y documenta un resultado parcial', async () => {
    mocks.reply = {
      data: Array.from({ length: 201 }, (_, i) => ({ id: String(i) })),
      error: null,
    }
    const snapshot = await obtenerDatosExplicadorSupervisor()
    expect(snapshot.tasks).toHaveLength(200)
    expect(snapshot.limitations).toContain('partial')
    expect(mocks.limit).toHaveBeenCalledWith(201, {
      referencedTable: 'registros_uso',
    })
  })
})
