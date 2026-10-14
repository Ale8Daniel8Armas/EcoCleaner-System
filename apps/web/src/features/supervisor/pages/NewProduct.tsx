import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Button,
    Card,
    IconArrowLeft,
    IconBuilding,
    IconCheck,
    IconFlask,
} from '../../../components/ui';
import { CATEGORIAS_QUIMICAS, type CategoriaQuimica } from '@ecocleaner/schemas';
import { crearProducto } from '../../../services/productos';
import { isSupabaseConfigured } from '../../../services/supabase';

const CATEGORIA_LABELS: Record<CategoriaQuimica, string> = {
    alcalino: 'Alcalino',
    acido: 'Ácido',
    hipoclorito: 'Hipoclorito (Cloro)',
    amoniaco: 'Amoníaco',
    amonio_cuaternario: 'Amonio cuaternario',
    peroxido: 'Peróxido',
    solvente: 'Solvente',
    otro: 'Otro / Neutro',
};

export default function NewProduct() {
    const [nombre, setNombre] = useState('');
    const [tipoQuimico, setTipoQuimico] = useState('');
    const [categorias, setCategorias] = useState<CategoriaQuimica[]>([]);
    const [incompatibilidades, setIncompatibilidades] = useState<CategoriaQuimica[]>([]);
    const [dilucionMin, setDilucionMin] = useState('');
    const [dilucionRec, setDilucionRec] = useState('');
    const [dilucionMax, setDilucionMax] = useState('');
    const [dilucionTexto, setDilucionTexto] = useState('');
    const [ph, setPh] = useState('');
    const [concentracionPh, setConcentracionPh] = useState('');
    const [phMedidoMl, setPhMedidoMl] = useState('');
    const [disposicion, setDisposicion] = useState('');
    const [urlFicha, setUrlFicha] = useState('');
    const [urlSds, setUrlSds] = useState('');

    const [guardando, setGuardando] = useState(false);
    const [mensajeExito, setMensajeExito] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const toggleCategoria = (cat: CategoriaQuimica) => {
        setCategorias((current) =>
            current.includes(cat)
                ? current.filter((c) => c !== cat)
                : [...current, cat]
        );
    };

    const toggleIncompatibilidad = (cat: CategoriaQuimica) => {
        setIncompatibilidades((current) =>
            current.includes(cat)
                ? current.filter((c) => c !== cat)
                : [...current, cat]
        );
    };

    // Validaciones de negocio y análisis de valores numéricos (enteros y decimales)
    const minVal = dilucionMin.trim() !== '' ? parseFloat(dilucionMin) : null;
    const recVal = dilucionRec.trim() !== '' ? parseFloat(dilucionRec) : null;
    const maxVal = dilucionMax.trim() !== '' ? parseFloat(dilucionMax) : null;
    const phVal = ph.trim() !== '' ? parseFloat(ph) : null;
    const phMedidoVal = phMedidoMl.trim() !== '' ? parseFloat(phMedidoMl) : null;

    // Regla de dilución: valores obligatorios, estrictamente mayores a 0 (el 0 no es válido aquí)
    const tieneDiluciones = minVal !== null && recVal !== null && maxVal !== null;
    const dilucionesMayoresACero = tieneDiluciones && minVal > 0 && recVal > 0 && maxVal > 0;
    const dilucionOrdenValido = tieneDiluciones && minVal <= recVal && recVal <= maxVal;
    const dilucionValida = dilucionesMayoresACero && dilucionOrdenValido;
    const phValido = phVal === null || (!isNaN(phVal) && phVal >= 0 && phVal <= 14);
    const phMedidoValido = phMedidoVal === null || (!isNaN(phMedidoVal) && phMedidoVal > 0);

    const formularioValido =
        nombre.trim().length >= 2 &&
        categorias.length > 0 &&
        dilucionValida &&
        phValido &&
        phMedidoValido;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formularioValido || guardando || minVal === null || recVal === null || maxVal === null) return;

        setGuardando(true);
        setErrorMsg(null);

        try {
            const nuevo = await crearProducto({
                nombre: nombre.trim(),
                tipo_quimico: tipoQuimico.trim() || null,
                categorias,
                incompatibilidades,
                dilucion_min_ml_por_litro: minVal,
                dilucion_ml_por_litro: recVal,
                dilucion_max_ml_por_litro: maxVal,
                dilucion_texto_ficha: dilucionTexto.trim() || null,
                ph: phVal,
                concentracion_ph: concentracionPh.trim() || null,
                ph_medido_a_ml_por_litro: phMedidoVal,
                indicaciones_disposicion: disposicion.trim() || null,
                url_ficha_tecnica: urlFicha.trim() || null,
                url_hoja_seguridad: urlSds.trim() || null,
            });

            setMensajeExito(nuevo.nombre);
        } catch (err: unknown) {
            console.error('Error al registrar producto:', err);
            setErrorMsg(err instanceof Error ? err.message : 'No se pudo registrar el producto');
        } finally {
            setGuardando(false);
        }
    };

    const resetForm = () => {
        setNombre('');
        setTipoQuimico('');
        setCategorias([]);
        setIncompatibilidades([]);
        setDilucionMin('');
        setDilucionRec('');
        setDilucionMax('');
        setDilucionTexto('');
        setPh('');
        setConcentracionPh('');
        setPhMedidoMl('');
        setDisposicion('');
        setUrlFicha('');
        setUrlSds('');
        setMensajeExito(null);
        setErrorMsg(null);
    };

    return (
        <div className="supervisor-shell report-page">
            {/* Cabecera acoplada idéntica al reporte */}
            <header className="supervisor-header report-header-bar">
                <div className="brand-lockup">
                    <Link className="supervisor-header-btn" to="/supervisor" title="Volver al panel principal">
                        <IconArrowLeft size={16} />
                        <span>Volver al panel</span>
                    </Link>
                    <div>
                        <p className="eyebrow">EcoCleaner · Catálogo Técnico y Dosificación</p>
                        <h1>Registrar nuevo producto químico</h1>
                    </div>
                </div>
                <div className="report-header-actions">
                    <span className="report-badge-status" style={{ background: isSupabaseConfigured ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: isSupabaseConfigured ? '#059669' : '#b45309' }}>
                        <span className="status-dot" style={{ background: isSupabaseConfigured ? '#10b981' : '#f59e0b', marginRight: '6px' }} />
                        {isSupabaseConfigured ? 'Supabase conectado' : 'Modo local / simulado'}
                    </span>
                    <Link className="supervisor-header-btn" to="/supervisor/sitios/nuevo" title="Crear nuevo sitio y áreas">
                        <IconBuilding size={15} />
                        <span>Nuevo sitio</span>
                    </Link>
                </div>
            </header>

            <main className="report-main" style={{ maxWidth: '1000px', margin: '24px auto' }}>
                {/* Metadatos y ficha de estado técnico */}
                <Card className="report-meta-card">
                    <div className="report-meta-grid">
                        <div className="report-meta-item">
                            <span className="report-meta-label">MÓDULO TÉCNICO</span>
                            <strong className="report-meta-val">Catálogo Químico y FDS</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">NORMATIVA DE SEGURIDAD</span>
                            <strong className="report-meta-val">SGA / GHS Rev. 9</strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">CATEGORÍAS ACTIVAS</span>
                            <strong className="report-meta-val">
                                {categorias.length > 0 ? `${categorias.length} seleccionada(s)` : 'Sin categorías'}
                            </strong>
                        </div>
                        <div className="report-meta-item">
                            <span className="report-meta-label">ESTADO DE FORMULARIO</span>
                            <span className="report-badge-status" style={{ background: formularioValido ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: formularioValido ? '#059669' : '#dc2626' }}>
                                <span className="status-dot" style={{ background: formularioValido ? '#10b981' : '#ef4444', marginRight: '6px' }} />
                                {formularioValido ? 'Listo para registrar' : 'Campos pendientes'}
                            </span>
                        </div>
                    </div>
                </Card>

                {mensajeExito ? (
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
                            ¡Producto químico registrado con éxito!
                        </h2>
                        <p style={{ color: '#475569', margin: '0 0 28px', fontSize: '14px', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                            <strong>«{mensajeExito}»</strong> ha sido incorporado al catálogo técnico. Sus especificaciones de dilución y pH están activas para las recetas de los operarios.
                        </p>
                        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
                            <Button variant="ghost" onClick={resetForm} style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155' }}>
                                Registrar otro producto
                            </Button>
                            <Link to="/supervisor" className="primary-button" style={{ textDecoration: 'none', background: '#2563eb', color: '#ffffff', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span>Ir al panel principal</span>
                                <span>→</span>
                            </Link>
                        </div>
                    </Card>
                ) : (
                    <Card className="report-card-section" style={{ padding: '32px' }}>
                        <form onSubmit={handleSubmit} className="supervisor-form-layout">
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
                                    <strong style={{ color: '#991b1b', fontSize: '13.5px' }}>Error al registrar producto</strong>
                                    <span style={{ color: '#b91c1c', fontSize: '13px' }}>{errorMsg}</span>
                                </div>
                            )}

                            {/* SECCIÓN 1: Identificación y Clasificación */}
                            <div className="form-section-block">
                                <div className="form-section-header">
                                    <span className="form-step-badge">1</span>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Identificación y clasificación química</h3>
                                        <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>Define la denominación comercial, familia química y categorías compatibles.</p>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '16px' }}>
                                    <label className="supervisor-field-label">
                                        Nombre comercial del producto *
                                        <input
                                            required
                                            value={nombre}
                                            onChange={(e) => setNombre(e.target.value)}
                                            placeholder="Ej. Detergente Alcalino Espumante 500"
                                            className="supervisor-input"
                                        />
                                    </label>
                                    <label className="supervisor-field-label">
                                        Tipo químico / Familia
                                        <input
                                            value={tipoQuimico}
                                            onChange={(e) => setTipoQuimico(e.target.value)}
                                            placeholder="Ej. Detergente alcalino formulado"
                                            className="supervisor-input"
                                        />
                                    </label>
                                </div>

                                <div style={{ marginTop: '20px' }}>
                                    <span style={{ color: '#334155', fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                                        Categorías químicas asociadas * <span style={{ fontWeight: 400, color: '#64748b' }}>(selecciona al menos una)</span>:
                                    </span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {CATEGORIAS_QUIMICAS.map((cat) => {
                                            const activa = categorias.includes(cat);
                                            return (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => toggleCategoria(cat)}
                                                    className={`supervisor-chip ${activa ? 'active' : ''}`}
                                                >
                                                    {activa && <IconCheck size={14} />}
                                                    <span>{CATEGORIA_LABELS[cat]}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div style={{ marginTop: '20px' }}>
                                    <span style={{ color: '#334155', fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                                        Incompatibilidades operativas <span style={{ fontWeight: 400, color: '#64748b' }}>(sustancias que generan riesgo severo al contacto)</span>:
                                    </span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {CATEGORIAS_QUIMICAS.map((cat) => {
                                            const esIncompatible = incompatibilidades.includes(cat);
                                            return (
                                                <button
                                                    key={`incomp-${cat}`}
                                                    type="button"
                                                    onClick={() => toggleIncompatibilidad(cat)}
                                                    className={`supervisor-chip danger ${esIncompatible ? 'active' : ''}`}
                                                >
                                                    {esIncompatible ? '✕ ' : '+ '}
                                                    <span>{CATEGORIA_LABELS[cat]}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '32px 0 24px' }} />

                            {/* SECCIÓN 2: Dosificación y Dilución */}
                            <div className="form-section-block">
                                <div className="form-section-header">
                                    <span className="form-step-badge">2</span>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Rangos de dilución recomendados (ml de producto / L de agua)</h3>
                                        <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>Acepta enteros o decimales. Valores estrictamente mayores a 0 ml/L.</p>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginTop: '16px' }}>
                                    <label className="supervisor-field-label">
                                        Mínima (ml/L) *
                                        <input
                                            type="number"
                                            min="0.001"
                                            step="any"
                                            required
                                            value={dilucionMin}
                                            onChange={(e) => setDilucionMin(e.target.value)}
                                            placeholder="Ej. 20"
                                            className="supervisor-input"
                                        />
                                    </label>
                                    <label className="supervisor-field-label">
                                        Recomendada (ml/L) *
                                        <input
                                            type="number"
                                            min="0.001"
                                            step="any"
                                            required
                                            value={dilucionRec}
                                            onChange={(e) => setDilucionRec(e.target.value)}
                                            placeholder="Ej. 50"
                                            className="supervisor-input"
                                        />
                                    </label>
                                    <label className="supervisor-field-label">
                                        Máxima (ml/L) *
                                        <input
                                            type="number"
                                            min="0.001"
                                            step="any"
                                            required
                                            value={dilucionMax}
                                            onChange={(e) => setDilucionMax(e.target.value)}
                                            placeholder="Ej. 100"
                                            className="supervisor-input"
                                        />
                                    </label>
                                    <label className="supervisor-field-label">
                                        Texto en Ficha Técnica
                                        <input
                                            value={dilucionTexto}
                                            onChange={(e) => setDilucionTexto(e.target.value)}
                                            placeholder="Ej. 1:20 o 20 a 50 ml/L"
                                            className="supervisor-input"
                                        />
                                    </label>
                                </div>

                                {tieneDiluciones && !dilucionesMayoresACero && (
                                    <p style={{ color: '#dc2626', fontSize: '12px', margin: '10px 0 0', fontWeight: 500 }}>
                                        ⚠️ La dosificación debe ser mayor a 0 ml/L. Un valor de 0 no es válido para productos químicos concentrados.
                                    </p>
                                )}

                                {tieneDiluciones && dilucionesMayoresACero && !dilucionOrdenValido && (
                                    <p style={{ color: '#dc2626', fontSize: '12px', margin: '10px 0 0', fontWeight: 500 }}>
                                        ⚠️ Regla técnica: Dilución Mínima ({minVal} ml/L) ≤ Recomendada ({recVal} ml/L) ≤ Máxima ({maxVal} ml/L).
                                    </p>
                                )}
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '32px 0 24px' }} />

                            {/* SECCIÓN 3: Propiedades Fisicoquímicas y Disposición */}
                            <div className="form-section-block">
                                <div className="form-section-header">
                                    <span className="form-step-badge">3</span>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>pH, control ambiental y seguridad de efluente</h3>
                                        <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>Información clave para evaluar compatibilidad con redes de descarga y neutralización.</p>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginTop: '16px' }}>
                                    <label className="supervisor-field-label">
                                        pH nominal (0 a 14)
                                        <input
                                            type="number"
                                            min="0"
                                            max="14"
                                            step="any"
                                            value={ph}
                                            onChange={(e) => setPh(e.target.value)}
                                            placeholder="0 a 14 (ej. 11.5 o 0)"
                                            className="supervisor-input"
                                        />
                                    </label>
                                    <label className="supervisor-field-label">
                                        Concentración medición pH
                                        <input
                                            value={concentracionPh}
                                            onChange={(e) => setConcentracionPh(e.target.value)}
                                            placeholder="Ej. pH al 1% o Puro"
                                            className="supervisor-input"
                                        />
                                    </label>
                                    <label className="supervisor-field-label">
                                        pH medido a (ml/L)
                                        <input
                                            type="number"
                                            min="0.001"
                                            step="any"
                                            value={phMedidoMl}
                                            onChange={(e) => setPhMedidoMl(e.target.value)}
                                            placeholder="Ej. 10 (> 0)"
                                            className="supervisor-input"
                                        />
                                    </label>
                                </div>

                                {!phValido && (
                                    <p style={{ color: '#dc2626', fontSize: '12px', margin: '10px 0 0', fontWeight: 500 }}>
                                        ⚠️ El pH debe encontrarse en la escala estándar de 0 a 14 (0 es válido para ácidos fuertes).
                                    </p>
                                )}

                                {!phMedidoValido && (
                                    <p style={{ color: '#dc2626', fontSize: '12px', margin: '10px 0 0', fontWeight: 500 }}>
                                        ⚠️ Si especificas el volumen de medición de pH, debe ser mayor a 0 ml/L.
                                    </p>
                                )}

                                <label className="supervisor-field-label" style={{ marginTop: '18px' }}>
                                    Indicaciones de disposición final de efluentes
                                    <textarea
                                        value={disposicion}
                                        onChange={(e) => setDisposicion(e.target.value)}
                                        placeholder="Indica precauciones de vertido, neutralización previa según sección 13 de la FDS/HDS..."
                                        className="supervisor-textarea"
                                        rows={3}
                                    />
                                </label>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '32px 0 24px' }} />

                            {/* SECCIÓN 4: Documentación Digital */}
                            <div className="form-section-block">
                                <div className="form-section-header">
                                    <span className="form-step-badge">4</span>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Documentación técnica digital (Opcional)</h3>
                                        <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>Enlaces seguros a hojas de datos técnicos o seguridad en PDF.</p>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '16px' }}>
                                    <label className="supervisor-field-label">
                                        URL Ficha Técnica (PDF)
                                        <input
                                            type="url"
                                            value={urlFicha}
                                            onChange={(e) => setUrlFicha(e.target.value)}
                                            placeholder="https://..."
                                            className="supervisor-input"
                                        />
                                    </label>
                                    <label className="supervisor-field-label">
                                        URL Hoja de Seguridad FDS/SDS (PDF)
                                        <input
                                            type="url"
                                            value={urlSds}
                                            onChange={(e) => setUrlSds(e.target.value)}
                                            placeholder="https://..."
                                            className="supervisor-input"
                                        />
                                    </label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '14px', marginTop: '36px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                                <Link className="supervisor-header-btn" to="/supervisor" style={{ height: '38px', padding: '0 18px' }}>
                                    Cancelar
                                </Link>
                                <button
                                    type="submit"
                                    disabled={!formularioValido || guardando}
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
                                    <IconFlask size={16} />
                                    <span>{guardando ? 'Guardando en catálogo...' : 'Registrar producto químico'}</span>
                                </button>
                            </div>
                        </form>
                    </Card>
                )}
            </main>
        </div>
    );
}
