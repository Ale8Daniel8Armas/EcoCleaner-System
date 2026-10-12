import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  CriteriaChecklist,
  OperarioHeader,
  PageHeader,
  Spinner,
} from '../../../components/ui'
import { OPERARIO_STEPS } from '../../../context/flow'
import { areas, getSitio } from '../../../services/operarioMock'
import {
  guardarResultado,
  obtenerRegistro,
  obtenerTarea,
  type RegistroUsoOperario,
  type TareaOperario,
} from '../../../services/tareas'

interface ChecklistItem {
  criterio: string
  cumple: boolean
}

const criteriosDeTarea = (tarea: TareaOperario | null): string[] => {
  if (!tarea) return []
  const area = areas.find((item) => item.id === tarea.area_id)
  const sitio = area ? getSitio(area.sitio_id) : undefined
  return sitio?.criterios_limpieza ?? []
}

export default function Criteria() {
  const { registroId = '' } = useParams()
  const navigate = useNavigate()

  const [registro, setRegistro] = useState<RegistroUsoOperario | null>(null)
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    let activo = true
    obtenerRegistro(registroId).then(async (resultado) => {
      if (!activo) return
      setRegistro(resultado)
      if (resultado) {
        const tareaActual = await obtenerTarea(resultado.tarea_id)
        if (!activo) return
        const criterios = criteriosDeTarea(tareaActual)
        setItems(criterios.map((criterio) => ({ criterio, cumple: true })))
      }
      setCargando(false)
    })
    return () => {
      activo = false
    }
  }, [registroId])

  const cumpleCriterio = items.length > 0 && items.every((item) => item.cumple)

  const cambiar = (index: number, cumple: boolean) => {
    setItems((actual) =>
      actual.map((item, itemIndex) =>
        itemIndex === index ? { ...item, cumple } : item,
      ),
    )
  }

  const guardar = async () => {
    if (!registro) return
    setGuardando(true)
    await guardarResultado({
      registro_uso_id: registro.id,
      cumple_criterio: cumpleCriterio,
      criterios_evaluados: items,
      observaciones: null,
    })
    setGuardando(false)
    setGuardado(true)
  }

  if (cargando) {
    return (
      <div className="operario-shell">
        <main className="operario-main">
          <Card className="operario-card">
            <p className="loading-row">
              <Spinner /> <span className="muted">Cargando el criterio…</span>
            </p>
          </Card>
        </main>
      </div>
    )
  }

  if (!registro) {
    return (
      <div className="operario-shell">
        <OperarioHeader
          title="Criterio de limpieza"
          backTo="/operario"
          breadcrumb={[
            { label: 'Operario', to: '/operario' },
            { label: 'Criterio' },
          ]}
          steps={OPERARIO_STEPS}
          currentStep={2}
        />
        <main className="operario-main">
          <PageHeader
            eyebrow="Criterio"
            title="Registro no encontrado"
            description="No hay un registro de uso para este identificador."
          />
          <Alert tone="warning" title="Sin registro activo">
            Vuelve a registrar el uso de una tarea para evaluar su criterio.
          </Alert>
          <div className="operario-actions">
            <Link className="ghost-button" to="/operario">
              Volver al inicio
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="operario-shell">
      <OperarioHeader
        title="Criterio de limpieza"
        backTo={`/operario/registro/${registro.tarea_id}`}
        breadcrumb={[
          { label: 'Operario', to: '/operario' },
          { label: 'Criterio' },
        ]}
        steps={OPERARIO_STEPS}
        currentStep={2}
      />

      <main className="operario-main">
        <PageHeader
          eyebrow="Evaluación"
          title="¿La limpieza cumplió su criterio?"
          description="El resultado se calcula en código: cumple solo si todos los criterios cumplen."
        />

        <Card className="operario-card">
          {items.length ? (
            <CriteriaChecklist items={items} onChange={cambiar} />
          ) : (
            <Alert tone="info" title="Sin criterios definidos">
              El supervisor no ha definido criterios para este sitio.
            </Alert>
          )}

          <Alert
            tone={cumpleCriterio ? 'success' : 'warning'}
            title={
              cumpleCriterio ? 'Cumple el criterio' : 'No cumple el criterio'
            }
          >
            {cumpleCriterio
              ? 'Todos los criterios cumplen; el resultado alimentará la comparación de variantes.'
              : 'Al menos un criterio no cumple; la variante se descartará en la comparación.'}
          </Alert>

          <div className="operario-actions operario-actions--sticky">
            <Button
              type="button"
              onClick={guardar}
              disabled={guardando || !items.length}
              aria-busy={guardando}
            >
              {guardando ? (
                <>
                  <Spinner label="Guardando resultado" /> Guardando…
                </>
              ) : (
                <>
                  Guardar resultado <span>→</span>
                </>
              )}
            </Button>
          </div>
        </Card>

        {guardado && (
          <Card className="operario-result">
            <Alert tone="success" title="Resultado guardado">
              El resultado quedó vinculado al registro de la tarea.
            </Alert>
            <div className="operario-actions operario-actions--sticky">
              <Button
                type="button"
                onClick={() => navigate(`/operario/efluente/${registro.id}`)}
              >
                Guía de efluente <span>→</span>
              </Button>
              <Button type="button" onClick={() => navigate('/operario')}>
                Volver al inicio
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  )
}
