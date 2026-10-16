import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AreaQr,
  IconBuilding,
  IconCheck,
  IconDroplet,
  IconLayers,
  IconSpray,
  SimulatedBadge,
  Spinner,
} from '../../../components/ui'
import { formatNumber } from '../../../lib/format'
import { obtenerArea, obtenerSitio } from '../../../services/sitios'
import { listarProductos } from '../../../services/productos'
import type {
  AreaOperario,
  ProductoOperario,
  SitioOperario,
} from '../../../services/operarioMock'

export default function AreaInfo() {
  const { areaId = '' } = useParams()

  const [area, setArea] = useState<AreaOperario | null>(null)
  const [sitio, setSitio] = useState<SitioOperario | null>(null)
  const [productos, setProductos] = useState<ProductoOperario[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarQr, setMostrarQr] = useState(false)

  useEffect(() => {
    let activo = true
    Promise.all([obtenerArea(areaId), listarProductos()]).then(
      async ([areaEncontrada, productosData]) => {
        if (!activo) return
        setArea(areaEncontrada ?? null)
        setProductos(productosData)
        if (areaEncontrada) {
          const sitioEncontrado = await obtenerSitio(areaEncontrada.sitio_id)
          if (!activo) return
          setSitio(sitioEncontrado ?? null)
        }
        setCargando(false)
      },
    )
    return () => {
      activo = false
    }
  }, [areaId])

  return (
    <div className="area-page">
      <header className="area-page-header">
        <div className="area-brand">
          <Link
            className="area-back"
            to="/escanear"
            aria-label="Escanear otra área"
          >
            ←
          </Link>
          <div>
            <p className="area-page-eyebrow">EcoCleaner · Área</p>
            <h1 className="area-page-title">Información del área</h1>
          </div>
        </div>
        <SimulatedBadge />
      </header>

      <main className="area-page-main">
        {cargando ? (
          <section className="area-card">
            <p className="loading-row">
              <Spinner /> <span className="area-muted">Cargando el área…</span>
            </p>
          </section>
        ) : !area ? (
          <>
            <section className="area-card">
              <p className="area-page-eyebrow">Resultado</p>
              <h2 className="area-hero-title">Área no encontrada</h2>
              <p className="area-muted">
                El código QR no corresponde a un área registrada (o fue
                eliminada). Verifica el QR o consulta al supervisor del sitio.
              </p>
            </section>
            <div className="area-actions">
              <Link className="area-cta" to="/escanear">
                Escanear otra área
              </Link>
              <Link className="area-ghost" to="/">
                Volver al inicio
              </Link>
            </div>
          </>
        ) : (
          <>
            <section className="area-hero">
              <p className="area-page-eyebrow">{sitio?.nombre ?? 'Sitio'}</p>
              <h2 className="area-hero-title">{area.nombre}</h2>
              <p className="area-hero-sub">
                Esta etiqueta identifica el área de limpieza. Aquí tienes sus
                datos y cómo limpiarla.
              </p>

              <div className="area-metrics">
                <div className="area-metric">
                  <IconLayers size={22} />
                  <small>Superficie</small>
                  <strong>{formatNumber(area.superficie_m2)} m²</strong>
                </div>
                <div className="area-metric">
                  <IconBuilding size={22} />
                  <small>Tipo de superficie</small>
                  <strong>{area.tipo_superficie}</strong>
                </div>
                <div className="area-metric">
                  <IconDroplet size={22} />
                  <small>Solución por m²</small>
                  <strong>
                    {formatNumber(area.litros_solucion_por_m2 ?? 0)} L/m²
                  </strong>
                </div>
              </div>
            </section>

            <section className="area-card">
              <p className="area-section-kicker">Cómo se limpia</p>
              <ol className="area-steps">
                <li>
                  <span className="area-step-num">1</span>
                  <div>
                    <strong>Prepara la solución</strong>
                    <span className="area-muted">
                      Mezcla el producto con agua respetando la dilución de la
                      ficha.
                    </span>
                  </div>
                </li>
                <li>
                  <span className="area-step-num">2</span>
                  <div>
                    <strong>Aplica sobre la superficie</strong>
                    <span className="area-muted">
                      Cubre los {formatNumber(area.superficie_m2)} m² del área.
                    </span>
                  </div>
                </li>
                <li>
                  <span className="area-step-num">3</span>
                  <div>
                    <strong>Enjuaga y recoge</strong>
                    <span className="area-muted">
                      Sin charcos ni residuos; luego registra el uso y el
                      criterio.
                    </span>
                  </div>
                </li>
              </ol>

              <p className="area-section-kicker area-section-kicker--spaced">
                Productos y dosis de referencia
              </p>
              <ul className="area-products">
                {productos.map((producto) => (
                  <li className="area-product-chip" key={producto.id}>
                    <span className="area-product-icon">
                      <IconSpray size={17} />
                    </span>
                    <div>
                      <strong>{producto.nombre}</strong>
                      <span className="chip-dosis">
                        {producto.dilucion_min_ml_por_litro}–
                        {producto.dilucion_max_ml_por_litro} ml/L
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="area-muted">
                La receta exacta depende del producto y del nivel de suciedad;
                usa «Preparar receta».
              </p>
            </section>

            {sitio && sitio.criterios_limpieza.length > 0 && (
              <section className="area-card">
                <p className="area-section-kicker">Criterios de limpieza</p>
                <ul className="area-criteria">
                  {sitio.criterios_limpieza.map((criterio) => (
                    <li key={criterio}>
                      <span className="area-criteria-check">
                        <IconCheck size={13} />
                      </span>
                      <span>{criterio}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="area-actions">
              <button
                type="button"
                className="area-btn-outline"
                onClick={() => setMostrarQr((valor) => !valor)}
              >
                {mostrarQr ? 'Ocultar QR' : 'Generar / Ver QR'}
              </button>
              <Link
                className="area-cta"
                to={`/operario/receta?area=${area.id}`}
              >
                Preparar receta <span>→</span>
              </Link>
            </div>

            {mostrarQr && (
              <section className="area-card">
                <p className="area-section-kicker">Etiqueta QR del área</p>
                <AreaQr
                  areaId={area.id}
                  areaNombre={area.nombre}
                  sitioNombre={sitio?.nombre}
                  qrPath={area.qr_path}
                  displaySize={240}
                />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
