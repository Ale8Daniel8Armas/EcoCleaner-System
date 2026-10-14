import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, OperarioHeader, PageHeader, Spinner } from '../../../components/ui'
import { formatNumber } from '../../../lib/format'
import { listarProductos } from '../../../services/productos'
import { listarTareas, type TareaOperario } from '../../../services/tareas'
import { cerrarSesion } from '../../../services/usuarios'

export default function OperarioHome() {
    const navigate = useNavigate()
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
        const nombre = tarea.tipo_tarea?.trim() || 'Tarea'
        return `${nombre} · ${prodNombre}`
    }

    const formatearFechaHora = (fechaIso?: string | null) => {
        if (!fechaIso) return 'Hora no registrada'
        try {
            const d = new Date(fechaIso)
            return d.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: 'short',
            })
        } catch {
            return String(fechaIso)
        }
    }

    return (
        <div className="operario-shell">
            <OperarioHeader
                title="Inicio"
                breadcrumb={[{ label: 'Operario' }]}
                actions={
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
                }
            />

            <main className="operario-main">
                <PageHeader
                    eyebrow="Operario"
                    title="Mis tareas y recetas"
                    description="Crea recetas técnicas, declara las cantidades usadas y envíalas al revisor para su validación."
                />

                <section className="workflow-card">
                    <div className="workflow-heading">
                        <p className="section-kicker">Rol de Operario</p>
                        <h3>Crea y declara tus tareas</h3>
                        <p className="muted">
                            Calcula las dosis químicas adecuadas para cada superficie y registra las cantidades reales aplicadas para trazabilidad.
                        </p>
                    </div>

                    <div className="workflow-footer" style={{ marginTop: '16px' }}>
                        <div className="workflow-footer-info">
                            <span className="status-dot" />
                            <span>La tarea pasará automáticamente a la bandeja de validación del revisor.</span>
                        </div>
                        <Link className="workflow-cta-btn" to="/operario/receta">
                            Nueva receta <span>→</span>
                        </Link>
                    </div>
                </section>

                <Card className="operario-card">
                    <div className="card-heading">
                        <div>
                            <h3>Mis tareas</h3>
                            <p className="muted">
                                Historial de tareas creadas y su estado de validación.
                            </p>
                        </div>
                    </div>
                    {cargando ? (
                        <p className="loading-row">
                            <Spinner /> <span className="muted">Cargando tareas…</span>
                        </p>
                    ) : tareas.length ? (
                        <ul className="task-list">
                            {tareas.map((tarea) => (
                                <li className="task-item" key={tarea.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                    <div>
                                        <strong>
                                            {formatNumber(tarea.superficie_m2)} m² ·{' '}
                                            {formatNumber(tarea.receta.ml_producto)} ml
                                        </strong>
                                        <span className="muted" style={{ display: 'block', fontSize: '13px' }}>
                                            {describirTarea(tarea)}
                                        </span>
                                        <span className="muted" style={{ display: 'block', fontSize: '11px', marginTop: '3px' }}>
                                            🕒 Inicio: {formatearFechaHora(tarea.hora_inicio)} {tarea.tiempo_estimado_min ? `· Est: ${tarea.tiempo_estimado_min} min` : ''}
                                        </span>
                                    </div>
                                    <div style={{ flexShrink: 0 }}>
                                        <span className={`state-pill ${tarea.estado === 'completada' ? 'ok' : 'warning'}`}>
                                            <span />
                                            {tarea.estado === 'completada' ? 'Completada' : 'Enviada'}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="muted">
                            Aún no has registrado tareas. Comienza creando una con «Nueva receta».
                        </p>
                    )}
                </Card>
            </main>
        </div>
    )
}
