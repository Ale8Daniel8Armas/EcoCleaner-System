import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, Spinner } from '../../../components/ui'
import { formatNumber } from '../../../lib/format'
import { listarProductos } from '../../../services/productos'
import { listarSitios, listarTodasLasAreas } from '../../../services/sitios'
import {
  listarTareas,
  type TareaOperario,
} from '../../../services/tareas'
import { cerrarSesion, listarUsuarios, type Usuario } from '../../../services/usuarios'
import type { AreaOperario, ProductoOperario, SitioOperario } from '../../../services/operarioMock'

export default function RevisorHome() {
  const navigate = useNavigate()
  const [tareas, setTareas] = useState<TareaOperario[]>([])
  const [productos, setProductos] = useState<ProductoOperario[]>([])
  const [sitios, setSitios] = useState<SitioOperario[]>([])
  const [areas, setAreas] = useState<AreaOperario[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState<'pendientes' | 'completadas'>('pendientes')

  useEffect(() => {
    let activo = true

    async function cargar() {
      try {
        const [tareasRes, prodsRes, sitiosRes, areasRes, usuariosRes] = await Promise.all([
          listarTareas(),
          listarProductos(),
          listarSitios(),
          listarTodasLasAreas(),
          listarUsuarios(),
        ])

        if (!activo) return
        setTareas(tareasRes)
        setProductos(prodsRes)
        setSitios(sitiosRes)
        setAreas(areasRes)
        setUsuarios(usuariosRes)
      } finally {
        if (activo) setCargando(false)
      }
    }

    cargar()

    return () => {
      activo = false
    }
  }, [])

  const productosMap = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const sitiosMap = useMemo(() => new Map(sitios.map((s) => [s.id, s])), [sitios])
  const areasMap = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas])
  const usuariosMap = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios])

  const tareasPendientes = useMemo(
    () => tareas.filter((t) => (t.estado ?? 'receta_enviada') !== 'completada'),
    [tareas],
  )

  const tareasCompletadas = useMemo(
    () => tareas.filter((t) => t.estado === 'completada'),
    [tareas],
  )

  const tareasMostradas = filtro === 'pendientes' ? tareasPendientes : tareasCompletadas

  const formatearHora = (fechaIso?: string | null) => {
    if (!fechaIso) return 'Hora no registrada'
    try {
      const d = new Date(fechaIso)
      if (isNaN(d.getTime())) return 'Hora no registrada'
      return d.toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'Hora no registrada'
    }
  }

  return (
    <div className="operario-shell">
      {/* Encabezado principal del Revisor */}
      <header className="supervisor-header">
        <div className="brand-lockup">
          <span className="brand-mark">EC</span>
          <div>
            <p className="eyebrow">EcoCleaner / Revisor</p>
            <h1>Bandeja de validación</h1>
          </div>
        </div>
        <div className="supervisor-header-actions">
          <button
            type="button"
            className="logout-button"
            onClick={() => {
              cerrarSesion()
              navigate('/')
            }}
            title="Cerrar sesión"
          >
            <span>Cerrar sesión</span> 🚪
          </button>
        </div>
      </header>

      <main className="revisor-shell">
        {/* Banner Hero en 3 Pasos */}
        <Card className="revisor-hero-card">
          <div className="revisor-hero-content">
            <div>
              <span className="revisor-hero-kicker">ASISTENTE EN 3 PASOS</span>
              <h1 className="revisor-hero-title">
                Bandeja de entrada<br />
                <span className="revisor-hero-highlight">
                  {tareasPendientes.length}{' '}
                  {tareasPendientes.length === 1 ? 'tarea pendiente' : 'tareas pendientes'}
                </span>
              </h1>
              <p className="revisor-hero-desc">
                Cada tarea enviada por el operario debe ser contrastada y certificada por
                un revisor técnico para pasar al panel general.
              </p>
            </div>

            <div className="revisor-hero-badge-wrap">
              <div className="revisor-circle-badge">
                <span className="revisor-circle-tag">3P</span>
                <span className="revisor-circle-check">✓</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Card Contenedor de la Lista de Recetas */}
        <Card className="revisor-list-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div className="revisor-list-header" style={{ marginBottom: 0 }}>
              <h2>
                {filtro === 'pendientes'
                  ? 'Recetas enviadas por operarios'
                  : 'Recetas validadas y certificadas'}
              </h2>
              <p className="muted">
                {filtro === 'pendientes'
                  ? 'Tareas en estado «receta_enviada» en espera de tu dictamen.'
                  : 'Tareas ya auditadas y completadas para supervisión.'}
              </p>
            </div>

            {/* Pestañas para alternar pendientes / completadas */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {tareasCompletadas.length > 0 && (
                <button
                  type="button"
                  className={`button ${filtro === 'completadas' ? '' : 'button--ghost'}`}
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                  onClick={() => setFiltro('completadas')}
                >
                  Validadas ({tareasCompletadas.length})
                </button>
              )}
            </div>
          </div>

          {cargando ? (
            <p className="loading-row">
              <Spinner /> <span className="muted">Cargando recetas pendientes…</span>
            </p>
          ) : tareasMostradas.length > 0 ? (
            <div>
              {tareasMostradas.map((tarea) => {
                const area = areasMap.get(tarea.area_id)
                const sitio = area?.sitio_id ? sitiosMap.get(area.sitio_id) : null
                const nombreSitio = sitio?.nombre || 'Sitio'
                const nombreArea = area?.nombre || 'Área'
                const producto = productosMap.get(tarea.producto_id)
                const nombreProducto = producto?.nombre || 'Producto químico'
                const operario = tarea.operario_id ? usuariosMap.get(tarea.operario_id) : null
                const nombreOperario = operario?.nombre || 'Operario'
                const esCompletada = tarea.estado === 'completada'

                return (
                  <div key={tarea.id} className="revisor-task-card">
                    <div className="revisor-task-info">
                      {/* Estado */}
                      <div>
                        <span
                          className={`revisor-state-pill ${esCompletada ? 'revisor-state-pill--completed' : ''
                            }`}
                        >
                          <span
                            className={`revisor-state-dot ${esCompletada ? 'revisor-state-dot--completed' : ''
                              }`}
                          />{' '}
                          {esCompletada ? 'Validada ✓' : 'Receta enviada'}
                        </span>
                      </div>

                      {/* Título de la tarea */}
                      <h3 className="revisor-task-title">
                        {tarea.tipo_tarea || 'Lavado de pisos'}
                      </h3>

                      {/* Ubicación: Sitio · Área */}
                      <p className="revisor-task-location">
                        {nombreSitio} · {nombreArea}
                      </p>

                      {/* Metadatos: Operario, Producto químico, Hora de inicio, Tiempo estimado */}
                      <div className="revisor-meta-grid">
                        <div className="revisor-meta-col">
                          <span className="revisor-meta-label">Operario</span>
                          <span className="revisor-meta-val">
                            <span style={{ color: '#a29bfe' }}>👤</span> {nombreOperario}
                          </span>
                        </div>

                        <div className="revisor-meta-col">
                          <span className="revisor-meta-label">Producto químico</span>
                          <span className="revisor-meta-val">
                            🧪 <strong>{nombreProducto}</strong>
                          </span>
                        </div>

                        <div className="revisor-meta-col">
                          <span className="revisor-meta-label">Hora de inicio</span>
                          <span className="revisor-meta-val">
                            🕒 {formatearHora(tarea.hora_inicio)}
                          </span>
                        </div>

                        <div className="revisor-meta-col">
                          <span className="revisor-meta-label">Tiempo estimado</span>
                          <span className="revisor-meta-val">
                            ⏱️ {tarea.tiempo_estimado_min ?? 30} min
                          </span>
                        </div>
                      </div>

                      {/* Superficie y dosis */}
                      <div className="revisor-dosage-row">
                        <span className="revisor-meta-label">Superficie y dosis</span>
                        <span className="revisor-dosage-val">
                          {formatNumber(tarea.superficie_m2)} m² - {formatNumber(tarea.receta.ml_producto)} ml
                        </span>
                      </div>
                    </div>

                    {/* Botón de acción */}
                    <div>
                      <Link
                        to={`/revisor/validar/${tarea.id}`}
                        className={`revisor-validate-btn ${esCompletada ? 'revisor-validate-btn--secondary' : ''
                          }`}
                      >
                        {esCompletada ? 'Ver dictamen' : 'Validar tarea'}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--muted)' }}>
              <p style={{ fontSize: '24px', margin: '0 0 10px 0' }}>✨</p>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--white)' }}>
                {filtro === 'pendientes'
                  ? 'No hay tareas pendientes de validación en este momento.'
                  : 'Aún no has validado tareas.'}
              </p>
              <p style={{ fontSize: '13px', margin: '6px 0 0' }}>
                {filtro === 'pendientes'
                  ? 'Las nuevas recetas enviadas por los operarios aparecerán aquí automáticamente.'
                  : ''}
              </p>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
