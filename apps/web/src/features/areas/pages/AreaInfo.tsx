import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Alert,
  AreaQr,
  Card,
  PageHeader,
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
    <div className="area-info-shell">
      <header className="area-info-header">
        <div className="brand-lockup">
          <Link className="back-link" to="/" aria-label="Inicio">
            ←
          </Link>
          <div>
            <p className="eyebrow">EcoCleaner · Área</p>
            <h1>Información del área</h1>
          </div>
        </div>
        <SimulatedBadge />
      </header>

      <main className="area-info-main">
        {cargando ? (
          <Card className="operario-card">
            <p className="loading-row">
              <Spinner /> <span className="muted">Cargando el área…</span>
            </p>
          </Card>
        ) : !area ? (
          <>
            <PageHeader
              eyebrow="Área"
              title="Área no encontrada"
              description="El código QR no corresponde a un área registrada."
            />
            <Alert tone="warning" title="Sin datos">
              Verifica el QR o consulta al supervisor del sitio.
            </Alert>
            <div className="operario-actions">
              <Link className="ghost-button" to="/">
                Volver al inicio
              </Link>
            </div>
          </>
        ) : (
          <>
            <PageHeader
              eyebrow={sitio?.nombre ?? 'Sitio'}
              title={area.nombre}
              description="Parámetros de limpieza del área y guía de dosificación."
            >
              <Link
                className="primary-button"
                to={`/operario/receta?area=${area.id}`}
              >
                Preparar receta <span>→</span>
              </Link>
            </PageHeader>

            <Card className="operario-card">
              <p className="section-kicker">Datos del área</p>
              <div className="result-grid">
                <div className="result-item">
                  <small>Superficie</small>
                  <strong>{formatNumber(area.superficie_m2)} m²</strong>
                </div>
                <div className="result-item">
                  <small>Tipo de superficie</small>
                  <strong>{area.tipo_superficie}</strong>
                </div>
                <div className="result-item">
                  <small>Litros por m²</small>
                  <strong>
                    {formatNumber(area.litros_solucion_por_m2 ?? 0)} L/m²
                  </strong>
                </div>
              </div>
              {sitio && sitio.criterios_limpieza.length > 0 && (
                <>
                  <p className="section-kicker" style={{ marginTop: '16px' }}>
                    Criterios de limpieza
                  </p>
                  <ul className="incompat-list">
                    {sitio.criterios_limpieza.map((criterio) => (
                      <li key={criterio}>{criterio}</li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card className="operario-card">
              <p className="section-kicker">
                Cómo se limpia (dosificación de referencia)
              </p>
              <ul className="area-product-list">
                {productos.map((producto) => (
                  <li key={producto.id}>
                    <strong>{producto.nombre}</strong>
                    <span className="muted">
                      {producto.dilucion_min_ml_por_litro}–
                      {producto.dilucion_max_ml_por_litro} ml/L (recomendado{' '}
                      {producto.dilucion_ml_por_litro})
                    </span>
                  </li>
                ))}
              </ul>
              <p className="muted">
                La receta exacta depende del producto y del nivel de suciedad;
                usa «Preparar receta» para calcularla.
              </p>
            </Card>

            <Card className="operario-card">
              <p className="section-kicker">Etiqueta QR del área</p>
              <AreaQr
                areaId={area.id}
                areaNombre={area.nombre}
                sitioNombre={sitio?.nombre}
              />
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
