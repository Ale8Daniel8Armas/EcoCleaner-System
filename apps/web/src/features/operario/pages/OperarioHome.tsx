import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, OperarioHeader, PageHeader, Spinner } from '../../../components/ui'
import { formatNumber } from '../../../lib/format'
import { listarProductos } from '../../../services/productos'
import { listarTareas, type TareaOperario } from '../../../services/tareas'

export default function OperarioHome() {
  const [tareas, setTareas] = useState<TareaOperario[]>([])
  const [cargando, setCargando] = useState(true)
  const [productosMap, setProductosMap] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    let activo = true
    Promise.all([listarTareas(), listarProductos()]).then(
      ([tareasRes, prodsRes]) => {
        if (!activo) return
        setTareas(tareasRes)
        setProductosMap(new Map(prodsRes.map((p) => [p.id, p.nombre])))
        setCargando(false)
      },
    )
    return () => {
      activo = false
    }
  }, [])

  const describirTarea = (tarea: TareaOperario): string => {
    const prodNombre = productosMap.get(tarea.producto_id) || 'Producto'
    return `Tarea · ${prodNombre}`
  }

  return (
    <div className="operario-shell">
      <OperarioHeader title="Inicio" breadcrumb={[{ label: 'Operario' }]} />

      <main className="operario-main">
        <PageHeader
          eyebrow="Operario"
          title="Registra y evalúa tus tareas"
          description="Prepara la receta, registra el uso real y evalúa el criterio de limpieza."
        >
          <Link className="primary-button" to="/operario/receta">
            Nueva receta <span>→</span>
          </Link>
        </PageHeader>

        <section className="operario-quicklinks">
          <Card>
            <p className="section-kicker">Paso 1</p>
            <h3>Receta</h3>
            <p className="muted">
              Calcula litros y ml según área, producto y suciedad.
            </p>
            <Link className="ghost-button" to="/operario/receta">
              Calcular receta
            </Link>
          </Card>
          <Card>
            <p className="section-kicker">Paso 2</p>
            <h3>Registro de uso</h3>
            <p className="muted">
              Usa los selectores de litros y ml; verás el desvío y la alerta de
              sobredosis.
            </p>
            <Link className="ghost-button" to="/operario/receta">
              Registrar uso
            </Link>
          </Card>
          <Card>
            <p className="section-kicker">Paso 3</p>
            <h3>Criterio de limpieza</h3>
            <p className="muted">
              Checklist de cumple / no cumple que alimenta la comparación.
            </p>
            <Link className="ghost-button" to="/operario/receta">
              Evaluar criterio
            </Link>
          </Card>
        </section>

        <Card className="operario-card">
          <div className="card-heading">
            <div>
              <h3>Tareas recientes</h3>
              <p className="muted">
                Recetas guardadas en este dispositivo (demostración).
              </p>
            </div>
          </div>
          {cargando ? (
            <p className="loading-row">
              <Spinner /> <span className="muted">Cargando tareas…</span>
            </p>
          ) : tareas.length ? (
            <ul className="task-list">
              {tareas.slice(0, 4).map((tarea) => (
                <li className="task-item" key={tarea.id}>
                  <div>
                    <strong>
                      {formatNumber(tarea.superficie_m2)} m² ·{' '}
                      {formatNumber(tarea.receta.ml_producto)} ml
                    </strong>
                    <span className="muted">{describirTarea(tarea)}</span>
                  </div>
                  <Link
                    className="ghost-button"
                    to={`/operario/registro/${tarea.id}`}
                  >
                    Continuar
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">
              Aún no hay tareas. Empieza con «Nueva receta».
            </p>
          )}
        </Card>
      </main>
    </div>
  )
}
