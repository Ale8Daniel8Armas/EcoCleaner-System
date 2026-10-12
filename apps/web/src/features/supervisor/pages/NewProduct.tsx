import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, PageHeader } from '../../../components/ui';
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
    const [categorias, setCategorias] = useState<CategoriaQuimica[]>(['alcalino']);
    const [incompatibilidades, setIncompatibilidades] = useState<CategoriaQuimica[]>(['acido']);
    const [dilucionMin, setDilucionMin] = useState('20');
    const [dilucionRec, setDilucionRec] = useState('50');
    const [dilucionMax, setDilucionMax] = useState('100');
    const [dilucionTexto, setDilucionTexto] = useState('1:20 (50 ml/L)');
    const [ph, setPh] = useState('11.5');
    const [concentracionPh, setConcentracionPh] = useState('pH al 1%');
    const [phMedidoMl, setPhMedidoMl] = useState('10');
    const [disposicion, setDisposicion] = useState('Neutralizar antes del vertido final si el pH resultante está fuera de norma.');
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

    // Validaciones de negocio
    const minVal = parseFloat(dilucionMin) || 0;
    const recVal = parseFloat(dilucionRec) || 0;
    const maxVal = parseFloat(dilucionMax) || 0;
    const phVal = ph ? parseFloat(ph) : null;

    const dilucionValida = minVal > 0 && minVal <= recVal && recVal <= maxVal;
    const phValido = phVal === null || (!isNaN(phVal) && phVal >= 0 && phVal <= 14);
    const formularioValido = nombre.trim().length >= 2 && categorias.length > 0 && dilucionValida && phValido;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formularioValido || guardando) return;

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
                ph_medido_a_ml_por_litro: phMedidoMl ? parseFloat(phMedidoMl) : null,
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
        setCategorias(['alcalino']);
        setIncompatibilidades(['acido']);
        setDilucionMin('20');
        setDilucionRec('50');
        setDilucionMax('100');
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
        <div className="supervisor-shell">
            <header className="supervisor-header">
                <div className="brand-lockup">
                    <Link className="back-link" to="/supervisor" title="Volver al panel">←</Link>
                    <div>
                        <p className="eyebrow">EcoCleaner / Supervisor</p>
                        <h1>Nuevo producto químico</h1>
                    </div>
                </div>
                <div className="header-actions">
                    <span className="simulated-badge">
                        <span className="status-dot" /> {isSupabaseConfigured ? 'Supabase conectado' : 'Modo local / simulado'}
                    </span>
                    <button className="avatar" aria-label="Perfil del supervisor">SV</button>
                </div>
            </header>

            <main className="new-site-main">
                <PageHeader
                    eyebrow="Catálogo técnico"
                    title="Registrar producto químico"
                    description="Ingresa las especificaciones técnicas, rangos de dosificación e incompatibilidades operativas para garantizar la seguridad del operario."
                />

                {mensajeExito ? (
                    <Card className="new-site-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '12px' }}>✓</div>
                        <h2 style={{ color: 'var(--white)', margin: '0 0 8px' }}>¡Producto registrado exitosamente!</h2>
                        <p style={{ color: 'var(--soft)', margin: '0 0 24px' }}>
                            <strong>{mensajeExito}</strong> ha sido agregado al catálogo y ahora está disponible para las recetas y tareas de limpieza.
                        </p>
                        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
                            <Button variant="ghost" onClick={resetForm}>
                                Registrar otro producto
                            </Button>
                            <Link to="/supervisor" className="primary-button" style={{ textDecoration: 'none' }}>
                                Ir al Centro de Control <span>→</span>
                            </Link>
                        </div>
                    </Card>
                ) : (
                    <Card className="new-site-card">
                        <form onSubmit={handleSubmit}>
                            {errorMsg && (
                                <div className="ui-alert ui-alert-error" style={{ marginBottom: '20px' }}>
                                    <strong className="ui-alert-title">Error al registrar</strong>
                                    <span className="ui-alert-body">{errorMsg}</span>
                                </div>
                            )}

                            {/* SECCIÓN 1: Identificación y Clasificación */}
                            <p className="section-kicker">1 / Identificación y clasificación</p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '12px' }}>
                                <label className="site-name-label" style={{ margin: 0 }}>
                                    Nombre del producto *
                                    <input
                                        required
                                        value={nombre}
                                        onChange={(e) => setNombre(e.target.value)}
                                        placeholder="Ej. Detergente Alcalino Espumante 500"
                                    />
                                </label>
                                <label className="site-name-label" style={{ margin: 0 }}>
                                    Tipo químico / Familia
                                    <input
                                        value={tipoQuimico}
                                        onChange={(e) => setTipoQuimico(e.target.value)}
                                        placeholder="Ej. Detergente alcalino formulado"
                                    />
                                </label>
                            </div>

                            <div style={{ marginTop: '20px' }}>
                                <span style={{ color: 'var(--soft)', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                                    Categorías químicas asociadas * (selecciona al menos una):
                                </span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {CATEGORIAS_QUIMICAS.map((cat) => {
                                        const activa = categorias.includes(cat);
                                        return (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => toggleCategoria(cat)}
                                                className={`tag-chip ${activa ? 'tag-chip--active' : ''}`}
                                            >
                                                {activa && '✓ '}
                                                {CATEGORIA_LABELS[cat]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ marginTop: '18px' }}>
                                <span style={{ color: 'var(--soft)', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                                    Incompatibilidades químicas (sustancias que provocan riesgo al contacto):
                                </span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {CATEGORIAS_QUIMICAS.map((cat) => {
                                        const esIncompatible = incompatibilidades.includes(cat);
                                        return (
                                            <button
                                                key={`incomp-${cat}`}
                                                type="button"
                                                onClick={() => toggleIncompatibilidad(cat)}
                                                className={`tag-chip tag-chip--danger ${esIncompatible ? 'tag-chip--danger-active' : ''}`}
                                            >
                                                {esIncompatible && '✕ '}
                                                {CATEGORIA_LABELS[cat]}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* SECCIÓN 2: Dosificación y Dilución */}
                            <p className="form-section-label" style={{ marginTop: '32px' }}>2 / Rangos de dilución recomendados (ml / L de agua)</p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginTop: '10px' }}>
                                <label className="site-name-label" style={{ margin: 0 }}>
                                    Mínima (ml/L) *
                                    <input
                                        type="number"
                                        min="0.1"
                                        step="0.5"
                                        required
                                        value={dilucionMin}
                                        onChange={(e) => setDilucionMin(e.target.value)}
                                        placeholder="20"
                                    />
                                </label>
                                <label className="site-name-label" style={{ margin: 0 }}>
                                    Recomendada (ml/L) *
                                    <input
                                        type="number"
                                        min="0.1"
                                        step="0.5"
                                        required
                                        value={dilucionRec}
                                        onChange={(e) => setDilucionRec(e.target.value)}
                                        placeholder="50"
                                    />
                                </label>
                                <label className="site-name-label" style={{ margin: 0 }}>
                                    Máxima (ml/L) *
                                    <input
                                        type="number"
                                        min="0.1"
                                        step="0.5"
                                        required
                                        value={dilucionMax}
                                        onChange={(e) => setDilucionMax(e.target.value)}
                                        placeholder="100"
                                    />
                                </label>
                                <label className="site-name-label" style={{ margin: 0 }}>
                                    Texto ficha técnica
                                    <input
                                        value={dilucionTexto}
                                        onChange={(e) => setDilucionTexto(e.target.value)}
                                        placeholder="Ej. 1:20 o 2-5%"
                                    />
                                </label>
                            </div>

                            {!dilucionValida && (
                                <p style={{ color: '#f47070', fontSize: '11px', margin: '8px 0 0' }}>
                                    ⚠️ Regla técnica: Dilución Mínima ({minVal} ml/L) ≤ Recomendada ({recVal} ml/L) ≤ Máxima ({maxVal} ml/L).
                                </p>
                            )}

                            {/* SECCIÓN 3: Propiedades Fisicoquímicas y Disposición */}
                            <p className="form-section-label" style={{ marginTop: '32px' }}>3 / pH, control ambiental y seguridad</p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '10px' }}>
                                <label className="site-name-label" style={{ margin: 0 }}>
                                    pH nominal (0 a 14)
                                    <input
                                        type="number"
                                        min="0"
                                        max="14"
                                        step="0.1"
                                        value={ph}
                                        onChange={(e) => setPh(e.target.value)}
                                        placeholder="Ej. 11.5"
                                    />
                                </label>
                                <label className="site-name-label" style={{ margin: 0 }}>
                                    Concentración medición pH
                                    <input
                                        value={concentracionPh}
                                        onChange={(e) => setConcentracionPh(e.target.value)}
                                        placeholder="Ej. pH al 1% o Puro"
                                    />
                                </label>
                                <label className="site-name-label" style={{ margin: 0 }}>
                                    pH medido a (ml/L)
                                    <input
                                        type="number"
                                        min="0.1"
                                        step="1"
                                        value={phMedidoMl}
                                        onChange={(e) => setPhMedidoMl(e.target.value)}
                                        placeholder="10"
                                    />
                                </label>
                            </div>

                            <label className="site-name-label" style={{ marginTop: '16px' }}>
                                Indicaciones de disposición final de efluentes
                                <textarea
                                    value={disposicion}
                                    onChange={(e) => setDisposicion(e.target.value)}
                                    placeholder="Indica precauciones de vertido, neutralización previa según sección 13 de la HDS..."
                                />
                            </label>

                            {/* SECCIÓN 4: Documentación Técnica */}
                            <p className="form-section-label" style={{ marginTop: '28px' }}>4 / Documentación digital (Opcional)</p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '10px' }}>
                                <label className="site-name-label" style={{ margin: 0 }}>
                                    URL Ficha Técnica (PDF)
                                    <input
                                        type="url"
                                        value={urlFicha}
                                        onChange={(e) => setUrlFicha(e.target.value)}
                                        placeholder="https://..."
                                    />
                                </label>
                                <label className="site-name-label" style={{ margin: 0 }}>
                                    URL Hoja de Seguridad FDS/SDS (PDF)
                                    <input
                                        type="url"
                                        value={urlSds}
                                        onChange={(e) => setUrlSds(e.target.value)}
                                        placeholder="https://..."
                                    />
                                </label>
                            </div>

                            <div className="new-site-actions" style={{ marginTop: '32px' }}>
                                <Link className="cancel-link" to="/supervisor">
                                    Cancelar
                                </Link>
                                <Button
                                    type="submit"
                                    disabled={!formularioValido || guardando}
                                >
                                    {guardando ? 'Guardando en catálogo...' : 'Registrar producto'} <span>→</span>
                                </Button>
                            </div>
                        </form>
                    </Card>
                )}
            </main>
        </div>
    );
}
