import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Card,
    IconArrowLeft,
    IconArrowUpRight,
    IconDownload,
    IconFlask,
    IconClipboardCheck,
} from '../../../components/ui';
import {
    obtenerComparacionVariantes,
    obtenerConsumoSupervisor,
    obtenerResumenSupervisor,
    obtenerUltimaDecisionEfluente,
} from '../../../services/supervisor';
import type {
    ConsumptionRow,
    EffluentDecision,
    VariantComparison,
} from '../../../services/supervisorMock';

const number = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value);

const formatearHora = (fechaIso?: string | null) => {
    if (!fechaIso) return '—';
    try {
        const d = new Date(fechaIso);
        return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
    } catch {
        return String(fechaIso);
    }
};

export default function Report() {
    const [consumption, setConsumption] = useState<ConsumptionRow[]>([]);
    const [decision, setDecision] = useState<EffluentDecision | null>(null);
    const [variants, setVariants] = useState<VariantComparison[]>([]);
    const [resumen, setResumen] = useState<{ tareasCompletadas: number; tareasPendientes: number }>({
        tareasCompletadas: 0,
        tareasPendientes: 0,
    });
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        let activo = true;
        Promise.all([
            obtenerConsumoSupervisor(),
            obtenerUltimaDecisionEfluente(),
            obtenerComparacionVariantes(),
            obtenerResumenSupervisor(),
        ]).then(([consData, decData, varData, resData]) => {
            if (!activo) return;
            setConsumption(consData);
            setDecision(decData);
            setVariants(varData);
            setResumen(resData);
            setCargando(false);
        }).catch(() => {
            if (activo) setCargando(false);
        });
        return () => {
            activo = false;
        };
    }, []);

    const totalWater = consumption.reduce((total, row) => total + row.water, 0);
    const totalProduct = consumption.reduce((total, row) => total + row.product, 0);
    const totalSurface = consumption.reduce((total, row) => total + row.surface, 0);

    const fechaHoy = new Date().toLocaleDateString('es-EC', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div className="supervisor-shell report-page">
            {/* Cabecera del Reporte */}
            <header className="supervisor-header report-header-bar">
                <div className="brand-lockup">
                    <Link className="supervisor-header-btn no-print" to="/supervisor" title="Volver al panel principal">
                        <IconArrowLeft size={16} />
                        <span>Volver al panel</span>
                    </Link>
                    <div>
                        <p className="eyebrow">EcoCleaner · Auditoría y Control de Operación</p>
                        <h1>Informe técnico de consumos y trazabilidad</h1>
                    </div>
                </div>
                <div className="report-header-actions no-print">
                    <Link className="supervisor-header-btn" to="/supervisor/comparacion" title="Comparar variantes técnicas">
                        <IconArrowUpRight size={15} />
                        <span>Comparar variantes</span>
                    </Link>
                    <Link className="supervisor-header-btn" to="/supervisor/efluente" title="Control ambiental de efluente">
                        <IconFlask size={15} />
                        <span>Control de efluentes</span>
                    </Link>
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => window.print()}
                        title="Imprimir o exportar reporte en PDF"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', height: '34px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                        <IconDownload size={15} />
                        <span
                        >Exportar / Imprimir PDF</span>
                    </button>
                </div>
            </header>

            <main className="report-main">
                {/* Banner de Ficha Técnica / Metadatos de Auditoría */}
                <Card className="report-meta-card">
                    <div className="report-meta-grid">
                        <div className="report-meta-item">
                            <span className="report-meta-label">DOCUMENTO DE AUDITORÍA</span>
                            <strong className="report-meta-val">FOLIO: REP-2026-P0</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">FECHA DE EMISIÓN</span>
                            <strong className="report-meta-val">{fechaHoy}</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">RESPONSABLE TÉCNICO</span>
                            <strong className="report-meta-val">Supervisor de Planta</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">ESTADO DE TRAZABILIDAD</span>
                            <span className="report-badge-status">
                                <span className="status-dot" style={{ background: '#10b981', marginRight: '6px' }} />
                                100% Conforme y validado
                            </span>
                        </div>
                    </div>
                </Card>

                {/* Métricas Principales (Grid de 4 Cards uniformes) */}
                <section className="report-metrics-grid" aria-label="Métricas consolidadas de consumo">
                    <Card className="report-metric-card">
                        <div className="report-metric-top">
                            <span className="report-metric-title">Agua total utilizada</span>
                            <span className="report-metric-icon">💧</span>
                        </div>
                        <strong className="report-metric-val">{number(totalWater)} <small>L</small></strong>
                        <span className="report-metric-sub">Volumen en tareas certificadas</span>
                    </Card>

                    <Card className="report-metric-card">
                        <div className="report-metric-top">
                            <span className="report-metric-title">Producto químico total</span>
                            <span className="report-metric-icon">🧪</span>
                        </div>
                        <strong className="report-metric-val">{number(totalProduct)} <small>L</small></strong>
                        <span className="report-metric-sub">Dosificación activa consolidada</span>
                    </Card>

                    <Card className="report-metric-card">
                        <div className="report-metric-top">
                            <span className="report-metric-title">Superficie intervenida</span>
                            <span className="report-metric-icon">📐</span>
                        </div>
                        <strong className="report-metric-val">{number(totalSurface)} <small>m²</small></strong>
                        <span className="report-metric-sub">Área total con limpieza ejecutada</span>
                    </Card>

                    <Card className="report-metric-card">
                        <div className="report-metric-top">
                            <span className="report-metric-title">Tareas validadas</span>
                            <span className="report-metric-icon">
                                <IconClipboardCheck size={18} />
                            </span>
                        </div>
                        <strong className="report-metric-val">{consumption.length} <small>completadas</small></strong>
                        <span className="report-metric-sub" style={{ color: resumen.tareasPendientes > 0 ? '#b45309' : '#15803d' }}>
                            {resumen.tareasPendientes > 0 ? `${resumen.tareasPendientes} pendientes en revisión` : 'Todas certificadas al día'}
                        </span>
                    </Card>
                </section>

                {/* Sección 1: Tabla detallada de consumo */}
                <Card className="report-card-section">
                    <div className="report-section-header">
                        <div>
                            <h3>Detalle de consumo por sitio y tarea (Tareas Validadas)</h3>
                            <p className="muted">Registro consolidado de tareas ejecutadas por operarios y contrastadas por el revisor técnico</p>
                        </div>
                    </div>
                    <div className="table-wrap">
                        <table className="report-table">
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
                                    <th>Resultado</th>
                                    <th>Fuente</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cargando ? (
                                    <tr>
                                        <td colSpan={10} style={{ textAlign: 'center', padding: '24px' }}>
                                            <span className="muted">Cargando registros consolidados...</span>
                                        </td>
                                    </tr>
                                ) : consumption.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} style={{ textAlign: 'center', padding: '24px' }}>
                                            <span className="muted">No hay tareas completadas y validadas registradas aún.</span>
                                        </td>
                                    </tr>
                                ) : (
                                    consumption.map((row, idx) => (
                                        <tr key={`${row.area}-${row.task}-${idx}`}>
                                            <td className="task-name">{row.task}</td>
                                            <td>{row.area}</td>
                                            <td>{number(row.surface)} m²</td>
                                            <td>
                                                <span className={`dirt-pill dirt-pill--${row.dirtLevel ?? 'media'}`}>
                                                    {row.dirtLevel ? row.dirtLevel.charAt(0).toUpperCase() + row.dirtLevel.slice(1) : 'Media'}
                                                </span>
                                            </td>
                                            <td>{formatearHora(row.startTime)}</td>
                                            <td>{row.estimatedTimeMin ? `${row.estimatedTimeMin} min` : '—'}</td>
                                            <td><strong>{number(row.water)} L</strong></td>
                                            <td><strong>{number(row.product)} L</strong></td>
                                            <td>
                                                <span className={`state-pill ${row.compliance === 'Cumple' ? 'ok' : 'warning'}`}>
                                                    <span />
                                                    {row.compliance}
                                                </span>
                                            </td>
                                            <td><span className="source-label">{row.source}</span></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {consumption.length > 0 && (
                                <tfoot>
                                    <tr className="report-table-total-row">
                                        <td colSpan={2}><strong>Totales acumulados ({consumption.length} tareas)</strong></td>
                                        <td><strong>{number(totalSurface)} m²</strong></td>
                                        <td colSpan={3}>—</td>
                                        <td><strong>{number(totalWater)} L</strong></td>
                                        <td><strong>{number(totalProduct)} L</strong></td>
                                        <td colSpan={2}><strong>100% Conforme</strong></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </Card>

                {/* Sección 2: Comparativa de variantes técnicas */}
                <Card className="report-card-section">
                    <div className="report-section-header">
                        <div>
                            <h3>Evaluación técnica de variantes de dosificación</h3>
                            <p className="muted">Control comparativo de diluciones sugeridas frente a consumos reales medidos</p>
                        </div>
                    </div>
                    <div className="table-wrap">
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Variante</th>
                                    <th>Dilución técnica</th>
                                    <th>Muestra evaluada</th>
                                    <th>Consumo medio químico</th>
                                    <th>Consumo medio agua</th>
                                    <th>Criterio técnico de validación</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {variants.map((variant) => (
                                    <tr key={variant.name}>
                                        <td className="task-name">{variant.name}</td>
                                        <td>{variant.dilution} ml/L</td>
                                        <td>{variant.sampleSize} repeticiones</td>
                                        <td><strong>{number(variant.productAverage)} L</strong></td>
                                        <td>{number(variant.waterAverage)} L</td>
                                        <td><span className="muted" style={{ fontSize: '12px' }}>{variant.reason}</span></td>
                                        <td>
                                            <span className={`state-pill ${variant.compliance === 'Cumple' ? 'ok' : 'warning'}`}>
                                                <span />
                                                {variant.compliance}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Sección 3: Dictamen ambiental de efluentes */}
                {decision && (
                    <Card className="report-card-section">
                        <div className="report-section-header">
                            <div>
                                <h3>Dictamen de vertido y control ambiental de efluente</h3>
                                <p className="muted">Parámetros de desecho, verificación de pH y disposición final autorizada</p>
                            </div>
                            <span className="report-badge-status" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                                Cumplimiento ambiental
                            </span>
                        </div>
                        <div className="effluent-report-grid-card">
                            <div className="effluent-col">
                                <span className="effluent-label">Sitio y punto de vertido</span>
                                <strong className="effluent-val">{decision.site} · {decision.area}</strong>
                                <span className="muted" style={{ fontSize: '12px' }}>Tarea: {decision.task}</span>
                            </div>
                            <div className="effluent-col">
                                <span className="effluent-label">Orientación ambiental</span>
                                <strong className="effluent-val">{decision.orientation}</strong>
                            </div>
                            <div className="effluent-col">
                                <span className="effluent-label">Dictamen registrado</span>
                                <strong className="effluent-val" style={{ color: '#0f172a' }}>{decision.decision}</strong>
                            </div>
                            <div className="effluent-col">
                                <span className="effluent-label">pH verificado</span>
                                <strong className="effluent-val" style={{ color: '#2563eb' }}>{decision.ph ?? 'Sin registro'}</strong>
                                <small className="muted">{decision.phOrigin}</small>
                            </div>
                        </div>
                        <div className="report-note-box">
                            <strong>Fundamento técnico:</strong> {decision.reason}
                        </div>
                    </Card>
                )}

                {/* Bloque de Firmas para Auditoría (Visible en pantalla e Impresión) */}
                <div className="report-signatures-grid">
                    <div className="signature-box">
                        <div className="signature-line" />
                        <strong>Supervisor Técnico de Planta</strong>
                        <span>Responsable de Operación y Dosificación</span>
                    </div>
                    <div className="signature-box">
                        <div className="signature-line" />
                        <strong>Revisor de Calidad y Procesos</strong>
                        <span>Certificación y Validación Técnica</span>
                    </div>
                </div>

                <footer className="report-footer">
                    EcoCleaner System · Reporte técnico operativo emitido con datos certificados · Sistema auditado.
                </footer>
            </main>
        </div>
    );
}
