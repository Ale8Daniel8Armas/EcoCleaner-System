import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Card,
    PageHeader,
    Select,
    IconPlus,
    IconDownload,
    IconFlask,
    IconUsers,
    IconBuilding,
    IconCheck,
    IconDroplet,
    IconLayers,
    SimulatedBadge,
} from '../../../components/ui';
import { obtenerConsumoSupervisor, obtenerResumenSupervisor } from '../../../services/supervisor';
import { listarTodasLasAreas, listarSitios } from '../../../services/sitios';
import { listarProductos } from '../../../services/productos';
import type { AreaOperario, ProductoOperario, SitioOperario } from '../../../services/operarioMock';
import type { ConsumptionRow } from '../../../services/supervisorMock';
import logo from '../../../assets/ecoapp_logo.svg';
import { obtenerUsuarioActual } from '../../../services/usuarios';
import { canShowDemo } from '../explainer/config';

const formatNumber = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value);

const formatearHora = (fechaIso?: string | null) => {
    if (!fechaIso) return '—';
    try {
        const d = new Date(fechaIso);
        return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
    } catch {
        return String(fechaIso);
    }
};

const CATEGORIA_LABELS: Record<string, string> = {
    alcalino: 'Alcalino',
    acido: 'Ácido',
    hipoclorito: 'Hipoclorito (Cloro)',
    amoniaco: 'Amoníaco',
    amonio_cuaternario: 'Amonio cuaternario',
    peroxido: 'Peróxido',
    solvente: 'Solvente',
    otro: 'Neutro / Otro',
};

export default function SupervisorHome() {
    const navigate = useNavigate();
    const showDemo = canShowDemo(obtenerUsuarioActual()?.rol, import.meta.env.VITE_LLM_MODE);
    const [rows, setRows] = useState<ConsumptionRow[]>([]);
    const [areasList, setAreasList] = useState<AreaOperario[]>([]);
    const [sitiosList, setSitiosList] = useState<SitioOperario[]>([]);
    const [productosList, setProductosList] = useState<ProductoOperario[]>([]);
    const [resumen, setResumen] = useState<{ tareasCompletadas: number; tareasPendientes: number }>({
        tareasCompletadas: 0,
        tareasPendientes: 0,
    });
    const [cargando, setCargando] = useState(true);
    const [selectedArea, setSelectedArea] = useState('Todas las áreas');

    useEffect(() => {
        let activo = true;
        Promise.all([
            obtenerConsumoSupervisor(),
            listarTodasLasAreas(),
            obtenerResumenSupervisor(),
            listarProductos(),
            listarSitios(),
        ]).then(([dataConsumo, dataAreas, dataResumen, dataProductos, dataSitios]) => {
            if (!activo) return;
            setRows(dataConsumo);
            setAreasList(dataAreas);
            setResumen(dataResumen);
            setProductosList(dataProductos);
            setSitiosList(dataSitios);
            setCargando(false);
        }).catch((err) => {
            console.error('Error al cargar datos en panel supervisor:', err);
            if (activo) setCargando(false);
        });
        return () => {
            activo = false;
        };
    }, []);

    const areas = useMemo(() => {
        const nombresUnicos = new Set<string>();
        // 1. Áreas registradas en el catálogo de sitios y áreas
        areasList.forEach((a) => {
            if (a.nombre?.trim()) nombresUnicos.add(a.nombre.trim());
        });
        // 2. Áreas presentes en registros de consumo
        rows.forEach((row) => {
            if (row.area?.trim()) nombresUnicos.add(row.area.trim());
        });
        return ['Todas las áreas', ...Array.from(nombresUnicos).sort((a, b) => a.localeCompare(b))];
    }, [areasList, rows]);

    const filteredRows = useMemo(
        () => selectedArea === 'Todas las áreas' ? rows : rows.filter((row) => row.area === selectedArea),
        [selectedArea, rows],
    );

    const areaSeleccionadaInfo = useMemo(
        () => areasList.find((a) => a.nombre === selectedArea),
        [areasList, selectedArea],
    );

    const totals = useMemo(() => {
        if (filteredRows.length > 0) {
            return filteredRows.reduce(
                (accumulator, row) => ({
                    water: accumulator.water + row.water,
                    product: accumulator.product + row.product,
                    surface: accumulator.surface + row.surface,
                }),
                { water: 0, product: 0, surface: 0 },
            );
        }
        if (areaSeleccionadaInfo) {
            return {
                water: 0,
                product: 0,
                surface: Number(areaSeleccionadaInfo.superficie_m2) || 0,
            };
        }
        return { water: 0, product: 0, surface: 0 };
    }, [filteredRows, areaSeleccionadaInfo]);

    return (
        <div className="supervisor-shell">
            {/* Cabecera del Supervisor */}
            <header className="supervisor-header">
                <div className="brand-lockup">
                    <img className="brand-logo" src={logo} alt="EcoCleaner App" />
                    <div>
                        <p className="eyebrow">EcoCleaner / Supervisor</p>
                        <h1>Centro de control</h1>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {showDemo && (
                        <Link className="supervisor-header-btn" to="/supervisor/asistente">
                            Asistente LLM (demo)
                        </Link>
                    )}
                    <Link
                        className="supervisor-header-btn"
                        to="/supervisor/comparacion"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                    >
                        <IconLayers size={15} />
                        <span>Comparación de variantes</span>
                    </Link>
                    <Link
                        className="supervisor-header-btn"
                        to="/supervisor/efluente"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                    >
                        <IconDroplet size={15} />
                        <span>Revisión de Efluentes</span>
                    </Link>
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => navigate('/supervisor/usuarios')}
                        style={{ whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                        <IconUsers size={15} />
                        Gestión de usuarios
                    </button>
                </div>
            </header>

            {/* Banner hero */}
            <section className="hero-panel">
                <div>
                    <p className="eyebrow">Vista general · Monitoreo en tiempo real</p>
                    <h2>Consumo por área<br /><span>y tarea</span></h2>
                    <p className="hero-copy">Monitorea el uso de agua y producto químico para tomar decisiones operativas con datos trazables.</p>
                </div>
                <div className="hero-orbit" aria-hidden="true"><span>m²</span><b>+</b></div>
            </section>

            <PageHeader eyebrow="Panel de consumo" title="Consumo por área y tarea" description="Métricas acumuladas y registros validados por el revisor">
                <Select variant="inline" label="Área" value={selectedArea} onChange={(event) => setSelectedArea(event.target.value)}>
                    {areas.map((area) => <option key={area}>{area}</option>)}
                </Select>
            </PageHeader>

            {/* Grid de métricas principales */}
            <section className="metric-grid" aria-label="Resumen de consumo por área y tarea">
                <article className="metric-card metric-water">
                    <div className="metric-icon">≈</div>
                    <p>Agua utilizada</p>
                    <strong>{formatNumber(totals.water)} <small>L</small></strong>
                    <span className="metric-trend">{filteredRows.length > 0 ? `${filteredRows.length} tareas validadas` : 'Sin consumo validado'}</span>
                </article>

                <article className="metric-card metric-product">
                    <div className="metric-icon">◌</div>
                    <p>Producto químico</p>
                    <strong>{formatNumber(totals.product)} <small>L</small></strong>
                    <span className="metric-trend">{filteredRows.length > 0 ? `${filteredRows.length} tareas validadas` : 'Sin consumo validado'}</span>
                </article>

                <article className="metric-card metric-surface">
                    <div className="metric-icon">⌗</div>
                    <p>Superficie atendida</p>
                    <strong>{formatNumber(totals.surface)} <small>m²</small></strong>
                    <span className="metric-trend neutral">
                        {selectedArea === 'Todas las áreas'
                            ? `En ${new Set(rows.map((row) => row.area)).size} áreas con consumo (${areasList.length} registradas)`
                            : `${selectedArea} · ${areaSeleccionadaInfo?.tipo_superficie ?? 'Superficie registrada'}`}
                    </span>
                </article>

                <article className="metric-card metric-pending" style={{ borderLeft: '4px solid #eab308' }}>
                    <div className="metric-icon">◷</div>
                    <p>Pendientes de validar</p>
                    <strong>{resumen.tareasPendientes} <small>recetas</small></strong>
                    <span className="metric-trend" style={{ color: '#eab308' }}>
                        {resumen.tareasPendientes > 0 ? 'En bandeja del revisor' : 'Sin tareas pendientes'}
                    </span>
                </article>
            </section>

            {/* =========================================================================
                TABLA 1: DETALLE POR TAREA (VALIDADAS)
                ========================================================================= */}
            <Card id="tareas-validadas" className="table-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
                <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Detalle por tarea (Validadas)</h3>
                        <p className="muted" style={{ margin: '3px 0 0', fontSize: '13px' }}>Consumo consolidado de tareas completadas y documentadas</p>
                    </div>
                    <div className="table-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Link className="supervisor-header-btn" to="/supervisor/productos/nuevo">
                            <IconPlus size={15} />
                            <span>Nuevo producto</span>
                        </Link>
                        <Link className="supervisor-header-btn" to="/supervisor/comparacion">
                            <IconLayers size={15} />
                            <span>Comparación de variantes</span>
                        </Link>
                        <Link className="supervisor-header-btn" to="/supervisor/efluente">
                            <IconDroplet size={15} />
                            <span>Revisión de Efluentes</span>
                        </Link>
                        <Link className="supervisor-header-btn" to="/supervisor/reporte">
                            <IconDownload size={15} />
                            <span>Exportar reporte</span>
                        </Link>
                    </div>
                </div>
                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                    <table className="report-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead>
                            <tr>
                                <th>Tarea</th>
                                <th>Área</th>
                                <th>Superficie</th>
                                <th>Nivel suciedad</th>
                                <th>Hora inicio</th>
                                <th>Tiempo est.</th>
                                <th>Agua</th>
                                <th>Producto</th>
                                <th>Estado</th>
                                <th>Fuente</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cargando ? (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: '28px' }}>
                                        <span className="muted">Cargando datos de consumo desde Supabase...</span>
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: '36px 16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                            <p className="table-empty-title" style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                                {selectedArea === 'Todas las áreas'
                                                    ? 'No hay registros de tareas validadas disponibles.'
                                                    : `El área «${selectedArea}» no registra consumos validados aún.`}
                                            </p>
                                            <p style={{ margin: 0, color: '#64748b', fontSize: '12px' }}>
                                                {resumen.tareasPendientes > 0
                                                    ? `Hay ${resumen.tareasPendientes} receta(s) enviadas por operarios pendientes de revisión.`
                                                    : 'Las tareas aparecerán en este panel una vez que el revisor las certifique en su bandeja.'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row, idx) => (
                                    <tr key={`${row.area}-${row.task}-${row.dirtLevel ?? 'm'}-${idx}`}>
                                        <td className="task-name" style={{ fontWeight: 600, color: '#0f172a' }}>{row.task}</td>
                                        <td>{row.area}</td>
                                        <td>{formatNumber(row.surface)} m²</td>
                                        <td>
                                            <span className={`dirt-pill dirt-pill--${row.dirtLevel ?? 'media'}`}>
                                                {row.dirtLevel ? row.dirtLevel.charAt(0).toUpperCase() + row.dirtLevel.slice(1) : 'Media'}
                                            </span>
                                        </td>
                                        <td>{formatearHora(row.startTime)}</td>
                                        <td>{row.estimatedTimeMin ? `${row.estimatedTimeMin} min` : '—'}</td>
                                        <td style={{ fontWeight: 600, color: '#0284c7' }}>{formatNumber(row.water)} L</td>
                                        <td style={{ fontWeight: 600, color: '#2563eb' }}>{formatNumber(row.product)} L</td>
                                        <td><span className={`state-pill ${row.compliance === 'Cumple' ? 'ok' : 'warning'}`}><span />{row.compliance}</span></td>
                                        <td><span className="source-label">{row.source}</span>{row.simulated && <SimulatedBadge />}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* =========================================================================
                TABLA 2: PRODUCTOS QUÍMICOS CREADOS (NUEVA)
                ========================================================================= */}
            <Card id="catalogo-productos" className="table-card" style={{ marginTop: '24px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
                <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe'
                        }}>
                            <IconFlask size={22} />
                        </span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                                Catálogo de productos químicos registrados
                            </h3>
                            <p className="muted" style={{ margin: '3px 0 0', fontSize: '13px' }}>
                                Fórmulas activas, rangos de dilución recomendados, pH y compatibilidades de seguridad
                            </p>
                        </div>
                    </div>
                    <Link
                        className="primary-button"
                        to="/supervisor/productos/nuevo"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            height: '36px',
                            padding: '0 16px',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            background: '#2563eb',
                            color: '#ffffff',
                            borderRadius: '8px',
                            textDecoration: 'none'
                        }}
                    >
                        <IconPlus size={15} />
                        <span>Nuevo producto</span>
                    </Link>
                </div>

                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                    <table className="report-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13.5px' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '26%' }}>Producto químico</th>
                                <th style={{ width: '18%' }}>Categoría técnica</th>
                                <th style={{ width: '18%' }}>Rango dilución (ml/L)</th>
                                <th style={{ width: '12%' }}>pH nominal</th>
                                <th style={{ width: '16%' }}>Incompatibilidades</th>
                                <th style={{ width: '10%', textAlign: 'center' }}>FDS / SDS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cargando ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '28px' }}>
                                        <span className="muted">Cargando catálogo químico...</span>
                                    </td>
                                </tr>
                            ) : productosList.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px' }}>
                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                            No hay productos químicos registrados en el catálogo aún.
                                        </p>
                                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '12px' }}>
                                            Haz clic en «Nuevo producto» para registrar la primera fórmula técnica.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                productosList.map((prod) => (
                                    <tr key={prod.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '8px',
                                                    background: '#eff6ff',
                                                    color: '#2563eb',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '13px',
                                                    flexShrink: 0,
                                                    border: '1px solid #bfdbfe'
                                                }}>
                                                    <IconFlask size={16} />
                                                </div>
                                                <div>
                                                    <strong style={{ display: 'block', fontSize: '13.5px', color: '#0f172a' }}>
                                                        {prod.nombre}
                                                    </strong>
                                                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                                                        {prod.tipo_quimico || 'Producto formulado'}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {prod.categorias && prod.categorias.length > 0 ? (
                                                    prod.categorias.map((cat) => (
                                                        <span
                                                            key={cat}
                                                            style={{
                                                                display: 'inline-block',
                                                                background: '#f1f5f9',
                                                                color: '#334155',
                                                                border: '1px solid #cbd5e1',
                                                                borderRadius: '12px',
                                                                padding: '2px 8px',
                                                                fontSize: '11px',
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {CATEGORIA_LABELS[cat] || cat}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '12.5px', lineHeight: 1.4 }}>
                                                <span style={{ color: '#64748b' }}>Min: {prod.dilucion_min_ml_por_litro} · </span>
                                                <strong style={{ color: '#2563eb', fontWeight: 700 }}>Rec: {prod.dilucion_ml_por_litro}</strong>
                                                <span style={{ color: '#64748b' }}> · Max: {prod.dilucion_max_ml_por_litro} ml/L</span>
                                            </div>
                                        </td>
                                        <td>
                                            {prod.ph !== null && prod.ph !== undefined ? (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    background: prod.ph > 9 ? '#eff6ff' : prod.ph < 5 ? '#fef2f2' : '#f0fdf4',
                                                    color: prod.ph > 9 ? '#1d4ed8' : prod.ph < 5 ? '#b91c1c' : '#15803d',
                                                    border: `1px solid ${prod.ph > 9 ? '#bfdbfe' : prod.ph < 5 ? '#fecaca' : '#bbf7d0'}`,
                                                    padding: '3px 8px',
                                                    borderRadius: '8px',
                                                    fontSize: '12px',
                                                    fontWeight: 700
                                                }}>
                                                    pH {prod.ph}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#94a3b8', fontSize: '12px' }}>No indicado</span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {prod.incompatibilidades && prod.incompatibilidades.length > 0 ? (
                                                    prod.incompatibilidades.map((inc) => (
                                                        <span
                                                            key={inc}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '3px',
                                                                background: '#fef2f2',
                                                                color: '#b91c1c',
                                                                border: '1px solid #fecaca',
                                                                borderRadius: '12px',
                                                                padding: '2px 8px',
                                                                fontSize: '11px',
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            ✕ {CATEGORIA_LABELS[inc] || inc}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span style={{ color: '#059669', fontSize: '11.5px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                        <IconCheck size={13} /> Conforme
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {prod.url_ficha_tecnica || prod.url_hoja_seguridad ? (
                                                <a
                                                    href={prod.url_ficha_tecnica || prod.url_hoja_seguridad || '#'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title="Ver documentación PDF"
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '4px',
                                                        fontSize: '11.5px',
                                                        fontWeight: 600,
                                                        color: '#2563eb',
                                                        textDecoration: 'none',
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        background: '#eff6ff',
                                                        border: '1px solid #bfdbfe'
                                                    }}
                                                >
                                                    PDF ↗
                                                </a>
                                            ) : (
                                                <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 4px 0',
                    borderTop: '1px solid #f1f5f9',
                    marginTop: '12px',
                    fontSize: '12.5px',
                    color: '#64748b'
                }}>
                    <span>Total químicos en catálogo: <strong>{productosList.length}</strong> productos</span>
                    <span>Trazabilidad bajo norma SGA / GHS</span>
                </div>
            </Card>

            {/* =========================================================================
                TABLA 3: SITIOS Y ÁREAS REGISTRADAS (NUEVA)
                ========================================================================= */}
            <Card id="sitios-registrados" className="table-card" style={{ marginTop: '24px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
                <div className="card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe'
                        }}>
                            <IconBuilding size={22} />
                        </span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                                Sitios e infraestructura operativa
                            </h3>
                            <p className="muted" style={{ margin: '3px 0 0', fontSize: '13px' }}>
                                Plantas industriales, áreas zonificadas, tipos de superficie y volúmenes estimados de lavado
                            </p>
                        </div>
                    </div>
                    <Link
                        className="primary-button"
                        to="/supervisor/sitios/nuevo"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            height: '36px',
                            padding: '0 16px',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            background: '#2563eb',
                            color: '#ffffff',
                            borderRadius: '8px',
                            textDecoration: 'none'
                        }}
                    >
                        <IconPlus size={15} />
                        <span>Crear sitio</span>
                    </Link>
                </div>

                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                    <table className="report-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13.5px' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '24%' }}>Sitio / Planta</th>
                                <th style={{ width: '24%' }}>Zonas y áreas configuradas</th>
                                <th style={{ width: '14%' }}>Superficie total</th>
                                <th style={{ width: '16%' }}>Tipos de superficie</th>
                                <th style={{ width: '12%' }}>Solución est.</th>
                                <th style={{ width: '10%', textAlign: 'center' }}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cargando ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '28px' }}>
                                        <span className="muted">Cargando infraestructura...</span>
                                    </td>
                                </tr>
                            ) : sitiosList.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px' }}>
                                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                            No hay sitios industriales registrados aún.
                                        </p>
                                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '12px' }}>
                                            Haz clic en «Crear sitio» para configurar la primera estructura de planta.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                sitiosList.map((sitio) => {
                                    const areasDeEsteSitio = areasList.filter((a) => a.sitio_id === sitio.id);
                                    const supTotal = areasDeEsteSitio.reduce((acc, a) => acc + (Number(a.superficie_m2) || 0), 0);
                                    const solTotal = areasDeEsteSitio.reduce((acc, a) => acc + ((Number(a.superficie_m2) || 0) * (Number(a.litros_solucion_por_m2) || 0.4)), 0).toFixed(1);
                                    const tiposSupUnicos = Array.from(new Set(areasDeEsteSitio.map((a) => a.tipo_superficie).filter(Boolean)));

                                    return (
                                        <tr key={sitio.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '8px',
                                                        background: '#eff6ff',
                                                        color: '#2563eb',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '13px',
                                                        flexShrink: 0,
                                                        border: '1px solid #bfdbfe'
                                                    }}>
                                                        <IconBuilding size={16} />
                                                    </div>
                                                    <div>
                                                        <strong style={{ display: 'block', fontSize: '13.5px', color: '#0f172a' }}>
                                                            {sitio.nombre}
                                                        </strong>
                                                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                                                            {sitio.tipo || 'Planta industrial'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '12.5px' }}>
                                                        {areasDeEsteSitio.length} {areasDeEsteSitio.length === 1 ? 'área asignada' : 'áreas asignadas'}
                                                    </span>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {areasDeEsteSitio.slice(0, 3).map((a) => (
                                                            <span
                                                                key={a.id}
                                                                style={{
                                                                    fontSize: '11px',
                                                                    background: '#f8fafc',
                                                                    color: '#475569',
                                                                    border: '1px solid #e2e8f0',
                                                                    padding: '1px 6px',
                                                                    borderRadius: '6px'
                                                                }}
                                                            >
                                                                {a.nombre}
                                                            </span>
                                                        ))}
                                                        {areasDeEsteSitio.length > 3 && (
                                                            <span style={{ fontSize: '11px', color: '#64748b', alignSelf: 'center' }}>
                                                                +{areasDeEsteSitio.length - 3} más
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>
                                                    {supTotal > 0 ? `${formatNumber(supTotal)} m²` : '—'}
                                                </strong>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                    {tiposSupUnicos.length > 0 ? (
                                                        tiposSupUnicos.map((tipo) => (
                                                            <span
                                                                key={tipo}
                                                                style={{
                                                                    fontSize: '11px',
                                                                    background: '#f1f5f9',
                                                                    color: '#334155',
                                                                    border: '1px solid #cbd5e1',
                                                                    padding: '2px 7px',
                                                                    borderRadius: '10px'
                                                                }}
                                                            >
                                                                {tipo}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Piso estándar</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0284c7' }}>
                                                    ~{solTotal} L
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    fontSize: '12px',
                                                    color: '#059669',
                                                    fontWeight: 500,
                                                    background: '#f0fdf4',
                                                    border: '1px solid #bbf7d0',
                                                    padding: '3px 8px',
                                                    borderRadius: '12px'
                                                }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                                                    Activo
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 4px 0',
                    borderTop: '1px solid #f1f5f9',
                    marginTop: '12px',
                    fontSize: '12.5px',
                    color: '#64748b'
                }}>
                    <span>Total sitios registrados: <strong>{sitiosList.length}</strong> plantas</span>
                    <span>Total áreas zonificadas: <strong>{areasList.length}</strong> zonas</span>
                </div>
            </Card>

            {/* Cards inferiores de configuración y accesos */}
            <div className="supervisor-cards-grid" style={{ marginTop: '28px' }}>
                <Card className="template-card">
                    <div>
                        <p className="section-kicker"><IconFlask size={18} />  Catálogo técnico</p>
                        <h3>¿Nuevo químico de limpieza?</h3>
                        <p className="muted">Registra dosificaciones técnicas, pH e incompatibilidades de seguridad.</p>
                    </div>
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => navigate('/supervisor/productos/nuevo')}
                        style={{ whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                        <IconPlus size={15} />
                        Nuevo producto
                    </button>
                </Card>

                <Card className="template-card">
                    <div>
                        <p className="section-kicker"><IconBuilding size={18} /> Configuración rápida</p>
                        <h3>¿Necesitas configurar otro sitio?</h3>
                        <p className="muted">Crea una estructura con áreas editables y criterios de limpieza.</p>
                    </div>
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => navigate('/supervisor/sitios/nuevo')}
                        style={{ whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                        <IconPlus size={15} />
                        Crear sitio
                    </button>
                </Card>

                <Card className="template-card">
                    <div>
                        <p className="section-kicker"><IconUsers size={18} />  Equipo y accesos</p>
                        <h3>Gestión de usuarios y perfiles</h3>
                        <p className="muted">Añade operarios, revisores o supervisores, actualiza sus datos y administra credenciales.</p>
                    </div>
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => navigate('/supervisor/usuarios')}
                        style={{ whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                        <IconUsers size={15} />
                        Gestionar usuarios
                    </button>
                </Card>

                <Card className="template-card">
                    <div>
                        <p className="section-kicker"><IconLayers size={18} /> Optimización operativa</p>
                        <h3>Comparación de variantes</h3>
                        <p className="muted">Evalúa escenarios de dilución, ahorro de agua y costo químico para elegir la fórmula óptima.</p>
                    </div>
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => navigate('/supervisor/comparacion')}
                        style={{ whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                        <IconLayers size={15} />
                        Comparar variantes
                    </button>
                </Card>

                <Card className="template-card">
                    <div>
                        <p className="section-kicker"><IconDroplet size={18} /> Impacto ambiental</p>
                        <h3>Revisión de Efluentes</h3>
                        <p className="muted">Audita mediciones de pH, neutralización y criterios de vertido seguro para aguas residuales.</p>
                    </div>
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => navigate('/supervisor/efluente')}
                        style={{ whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                        <IconDroplet size={15} />
                        Revisar efluentes
                    </button>
                </Card>
            </div>
        </div>
    );
}
