import { afterEach, describe, expect, it, vi } from 'vitest'
import { areaQrPayload, parseAreaQrUrl, qrFileName } from './qr'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('qr util', () => {
  it('genera la ruta de área como payload', () => {
    expect(areaQrPayload('area-1')).toContain('/areas/area-1')
  })

  it('usa el origin cuando hay window', () => {
    vi.stubGlobal('window', { location: { origin: 'https://eco.test' } })
    expect(areaQrPayload('id1')).toBe('https://eco.test/areas/id1')
  })

  it('extrae el id de área de una URL de QR', () => {
    expect(parseAreaQrUrl('https://eco.test/areas/area-1')).toBe('area-1')
    expect(parseAreaQrUrl('https://eco.test/areas/area-1/')).toBe('area-1')
    expect(parseAreaQrUrl('https://eco.test/supervisor')).toBeNull()
    expect(parseAreaQrUrl('no-es-una-url')).toBeNull()
  })

  it('nombra el archivo con sitio y área', () => {
    expect(qrFileName('Producción A', 'Planta Norte')).toBe(
      'qr-planta-norte-produccion-a.png',
    )
    expect(qrFileName('Almacén')).toBe('qr-almacen.png')
  })
})
