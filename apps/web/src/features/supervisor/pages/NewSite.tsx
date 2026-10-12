import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Field, PageHeader } from '../../../components/ui';
import { siteTemplates } from '../../../services/supervisorMock';

type AreaDraft = {
    name: string;
    surface: string;
    surfaceType: string;
    solutionPerM2: string;
};

const areasFromTemplate = (areas: string[]): AreaDraft[] => areas.map((name) => ({
    name,
    surface: '100',
    surfaceType: 'Piso industrial',
    solutionPerM2: '0.4',
}));

export default function NewSite() {
    const [selectedTemplate, setSelectedTemplate] = useState(siteTemplates[0].id);
    const [siteName, setSiteName] = useState('');
    const [criteria, setCriteria] = useState('Superficie visualmente limpia y sin residuos visibles');
    const [areaDrafts, setAreaDrafts] = useState(() => areasFromTemplate(siteTemplates[0].areas));
    const [createdSite, setCreatedSite] = useState('');
    const template = siteTemplates.find((item) => item.id === selectedTemplate) ?? siteTemplates[0];
    const selectTemplate = (templateId: string) => {
        setSelectedTemplate(templateId);
        const nextTemplate = siteTemplates.find((item) => item.id === templateId);
        setAreaDrafts(areasFromTemplate(nextTemplate?.areas ?? []));
    };
    const updateArea = (index: number, field: keyof AreaDraft, value: string) => {
        setAreaDrafts((current) => current.map((area, areaIndex) => areaIndex === index ? { ...area, [field]: value } : area));
    };

    return <div className="supervisor-shell">
        <header className="supervisor-header">
            <div className="brand-lockup"><Link className="back-link" to="/supervisor">←</Link><div><p className="eyebrow">EcoCleaner / Supervisor</p><h1>Nuevo sitio</h1></div></div>
            <span className="simulated-badge"><span className="status-dot" /> Datos simulados</span>
        </header>
        <main className="new-site-main">
            <PageHeader eyebrow="Configuración" title="Crear sitio desde plantilla" description="Prepara la estructura del sitio y sus áreas para comenzar a registrar tareas." />
            <Card className="new-site-card">
                <p className="section-kicker">1 / Plantilla base</p>
                <div className="template-options">{siteTemplates.map((item) => <button key={item.id} type="button" className={`template-option ${selectedTemplate === item.id ? 'selected' : ''}`} onClick={() => selectTemplate(item.id)}><span className="template-radio" /><span><strong>{item.name}</strong><small>{item.description}</small></span></button>)}</div>
                <Field id="site-name" label="Nombre del sitio" value={siteName} onChange={(event) => setSiteName(event.target.value)} placeholder="Ej. Planta Norte" />
                <p className="form-section-label">2 / Áreas y parámetros</p>
                <div className="area-drafts">{areaDrafts.map((area, index) => <div className="area-draft" key={`${area.name}-${index}`}>
                    <strong>{area.name || `Área ${index + 1}`}</strong>
                    <input aria-label={`Nombre del área ${index + 1}`} value={area.name} onChange={(event) => updateArea(index, 'name', event.target.value)} placeholder="Nombre del área" />
                    <input aria-label={`Superficie del área ${index + 1}`} type="number" min="0.1" step="0.1" value={area.surface} onChange={(event) => updateArea(index, 'surface', event.target.value)} placeholder="m²" />
                    <input aria-label={`Tipo de superficie del área ${index + 1}`} value={area.surfaceType} onChange={(event) => updateArea(index, 'surfaceType', event.target.value)} placeholder="Tipo de superficie" />
                    <input aria-label={`Litros por metro cuadrado del área ${index + 1}`} type="number" min="0.01" step="0.01" value={area.solutionPerM2} onChange={(event) => updateArea(index, 'solutionPerM2', event.target.value)} placeholder="L/m²" />
                </div>)}</div>
                <label className="site-name-label" htmlFor="cleaning-criteria">Criterio de limpieza<textarea id="cleaning-criteria" value={criteria} onChange={(event) => setCriteria(event.target.value)} /></label>
                <p className="template-preview"><strong>{template.areas.length || 'Sin'} áreas</strong> precargadas. Los campos quedan editables antes de guardar el sitio.</p>
                <div className="new-site-actions"><Link className="cancel-link" to="/supervisor">Cancelar</Link><Button disabled={!siteName.trim()} onClick={() => setCreatedSite(siteName.trim())}>Crear sitio <span>→</span></Button></div>
                {createdSite && <p className="success-message">Sitio “{createdSite}” creado como borrador. El siguiente paso es ajustar sus áreas y criterios.</p>}
            </Card>
        </main>
    </div>;
}
