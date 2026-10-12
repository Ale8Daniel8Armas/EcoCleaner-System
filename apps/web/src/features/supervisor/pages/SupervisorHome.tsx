import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, PageHeader, Select } from '../../../components/ui';
import { obtenerConsumoSupervisor } from '../../../services/supervisor';
import { isSupabaseConfigured } from '../../../services/supabase';
import type { ConsumptionRow } from '../../../services/supervisorMock';

const formatNumber = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value);

export default function SupervisorHome() {
    const [rows, setRows] = useState<ConsumptionRow[]>([]);
    const [cargando, setCargando] = useState(true);
    const [selectedArea, setSelectedArea] = useState('Todas las áreas');

    useEffect(() => {
        let activo = true;
        obtenerConsumoSupervisor().then((data) => {
            if (!activo) return;
            setRows(data);
            setCargando(false);
        });
        return () => {
            activo = false;
        };
    }, []);

    const areas = ['Todas las áreas', ...new Set(rows.map((row) => row.area))];
    const filteredRows = useMemo(
        () => selectedArea === 'Todas las áreas' ? rows : rows.filter((row) => row.area === selectedArea),
        [selectedArea, rows],
    );
    const totals = useMemo(
        () => filteredRows.reduce(
            (accumulator, row) => ({
                water: accumulator.water + row.water,
                product: accumulator.product + row.product,
                surface: accumulator.surface + row.surface,
            }),
            { water: 0, product: 0, surface: 0 },
        ),
        [filteredRows],
    );
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
                    <span className="metric-trend">↓ 8.4% vs. periodo anterior</span>
                </article>
                <article className="metric-card metric-product">
                    <div className="metric-icon">◌</div>
                    <p>Producto utilizado</p>
                    <strong>{formatNumber(totals.product)} <small>L</small></strong>
                    <span className="metric-trend">↓ 5.1% vs. periodo anterior</span>
                </article>
                <article className="metric-card metric-surface">
                    <div className="metric-icon">⌗</div>
                    <p>Superficie atendida</p>
                    <strong>{formatNumber(totals.surface)} <small>m²</small></strong>
                    <span className="metric-trend neutral">En {new Set(filteredRows.map((row) => row.area)).size} áreas activas</span>
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
                        <thead><tr><th>Tarea</th><th>Área</th><th>Superficie</th><th>Agua</th><th>Producto</th><th>Estado</th><th>Fuente</th></tr></thead>
                        <tbody>
                            {cargando ? (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>
                                        <span className="muted">Cargando datos de consumo...</span>
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => (
                                    <tr key={`${row.area}-${row.task}`}>
                                        <td className="task-name">{row.task}</td><td>{row.area}</td><td>{formatNumber(row.surface)} m²</td><td>{formatNumber(row.water)} L</td><td>{formatNumber(row.product)} L</td>
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
