import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AreaQr,
    Card,
    IconArrowLeft,
    IconBuilding,
    IconFlask,
    IconPlus,
} from '../../../components/ui';
import { siteTemplates } from '../../../services/supervisorMock';
import { crearSitioConAreas } from '../../../services/sitios';
import { tiposSuperficie, type AreaOperario } from '../../../services/operarioMock';

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
    const [areasCreadas, setAreasCreadas] = useState<AreaOperario[]>([]);
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
            const { areas } = await crearSitioConAreas({
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
            setAreasCreadas(areas);
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
        setAreasCreadas([]);
        setErrorMsg(null);
        setAreaDrafts(areasFromTemplate(siteTemplates[0].areas, siteTemplates[0].id));
        setSelectedTemplate(siteTemplates[0].id);
    };

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
                        <p className="eyebrow">EcoCleaner · Configuración de Infraestructura</p>
                        <h1>Crear nuevo sitio y definir áreas operativas</h1>
                    </div>
                </div>
                <div className="report-header-actions">
                    <Link className="supervisor-header-btn" to="/supervisor/productos/nuevo" title="Registrar producto químico">
                        <IconFlask size={15} />
                        <span>Nuevo producto</span>
                    </Link>
                </div>
            </header>

            <main className="report-main" style={{ maxWidth: '1000px', margin: '24px auto' }}>
                {/* Metadatos consolidados del sitio */}
                <Card className="report-meta-card">
                    <div className="report-meta-grid">
                        <div className="report-meta-item">
                            <span className="report-meta-label">PLANTILLA BASE</span>
                            <strong className="report-meta-val">{template.name}</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">ÁREAS CONFIGURADAS</span>
                            <strong className="report-meta-val">{areaDrafts.length} zona(s)</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">SUPERFICIE TOTAL</span>
                            <strong className="report-meta-val">{totalSuperficie} m²</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">ESTADO DE VALIDACIÓN</span>
                            <span className="report-badge-status" style={{ background: formularioValido ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: formularioValido ? '#059669' : '#dc2626' }}>
                                <span className="status-dot" style={{ background: formularioValido ? '#10b981' : '#ef4444', marginRight: '6px' }} />
                                {formularioValido ? 'Configuración válida' : 'Faltan datos obligatorios'}
                            </span>
                        </div>
                    </div>
                </Card>

                {createdSite ? (
                    <Card className="report-card-section" style={{ textAlign: 'center', padding: '48px 32px' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            background: '#dcfce7',
                            color: '#16a34a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '32px',
                            margin: '0 auto 16px',
                            border: '1px solid #bbf7d0'
                        }}>
                            ✓
                        </div>
                        <h2 style={{ color: '#0f172a', margin: '0 0 10px', fontSize: '22px', fontWeight: 700 }}>
                            ¡Sitio creado correctamente!
                        </h2>
                        <p style={{ color: '#475569', margin: '0 0 28px', fontSize: '14px', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                            El sitio <strong>«{createdSite}»</strong> con sus <strong>{areaDrafts.length} áreas</strong> y criterios de calidad ya está disponible para el registro de tareas y consumos.
                        </p>
                        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
                            <button
                                type="button"
                                className="supervisor-header-btn"
                                onClick={resetForm}
                                style={{ height: '38px', padding: '0 18px', background: '#ffffff' }}
                            >
                                Crear otro sitio
                            </button>
                            <Link to="/supervisor" className="primary-button" style={{ textDecoration: 'none', background: '#2563eb', color: '#ffffff', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span>Ir al panel principal</span>
                                <span>→</span>
                            </Link>
                        </div>

                        {areasCreadas.length > 0 && (
                            <div style={{ marginTop: '28px', textAlign: 'left' }}>
                                <p className="section-kicker">Etiquetas QR de las áreas</p>
                                <p style={{ margin: '4px 0 14px', fontSize: '13px', color: '#64748b' }}>
                                    Imprime o descarga el QR de cada área. Al escanearlo se abre la información de limpieza del área.
                                </p>
                                <div className="area-qr-list">
                                    {areasCreadas.map((area) => (
                                        <AreaQr
                                            key={area.id}
                                            areaId={area.id}
                                            areaNombre={area.nombre}
                                            sitioNombre={createdSite}
                                            qrPath={area.qr_path}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </Card>
                ) : (
                    <Card className="report-card-section" style={{ padding: '32px' }}>
                        {errorMsg && (
                            <div style={{
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '10px',
                                padding: '14px 18px',
                                marginBottom: '24px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                            }}>
                                <strong style={{ color: '#991b1b', fontSize: '13.5px' }}>Error al registrar sitio</strong>
                                <span style={{ color: '#b91c1c', fontSize: '13px' }}>{errorMsg}</span>
                            </div>
                        )}

                        {/* SECCIÓN 1: Plantilla base */}
                        <div className="form-section-block">
                            <div className="form-section-header">
                                <span className="form-step-badge">1</span>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Plantilla base o configuración personalizada</h3>
                                    <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>Selecciona una tipología predeterminada para cargar áreas y consumos de referencia.</p>
                                </div>
                            </div>

                            <div className="supervisor-template-grid" style={{ marginTop: '16px' }}>
                                {siteTemplates.map((item) => {
                                    const selected = selectedTemplate === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={`supervisor-template-card ${selected ? 'selected' : ''}`}
                                            onClick={() => selectTemplate(item.id)}
                                        >
                                            <div className="template-card-radio">
                                                <div className="template-radio-dot" />
                                            </div>
                                            <div className="template-card-text">
                                                <strong>{item.name}</strong>
                                                <small>{item.description}</small>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div style={{ marginTop: '22px' }}>
                                <label className="supervisor-field-label">
                                    Nombre del sitio / Planta *
                                    <input
                                        id="site-name"
                                        value={siteName}
                                        onChange={(event) => setSiteName(event.target.value)}
                                        placeholder="Ej. Planta Procesadora Norte o Almacén Central"
                                        className="supervisor-input"
                                        style={{ marginTop: '6px' }}
                                    />
                                </label>
                            </div>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '32px 0 24px' }} />

                        {/* SECCIÓN 2: Áreas y parámetros */}
                        <div className="form-section-block">
                            <div className="form-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span className="form-step-badge">2</span>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Áreas y parámetros de superficie</h3>
                                        <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>Define las zonas de limpieza, metros cuadrados y volumen estimado de solución.</p>
                                    </div>
                                </div>
                                <span className="report-badge-status" style={{ background: '#f1f5f9', color: '#334155' }}>
                                    {areaDrafts.length} {areaDrafts.length === 1 ? 'área' : 'áreas'}
                                </span>
                            </div>

                            {/* Barra de opciones de zonas sugeridas */}
                            <div className="quick-zones-bar-modern" style={{ marginTop: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                                        Agregar zonas comunes con 1 clic:
                                    </span>
                                    <button
                                        type="button"
                                        className="supervisor-header-btn"
                                        style={{ height: '28px', padding: '0 10px', fontSize: '11.5px' }}
                                        onClick={() => addArea()}
                                    >
                                        + Área en blanco
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {ZONAS_SUGERIDAS.map((zona) => (
                                        <button
                                            key={zona.name}
                                            type="button"
                                            className="quick-zone-chip-modern"
                                            onClick={() => addArea(zona)}
                                            title={`Agregar ${zona.name} (${zona.surface} m²)`}
                                        >
                                            + {zona.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Listado dinámico de cards de área */}
                            {areaDrafts.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '36px 20px',
                                    background: '#f8fafc',
                                    borderRadius: '12px',
                                    border: '1px dashed #cbd5e1',
                                    margin: '20px 0'
                                }}>
                                    <p style={{ margin: '0 0 6px', color: '#0f172a', fontSize: '14px', fontWeight: 600 }}>
                                        No hay áreas agregadas en este sitio todavía.
                                    </p>
                                    <p style={{ margin: '0 0 18px', color: '#64748b', fontSize: '13px' }}>
                                        Agrega zonas usando las opciones superiores o pulsa el botón a continuación:
                                    </p>
                                    <button
                                        type="button"
                                        className="primary-button"
                                        onClick={() => addArea()}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: '#2563eb',
                                            color: '#ffffff',
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <IconPlus size={15} />
                                        <span>Agregar primera área</span>
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '20px 0' }}>
                                    {areaDrafts.map((area, index) => {
                                        const surfaceNum = parseFloat(area.surface) || 0;
                                        const solNum = parseFloat(area.solutionPerM2) || 0;
                                        const totalSolLitros = (surfaceNum * solNum).toFixed(1);
                                        return (
                                            <div key={area.id} className="supervisor-area-card">
                                                <div className="area-card-top-bar">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span className="area-number-pill">Área #{index + 1}</span>
                                                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                                                            {area.name.trim() || `Área ${index + 1}`}
                                                        </strong>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeArea(area.id)}
                                                        className="area-remove-btn"
                                                        title="Eliminar esta área"
                                                    >
                                                        ✕ Eliminar
                                                    </button>
                                                </div>

                                                <div className="area-card-inputs-grid">
                                                    <label className="supervisor-field-label">
                                                        Nombre del área / zona *
                                                        <input
                                                            value={area.name}
                                                            onChange={(e) => updateArea(area.id, 'name', e.target.value)}
                                                            placeholder="Ej. Línea de Envasado"
                                                            className="supervisor-input"
                                                        />
                                                    </label>
                                                    <label className="supervisor-field-label">
                                                        Superficie (m²) *
                                                        <input
                                                            type="number"
                                                            min="0.1"
                                                            step="any"
                                                            value={area.surface}
                                                            onChange={(e) => updateArea(area.id, 'surface', e.target.value)}
                                                            placeholder="Ej. 100"
                                                            className="supervisor-input"
                                                        />
                                                    </label>
                                                    <label className="supervisor-field-label">
                                                        Tipo de superficie
                                                        <select
                                                            value={area.surfaceType}
                                                            onChange={(e) => updateArea(area.id, 'surfaceType', e.target.value)}
                                                            className="supervisor-input"
                                                        >
                                                            {tiposSuperficie.map((tipo) => (
                                                                <option key={tipo} value={tipo}>{tipo}</option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                    <label className="supervisor-field-label">
                                                        Solución requerida (L/m²)
                                                        <input
                                                            type="number"
                                                            min="0.01"
                                                            step="any"
                                                            value={area.solutionPerM2}
                                                            onChange={(e) => updateArea(area.id, 'solutionPerM2', e.target.value)}
                                                            placeholder="Ej. 0.4"
                                                            className="supervisor-input"
                                                        />
                                                    </label>
                                                </div>

                                                <div className="area-card-metrics-footer">
                                                    <span>Superficie: <strong>{surfaceNum} m²</strong> · {area.surfaceType}</span>
                                                    <span>Solución estimada por lavado: <strong>~{totalSolLitros} L</strong></span>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
                                        <button
                                            type="button"
                                            className="supervisor-header-btn"
                                            onClick={() => addArea()}
                                            style={{ height: '34px', padding: '0 14px' }}
                                        >
                                            <IconPlus size={14} />
                                            <span>Agregar otra área</span>
                                        </button>

                                        <div className="area-summary-pill-modern">
                                            <span>Áreas: <strong>{areaDrafts.length}</strong></span>
                                            <span>Superficie total: <strong>{totalSuperficie} m²</strong></span>
                                            <span>Solución total estimada: <strong>~{totalSolucionLitros} L</strong></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '32px 0 24px' }} />

                        {/* SECCIÓN 3: Criterios */}
                        <div className="form-section-block">
                            <div className="form-section-header">
                                <span className="form-step-badge">3</span>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Criterios de limpieza y calidad para el sitio</h3>
                                    <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>Escribe los puntos de inspección requeridos para la validación del revisor (uno por línea).</p>
                                </div>
                            </div>

                            <div style={{ marginTop: '16px' }}>
                                <label className="supervisor-field-label">
                                    Criterios de inspección
                                    <textarea
                                        id="cleaning-criteria"
                                        value={criteria}
                                        onChange={(event) => setCriteria(event.target.value)}
                                        placeholder="Escribe los criterios requeridos de inspección..."
                                        className="supervisor-textarea"
                                        rows={4}
                                    />
                                </label>
                            </div>

                            <div className="report-note-box" style={{ marginTop: '16px' }}>
                                <strong>Resumen de configuración:</strong> {areaDrafts.length} {areaDrafts.length === 1 ? 'área configurada' : 'áreas configuradas'} con un total de {totalSuperficie} m². Toda la información quedará registrada en el sistema para asignación de productos y generación de recetas.
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '14px', marginTop: '36px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                            <Link className="supervisor-header-btn" to="/supervisor" style={{ height: '38px', padding: '0 18px' }}>
                                Cancelar
                            </Link>
                            <button
                                type="button"
                                disabled={!formularioValido || guardando}
                                onClick={handleCrearSitio}
                                className="primary-button"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    height: '38px',
                                    padding: '0 22px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    background: '#2563eb',
                                    color: '#ffffff',
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: (!formularioValido || guardando) ? 'not-allowed' : 'pointer',
                                    opacity: (!formularioValido || guardando) ? 0.6 : 1,
                                }}
                            >
                                <IconBuilding size={16} />
                                <span>{guardando ? 'Guardando sitio...' : 'Crear sitio y registrar áreas'}</span>
                            </button>
                        </div>
                    </Card>
                )}
            </main>
        </div>
    );
}
