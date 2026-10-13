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
                    title="Registra y evalúa tus tareas"
                    description="Flujo operativo estandarizado para dosificación química, trazabilidad y control ambiental."
                />

                <section className="workflow-card">
                    <div className="workflow-heading">
                        <p className="section-kicker">Guía de proceso</p>
                        <h3>Flujo operativo en 4 pasos</h3>
                        <p className="muted">
                            Sigue esta secuencia para preparar químicos con precisión, registrar consumos y garantizar el vertido seguro.
                        </p>
                    </div>

                    <div className="workflow-steps-grid">
                        <div className="workflow-step-item">
                            <div className="workflow-step-top">
                                <span className="workflow-step-num">01</span>
                                <span className="workflow-step-tag">Paso 1</span>
                            </div>
                            <h4>Calcular receta</h4>
                            <p>Selecciona sitio, área y nivel de suciedad para obtener litros de agua y ml exactos.</p>
                        </div>

                        <div className="workflow-step-item">
                            <div className="workflow-step-top">
                                <span className="workflow-step-num">02</span>
                                <span className="workflow-step-tag">Paso 2</span>
                            </div>
                            <h4>Registrar uso</h4>
                            <p>Mide los litros y ml aplicados con cálculo de desvíos y alertas inmediatas de sobredosis.</p>
                        </div>

                        <div className="workflow-step-item">
                            <div className="workflow-step-top">
                                <span className="workflow-step-num">03</span>
                                <span className="workflow-step-tag">Paso 3</span>
                            </div>
                            <h4>Evaluar criterios</h4>
                            <p>Valida la inspección visual mediante el checklist de conformidad de inocuidad.</p>
                        </div>

                        <div className="workflow-step-item">
                            <div className="workflow-step-top">
                                <span className="workflow-step-num">04</span>
                                <span className="workflow-step-tag">Paso 4</span>
                            </div>
                            <h4>Control de efluente</h4>
                            <p>Mide el pH final del residuo y registra la orientación técnica de vertido o ajuste.</p>
                        </div>
                    </div>

                    <div className="workflow-footer">
                        <div className="workflow-footer-info">
                            <span className="status-dot" />
                            <span>Proceso guiado con alertas de sobredosis y cálculo de dilución</span>
                        </div>
                        <Link className="workflow-cta-btn" to="/operario/receta">
                            Crear receta <span>→</span>
                        </Link>
                    </div>
                </section>

                <Card className="operario-card">
                    <div className="card-heading">
                        <div>
                            <h3>Tareas recientes</h3>
                            <p className="muted">
                                Recetas guardadas en este dispositivo para continuar tu jornada.
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
                            Aún no hay tareas registradas. Empieza con «Crear receta» arriba.
                        </p>
                    )}
                </Card>
            </main>
        </div>
    )
}
