import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, PageHeader } from '../../../components/ui';
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

    return <div className="supervisor-shell">
        <header className="supervisor-header">
            <div className="brand-lockup"><Link className="back-link" to="/supervisor">←</Link><div><p className="eyebrow">EcoCleaner / Supervisor</p><h1>Seguimiento de efluente</h1></div></div>
            <span className="simulated-badge"><span className="status-dot" /> Datos trazables</span>
        </header>
        <main className="effluent-main">
            <PageHeader eyebrow="Trazabilidad ambiental" title="Orientación de efluente" description="Consulta la orientación y decisión registrada al finalizar la tarea.">
                <Link className="ghost-button" to="/supervisor/reporte">Ver reporte <span>↗</span></Link>
            </PageHeader>
            <Card className="effluent-hero-card">
                <div className="effluent-status-icon">!</div>
                <div><p className="section-kicker">Orientación registrada</p><h2>{decisionActiva.orientation}</h2><p className="muted">{decisionActiva.reason}</p></div>
            </Card>
            <div className="effluent-data-grid">
                <Card><p className="section-kicker">Contexto</p><h3>{decisionActiva.site}</h3><p className="muted">{decisionActiva.area} · {decisionActiva.task}</p></Card>
                <Card><p className="section-kicker">Decisión final</p><h3>{decisionActiva.decision}</h3><p className="muted">Registrada para este resultado</p></Card>
                <Card><p className="section-kicker">pH del efluente</p><h3>{decisionActiva.ph ?? 'No disponible'}</h3><p className="muted">{decisionActiva.phOrigin}</p></Card>
            </div>
            <Card className="effluent-guidance"><h3>Reglas aplicadas</h3><ul><li>La ausencia de una medición final impide autorizar un vertido.</li><li>El software orienta y documenta; no neutraliza físicamente el efluente.</li><li>Los sobrantes concentrados se derivan de forma conservadora a un gestor autorizado.</li></ul><Button variant="ghost" type="button">Decisión registrada ✓</Button></Card>
        </main>
    </div>;
}
