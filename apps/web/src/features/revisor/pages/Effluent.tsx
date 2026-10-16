import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { calcularDesvio, evaluarEfluente } from '@ecocleaner/core'
import type { Orientacion } from '@ecocleaner/schemas'
import {
  Alert,
  Button,
  Card,
  NumberStepper,
  OperarioHeader,
  PageHeader,
  Select,
  Spinner,
} from '../../../components/ui'
import { formatNumber } from '../../../lib/format'
import { operarioConfig, type ProductoOperario } from '../../../services/operarioMock'
import { obtenerProducto } from '../../../services/productos'
import {
  guardarDecisionEfluente,
  obtenerRegistro,
  obtenerResultadoPorRegistro,
  obtenerTarea,
  type DecisionFinalOperario,
  type RegistroUsoOperario,
  type ResultadoOperario,
  type TareaOperario,
} from '../../../services/tareas'
import { OPERARIO_STEPS } from '../../../context/flow'

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

export default function Effluent() {
  const { registroId = '' } = useParams()
  const navigate = useNavigate()

  const [registro, setRegistro] = useState<RegistroUsoOperario | null>(null)
  const [tarea, setTarea] = useState<TareaOperario | null>(null)
  const [catalogo, setCatalogo] = useState<ProductoOperario | null>(null)
  const [resultado, setResultado] = useState<ResultadoOperario | null>(null)
  const [cargando, setCargando] = useState(true)

  const [sobrantes, setSobrantes] = useState(false)
  const [midePh, setMidePh] = useState(false)
  const [phValor, setPhValor] = useState(7)
  const [phFuente, setPhFuente] = useState(operarioConfig.fuentesPhEfluente[0])
  const [reuso, setReuso] = useState(false)
  const [decisionOverride, setDecisionOverride] = useState<
    DecisionFinalOperario | '' | null
  >(null)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    let activo = true
    Promise.all([
      obtenerRegistro(registroId),
      obtenerResultadoPorRegistro(registroId),
    ]).then(async ([registroActual, resultadoActual]) => {
      if (!activo) return
      setRegistro(registroActual)
      setResultado(resultadoActual)
      if (registroActual) {
        const tareaActual = await obtenerTarea(registroActual.tarea_id)
        if (!activo) return
        setTarea(tareaActual)
        if (tareaActual) {
          const prod = await obtenerProducto(tareaActual.producto_id)
          if (!activo) return
          setCatalogo(prod ?? null)
        }
      }
      setCargando(false)
    })
    return () => {
      activo = false
    }
  }, [registroId])

  const mlPreparado = useMemo(() => {
    if (!registro || !tarea) return 0
    try {
      return calcularDesvio({
        receta: tarea.receta,
        litros_agua_reales: registro.litros_agua_reales,
        ml_producto_reales: registro.ml_producto_reales,
        dilucion_max_ml_por_litro:
          catalogo?.dilucion_max_ml_por_litro ?? tarea.receta.ml_por_litro,
      }).ml_por_litro_real
    } catch {
      return tarea.receta.ml_por_litro
    }
  }, [registro, tarea, catalogo])

  const evaluacion = useMemo(() => {
    if (!tarea || !registro) return null
    return evaluarEfluente({
      producto: {
        ph: catalogo?.ph ?? null,
        ph_medido_a_ml_por_litro: catalogo?.ph_medido_a_ml_por_litro ?? null,
      },
      ml_por_litro_preparado: mlPreparado,
      rango_ph_descarga: operarioConfig.rangoPhDescarga,
      quedan_sobrantes_concentrados: sobrantes,
      permite_reuso: reuso,
      medicion_ph_efluente: midePh
        ? { valor: phValor, fuente: phFuente }
        : undefined,
      validacion_rango: operarioConfig.validacionRango,
    })
  }, [
    tarea,
    registro,
    catalogo,
    mlPreparado,
    sobrantes,
    reuso,
    midePh,
    phValor,
    phFuente,
  ])

  // Sugerencia editable según la orientación; sin preselección si es no_disponible.
  const sugerencia: DecisionFinalOperario | '' =
    evaluacion && evaluacion.orientacion !== 'no_disponible'
      ? evaluacion.orientacion
      : ''
  const decisionFinal = decisionOverride ?? sugerencia

  const guardar = async () => {
    if (!resultado || !evaluacion || !decisionFinal) return
    setGuardando(true)
    await guardarDecisionEfluente({
      resultado_id: resultado.id,
      orientacion: evaluacion.orientacion,
      decision_final: decisionFinal,
      ph_estimado: midePh ? Number(phValor) : null,
      observaciones: null,
    })
    setGuardando(false)
    setGuardado(true)
  }

  if (cargando) {
    return (
      <div className="revisor-shell">
        <main className="operario-main">
          <Card className="operario-card">
            <p className="loading-row">
              <Spinner />{' '}
              <span className="muted">Preparando la guía de efluente…</span>
            </p>
          </Card>
        </main>
      </div>
    )
  }

  if (!registro) {
    return (
      <div className="revisor-shell">
        <OperarioHeader
          eyebrow="EcoCleaner · Auditoría y Revisión"
          title="Guía de efluente"
          backTo="/revisor"
          breadcrumb={[
            { label: 'Revisor', to: '/revisor' },
            { label: 'Efluente' },
          ]}
          steps={OPERARIO_STEPS}
          currentStep={3}
        />
        <main className="operario-main">
          <PageHeader
            eyebrow="Efluente"
            title="Registro no encontrado"
            description="No hay un registro de uso para este identificador."
          />
          <Alert tone="warning" title="Sin registro activo">
            Vuelve a la bandeja de revisor para evaluar el efluente.
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
    <div className="revisor-shell">
      <OperarioHeader
        eyebrow="EcoCleaner · Auditoría y Revisión"
        title="Guía de efluente"
        backTo={`/revisor/criterio/${registro.id}`}
        breadcrumb={[
          { label: 'Revisor', to: '/revisor' },
          { label: 'Efluente' },
        ]}
        steps={OPERARIO_STEPS}
        currentStep={3}
      />

      <main className="operario-main">
        <PageHeader
          eyebrow="Trazabilidad ambiental"
          title="Orientación de efluente"
          description="El software orienta y documenta; no neutraliza el efluente ni autoriza vertidos."
        />

        {!resultado ? (
          <>
            <Alert tone="warning" title="Falta el criterio de limpieza">
              Registra primero el criterio de limpieza de la tarea para poder
              guardar la decisión de efluente.
            </Alert>
            <div className="operario-actions">
              <Link
                className="ghost-button"
                to={`/operario/criterio/${registro.id}`}
              >
                Evaluar criterio
              </Link>
            </div>
          </>
        ) : (
          <>
            <Card className="operario-card">
              <div className="form-grid">
                <Select
                  label="¿Quedan sobrantes concentrados?"
                  id="sobrantes"
                  value={sobrantes ? 'si' : 'no'}
                  onChange={(event) =>
                    setSobrantes(event.target.value === 'si')
                  }
                >
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                </Select>
                <Select
                  label="¿Se permite el reúso?"
                  id="reuso"
                  value={reuso ? 'si' : 'no'}
                  onChange={(event) => setReuso(event.target.value === 'si')}
                >
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                </Select>
                <Select
                  label="¿Mediste el pH del efluente?"
                  id="mide-ph"
                  value={midePh ? 'si' : 'no'}
                  onChange={(event) => setMidePh(event.target.value === 'si')}
                >
                  <option value="no">No</option>
                  <option value="si">Sí</option>
                </Select>
                {midePh && (
                  <Select
                    label="Fuente de la medición"
                    id="fuente-ph"
                    value={phFuente}
                    onChange={(event) => setPhFuente(event.target.value)}
                  >
                    {operarioConfig.fuentesPhEfluente.map((fuente) => (
                      <option key={fuente} value={fuente}>
                        {fuente}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              {midePh && (
                <div className="stepper-grid">
                  <NumberStepper
                    id="ph-efluente"
                    label="pH medido del efluente"
                    value={phValor}
                    onChange={setPhValor}
                    step={0.1}
                    min={0}
                    max={14}
                  />
                </div>
              )}
            </Card>

            {evaluacion && (
              <Card className="operario-result">
                <p className="section-kicker">Orientación</p>
                <Alert
                  tone={TONO_ORIENTACION[evaluacion.orientacion]}
                  title={ETIQUETA_ORIENTACION[evaluacion.orientacion]}
                >
                  {evaluacion.motivo}
                </Alert>

                <div className="result-grid">
                  <div className="result-item">
                    <small>pH del efluente</small>
                    <strong>
                      {evaluacion.ph_efluente === null
                        ? 'No disponible'
                        : formatNumber(evaluacion.ph_efluente)}
                    </strong>
                  </div>
                  <div className="result-item">
                    <small>Origen del pH</small>
                    <strong>{evaluacion.origen_ph}</strong>
                  </div>
                  <div className="result-item">
                    <small>Concentración preparada</small>
                    <strong>{formatNumber(mlPreparado)} ml/L</strong>
                  </div>
                </div>

                {evaluacion.referencias.length > 0 && (
                  <p className="muted">
                    Referencias: {evaluacion.referencias.join(' · ')}
                  </p>
                )}

                <Alert tone="info" title="Requiere revisión">
                  Esta orientación es preliminar: requiere revisión del
                  responsable y no constituye autorización legal ni
                documentación definitiva de seguridad.
                </Alert>

                <Select
                  label="Decisión final"
                  id="decision-final"
                  value={decisionFinal}
                  onChange={(event) =>
                    setDecisionOverride(
                      event.target.value as DecisionFinalOperario | '',
                    )
                  }
                  hint="Se sugiere según la orientación; se guarda solo al confirmar."
                >
                  <option value="" disabled>
                    Selecciona una decisión
                  </option>
                  {DECISIONES.map((decision) => (
                    <option key={decision.value} value={decision.value}>
                      {decision.label}
                    </option>
                  ))}
                </Select>

                <div className="operario-actions operario-actions--sticky">
                  <Button
                    type="button"
                    onClick={guardar}
                    disabled={guardando || !decisionFinal}
                    aria-busy={guardando}
                  >
                    {guardando ? (
                      <>
                        <Spinner label="Guardando decisión" /> Guardando…
                      </>
                    ) : (
                      <>
                        Guardar decisión <span>→</span>
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}

        {guardado && (
          <Card className="operario-result">
            <Alert tone="success" title="Decisión registrada">
              La decisión de efluente quedó vinculada al resultado de la tarea.
            </Alert>
            <div className="operario-actions">
              <Button type="button" onClick={() => navigate('/operario')}>
                Finalizar
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
