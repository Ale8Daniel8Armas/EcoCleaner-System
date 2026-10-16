import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaQr,
  IconBuilding,
  IconPlus,
  SimulatedBadge,
  Spinner,
} from '../../../components/ui'
import { formatNumber } from '../../../lib/format'
import { listarAreasDeSitio, listarSitios } from '../../../services/sitios'
import type {
  AreaOperario,
  SitioOperario,
} from '../../../services/operarioMock'

interface SitesBrowserProps {
  /** Muestra el botón «Nuevo sitio» (solo supervisor). */
  puedeCrear?: boolean
  eyebrow?: string
  backTo?: string
}

/**
 * Lista de sitios y áreas reutilizable por supervisor y operario.
 * El operario solo consulta (sin crear); el supervisor además puede crear.
 */
export function SitesBrowser({
  puedeCrear = false,
  eyebrow = 'EcoCleaner · Sitios',
  backTo,
}: SitesBrowserProps) {
  const [sitios, setSitios] = useState<SitioOperario[]>([])
  const [areasPorSitio, setAreasPorSitio] = useState<
    Record<string, AreaOperario[]>
  >({})
  const [cargando, setCargando] = useState(true)
  const [qrAbierto, setQrAbierto] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    listarSitios().then(async (dataSitios) => {
      if (!activo) return
      setSitios(dataSitios)
      const entradas = await Promise.all(
        dataSitios.map(
          async (sitio) =>
            [sitio.id, await listarAreasDeSitio(sitio.id)] as const,
        ),
      )
      if (!activo) return
      setAreasPorSitio(Object.fromEntries(entradas))
      setCargando(false)
    })
    return () => {
      activo = false
    }
  }, [])

  return (
    <div className="area-page">
      <header className="area-page-header">
        <div className="area-brand">
          {backTo ? (
            <Link className="area-back" to={backTo} aria-label="Volver">
              ←
            </Link>
          ) : (
            <span className="area-back area-back--mark">
              <IconBuilding size={18} />
            </span>
          )}
          <div>
            <p className="area-page-eyebrow">{eyebrow}</p>
            <h1 className="area-page-title">Sitios y áreas</h1>
          </div>
        </div>
        <SimulatedBadge />
      </header>

      <main className="area-page-main">
        <div
          className="area-actions"
          style={{ justifyContent: 'space-between' }}
        >
          <p className="area-muted">
            {puedeCrear
              ? 'Administra los sitios y sus áreas. Genera, descarga o imprime el QR de cada área.'
              : 'Consulta los sitios y sus áreas, y abre el detalle o el QR de cada área.'}
          </p>
          {puedeCrear && (
            <Link className="area-cta" to="/supervisor/sitios/nuevo">
              <IconPlus size={15} /> Nuevo sitio
            </Link>
          )}
        </div>

        {cargando ? (
          <section className="area-card">
            <p className="loading-row">
              <Spinner /> <span className="area-muted">Cargando sitios…</span>
            </p>
          </section>
        ) : sitios.length === 0 ? (
          <section className="area-card">
            <p className="area-section-kicker">Sin sitios</p>
            <p className="area-muted">
              {puedeCrear
                ? 'Aún no hay sitios registrados. Crea el primero con «Nuevo sitio».'
                : 'Aún no hay sitios registrados.'}
            </p>
          </section>
        ) : (
          sitios.map((sitio) => {
            const areas = areasPorSitio[sitio.id] ?? []
            return (
              <section className="area-card" key={sitio.id}>
                <div className="site-head">
                  <div>
                    <p
                      className="area-section-kicker"
                      style={{ marginBottom: '2px' }}
                    >
                      {sitio.tipo || 'Sitio'}
                    </p>
                    <h2 className="area-hero-title site-title">
                      {sitio.nombre}
                    </h2>
                  </div>
                  <span className="site-area-count">
                    {areas.length} {areas.length === 1 ? 'área' : 'áreas'}
                  </span>
                </div>

                {areas.length === 0 ? (
                  <p className="area-muted">Este sitio no tiene áreas.</p>
                ) : (
                  <ul className="site-areas">
                    {areas.map((area) => (
                      <li className="site-area" key={area.id}>
                        <div className="site-area-info">
                          <strong>{area.nombre}</strong>
                          <span className="area-muted">
                            {formatNumber(area.superficie_m2)} m² ·{' '}
                            {area.tipo_superficie} ·{' '}
                            {formatNumber(area.litros_solucion_por_m2 ?? 0)}{' '}
                            L/m²
                          </span>
                        </div>
                        <div className="site-area-actions">
                          <Link className="area-ghost" to={`/areas/${area.id}`}>
                            Ver detalle
                          </Link>
                          <button
                            type="button"
                            className="area-btn-outline"
                            onClick={() =>
                              setQrAbierto((actual) =>
                                actual === area.id ? null : area.id,
                              )
                            }
                          >
                            {qrAbierto === area.id ? 'Ocultar QR' : 'Ver QR'}
                          </button>
                        </div>
                        {qrAbierto === area.id && (
                          <div className="site-area-qr">
                            <AreaQr
                              areaId={area.id}
                              areaNombre={area.nombre}
                              sitioNombre={sitio.nombre}
                              qrPath={area.qr_path}
                              displaySize={200}
                            />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })
        )}
      </main>
    </div>
  )
}
