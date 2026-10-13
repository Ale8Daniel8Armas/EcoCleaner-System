import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, PageHeader, Select } from '../../../components/ui';
import { obtenerConsumoSupervisor } from '../../../services/supervisor';
import { isSupabaseConfigured } from '../../../services/supabase';
import { listarTodasLasAreas } from '../../../services/sitios';
import type { AreaOperario } from '../../../services/operarioMock';
import type { ConsumptionRow } from '../../../services/supervisorMock';

const formatNumber = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value);

export default function SupervisorHome() {
    const [rows, setRows] = useState<ConsumptionRow[]>([]);
    const [areasList, setAreasList] = useState<AreaOperario[]>([]);
    const [cargando, setCargando] = useState(true);
    const [selectedArea, setSelectedArea] = useState('Todas las áreas');

    useEffect(() => {
        let activo = true;
        Promise.all([
            obtenerConsumoSupervisor(),
            listarTodasLasAreas(),
        ]).then(([dataConsumo, dataAreas]) => {
            if (!activo) return;
            setRows(dataConsumo);
            setAreasList(dataAreas);
            setCargando(false);
        });
        return () => {
            activo = false;
        };
    }, []);

    const areas = useMemo(() => {
        const nombresUnicos = new Set<string>();
        // 1. Áreas registradas en el catálogo de sitios y áreas (incluye las nuevas)
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
            <header className="supervisor-header">
                <div className="brand-lockup">
                    <span className="brand-mark">EC</span>
                    <div>
                        <p className="eyebrow">EcoCleaner / Supervisor</p>
                        <h1>Centro de control</h1>
                    </div>
                </div>
                <div className="header-actions">
                    <span className="simulated-badge">
                        <span className="status-dot" /> {isSupabaseConfigured ? 'Supabase conectado' : 'Datos simulados'}
                    </span>
                    <button className="avatar" aria-label="Perfil del supervisor">SV</button>
                </div>
            </header>

            <section className="hero-panel">
                <div>
                    <p className="eyebrow">Vista general · 11 oct 2026</p>
                    <h2>Consumo por área<br /><span>y tarea</span></h2>
                    <p className="hero-copy">Monitorea el uso de agua y producto químico para tomar decisiones operativas con datos trazables.</p>
                </div>
                <div className="hero-orbit" aria-hidden="true"><span>m²</span><b>+</b></div>
            </section>

            <PageHeader eyebrow="Panel de consumo" title="Consumo por área y tarea" description="Últimas 30 jornadas registradas">
                <Select variant="inline" label="Área" value={selectedArea} onChange={(event) => setSelectedArea(event.target.value)}>
                    {areas.map((area) => <option key={area}>{area}</option>)}
                </Select>
            </PageHeader>

            <section className="metric-grid" aria-label="Resumen de consumo">
                <article className="metric-card metric-water">
                    <div className="metric-icon">≈</div>
                    <p>Agua utilizada</p>
                    <strong>{formatNumber(totals.water)} <small>L</small></strong>
                    <span className="metric-trend">{filteredRows.length > 0 ? '↓ 8.4% vs. periodo anterior' : 'Sin consumo registrado'}</span>
                </article>
                <article className="metric-card metric-product">
                    <div className="metric-icon">◌</div>
                    <p>Producto utilizado</p>
                    <strong>{formatNumber(totals.product)} <small>L</small></strong>
                    <span className="metric-trend">{filteredRows.length > 0 ? '↓ 5.1% vs. periodo anterior' : 'Sin consumo registrado'}</span>
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
            </section>

            <Card className="table-card">
                <div className="card-heading">
                    <div><h3>Detalle por tarea</h3><p className="muted">Consumo consolidado por área y actividad</p></div>
                    <div className="table-actions">
                        <Link className="ghost-button" to="/supervisor/productos/nuevo">+ Nuevo producto</Link>
                        <Link className="ghost-button" to="/supervisor/comparacion">Comparar variantes <span>↗</span></Link>
                        <Link className="ghost-button" to="/supervisor/reporte">Exportar reporte <span>↗</span></Link>
                    </div>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Tarea</th>
                                <th>Área</th>
                                <th>Superficie</th>
                                <th>Nivel de suciedad</th>
                                <th>Agua</th>
                                <th>Producto</th>
                                <th>Estado</th>
                                <th>Fuente</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cargando ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>
                                        <span className="muted">Cargando datos de consumo...</span>
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px 16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                            <p style={{ margin: 0, color: 'var(--white)', fontSize: '14px', fontWeight: 600 }}>
                                                {selectedArea === 'Todas las áreas'
                                                    ? 'No hay registros de consumo disponibles.'
                                                    : `El área «${selectedArea}» no registra consumos de tareas aún.`}
                                            </p>
                                            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px' }}>
                                                {areaSeleccionadaInfo
                                                    ? `Esta zona está registrada con ${areaSeleccionadaInfo.superficie_m2} m² (${areaSeleccionadaInfo.tipo_superficie}). Puedes iniciar una receta para ella.`
                                                    : 'Esta zona está configurada en el sistema. Puedes calcular una receta para comenzar a registrar tareas.'}
                                            </p>
                                            <Link to="/operario/receta" className="ghost-button" style={{ marginTop: '10px' }}>
                                                Calcular receta para {selectedArea} <span>→</span>
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row, idx) => (
                                    <tr key={`${row.area}-${row.task}-${row.dirtLevel ?? 'm'}-${idx}`}>
                                        <td className="task-name">{row.task}</td>
                                        <td>{row.area}</td>
                                        <td>{formatNumber(row.surface)} m²</td>
                                        <td>
                                            <span className={`dirt-pill dirt-pill--${row.dirtLevel ?? 'media'}`}>
                                                {row.dirtLevel ? row.dirtLevel.charAt(0).toUpperCase() + row.dirtLevel.slice(1) : 'Media'}
                                            </span>
                                        </td>
                                        <td>{formatNumber(row.water)} L</td>
                                        <td>{formatNumber(row.product)} L</td>
                                        <td><span className={`state-pill ${row.compliance === 'Cumple' ? 'ok' : 'warning'}`}><span />{row.compliance}</span></td>
                                        <td><span className="source-label">{row.source}</span></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginTop: '18px' }}>
                <Card className="template-card" style={{ marginTop: 0 }}>
                    <div>
                        <p className="section-kicker">Catálogo técnico</p>
                        <h3>¿Nuevo químico de limpieza?</h3>
                        <p className="muted">Registra dosificaciones técnicas, pH e incompatibilidades de seguridad.</p>
                    </div>
                    <Link className="primary-button" to="/supervisor/productos/nuevo" style={{ whiteSpace: 'nowrap' }}>
                        Nuevo producto <span>→</span>
                    </Link>
                </Card>

                <Card className="template-card" style={{ marginTop: 0 }}>
                    <div>
                        <p className="section-kicker">Configuración rápida</p>
                        <h3>¿Necesitas configurar otro sitio?</h3>
                        <p className="muted">Crea una estructura con áreas editables y criterios de limpieza.</p>
                    </div>
                    <Link className="primary-button" to="/supervisor/sitios/nuevo" style={{ whiteSpace: 'nowrap' }}>
                        Crear sitio <span>→</span>
                    </Link>
                </Card>
            </div>
        </div>
    );
}
