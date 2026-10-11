import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../../../components/ui';
import { variantComparisons } from '../../../services/supervisorMock';

const recommended = variantComparisons.find((variant) => variant.name === 'Recomendada');
const number = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value);

export default function Comparison() {
    return <div className="supervisor-shell">
        <header className="supervisor-header">
            <div className="brand-lockup"><Link className="back-link" to="/supervisor">←</Link><div><p className="eyebrow">EcoCleaner / Supervisor</p><h1>Comparación de variantes</h1></div></div>
            <span className="simulated-badge"><span className="status-dot" /> Datos simulados</span>
        </header>
        <main className="comparison-main">
            <PageHeader eyebrow="Análisis de tarea" title="Comparación y recomendación" description="Lavado de pisos · Producción A · muestra pequeña">
                <Link className="ghost-button" to="/supervisor/reporte">Ver reporte <span>↗</span></Link>
            </PageHeader>
            <div className="comparison-notice"><strong>Regla aplicada</strong><span>Solo se recomiendan variantes con 3 repeticiones medidas que cumplen todos los criterios. Se prioriza menor producto promedio y luego agua.</span></div>
            <Card className="comparison-card">
                <div className="card-heading"><div><h3>Variantes evaluadas</h3><p className="muted">Dilución en ml/L de solución final</p></div><span className="sample-badge">Mínimo requerido: 3</span></div>
                <div className="variant-list">{variantComparisons.map((variant) => {
                    const isRecommended = variant === recommended;
                    const isRejected = variant.compliance === 'No cumple';
                    return <article className={`variant-row ${isRejected ? 'variant-rejected' : ''} ${isRecommended ? 'variant-recommended' : ''}`} key={variant.name}>
                        <div className="variant-marker">{isRecommended ? '★' : isRejected ? '!' : '○'}</div>
                        <div className="variant-main"><div className="variant-title"><h4>{variant.name}</h4>{isRecommended && <span className="recommendation-label">Recomendada</span>}{isRejected && <span className="rejected-label">Descartada</span>}</div><p>{variant.dilution} ml/L · {variant.reason}</p></div>
                        <div className="variant-metric"><small>Muestra</small><strong>{variant.sampleSize} <span>rep.</span></strong></div>
                        <div className="variant-metric"><small>Producto prom.</small><strong>{number(variant.productAverage)} <span>L</span></strong></div>
                        <div className="variant-metric"><small>Agua prom.</small><strong>{number(variant.waterAverage)} <span>L</span></strong></div>
                        <span className={`state-pill ${isRejected ? 'warning' : 'ok'}`}><span />{variant.compliance}</span>
                    </article>;
                })}</div>
            </Card>
            <Card className="recommendation-card">
                <div className="recommendation-icon">✓</div><div><p className="section-kicker">Resultado de la comparación</p><h3>Se recomienda la variante {recommended?.name.toLowerCase()}</h3><p className="muted">Cumple los criterios de limpieza en {recommended?.sampleSize} de {recommended?.sampleSize} repeticiones y presenta un consumo de {number(recommended?.productAverage ?? 0)} L de producto promedio.</p></div>
            </Card>
            <p className="data-disclaimer">Datos simulados para demostración. Esta muestra no permite extrapolar porcentajes de ahorro.</p>
        </main>
    </div>;
}
