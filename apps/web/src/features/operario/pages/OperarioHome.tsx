import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Card,
    Select,
    Spinner,
    IconPlus,
    IconFlask,
    IconClipboardCheck,
    IconShieldCheck,
} from '../../../components/ui';
import { formatNumber } from '../../../lib/format';
import { listarProductos } from '../../../services/productos';
import { listarTareas, type TareaOperario } from '../../../services/tareas';
import { listarTodasLasAreas, listarSitios } from '../../../services/sitios';
import { obtenerUsuarioActual } from '../../../services/usuarios';
import type { AreaOperario, ProductoOperario, SitioOperario } from '../../../services/operarioMock';
import logo from '../../../assets/ecoapp_logo.svg';

export default function OperarioHome() {
    const navigate = useNavigate();
    const usuario = obtenerUsuarioActual();
    const demoToolsEnabled = import.meta.env.VITE_DEMO_TOOLS === 'true';

    const [tareas, setTareas] = useState<TareaOperario[]>([]);
    const [productos, setProductos] = useState<ProductoOperario[]>([]);
    const [areas, setAreas] = useState<AreaOperario[]>([]);
    const [sitios, setSitios] = useState<SitioOperario[]>([]);
    const [cargando, setCargando] = useState(true);

    const [filtroEstado, setFiltroEstado] = useState<'todas' | 'pendientes' | 'completadas'>('todas');
    const [selectedArea, setSelectedArea] = useState('Todas las áreas');

    useEffect(() => {
        let activo = true;
        Promise.all([
            listarTareas(),
            listarProductos(),
            listarTodasLasAreas(),
            listarSitios(),
        ]).then(([tareasRes, prodsRes, areasRes, sitiosRes]) => {
            if (!activo) return;
            setTareas(tareasRes);
            setProductos(prodsRes);
            setAreas(areasRes);
            setSitios(sitiosRes);
            setCargando(false);
        }).catch((err) => {
            console.error('Error al cargar datos del operario:', err);
            if (activo) setCargando(false);
        });

        return () => {
            activo = false;
        };
    }, []);

    const productosMap = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
    const areasMap = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
    const sitiosMap = useMemo(() => new Map(sitios.map((s) => [s.id, s])), [sitios]);

    const areasNombres = useMemo(() => {
        const nombresUnicos = new Set<string>();
        areas.forEach((a) => {
            if (a.nombre?.trim()) nombresUnicos.add(a.nombre.trim());
        });
        tareas.forEach((t) => {
            const areaObj = areasMap.get(t.area_id);
            if (areaObj?.nombre?.trim()) nombresUnicos.add(areaObj.nombre.trim());
        });
        return ['Todas las áreas', ...Array.from(nombresUnicos).sort((a, b) => a.localeCompare(b))];
    }, [areas, tareas, areasMap]);


    const formatearFechaHora = (fechaIso?: string | null) => {
        if (!fechaIso) return 'Hora no registrada';
        try {
            const d = new Date(fechaIso);
            return d.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: 'short',
            });
        } catch {
            return String(fechaIso);
        }
    };

    // Totales calculados para los KPI
    const totales = useMemo(() => {
        return tareas.reduce(
            (acc, t) => {
                const agua = Number(t.receta?.litros_agua) || 0;
                const quimicoMl = Number(t.receta?.ml_producto) || 0;
                const superficie = Number(t.superficie_m2) || 0;
                return {
                    water: acc.water + agua,
                    chemicalMl: acc.chemicalMl + quimicoMl,
                    surface: acc.surface + superficie,
                };
            },
            { water: 0, chemicalMl: 0, surface: 0 },
        );
    }, [tareas]);

    const tareasCompletadas = useMemo(() => tareas.filter((t) => t.estado === 'completada'), [tareas]);
    const tareasPendientes = useMemo(() => tareas.filter((t) => t.estado !== 'completada'), [tareas]);

    // Filtrado de tareas para la tabla y listado
    const tareasFiltradas = useMemo(() => {
        return tareas.filter((t) => {
            if (filtroEstado === 'completadas' && t.estado !== 'completada') return false;
            if (filtroEstado === 'pendientes' && t.estado === 'completada') return false;

            if (selectedArea !== 'Todas las áreas') {
                const areaObj = areasMap.get(t.area_id);
                if (areaObj?.nombre !== selectedArea) return false;
            }
            return true;
        });
    }, [tareas, filtroEstado, selectedArea, areasMap]);

    return (
        <div className="operario-shell">
            {/* Cabecera ejecutiva del Operario */}
            <header className="supervisor-header" style={{ marginBottom: '16px' }}>
                <div className="brand-lockup">
                    <img className="brand-logo" src={logo} alt="EcoCleaner App" />
                    <div>
                        <p className="eyebrow" style={{ color: '#2563eb', fontWeight: 600 }}>EcoCleaner · Estación Operario</p>
                        <h1>Panel de operaciones y recetas</h1>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {demoToolsEnabled && (
                        <Link className="supervisor-header-btn" to="/operario/simulador">
                            Modo demostración
                        </Link>
                    )}
                    <div style={{
                        display: 'none',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        padding: '6px 12px',
                        borderRadius: '10px',
                        fontSize: '12.5px',
                        color: '#64748b'
                    }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                        <span>Operario: <strong style={{ color: '#0f172a' }}>{usuario?.nombre || 'Activo'}</strong></span>
                    </div>

                    <Link
                        className="primary-button"
                        to="/operario/receta"
                        style={{
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            textDecoration: 'none',
                            padding: '10px 18px',
                            background: '#2563eb',
                            color: '#ffffff',
                            fontWeight: 600,
                            borderRadius: '10px'
                        }}
                    >
                        <IconPlus size={16} />
                        <span>Nueva receta / Dosificar</span>
                    </Link>
                </div>
            </header>

            {/* Banner hero operativo */}
            <section className="hero-panel">
                <div>
                    <p className="eyebrow">Turno en planta · Dosificación técnica</p>
                    <h2>Registro de recetas<br /><span>y consumo químico</span></h2>
                    <p className="hero-copy">Calcula dosificaciones seguras por superficie y tipo de suciedad, declara las cantidades reales aplicadas y envíalas para documentación del revisor.</p>
                </div>
                <div className="hero-orbit" aria-hidden="true"><span>ml</span><b>+</b></div>
            </section>

            {/* Grid de métricas principales del turno */}
            <section className="metric-grid" aria-label="Resumen operativo del turno" style={{ marginBottom: '24px' }}>
                <article className="metric-card metric-water">
                    <div className="metric-icon">≈</div>
                    <p>Agua acumulada</p>
                    <strong>{formatNumber(totales.water)} <small>L</small></strong>
                    <span className="metric-trend" style={{ color: '#0284c7' }}>
                        {tareas.length > 0 ? `${tareas.length} recetas en este turno` : 'Sin registros'}
                    </span>
                </article>

                <article className="metric-card metric-product">
                    <div className="metric-icon">◌</div>
                    <p>Producto dosificado</p>
                    <strong>{formatNumber(totales.chemicalMl / 1000)} <small>L</small></strong>
                    <span className="metric-trend" style={{ color: '#8b5cf6' }}>
                        ~{formatNumber(totales.chemicalMl)} ml químicos
                    </span>
                </article>

                <article className="metric-card metric-surface">
                    <div className="metric-icon">⌗</div>
                    <p>Superficie atendida</p>
                    <strong>{formatNumber(totales.surface)} <small>m²</small></strong>
                    <span className="metric-trend" style={{ color: '#0ea5e9' }}>
                        En {new Set(tareas.map((t) => t.area_id)).size} áreas de planta
                    </span>
                </article>

                <article className="metric-card metric-status">
                    <div className="metric-icon">✓</div>
                    <p>Certificación del revisor</p>
                    <strong>{tareasCompletadas.length} <small>/ {tareas.length}</small></strong>
                    <span className="metric-trend" style={{ color: tareasPendientes.length > 0 ? '#eab308' : '#10b981' }}>
                        {tareasPendientes.length > 0 ? `${tareasPendientes.length} pendiente(s) de revisión` : 'Todas validadas'}
                    </span>
                </article>
            </section>

            {/* =========================================================================
                VISTA DESKTOP (≥ 900px): TABLA EJECUTIVA Y PANELES TÉCNICOS
                ========================================================================= */}
            <div className="operario-desktop-view">
                <Card className="table-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
                    <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Registro de tareas y dosificaciones</h3>
                            <p className="muted" style={{ margin: '3px 0 0', fontSize: '13px' }}>
                                Consulta el estado de documentación, diluciones aplicadas y trazabilidad química
                            </p>
                        </div>

                        {/* Barra de filtros de escritorio */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setFiltroEstado('todas')}
                                    style={{
                                        border: 'none',
                                        background: filtroEstado === 'todas' ? '#ffffff' : 'transparent',
                                        color: filtroEstado === 'todas' ? '#0f172a' : '#64748b',
                                        fontWeight: 600,
                                        fontSize: '12.5px',
                                        padding: '6px 12px',
                                        borderRadius: '7px',
                                        cursor: 'pointer',
                                        boxShadow: filtroEstado === 'todas' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    Todas ({tareas.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFiltroEstado('pendientes')}
                                    style={{
                                        border: 'none',
                                        background: filtroEstado === 'pendientes' ? '#ffffff' : 'transparent',
                                        color: filtroEstado === 'pendientes' ? '#0f172a' : '#64748b',
                                        fontWeight: 600,
                                        fontSize: '12.5px',
                                        padding: '6px 12px',
                                        borderRadius: '7px',
                                        cursor: 'pointer',
                                        boxShadow: filtroEstado === 'pendientes' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    Pendientes ({tareasPendientes.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFiltroEstado('completadas')}
                                    style={{
                                        border: 'none',
                                        background: filtroEstado === 'completadas' ? '#ffffff' : 'transparent',
                                        color: filtroEstado === 'completadas' ? '#0f172a' : '#64748b',
                                        fontWeight: 600,
                                        fontSize: '12.5px',
                                        padding: '6px 12px',
                                        borderRadius: '7px',
                                        cursor: 'pointer',
                                        boxShadow: filtroEstado === 'completadas' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    Completadas ({tareasCompletadas.length})
                                </button>
                            </div>

                            <Select
                                variant="inline"
                                label=""
                                value={selectedArea}
                                onChange={(e) => setSelectedArea(e.target.value)}
                                style={{ minWidth: '160px' }}
                            >
                                {areasNombres.map((a) => <option key={a}>{a}</option>)}
                            </Select>

                            <Link
                                to="/operario/receta"
                                className="supervisor-header-btn"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '7px 12px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    textDecoration: 'none'
                                }}
                            >
                                <IconPlus size={14} />
                                <span>Nueva receta</span>
                            </Link>
                        </div>
                    </div>

                    <div className="table-wrap" style={{ overflowX: 'auto' }}>
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Tarea y Producto</th>
                                    <th>Área / Ubicación</th>
                                    <th>Superficie</th>
                                    <th>Nivel suciedad</th>
                                    <th>Solución preparada</th>
                                    <th>Hora inicio</th>
                                    <th>Tiempo est.</th>
                                    <th style={{ textAlign: 'center' }}>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cargando ? (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: '36px' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', color: '#64748b' }}>
                                                <Spinner />
                                                <span>Cargando registros del operario...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : tareasFiltradas.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: '48px 16px' }}>
                                            <div style={{ maxWidth: '420px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center', marginBottom: '4px' }}>
                                                    <IconClipboardCheck size={22} />
                                                </div>
                                                <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                                                    No hay tareas en este filtro
                                                </p>
                                                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', textAlign: 'center' }}>
                                                    {filtroEstado === 'todas'
                                                        ? 'Aún no has registrado tareas en este turno. Comienza creando una receta con el asistente de dosificación.'
                                                        : `No hay tareas con estado «${filtroEstado}» en la selección actual.`}
                                                </p>
                                                <Link
                                                    to="/operario/receta"
                                                    className="primary-button"
                                                    style={{
                                                        marginTop: '12px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '8px 16px',
                                                        borderRadius: '8px',
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                        textDecoration: 'none'
                                                    }}
                                                >
                                                    <IconPlus size={15} />
                                                    Preparar primera receta
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    tareasFiltradas.map((tarea) => {
                                        const prod = productosMap.get(tarea.producto_id);
                                        const areaObj = areasMap.get(tarea.area_id);
                                        const sitioObj = areaObj?.sitio_id ? sitiosMap.get(areaObj.sitio_id) : null;
                                        const aguaL = Number(tarea.receta?.litros_agua) || 0;
                                        const prodMl = Number(tarea.receta?.ml_producto) || 0;

                                        return (
                                            <tr key={tarea.id}>
                                                <td>
                                                    <strong style={{ color: '#0f172a', display: 'block', fontSize: '13.5px' }}>
                                                        {tarea.tipo_tarea || 'Lavado técnico'}
                                                    </strong>
                                                    <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 500 }}>
                                                        {prod?.nombre || 'Producto químico'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ color: '#1e293b', fontWeight: 500, display: 'block', fontSize: '13px' }}>
                                                        {areaObj?.nombre || 'Área asignada'}
                                                    </span>
                                                    <small style={{ color: '#64748b', fontSize: '11.5px' }}>
                                                        {sitioObj?.nombre || 'Planta operativa'}
                                                    </small>
                                                </td>
                                                <td>
                                                    <strong style={{ color: '#0f172a', fontSize: '13.5px' }}>
                                                        {formatNumber(tarea.superficie_m2)} m²
                                                    </strong>
                                                </td>
                                                <td>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        fontSize: '11.5px',
                                                        fontWeight: 600,
                                                        background: tarea.nivel_suciedad === 'alta' ? '#fff7ed' : tarea.nivel_suciedad === 'baja' ? '#eff6ff' : '#fefce8',
                                                        color: tarea.nivel_suciedad === 'alta' ? '#c2410c' : tarea.nivel_suciedad === 'baja' ? '#1d4ed8' : '#a16207',
                                                        border: `1px solid ${tarea.nivel_suciedad === 'alta' ? '#ffedd5' : tarea.nivel_suciedad === 'baja' ? '#dbeafe' : '#fef08a'}`
                                                    }}>
                                                        {tarea.nivel_suciedad === 'alta' ? 'Alta' : tarea.nivel_suciedad === 'baja' ? 'Baja' : 'Media'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ color: '#0284c7', fontWeight: 600, fontSize: '13px' }}>
                                                        {formatNumber(aguaL)} L
                                                    </span>
                                                    <span style={{ color: '#64748b', margin: '0 4px', fontSize: '12px' }}>+</span>
                                                    <span style={{ color: '#8b5cf6', fontWeight: 600, fontSize: '13px' }}>
                                                        {formatNumber(prodMl)} ml
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '12.5px', color: '#475569' }}>
                                                        {formatearFechaHora(tarea.hora_inicio)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span style={{ fontSize: '12.5px', color: '#475569' }}>
                                                        {tarea.tiempo_estimado_min ? `${tarea.tiempo_estimado_min} min` : '—'}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {tarea.estado === 'completada' ? (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                            fontSize: '11.5px',
                                                            color: '#059669',
                                                            fontWeight: 600,
                                                            background: '#f0fdf4',
                                                            border: '1px solid #bbf7d0',
                                                            padding: '3px 8px',
                                                            borderRadius: '12px'
                                                        }}>
                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                                                            Completada
                                                        </span>
                                                    ) : (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                            fontSize: '11.5px',
                                                            color: '#d97706',
                                                            fontWeight: 600,
                                                            background: '#fffbeb',
                                                            border: '1px solid #fde68a',
                                                            padding: '3px 8px',
                                                            borderRadius: '12px'
                                                        }}>
                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                                                            Enviada a revisor
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Tarjetas inferiores de soporte técnico y buenas prácticas */}
                <div className="supervisor-cards-grid">
                    <Card className="template-card">
                        <div>
                            <p className="section-kicker"><IconFlask size={18} /> Guía rápida de dilución</p>
                            <h3>Dosificación recomendada</h3>
                            <p className="muted">
                                <strong>Ligera:</strong> 20–30 ml/L (limpieza de mantenimiento)<br />
                                <strong>Media:</strong> 40–50 ml/L (grasa estándar de turno)<br />
                                <strong>Pesada:</strong> 60–80 ml/L (residuos adheridos o fin de línea)
                            </p>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                            Calculado según m² y litros de solución.
                        </div>
                    </Card>

                    <Card className="template-card">
                        <div>
                            <p className="section-kicker"><IconShieldCheck size={18} /> Seguridad y EPP</p>
                            <h3>Protocolo de protección en planta</h3>
                            <p className="muted">
                                • Uso obligatorio de guantes de nitrilo y gafas herméticas.<br />
                                • Nunca mezclar ácidos con hipoclorito (cloro) o amoníaco.<br />
                                • Verter siempre el químico concentrado sobre el agua, nunca al revés.
                            </p>
                        </div>
                        <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 600, borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                            Seguridad química documentada
                        </div>
                    </Card>

                    <Card className="template-card">
                        <div>
                            <p className="section-kicker"><IconPlus size={18} /> Estación de cálculo</p>
                            <h3>¿Vas a iniciar otra tarea?</h3>
                            <p className="muted">
                                Selecciona el área, elige el químico de limpieza y obtén los litros exactos de agua y químico listos para preparar.
                            </p>
                        </div>
                        <button
                            type="button"
                            className="primary-button"
                            onClick={() => navigate('/operario/receta')}
                            style={{ whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                            <IconPlus size={15} />
                            Preparar receta
                        </button>
                    </Card>
                </div>
            </div>

            {/* =========================================================================
                VISTA MÓVIL (< 900px): SIMPLICIDAD TÁCTIL Y FLUJO DIRECTO
                ========================================================================= */}
            <div className="operario-mobile-view">
                {/* Botón táctil destacado para crear tarea en planta */}
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '18px',
                    boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.04)'
                }}>
                    <div style={{ marginBottom: '14px' }}>
                        <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Estación rápida de trabajo
                        </span>
                        <h3 style={{ margin: '4px 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                            ¿Vas a preparar una mezcla?
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                            Calcula las cantidades exactas de agua y químico para el área asignada.
                        </p>
                    </div>

                    <Link
                        to="/operario/receta"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '14px',
                            borderRadius: '12px',
                            background: '#2563eb',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '15px',
                            textDecoration: 'none',
                            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
                        }}
                    >
                        <IconPlus size={18} />
                        <span>Nueva receta / Preparar</span>
                    </Link>
                </div>

                {/* Filtro rápido móvil */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '14px' }}>
                    <button
                        type="button"
                        onClick={() => setFiltroEstado('todas')}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            border: `1px solid ${filtroEstado === 'todas' ? '#2563eb' : '#cbd5e1'}`,
                            background: filtroEstado === 'todas' ? '#eff6ff' : '#ffffff',
                            color: filtroEstado === 'todas' ? '#2563eb' : '#475569',
                            fontWeight: 600,
                            fontSize: '12px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Todas ({tareas.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFiltroEstado('pendientes')}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            border: `1px solid ${filtroEstado === 'pendientes' ? '#2563eb' : '#cbd5e1'}`,
                            background: filtroEstado === 'pendientes' ? '#eff6ff' : '#ffffff',
                            color: filtroEstado === 'pendientes' ? '#2563eb' : '#475569',
                            fontWeight: 600,
                            fontSize: '12px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Enviadas ({tareasPendientes.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFiltroEstado('completadas')}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            border: `1px solid ${filtroEstado === 'completadas' ? '#2563eb' : '#cbd5e1'}`,
                            background: filtroEstado === 'completadas' ? '#eff6ff' : '#ffffff',
                            color: filtroEstado === 'completadas' ? '#2563eb' : '#475569',
                            fontWeight: 600,
                            fontSize: '12px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Completadas ({tareasCompletadas.length})
                    </button>
                </div>

                {/* Lista táctil de tarjetas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {cargando ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                            <Spinner />
                            <p style={{ marginTop: '8px', fontSize: '13px' }}>Cargando tus tareas…</p>
                        </div>
                    ) : tareasFiltradas.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '36px 16px',
                            background: '#ffffff',
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0'
                        }}>
                            <p style={{ margin: 0, fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>
                                Sin tareas en este filtro
                            </p>
                            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '12.5px' }}>
                                Presiona «Nueva receta / Preparar» para iniciar tu siguiente tarea.
                            </p>
                        </div>
                    ) : (
                        tareasFiltradas.map((tarea) => {
                            const prod = productosMap.get(tarea.producto_id);
                            const areaObj = areasMap.get(tarea.area_id);
                            const aguaL = Number(tarea.receta?.litros_agua) || 0;
                            const prodMl = Number(tarea.receta?.ml_producto) || 0;

                            return (
                                <div key={tarea.id} className="operario-mobile-task-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: '#0f172a' }}>
                                                {tarea.tipo_tarea || 'Lavado de planta'}
                                            </h4>
                                            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#2563eb', fontWeight: 600 }}>
                                                {prod?.nombre || 'Producto químico'}
                                            </p>
                                        </div>

                                        <span style={{
                                            flexShrink: 0,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            padding: '3px 8px',
                                            borderRadius: '12px',
                                            background: tarea.estado === 'completada' ? '#f0fdf4' : '#fffbeb',
                                            color: tarea.estado === 'completada' ? '#059669' : '#d97706',
                                            border: `1px solid ${tarea.estado === 'completada' ? '#bbf7d0' : '#fde68a'}`
                                        }}>
                                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: tarea.estado === 'completada' ? '#10b981' : '#f59e0b' }} />
                                            {tarea.estado === 'completada' ? 'Completada' : 'Enviada'}
                                        </span>
                                    </div>

                                    {/* Métricas clave en pastillas */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: '6px',
                                        padding: '10px',
                                        borderRadius: '10px',
                                        background: '#f8fafc',
                                        border: '1px solid #f1f5f9',
                                        marginBottom: '8px'
                                    }}>
                                        <div>
                                            <span style={{ display: 'block', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Superficie</span>
                                            <strong style={{ fontSize: '12.5px', color: '#0f172a' }}>{formatNumber(tarea.superficie_m2)} m²</strong>
                                        </div>
                                        <div>
                                            <span style={{ display: 'block', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Agua</span>
                                            <strong style={{ fontSize: '12.5px', color: '#0284c7' }}>{formatNumber(aguaL)} L</strong>
                                        </div>
                                        <div>
                                            <span style={{ display: 'block', fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Químico</span>
                                            <strong style={{ fontSize: '12.5px', color: '#8b5cf6' }}>{formatNumber(prodMl)} ml</strong>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b' }}>
                                        <span>📍 {areaObj?.nombre || 'Área estándar'}</span>
                                        <span>🕒 {formatearFechaHora(tarea.hora_inicio)}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
