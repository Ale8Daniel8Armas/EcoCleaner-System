import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Card,
    IconArrowLeft,
    IconArrowUpRight,
    IconClipboardCheck,
    IconCheck,
} from '../../../components/ui';
import { obtenerUltimaDecisionEfluente } from '../../../services/supervisor';
import type { EffluentDecision } from '../../../services/supervisorMock';

export default function Effluent() {
    const [decision, setDecision] = useState<EffluentDecision | null>(null);

    useEffect(() => {
        let activo = true;
        obtenerUltimaDecisionEfluente().then((data) => {
            if (!activo) return;
            setDecision(data);
        });
        return () => {
            activo = false;
        };
    }, []);

    const decisionActiva = decision ?? {
        site: 'Planta Norte',
        area: 'Producción A',
        task: 'Lavado de pisos',
        orientation: 'No disponible' as const,
        decision: 'Pendiente de registro' as const,
        ph: null,
        phOrigin: 'Sin medición analítica final',
        reason: 'Sin registros recientes.',
    };

    const esVertidoPermitido = decisionActiva.decision.toLowerCase().includes('vertido directo') || decisionActiva.orientation.toLowerCase().includes('neutral');

    return (
        <div className="supervisor-shell report-page">
            {/* Cabecera idéntica al reporte */}
            <header className="supervisor-header report-header-bar">
                <div className="brand-lockup">
                    <Link className="supervisor-header-btn" to="/supervisor" title="Volver al panel principal">
                        <IconArrowLeft size={16} />
                        <span>Volver al panel</span>
                    </Link>
                    <div>
                        <p className="eyebrow">EcoCleaner · Trazabilidad Ambiental y Descargas</p>
                        <h1>Control y orientación ambiental de efluentes</h1>
                    </div>
                </div>
                <div className="report-header-actions">
                    <Link className="supervisor-header-btn" to="/supervisor/reporte" title="Ver informe de auditoría">
                        <IconClipboardCheck size={15} />
                        <span>Ver reporte</span>
                    </Link>
                    <Link className="supervisor-header-btn" to="/supervisor/comparacion" title="Comparar variantes técnicas">
                        <IconArrowUpRight size={15} />
                        <span>Comparar variantes</span>
                    </Link>
                </div>
            </header>

            <main className="report-main" style={{ maxWidth: '1000px', margin: '24px auto' }}>
                {/* Metadatos consolidados del efluente */}
                <Card className="report-meta-card">
                    <div className="report-meta-grid">
                        <div className="report-meta-item">
                            <span className="report-meta-label">SITIO DE CONTROL</span>
                            <strong className="report-meta-val">{decisionActiva.site}</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">ÁREA Y TAREA</span>
                            <strong className="report-meta-val">{decisionActiva.area} · {decisionActiva.task}</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">PH MEDICIÓN FINAL</span>
                            <strong className="report-meta-val">{decisionActiva.ph !== null ? `${decisionActiva.ph}` : 'Sin medición'}</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">ESTADO DE DISPOSICIÓN</span>
                            <span className="report-badge-status" style={{
                                background: esVertidoPermitido ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                color: esVertidoPermitido ? '#059669' : '#b45309'
                            }}>
                                <span className="status-dot" style={{
                                    background: esVertidoPermitido ? '#10b981' : '#f59e0b',
                                    marginRight: '6px'
                                }} />
                                {decisionActiva.orientation}
                            </span>
                        </div>
                    </div>
                </Card>

                {/* Hero card con la orientación registrada */}
                <Card className="report-card-section" style={{
                    background: esVertidoPermitido ? '#f0fdf4' : '#fffbeb',
                    border: `1px solid ${esVertidoPermitido ? '#bbf7d0' : '#fde68a'}`,
                    padding: '24px 28px',
                    marginBottom: '20px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '50%',
                            background: esVertidoPermitido ? '#16a34a' : '#f59e0b',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '24px',
                            fontWeight: 800,
                            flexShrink: 0
                        }}>
                            {esVertidoPermitido ? '✓' : '!'}
                        </div>
                        <div>
                            <p className="section-kicker" style={{
                                margin: '0 0 4px',
                                color: esVertidoPermitido ? '#15803d' : '#b45309',
                                fontWeight: 700
                            }}>
                                Orientación ambiental registrada
                            </p>
                            <h2 style={{
                                margin: '0 0 6px',
                                fontSize: '22px',
                                fontWeight: 700,
                                color: '#0f172a'
                            }}>
                                {decisionActiva.orientation}
                            </h2>
                            <p style={{
                                margin: 0,
                                fontSize: '14px',
                                color: '#475569',
                                lineHeight: 1.5
                            }}>
                                {decisionActiva.reason}
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Grid de 3 cards con el desglose técnico */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <Card className="report-card-section" style={{ margin: 0, padding: '20px' }}>
                        <p className="section-kicker" style={{ margin: '0 0 4px' }}>Contexto Operativo</p>
                        <h3 style={{ margin: '0 0 4px', fontSize: '18px', color: '#0f172a' }}>{decisionActiva.site}</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{decisionActiva.area} · {decisionActiva.task}</p>
                    </Card>

                    <Card className="report-card-section" style={{ margin: 0, padding: '20px' }}>
                        <p className="section-kicker" style={{ margin: '0 0 4px' }}>Decisión Final</p>
                        <h3 style={{ margin: '0 0 4px', fontSize: '18px', color: '#0f172a' }}>{decisionActiva.decision}</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Protocolo registrado para este efluente</p>
                    </Card>

                    <Card className="report-card-section" style={{ margin: 0, padding: '20px' }}>
                        <p className="section-kicker" style={{ margin: '0 0 4px' }}>pH del Efluente</p>
                        <h3 style={{ margin: '0 0 4px', fontSize: '18px', color: '#0f172a' }}>
                            {decisionActiva.ph !== null ? decisionActiva.ph : 'No disponible'}
                        </h3>
                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{decisionActiva.phOrigin}</p>
                    </Card>
                </div>

                {/* Card de directrices y reglas ambientales */}
                <Card className="report-card-section">
                    <div className="report-section-header">
                        <div>
                            <p className="section-kicker" style={{ margin: '0 0 2px' }}>Marco Normativo</p>
                            <h3 style={{ margin: 0 }}>Reglas y directrices de descarga aplicadas</h3>
                        </div>
                    </div>

                    <ul style={{ margin: '14px 0 24px', paddingLeft: '22px', color: '#334155', fontSize: '13.5px', lineHeight: 1.8 }}>
                        <li>La ausencia de una medición analítica final en sitio impide autorizar un vertido a la red general.</li>
                        <li>El software orienta y documenta la trazabilidad técnica; no sustituye la neutralización física del efluente.</li>
                        <li>Los sobrantes concentrados se derivan de forma conservadora a un gestor ambiental autorizado según FDS/HDS.</li>
                    </ul>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                            Estado de auditoría ambiental: Conforme con protocolo
                        </span>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '12.5px',
                            fontWeight: 600
                        }}>
                            <IconCheck size={15} />
                            <span>Decisión registrada y documentada</span>
                        </div>
                    </div>
                </Card>
            </main>
        </div>
    );
}
