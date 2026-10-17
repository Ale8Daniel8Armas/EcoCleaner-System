import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  calcularDesvio,
  evaluarEfluente,
} from '@ecocleaner/core'
import type { Orientacion } from '@ecocleaner/schemas'
import {
  Alert,
  Button,
  SimulatedBadge,
  Card,
  CriteriaChecklist,
  NumberStepper,
  PageHeader,
  Select,
  Spinner,
  StepIndicator,
} from '../../../components/ui'
import { formatNumber, formatPercent } from '../../../lib/format'
import { operarioConfig, type ProductoOperario } from '../../../services/operarioMock'
import { obtenerProducto } from '../../../services/productos'
import { obtenerArea, obtenerSitio } from '../../../services/sitios'
import {
  obtenerRegistroPorTarea,
  obtenerTarea,
  validarTareaTransaccional,
  type DecisionFinalOperario,
  type RegistroUsoOperario,
  type TareaOperario,
} from '../../../services/tareas'
import { obtenerUsuarioActual } from '../../../services/usuarios'

// TODO: verificar con la norma vigente según el tipo de industria y jurisdicción ambiental
const RANGO_PH_DESCARGA_CONFIGURABLE: { min: number; max: number } = { min: 6.0, max: 9.0 }

const WIZARD_STEPS = [
  { label: 'Uso real' },
  { label: 'Criterio de limpieza' },
  { label: 'Efluente' },
]

const ETIQUETA_ORIENTACION: Record<Orientacion, string> = {
  verter: 'Verter',
  ajustar: 'Ajustar / evaluación técnica',
  reutilizar: 'Reutilizar',
  gestor: 'Gestor autorizado',
  no_disponible: 'No disponible',
}

const TONO_ORIENTACION: Record<
  Orientacion,
  'info' | 'success' | 'warning' | 'error'
> = {
  verter: 'success',
  ajustar: 'warning',
  reutilizar: 'info',
  gestor: 'warning',
  no_disponible: 'info',
}

const DECISIONES: { value: DecisionFinalOperario; label: string }[] = [
  { value: 'verter', label: 'Verter' },
  { value: 'ajustar', label: 'Ajustar' },
  { value: 'reutilizar', label: 'Reutilizar' },
  { value: 'gestor', label: 'Entregar a gestor autorizado' },
]

export default function ValidationWizard() {
  const { tareaId = '' } = useParams()
  const navigate = useNavigate()

  const [step, setStep] = useState<number>(0)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [completado, setCompletado] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Datos base de la tarea
  const [tarea, setTarea] = useState<TareaOperario | null>(null)
  const [producto, setProducto] = useState<ProductoOperario | null>(null)
  const [registroOriginal, setRegistroOriginal] = useState<RegistroUsoOperario | null>(null)
  const [nombreSitio, setNombreSitio] = useState('Sitio')
  const [nombreArea, setNombreArea] = useState('Área')

  // Paso 1: Uso real (confirmado o corregido por revisor)
  const [aguaRevisada, setAguaRevisada] = useState<number>(0)
  const [productoRevisado, setProductoRevisado] = useState<number>(0)
  const [marca, setMarca] = useState<'medido' | 'estimado'>('medido')

  // Paso 2: Criterio
  const [criteriosItems, setCriteriosItems] = useState<{ criterio: string; cumple: boolean }[]>([])
  const [observacionesCriterio, setObservacionesCriterio] = useState('')

  // Paso 3: Efluente
  const [sobrantes, setSobrantes] = useState(false)
  const [reuso, setReuso] = useState(false)
  const [midePh, setMidePh] = useState(false)
  const [phValor, setPhValor] = useState<number>(7.0)
  const [phFuente, setPhFuente] = useState(operarioConfig.fuentesPhEfluente[0])
  const [decisionOverride, setDecisionOverride] = useState<DecisionFinalOperario | '' | null>(null)
  const [observacionesEfluente, setObservacionesEfluente] = useState('')

  useEffect(() => {
    let activo = true
    Promise.all([
      obtenerTarea(tareaId),
      obtenerRegistroPorTarea(tareaId),
    ]).then(async ([t, reg]) => {
      if (!activo) return
      setTarea(t)
      setRegistroOriginal(reg)

      if (t) {
        const prod = await obtenerProducto(t.producto_id)
        const areaData = await obtenerArea(t.area_id)
        const sitioData = areaData ? await obtenerSitio(areaData.sitio_id) : null

        if (!activo) return
        setProducto(prod ?? null)
        if (areaData) setNombreArea(areaData.nombre)
        if (sitioData) {
          setNombreSitio(sitioData.nombre)
          const crit = sitioData.criterios_limpieza ?? []
          setCriteriosItems(crit.map((c) => ({ criterio: c, cumple: true })))
        }

        // Inicializar cantidades con lo declarado por el operario o la receta
        const ag = reg ? reg.litros_agua_reales : t.receta.litros_agua
        const pr = reg ? reg.ml_producto_reales : t.receta.ml_producto
        setAguaRevisada(ag)
        setProductoRevisado(pr)
        if (reg) {
          setMarca(reg.marca)
        }
      }
      setCargando(false)
    })

    return () => {
      activo = false
    }
  }, [tareaId])

  // Desvío con las cantidades revisadas
  const desvio = useMemo(() => {
    if (!tarea || !producto) return null
    try {
      return calcularDesvio({
        receta: tarea.receta,
        litros_agua_reales: aguaRevisada,
        ml_producto_reales: productoRevisado,
        dilucion_max_ml_por_litro: producto.dilucion_max_ml_por_litro,
        tolerancia_pct: operarioConfig.toleranciaSobredosisPct,
      })
    } catch {
      return null
    }
  }, [tarea, producto, aguaRevisada, productoRevisado])

  // Detección de corrección frente a lo original del operario
  const fueCorregido = useMemo(() => {
    if (!registroOriginal) return false
    return (
      registroOriginal.litros_agua_reales !== aguaRevisada ||
      registroOriginal.ml_producto_reales !== productoRevisado
    )
  }, [registroOriginal, aguaRevisada, productoRevisado])

  // Cumplimiento de criterios en código
  const cumpleCriterio = useMemo(() => {
    return criteriosItems.length > 0 && criteriosItems.every((item) => item.cumple)
  }, [criteriosItems])

  const cambiarCriterio = (idx: number, cumple: boolean) => {
    setCriteriosItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, cumple } : item)),
    )
  }

  // Concentración y evaluación de efluente
  const mlPreparado = useMemo(() => {
    if (!tarea || !desvio) return tarea?.receta.ml_por_litro ?? 50
    return desvio.ml_por_litro_real
  }, [tarea, desvio])

  const evaluacion = useMemo(() => {
    if (!tarea) return null
    return evaluarEfluente({
      producto: {
        ph: producto?.ph ?? null,
        ph_medido_a_ml_por_litro: producto?.ph_medido_a_ml_por_litro ?? null,
      },
      ml_por_litro_preparado: mlPreparado,
      rango_ph_descarga: RANGO_PH_DESCARGA_CONFIGURABLE,
      quedan_sobrantes_concentrados: sobrantes,
      permite_reuso: reuso,
      medicion_ph_efluente: midePh
        ? { valor: phValor, fuente: phFuente }
        : undefined,
      validacion_rango: operarioConfig.validacionRango,
    })
  }, [
    tarea,
    producto,
    mlPreparado,
    sobrantes,
    reuso,
    midePh,
    phValor,
    phFuente,
  ])

  const sugerencia: DecisionFinalOperario | '' =
    evaluacion && evaluacion.orientacion !== 'no_disponible'
      ? evaluacion.orientacion
      : ''
  const decisionFinal = decisionOverride ?? sugerencia

  const handleFinalizarValidacion = async () => {
    if (!tarea || !evaluacion || !decisionFinal) return
    setGuardando(true)
    setErrorMsg(null)

    const revisorActual = obtenerUsuarioActual()
    const revisorId = revisorActual?.id || 'usr-revisor-default'

    // Si el revisor corrigió las cantidades, respaldamos lo declarado originalmente en declarado_operario
    const declaradoOperario = fueCorregido && registroOriginal
      ? {
          litros_agua_reales: registroOriginal.litros_agua_reales,
          ml_producto_reales: registroOriginal.ml_producto_reales,
          corregido_en: new Date().toISOString(),
        }
      : (registroOriginal?.declarado_operario ?? null)

    const res = await validarTareaTransaccional({
      tarea_id: tarea.id,
      revisor_id: revisorId,
      litros_agua_reales: aguaRevisada,
      ml_producto_reales: productoRevisado,
      marca,
      declarado_operario: declaradoOperario,
      cumple_criterio: cumpleCriterio,
      criterios_evaluados: criteriosItems,
      observaciones_criterio: observacionesCriterio.trim() || null,
      orientacion: evaluacion.orientacion,
      decision_final: decisionFinal,
      ph_estimado: midePh ? Number(phValor) : null,
      observaciones_efluente: observacionesEfluente.trim() || null,
    })

    setGuardando(false)
    if (!res.ok) {
      setErrorMsg(res.error || 'Ocurrió un error al validar la tarea.')
      return
    }

    setCompletado(true)
    setTimeout(() => {
      navigate('/revisor')
    }, 1500)
  }

  if (cargando) {
    return (
      <div className="revisor-shell">
        <main className="operario-main">
          <Card className="operario-card">
            <p className="loading-row">
              <Spinner /> <span className="muted">Cargando datos de la tarea para validación…</span>
            </p>
          </Card>
        </main>
      </div>
    )
  }

  if (!tarea) {
    return (
      <div className="revisor-shell">
        <main className="operario-main">
          <PageHeader
            eyebrow="Validación"
            title="Tarea no encontrada"
            description="El identificador de tarea no existe en el sistema."
          />
          <Alert tone="warning" title="Sin tarea">
            No se encontró la tarea seleccionada.
          </Alert>
          <div className="operario-actions">
            <Link className="ghost-button" to="/revisor">
              Volver a la bandeja
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="revisor-shell validation-wizard-shell">
      <header className="operario-header validation-wizard-header">
        <div className="brand-lockup">
          <Link className="back-link" to="/revisor" aria-label="Volver a la bandeja">
            ←
          </Link>
          <div>
            <p className="eyebrow">EcoCleaner · Asistente de Revisor</p>
            <h1>Validación técnica de tarea</h1>
          </div>
        </div>
      </header>

      <main className="operario-main validation-wizard-main">
        <Card className="validation-workspace">
        {/* StepIndicator en el asistente de 3 pasos */}
        <div className="validation-progress">
          <StepIndicator steps={WIZARD_STEPS} current={step} />
        </div>

        {errorMsg && (
          <div style={{ marginBottom: '16px' }}>
            <Alert tone="error">{errorMsg}</Alert>
          </div>
        )}

        {completado && (
          <div style={{ marginBottom: '16px' }}>
            <Alert tone="success" title="¡Tarea validada con éxito!">
              La tarea ha pasado a estado «completada» y ahora está visible en el panel general del supervisor. Redirigiendo a tu bandeja...
            </Alert>
          </div>
        )}

        {/* Resumen contextual fijo */}
        <div className="validation-summary">
          <div className="validation-summary-main">
            <div>
              <span className="section-kicker">Tarea en revisión</span>
              <h3 style={{ margin: '2px 0' }}>{tarea.tipo_tarea || 'Lavado general'}</h3>
              <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
                {nombreSitio} · {nombreArea} · <strong>{producto?.nombre ?? 'Producto químico'}</strong>
              </p>
            </div>
            <div className="validation-summary-surface">
              <span className="muted" style={{ display: 'block', fontSize: '12px' }}>Superficie</span>
              <strong>{formatNumber(tarea.superficie_m2)} m²</strong>
            </div>
          </div>
        </div>

        {/* PASO 1: USO REAL */}
        {step === 0 && (
          <section className="validation-step-card">
            <div className="card-heading validation-step-heading">
              <div>
                <p className="section-kicker">Paso 1 de 3</p>
                <h3>Verificación del uso real {registroOriginal?.fuente === 'simulada' && <SimulatedBadge />}</h3>
              </div>
            </div>

            <div className="result-grid validation-result-grid">
              <div className="result-item">
                <small>Receta esperada</small>
                <strong>{formatNumber(tarea.receta.litros_agua)} L agua / {formatNumber(tarea.receta.ml_producto)} ml prod</strong>
              </div>
              <div className="result-item">
                <small>Cantidad reportada por el operario</small>
                <strong style={{ color: '#2563eb' }}>
                  {registroOriginal ? `${formatNumber(registroOriginal.litros_agua_reales)} L / ${formatNumber(registroOriginal.ml_producto_reales)} ml` : 'Sin registro previo'}
                </strong>
              </div>
              <div className="result-item">
                <small>Concentración esperada</small>
                <strong>{formatNumber(tarea.receta.ml_por_litro)} ml/L</strong>
              </div>
            </div>

            <p className="section-kicker validation-section-label">Cantidades verificadas por el revisor</p>
            <div className="stepper-grid validation-input-grid">
              <NumberStepper
                id="revisor-agua"
                label="Litros de agua confirmados"
                value={aguaRevisada}
                onChange={setAguaRevisada}
                step={0.5}
                min={0}
                max={10000}
                unit="L"
              />
              <NumberStepper
                id="revisor-producto"
                label="Ml de producto confirmados"
                value={productoRevisado}
                onChange={setProductoRevisado}
                step={10}
                min={0}
                max={100000}
                unit="ml"
              />
            </div>

            <div className="form-grid validation-form-grid">
              <Select
                label="Tipo de comprobación (Marca)"
                id="revisor-marca"
                value={marca}
                onChange={(e) => setMarca(e.target.value as 'medido' | 'estimado')}
              >
                <option value="medido">Medido (aforo / caudalímetro / pesaje)</option>
                <option value="estimado">Estimado (cálculo visual o aproximado)</option>
              </Select>
            </div>

            {desvio && (
              <div className="validation-feedback">
                <div className="result-grid validation-result-grid">
                  <div className="result-item">
                    <small>Concentración real</small>
                    <strong>{formatNumber(desvio.ml_por_litro_real)} ml/L</strong>
                  </div>
                  <div className="result-item">
                    <small>Desvío</small>
                    <strong>{formatPercent(desvio.desvio_pct)} %</strong>
                  </div>
                </div>

                {desvio.supera_maximo_ficha ? (
                  <Alert tone="error" title="Supera máximo de ficha técnica">
                    La concentración validada ({formatNumber(desvio.ml_por_litro_real)} ml/L) supera el límite máximo del fabricante ({producto?.dilucion_max_ml_por_litro} ml/L).
                  </Alert>
                ) : desvio.sobredosis ? (
                  <Alert tone="warning" title="Alerta de sobredosis">
                    El desvío excede la tolerancia permitida ({operarioConfig.toleranciaSobredosisPct}%).
                  </Alert>
                ) : (
                  <Alert tone="success" title="Dosificación en rango">
                    La mezcla se encuentra dentro de los parámetros de tolerancia técnica.
                  </Alert>
                )}
              </div>
            )}

            {fueCorregido && (
              <Alert tone="info" title="Corrección registrada">
                Has modificado las cantidades respecto a lo declarado por el operario. Los valores originales ({registroOriginal?.litros_agua_reales} L / {registroOriginal?.ml_producto_reales} ml) se guardarán en <code>declarado_operario</code> para auditoría.
              </Alert>
            )}

            <div className="operario-actions validation-actions">
              <Button type="button" onClick={() => setStep(1)}>
                Continuar a Criterio de limpieza <span>→</span>
              </Button>
            </div>
          </section>
        )}

        {/* PASO 2: CRITERIO */}
        {step === 1 && (
          <section className="validation-step-card">
            <div className="card-heading validation-step-heading">
              <div>
                <p className="section-kicker">Paso 2 de 3</p>
                <h3>Criterios de limpieza y seguridad del proceso</h3>
              </div>
            </div>

            {criteriosItems.length > 0 ? (
              <CriteriaChecklist items={criteriosItems} onChange={cambiarCriterio} />
            ) : (
              <Alert tone="info" title="Sin criterios definidos">
                Este sitio no tiene criterios de limpieza configurados en su catálogo.
              </Alert>
            )}

            <Alert
              tone={cumpleCriterio ? 'success' : 'warning'}
              title={cumpleCriterio ? 'Cumple el criterio' : 'No cumple todos los criterios'}
            >
              {cumpleCriterio
                ? 'Todos los puntos de inspección cumplen. La tarea documenta las condiciones seguras del área.'
                : 'Al menos un criterio no cumple. Se registrará la observación para control de calidad.'}
            </Alert>

            <div className="validation-observations">
              <label htmlFor="obs-criterio" className="ui-field-label">
                Observaciones del revisor (opcional):
              </label>
              <textarea
                id="obs-criterio"
                className="ui-field-input"
                style={{ width: '100%', minHeight: '80px', borderRadius: '8px' }}
                placeholder="Anota detalles de la inspección o motivos de no conformidad..."
                value={observacionesCriterio}
                onChange={(e) => setObservacionesCriterio(e.target.value)}
              />
            </div>

            <div className="operario-actions validation-actions">
              <Button variant="ghost" type="button" onClick={() => setStep(0)}>
                ← Volver a Uso
              </Button>
              <Button type="button" onClick={() => setStep(2)}>
                Continuar a Efluente <span>→</span>
              </Button>
            </div>
          </section>
        )}

        {/* PASO 3: EFLUENTE */}
        {step === 2 && (
          <section className="validation-step-card">
            <div className="card-heading validation-step-heading">
              <div>
                <p className="section-kicker">Paso 3 de 3</p>
                <h3>Orientación y control de efluente</h3>
              </div>
            </div>

            <div className="form-grid validation-form-grid">
              <Select
                label="¿Quedan sobrantes concentrados?"
                id="revisor-sobrantes"
                value={sobrantes ? 'si' : 'no'}
                onChange={(e) => setSobrantes(e.target.value === 'si')}
              >
                <option value="no">No</option>
                <option value="si">Sí (sobrante químico no diluido)</option>
              </Select>

              <Select
                label="¿Se permite el reúso del efluente?"
                id="revisor-reuso"
                value={reuso ? 'si' : 'no'}
                onChange={(e) => setReuso(e.target.value === 'si')}
              >
                <option value="no">No</option>
                <option value="si">Sí (reutilización en prelavado)</option>
              </Select>

              <Select
                label="¿Se realizó medición analítica de pH?"
                id="revisor-mide-ph"
                value={midePh ? 'si' : 'no'}
                onChange={(e) => setMidePh(e.target.value === 'si')}
              >
                <option value="no">No (usar pH de ficha técnica si aplica)</option>
                <option value="si">Sí (medición en campo)</option>
              </Select>

              {midePh && (
                <Select
                  label="Fuente de medición"
                  id="revisor-fuente-ph"
                  value={phFuente}
                  onChange={(e) => setPhFuente(e.target.value)}
                >
                  {operarioConfig.fuentesPhEfluente.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {midePh && (
              <div className="stepper-grid validation-input-grid">
                <NumberStepper
                  id="revisor-ph-valor"
                  label="pH medido del efluente"
                  value={phValor}
                  onChange={setPhValor}
                  step={0.1}
                  min={0}
                  max={14}
                />
              </div>
            )}

            {evaluacion && (
              <div className="validation-feedback">
                <p className="section-kicker">Dictamen de Orientación</p>
                <Alert
                  tone={TONO_ORIENTACION[evaluacion.orientacion]}
                  title={ETIQUETA_ORIENTACION[evaluacion.orientacion]}
                >
                  {evaluacion.motivo}
                </Alert>

                <div className="result-grid validation-result-grid">
                  <div className="result-item">
                    <small>pH considerado</small>
                    <strong>
                      {evaluacion.ph_efluente !== null
                        ? formatNumber(evaluacion.ph_efluente)
                        : (producto?.ph !== null && producto?.ph !== undefined
                            ? `${formatNumber(producto.ph)} (ficha)`
                            : 'dato no disponible')}
                    </strong>
                  </div>
                  <div className="result-item">
                    <small>Origen del dato pH</small>
                    <strong>{evaluacion.origen_ph}</strong>
                  </div>
                  <div className="result-item">
                    <small>Concentración preparada</small>
                    <strong>{formatNumber(mlPreparado)} ml/L</strong>
                  </div>
                </div>

                <div className="form-grid validation-form-grid">
                  <Select
                    label="Decisión final del revisor *"
                    id="revisor-decision-final"
                    value={decisionFinal}
                    onChange={(e) => setDecisionOverride(e.target.value as DecisionFinalOperario)}
                    hint="Determina la disposición final trazable en el sistema."
                  >
                    <option value="" disabled>
                      Selecciona una decisión
                    </option>
                    {DECISIONES.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="validation-observations">
                  <label htmlFor="obs-efluente" className="ui-field-label">
                    Observaciones ambientales:
                  </label>
                  <textarea
                    id="obs-efluente"
                    className="ui-field-input"
                    style={{ width: '100%', minHeight: '70px', borderRadius: '8px' }}
                    placeholder="Detalles sobre vertido, neutralización o gestor ambiental..."
                    value={observacionesEfluente}
                    onChange={(e) => setObservacionesEfluente(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="operario-actions validation-actions">
              <Button variant="ghost" type="button" onClick={() => setStep(1)} disabled={guardando}>
                ← Volver a Criterio
              </Button>
              <Button
                type="button"
                onClick={handleFinalizarValidacion}
                disabled={guardando || !decisionFinal}
                aria-busy={guardando}
              >
                {guardando ? (
                  <>
                    <Spinner label="Validando..." /> Registrando validación…
                  </>
                ) : (
                  'Completar y validar tarea ✓'
                )}
              </Button>
            </div>
          </section>
        )}
        </Card>
      </main>
    </div>
  )
}
