import { Link } from 'react-router-dom';
import {
    Card,
    IconArrowLeft,
    IconClipboardCheck,
    IconFlask,
} from '../../../components/ui';
import { variantComparisons } from '../../../services/supervisorMock';

const recommended = variantComparisons.find((variant) => variant.name === 'Recomendada');
const number = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value);

export default function Comparison() {
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
                        <p className="eyebrow">EcoCleaner · Optimización Operativa y Dosificación</p>
                        <h1>Comparación y recomendación técnica de variantes</h1>
                    </div>
                </div>
                <div className="report-header-actions">
                    <Link className="supervisor-header-btn" to="/supervisor/reporte" title="Ver informe de auditoría">
                        <IconClipboardCheck size={15} />
                        <span>Ver reporte</span>
                    </Link>
                    <Link className="supervisor-header-btn" to="/supervisor/efluente" title="Control de efluentes">
                        <IconFlask size={15} />
                        <span>Control de efluentes</span>
                    </Link>
                </div>
            </header>

            <main className="report-main" style={{ maxWidth: '1000px', margin: '24px auto' }}>
                {/* Metadatos técnicos de la evaluación */}
                <Card className="report-meta-card">
                    <div className="report-meta-grid">
                        <div className="report-meta-item">
                            <span className="report-meta-label">TAREA EN ANÁLISIS</span>
                            <strong className="report-meta-val">Lavado de pisos · Producción A</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">MUESTRA REQUERIDA</span>
                            <strong className="report-meta-val">3 repeticiones documentadas</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">CRITERIO DE OPTIMIZACIÓN</span>
                            <strong className="report-meta-val">Menor químico y agua</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">ESTADO DE DECISIÓN</span>
                            <span className="report-badge-status">
                                <span className="status-dot" style={{ background: '#10b981', marginRight: '6px' }} />
                                Variante óptima identificada
                            </span>
                        </div>
                    </div>
                </Card>

                {/* Caja de regla de negocio aplicada */}
                <div className="report-note-box" style={{ marginBottom: '24px' }}>
                    <strong>Regla técnica aplicada:</strong> Solo se recomiendan variantes con al menos 3 repeticiones medidas que cumplan satisfactoriamente todos los criterios de inspección. Se prioriza el menor consumo promedio de producto concentrado y posteriormente el ahorro de agua.
                </div>

                {/* Card principal con las variantes evaluadas */}
                <Card className="report-card-section">
                    <div className="report-section-header">
                        <div>
                            <p className="section-kicker" style={{ margin: '0 0 2px' }}>Parámetros operativos</p>
                            <h3 style={{ margin: 0 }}>Variantes técnicas evaluadas</h3>
                            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                                Dilución expresada en ml de químico por litro de solución final preparada.
                            </p>
                        </div>
                        <span className="report-badge-status" style={{ background: '#f1f5f9', color: '#334155' }}>
                            Muestra mínima: 3 repeticiones
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                        {variantComparisons.map((variant) => {
                            const isRecommended = variant === recommended;
                            const isRejected = variant.compliance === 'No cumple';
                            return (
                                <article
                                    key={variant.name}
                                    className="variant-comparison-row"
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '40px minmax(200px, 1fr) 110px 140px 140px 110px',
                                        gap: '14px',
                                        alignItems: 'center',
                                        padding: '16px 20px',
                                        borderRadius: '12px',
                                        border: isRecommended
                                            ? '2px solid #2563eb'
                                            : isRejected
                                                ? '1px solid #fecaca'
                                                : '1px solid #e2e8f0',
                                        background: isRecommended
                                            ? '#f0f7ff'
                                            : isRejected
                                                ? '#fffbfb'
                                                : '#ffffff',
                                        boxShadow: isRecommended
                                            ? '0 4px 12px rgba(37, 99, 235, 0.08)'
                                            : 'none',
                                    }}
                                >
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 700,
                                        fontSize: '14px',
                                        background: isRecommended ? '#2563eb' : isRejected ? '#fee2e2' : '#f1f5f9',
                                        color: isRecommended ? '#ffffff' : isRejected ? '#dc2626' : '#64748b',
                                    }}>
                                        {isRecommended ? '★' : isRejected ? '!' : '○'}
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <h4 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: '#0f172a' }}>
                                                {variant.name}
                                            </h4>
                                            {isRecommended && (
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    background: '#2563eb',
                                                    color: '#ffffff',
                                                    padding: '2px 8px',
                                                    borderRadius: '20px'
                                                }}>
                                                    Recomendada
                                                </span>
                                            )}
                                            {isRejected && (
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    background: '#fee2e2',
                                                    color: '#dc2626',
                                                    padding: '2px 8px',
                                                    borderRadius: '20px'
                                                }}>
                                                    Descartada
                                                </span>
                                            )}
                                        </div>
                                        <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                                            {variant.dilution} ml/L · {variant.reason}
                                        </p>
                                    </div>

                                    <div>
                                        <small style={{ display: 'block', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Muestra</small>
                                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{variant.sampleSize} rep.</strong>
                                    </div>

                                    <div>
                                        <small style={{ display: 'block', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Producto prom.</small>
                                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{number(variant.productAverage)} L</strong>
                                    </div>

                                    <div>
                                        <small style={{ display: 'block', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Agua prom.</small>
                                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{number(variant.waterAverage)} L</strong>
                                    </div>

                                    <div>
                                        <span className={`state-pill ${isRejected ? 'warning' : 'ok'}`}>
                                            <span />
                                            {variant.compliance}
                                        </span>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </Card>

                {/* Card de recomendación definitiva */}
                <Card className="report-card-section" style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                    <div className="comparison-recommendation" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                        <div className="comparison-recommendation-mark" style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: '#dcfce7',
                            border: '1px solid #bbf7d0',
                            color: '#15803d',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '22px',
                            fontWeight: 700,
                            flexShrink: 0
                        }} aria-label="Variante recomendada" title="Variante recomendada">
                            ★
                        </div>
                        <div>
                            <p className="section-kicker" style={{ margin: '0 0 4px', color: '#16a34a' }}>
                                Conclusión de la comparación
                            </p>
                            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                                Se recomienda adoptar la variante «{recommended?.name.toLowerCase()}»
                            </h3>
                            <p style={{ margin: 0, fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
                                Cumple plenamente con los criterios de limpieza en {recommended?.sampleSize} de {recommended?.sampleSize} repeticiones analizadas y registra un consumo medio óptimo de <strong>{number(recommended?.productAverage ?? 0)} L</strong> de producto químico y <strong>{number(recommended?.waterAverage ?? 0)} L</strong> de agua.
                            </p>
                        </div>
                    </div>
                </Card>

                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', marginTop: '24px' }}>
                    * Datos analizados a partir de las tareas validadas en el sistema. Los consumos corresponden a los estándares registrados para las condiciones de la tarea.
                </p>
            </main>
        </div>
    );
}
