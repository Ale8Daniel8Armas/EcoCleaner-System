import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, PageHeader } from '../../../components/ui';
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
        });
        return () => {
            activo = false;
        };
    }, []);

    const totalWater = consumption.reduce((total, row) => total + row.water, 0);
    const totalProduct = consumption.reduce((total, row) => total + row.product, 0);

    return <div className="supervisor-shell report-page">
        <header className="supervisor-header report-toolbar">
            <div className="brand-lockup"><Link className="back-link no-print" to="/supervisor">←</Link><div><p className="eyebrow">EcoCleaner / Supervisor</p><h1>Reporte de operación</h1></div></div>
            <Button className="no-print" onClick={() => window.print()}>Imprimir / Exportar PDF <span>↗</span></Button>
        </header>
        <main className="report-main">
            <PageHeader eyebrow="Reporte P0 · Trazabilidad" title="Resumen de consumo y efluente" description="Registro consolidado de tareas validadas y vertidos"><Link className="ghost-button no-print" to="/supervisor/efluente">Ver efluente <span>↗</span></Link></PageHeader>
            <section className="report-summary">
                <Card><p>Agua total</p><strong>{number(totalWater)} L</strong></Card>
                <Card><p>Producto total</p><strong>{number(totalProduct)} L</strong></Card>
                <Card><p>Tareas validadas</p><strong>{consumption.length}</strong></Card>
                <Card><p>Pendientes de validar</p><strong style={{ color: '#eab308' }}>{resumen.tareasPendientes}</strong></Card>
            </section>
            <Card className="report-section">
                <h3>Consumo por sitio y tarea (Completadas)</h3>
                <table>
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
                        </tr>
                    </thead>
                    <tbody>
                        {consumption.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}>
                                    <span className="muted">No hay tareas completadas y validadas registradas aún.</span>
                                </td>
                            </tr>
                        ) : (
                            consumption.map((row, idx) => (
                                <tr key={`${row.area}-${row.task}-${idx}`}>
                                    <td>{row.task}</td>
                                    <td>{row.area}</td>
                                    <td>{number(row.surface)} m²</td>
                                    <td>
                                        <span className={`dirt-pill dirt-pill--${row.dirtLevel ?? 'media'}`}>
                                            {row.dirtLevel ? row.dirtLevel.charAt(0).toUpperCase() + row.dirtLevel.slice(1) : 'Media'}
                                        </span>
                                    </td>
                                    <td>{formatearHora(row.startTime)}</td>
                                    <td>{row.estimatedTimeMin ? `${row.estimatedTimeMin} min` : '—'}</td>
                                    <td>{number(row.water)} L</td>
                                    <td>{number(row.product)} L</td>
                                    <td><span className={`state-pill ${row.compliance === 'Cumple' ? 'ok' : 'warning'}`}><span />{row.compliance}</span></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Card>
            <Card className="report-section"><h3>Resultados y recomendación</h3><p className="muted">Lavado de pisos · Producción A · tamaño de muestra: 3 repeticiones mínimas</p><table><thead><tr><th>Variante</th><th>Muestra</th><th>Producto promedio</th><th>Estado</th></tr></thead><tbody>{variants.map((variant) => <tr key={variant.name}><td>{variant.name} ({variant.dilution} ml/L)</td><td>{variant.sampleSize}</td><td>{number(variant.productAverage)} L</td><td>{variant.compliance}</td></tr>)}</tbody></table></Card>
            {decision && (
                <Card className="report-section"><h3>Decisión de efluente</h3><div className="effluent-report-grid"><div><p className="muted">Sitio / área / tarea</p><strong>{decision.site} · {decision.area} · {decision.task}</strong></div><div><p className="muted">Orientación</p><strong>{decision.orientation}</strong></div><div><p className="muted">Decisión registrada</p><strong>{decision.decision}</strong></div><div><p className="muted">pH del efluente</p><strong>{decision.ph ?? 'No disponible'}</strong><small>{decision.phOrigin}</small></div></div><p className="report-note">{decision.reason}</p></Card>
            )}
            <footer className="report-footer">EcoCleaner · Reporte operativo · Los datos simulados no son evidencia de ahorro ni autorización ambiental.</footer>
        </main>
    </div>;
}
