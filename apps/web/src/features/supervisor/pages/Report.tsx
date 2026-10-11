import { Link } from 'react-router-dom';
import { Button, Card, PageHeader } from '../../../components/ui';
import { effluentDecision, supervisorConsumption, variantComparisons } from '../../../services/supervisorMock';

const number = (value: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value);

export default function Report() {
    const totalWater = supervisorConsumption.reduce((total, row) => total + row.water, 0);
    const totalProduct = supervisorConsumption.reduce((total, row) => total + row.product, 0);
    return <div className="supervisor-shell report-page">
        <header className="supervisor-header report-toolbar">
            <div className="brand-lockup"><Link className="back-link no-print" to="/supervisor">←</Link><div><p className="eyebrow">EcoCleaner / Supervisor</p><h1>Reporte de operación</h1></div></div>
            <Button className="no-print" onClick={() => window.print()}>Imprimir / Exportar PDF <span>↗</span></Button>
        </header>
        <main className="report-main">
            <PageHeader eyebrow="Reporte P0 · Datos simulados" title="Resumen de consumo y efluente" description="Planta Norte · 12 septiembre — 11 octubre 2026"><Link className="ghost-button no-print" to="/supervisor/efluente">Ver efluente <span>↗</span></Link></PageHeader>
            <section className="report-summary"><Card><p>Agua total</p><strong>{number(totalWater)} L</strong></Card><Card><p>Producto total</p><strong>{number(totalProduct)} L</strong></Card><Card><p>Tareas registradas</p><strong>{supervisorConsumption.length}</strong></Card></section>
            <Card className="report-section"><h3>Consumo por sitio y tarea</h3><table><thead><tr><th>Tarea</th><th>Área</th><th>Agua</th><th>Producto</th><th>Resultado</th></tr></thead><tbody>{supervisorConsumption.map((row) => <tr key={`${row.area}-${row.task}`}><td>{row.task}</td><td>{row.area}</td><td>{number(row.water)} L</td><td>{number(row.product)} L</td><td><span className={`state-pill ${row.compliance === 'Cumple' ? 'ok' : 'warning'}`}><span />{row.compliance}</span></td></tr>)}</tbody></table></Card>
            <Card className="report-section"><h3>Resultados y recomendación</h3><p className="muted">Lavado de pisos · Producción A · tamaño de muestra: 3 repeticiones mínimas</p><table><thead><tr><th>Variante</th><th>Muestra</th><th>Producto promedio</th><th>Estado</th></tr></thead><tbody>{variantComparisons.map((variant) => <tr key={variant.name}><td>{variant.name} ({variant.dilution} ml/L)</td><td>{variant.sampleSize}</td><td>{number(variant.productAverage)} L</td><td>{variant.compliance}</td></tr>)}</tbody></table></Card>
            <Card className="report-section"><h3>Decisión de efluente</h3><div className="effluent-report-grid"><div><p className="muted">Sitio / área / tarea</p><strong>{effluentDecision.site} · {effluentDecision.area} · {effluentDecision.task}</strong></div><div><p className="muted">Orientación</p><strong>{effluentDecision.orientation}</strong></div><div><p className="muted">Decisión registrada</p><strong>{effluentDecision.decision}</strong></div><div><p className="muted">pH del efluente</p><strong>{effluentDecision.ph ?? 'No disponible'}</strong><small>{effluentDecision.phOrigin}</small></div></div><p className="report-note">{effluentDecision.reason}</p></Card>
            <footer className="report-footer">EcoCleaner · Reporte generado el 11 de octubre de 2026 · Los datos simulados no son evidencia de ahorro ni autorización ambiental.</footer>
        </main>
    </div>;
}
