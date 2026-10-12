import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Field, PageHeader } from '../../../components/ui';
import { siteTemplates } from '../../../services/supervisorMock';
import { crearSitioConAreas } from '../../../services/sitios';
import { isSupabaseConfigured } from '../../../services/supabase';
import { tiposSuperficie } from '../../../services/operarioMock';

type AreaDraft = {
    id: string;
    name: string;
    surface: string;
    surfaceType: string;
    solutionPerM2: string;
};

const ZONAS_SUGERIDAS = [
    { name: 'Producción', surface: '150', surfaceType: 'Piso industrial', solutionPerM2: '0.4' },
    { name: 'Almacén', surface: '120', surfaceType: 'Piso epóxico', solutionPerM2: '0.3' },
    { name: 'Muelles de carga', surface: '80', surfaceType: 'Hormigón', solutionPerM2: '0.5' },
    { name: 'Envasado y empaque', surface: '100', surfaceType: 'Piso epóxico', solutionPerM2: '0.4' },
    { name: 'Cámaras frigoríficas', surface: '60', surfaceType: 'Acero inoxidable', solutionPerM2: '0.35' },
    { name: 'Sanitarios / Vestuarios', surface: '40', surfaceType: 'Cerámica', solutionPerM2: '0.3' },
    { name: 'Laboratorio de control', surface: '50', surfaceType: 'Piso epóxico', solutionPerM2: '0.25' },
    { name: 'Pasillos y tránsito', surface: '90', surfaceType: 'Piso industrial', solutionPerM2: '0.3' },
];

const areasFromTemplate = (areas: string[], tplId: string): AreaDraft[] => areas.map((name, i) => ({
    id: `tpl-${tplId}-${i}-${Date.now()}`,
    name,
    surface: '100',
    surfaceType: 'Piso industrial',
    solutionPerM2: '0.4',
}));

export default function NewSite() {
    const [selectedTemplate, setSelectedTemplate] = useState(siteTemplates[0].id);
    const [siteName, setSiteName] = useState('');
    const [criteria, setCriteria] = useState('Superficie visualmente limpia y sin residuos visibles\nSin charcos ni acumulación de agua');
    const [areaDrafts, setAreaDrafts] = useState<AreaDraft[]>(() => areasFromTemplate(siteTemplates[0].areas, siteTemplates[0].id));
    const [createdSite, setCreatedSite] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const template = siteTemplates.find((item) => item.id === selectedTemplate) ?? siteTemplates[0];

    const selectTemplate = (templateId: string) => {
        setSelectedTemplate(templateId);
        const nextTemplate = siteTemplates.find((item) => item.id === templateId);
        setAreaDrafts(areasFromTemplate(nextTemplate?.areas ?? [], templateId));
    };

    const addArea = (preset?: Partial<AreaDraft>) => {
        setAreaDrafts((current) => [
            ...current,
            {
                id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                name: preset?.name ?? `Área ${current.length + 1}`,
                surface: preset?.surface ?? '100',
                surfaceType: preset?.surfaceType ?? 'Piso industrial',
                solutionPerM2: preset?.solutionPerM2 ?? '0.4',
            },
        ]);
    };

    const removeArea = (id: string) => {
        setAreaDrafts((current) => current.filter((area) => area.id !== id));
    };

    const updateArea = (id: string, field: keyof AreaDraft, value: string) => {
        setAreaDrafts((current) => current.map((area) => area.id === id ? { ...area, [field]: value } : area));
    };

    const totalSuperficie = useMemo(
        () => areaDrafts.reduce((acc, a) => acc + (parseFloat(a.surface) || 0), 0),
        [areaDrafts]
    );

    const totalSolucionLitros = useMemo(
        () => areaDrafts.reduce((acc, a) => acc + ((parseFloat(a.surface) || 0) * (parseFloat(a.solutionPerM2) || 0)), 0).toFixed(1),
        [areaDrafts]
    );

    const areasValidas = areaDrafts.length > 0 && areaDrafts.every((a) => a.name.trim().length > 0 && (parseFloat(a.surface) || 0) > 0);
    const formularioValido = siteName.trim().length >= 2 && areasValidas;

    const handleCrearSitio = async () => {
        const nombre = siteName.trim();
        if (!formularioValido || guardando) return;
        setGuardando(true);
        setErrorMsg(null);
        try {
            await crearSitioConAreas({
                nombre,
                tipo: template.name,
                criterios_limpieza: criteria.split('\n').map((c) => c.trim()).filter(Boolean),
                areas: areaDrafts.map((a, i) => ({
                    nombre: a.name.trim() || `Área ${i + 1}`,
                    superficie_m2: parseFloat(a.surface) || 100,
                    tipo_superficie: a.surfaceType.trim() || 'Piso industrial',
                    litros_solucion_por_m2: parseFloat(a.solutionPerM2) || 0.4,
                })),
            });
            setCreatedSite(nombre);
        } catch (error) {
            console.error('Error al guardar el sitio:', error);
            setErrorMsg(error instanceof Error ? error.message : 'Error al guardar el sitio');
        } finally {
            setGuardando(false);
        }
    };

    const resetForm = () => {
        setSiteName('');
        setCreatedSite('');
        setErrorMsg(null);
        setAreaDrafts(areasFromTemplate(siteTemplates[0].areas, siteTemplates[0].id));
        setSelectedTemplate(siteTemplates[0].id);
    };

    return (
        <div className="supervisor-shell">
            <header className="supervisor-header">
                <div className="brand-lockup">
                    <Link className="back-link" to="/supervisor" title="Volver al panel">←</Link>
                    <div>
                        <p className="eyebrow">EcoCleaner / Supervisor</p>
                        <h1>Nuevo sitio</h1>
                    </div>
                </div>
                <div className="header-actions">
                    <span className="simulated-badge">
                        <span className="status-dot" /> {isSupabaseConfigured ? 'Supabase conectado' : 'Datos simulados'}
                    </span>
                    <button className="avatar" aria-label="Perfil del supervisor">SV</button>
                </div>
            </header>

            <main className="new-site-main">
                <PageHeader
                    eyebrow="Configuración"
                    title="Crear sitio y definir áreas"
                    description="Prepara la estructura del sitio y sus áreas para comenzar a registrar tareas y consumos."
                />

                {createdSite ? (
                    <Card className="new-site-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '12px' }}>✓</div>
                        <h2 style={{ color: 'var(--white)', margin: '0 0 8px' }}>¡Sitio creado correctamente!</h2>
                        <p style={{ color: 'var(--soft)', margin: '0 0 24px' }}>
                            El sitio <strong>{createdSite}</strong> con sus <strong>{areaDrafts.length} áreas</strong> y criterios ya está disponible en el sistema.
                        </p>
                        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
                            <Button variant="ghost" onClick={resetForm}>
                                Crear otro sitio
                            </Button>
                            <Link to="/supervisor" className="primary-button" style={{ textDecoration: 'none' }}>
                                Ir al Centro de Control <span>→</span>
                            </Link>
                        </div>
                    </Card>
                ) : (
                    <Card className="new-site-card">
                        {errorMsg && (
                            <div className="ui-alert ui-alert-error" style={{ marginBottom: '18px' }}>
                                <strong className="ui-alert-title">Error al registrar el sitio</strong>
                                <span className="ui-alert-body">{errorMsg}</span>
                            </div>
                        )}

                        {/* SECCIÓN 1: Plantilla base */}
                        <p className="section-kicker">1 / Plantilla o personalización</p>
                        <div className="template-options">
                            {siteTemplates.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`template-option ${selectedTemplate === item.id ? 'selected' : ''}`}
                                    onClick={() => selectTemplate(item.id)}
                                >
                                    <span className="template-radio" />
                                    <span>
                                        <strong>{item.name}</strong>
                                        <small>{item.description}</small>
                                    </span>
                                </button>
                            ))}
                        </div>

                        <Field
                            id="site-name"
                            label="Nombre del sitio *"
                            value={siteName}
                            onChange={(event) => setSiteName(event.target.value)}
                            placeholder="Ej. Planta Procesadora Norte o Almacén Central"
                        />

                        {/* SECCIÓN 2: Áreas y parámetros */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '30px' }}>
                            <p className="form-section-label" style={{ margin: 0 }}>
                                2 / Cards de áreas y parámetros de superficie
                            </p>
                            <span style={{ color: 'var(--cyan)', fontSize: '12px' }}>
                                {areaDrafts.length} {areaDrafts.length === 1 ? 'área' : 'áreas'}
                            </span>
                        </div>

                        {/* Barra de opciones de zonas rápidas independientes de la plantilla */}
                        <div className="quick-zones-bar">
                            <div className="quick-zones-header">
                                <strong>Agregar zonas con un clic (independiente de la plantilla):</strong>
                                <button
                                    type="button"
                                    className="ghost-button"
                                    style={{ padding: '4px 10px', fontSize: '11px' }}
                                    onClick={() => addArea()}
                                >
                                    + Área en blanco
                                </button>
                            </div>
                            <div className="quick-zones-chips">
                                {ZONAS_SUGERIDAS.map((zona) => (
                                    <button
                                        key={zona.name}
                                        type="button"
                                        className="quick-zone-chip"
                                        onClick={() => addArea(zona)}
                                        title={`Agregar card para ${zona.name} (${zona.surface} m²)`}
                                    >
                                        + {zona.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Listado dinámico de cards de área */}
                        {areaDrafts.length === 0 ? (
                            <div className="area-empty-box">
                                <p style={{ margin: '0 0 8px', color: 'var(--white)', fontSize: '13px', fontWeight: 600 }}>
                                    No hay áreas agregadas aún en este sitio.
                                </p>
                                <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: '12px' }}>
                                    Como elegiste un sitio personalizado (o quitaste las áreas previas), agrega tus zonas de trabajo con las opciones de arriba o pulsando el botón siguiente:
                                </p>
                                <Button type="button" onClick={() => addArea()}>
                                    + Agregar primera área <span>→</span>
                                </Button>
                            </div>
                        ) : (
                            <div className="area-cards-container">
                                {areaDrafts.map((area, index) => {
                                    const surfaceNum = parseFloat(area.surface) || 0;
                                    const solNum = parseFloat(area.solutionPerM2) || 0;
                                    const totalSolLitros = (surfaceNum * solNum).toFixed(1);
                                    return (
                                        <div className="area-card-item" key={area.id}>
                                            <div className="area-card-header">
                                                <div className="area-card-badge">
                                                    <span>Área #{index + 1}</span>
                                                    <strong>{area.name.trim() || `Área ${index + 1}`}</strong>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="area-card-remove"
                                                    onClick={() => removeArea(area.id)}
                                                    title="Eliminar esta área"
                                                >
                                                    ✕ Eliminar
                                                </button>
                                            </div>

                                            <div className="area-card-fields">
                                                <label>
                                                    Nombre del área / zona *
                                                    <input
                                                        value={area.name}
                                                        onChange={(e) => updateArea(area.id, 'name', e.target.value)}
                                                        placeholder="Ej. Línea de Envasado"
                                                    />
                                                </label>
                                                <label>
                                                    Superficie (m²) *
                                                    <input
                                                        type="number"
                                                        min="0.1"
                                                        step="any"
                                                        value={area.surface}
                                                        onChange={(e) => updateArea(area.id, 'surface', e.target.value)}
                                                        placeholder="Ej. 100"
                                                    />
                                                </label>
                                                <label>
                                                    Tipo de superficie
                                                    <select
                                                        value={area.surfaceType}
                                                        onChange={(e) => updateArea(area.id, 'surfaceType', e.target.value)}
                                                    >
                                                        {tiposSuperficie.map((tipo) => (
                                                            <option key={tipo} value={tipo}>{tipo}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label>
                                                    Solución requerida (L/m²)
                                                    <input
                                                        type="number"
                                                        min="0.01"
                                                        step="any"
                                                        value={area.solutionPerM2}
                                                        onChange={(e) => updateArea(area.id, 'solutionPerM2', e.target.value)}
                                                        placeholder="Ej. 0.4"
                                                    />
                                                </label>
                                            </div>

                                            <div className="area-card-footer">
                                                <span>Superficie: <strong>{surfaceNum} m²</strong> · {area.surfaceType}</span>
                                                <span>Solución estimada por lavado: <strong>~{totalSolLitros} L</strong></span>
                                            </div>
                                        </div>
                                    );
                                })}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                    <button
                                        type="button"
                                        className="ghost-button"
                                        onClick={() => addArea()}
                                    >
                                        + Agregar otra card de área
                                    </button>

                                    <div className="area-summary-pill">
                                        <span>Áreas: <strong>{areaDrafts.length}</strong></span>
                                        <span>Superficie total: <strong>{totalSuperficie} m²</strong></span>
                                        <span>Solución estimada: <strong>~{totalSolucionLitros} L</strong></span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SECCIÓN 3: Criterios */}
                        <label className="site-name-label" htmlFor="cleaning-criteria" style={{ marginTop: '28px' }}>
                            Criterios de limpieza del sitio (uno por línea)
                            <textarea
                                id="cleaning-criteria"
                                value={criteria}
                                onChange={(event) => setCriteria(event.target.value)}
                                placeholder="Escribe los criterios requeridos de inspección..."
                            />
                        </label>

                        <p className="template-preview">
                            <strong>{areaDrafts.length} {areaDrafts.length === 1 ? 'área configurada' : 'áreas configuradas'}</strong> con un total de <strong>{totalSuperficie} m²</strong>.
                            Todos los datos quedan guardados y listos para asignar productos y registrar tareas operativas.
                        </p>

                        <div className="new-site-actions">
                            <Link className="cancel-link" to="/supervisor">Cancelar</Link>
                            <Button disabled={!formularioValido || guardando} onClick={handleCrearSitio}>
                                {guardando ? 'Guardando…' : 'Crear sitio'} <span>→</span>
                            </Button>
                        </div>
                    </Card>
                )}
            </main>
        </div>
    );
}
