import { Component, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { obtenerDatosExplicadorSupervisor } from '../../../services/supervisor'
import { canShowDemo } from './config'
import type { DemoExplanation, DemoSnapshot } from './contracts'
import { DEMO_NOTICE, DEMO_QUESTIONS } from './explainDemo'
import type { DemoQuestionId } from './explainDemo'
import { DEMO_ERROR, prepareDemoView } from './view'
import './demo-explainer.css'

export class DemoErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <p role="alert" className="demo-explainer-error">
        {DEMO_ERROR}
      </p>
    ) : (
      this.props.children
    )
  }
}

export function DemoAnswer({ answer }: { answer: DemoExplanation }) {
  const sections = [
    ['Resumen', answer.summary],
    ['Evidencia', answer.evidence],
    ['Recomendación preliminar', answer.preliminaryRecommendation],
    ['Limitaciones', answer.limitations],
  ]
  return (
    <div className="demo-explainer-answer" aria-live="polite">
      {sections.map(([title, text]) => (
        <section key={title}>
          <h4>{title}</h4>
          <p>{text}</p>
        </section>
      ))}
    </div>
  )
}

export function DemoExplainer({
  role,
  mode = import.meta.env.VITE_LLM_MODE,
}: {
  role: unknown
  mode?: unknown
}) {
  const visible = canShowDemo(role, mode)
  const [open, setOpen] = useState(false)
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null)
  const [failed, setFailed] = useState(false)
  const [question, setQuestion] = useState<DemoQuestionId>('period')
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!visible) return
    let active = true
    obtenerDatosExplicadorSupervisor()
      .then((data) => {
        if (active) setSnapshot(data)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [visible])
  const view = useMemo(
    () => (snapshot ? prepareDemoView(snapshot, question) : null),
    [snapshot, question],
  )
  if (!visible) return null
  return (
    <div className="demo-explainer">
      <button
        ref={button}
        type="button"
        className="supervisor-header-btn"
        aria-expanded={open}
        aria-controls="demo-explainer-panel"
        onClick={() => setOpen(!open)}
      >
        Explicar resultados (demo)
      </button>
      {open && (
        <section
          id="demo-explainer-panel"
          className="demo-explainer-panel"
          aria-labelledby="demo-explainer-title"
        >
          <div className="demo-explainer-heading">
            <h2 id="demo-explainer-title">Explicación de resultados</h2>
            <button
              type="button"
              className="supervisor-header-btn"
              onClick={() => {
                setOpen(false)
                button.current?.focus()
              }}
            >
              Cerrar explicación
            </button>
          </div>
          <p className="demo-explainer-notice">{DEMO_NOTICE}</p>
          <p className="demo-explainer-scope">
            Todas las áreas · tareas cargadas · sin filtro de fechas. Las
            referencias de tareas y áreas evitan datos personales.
          </p>
          {!snapshot && !failed && (
            <p role="status">Cargando registros para la explicación…</p>
          )}
          {(failed || view?.error) && (
            <p role="alert" className="demo-explainer-error">
              {DEMO_ERROR}
            </p>
          )}
          {snapshot && !snapshot.tasks.length && (
            <p role="status">
              No hay tareas disponibles en el origen cargado. Las preguntas
              indican la información faltante.
            </p>
          )}
          {view && !view.error && (
            <>
              <p className="demo-explainer-source">
                Origen:{' '}
                {view.input.origin === 'supabase'
                  ? 'Supabase'
                  : 'almacenamiento local del navegador'}
                .{' '}
                {view.input.hasSimulation
                  ? 'Contiene datos o catálogo simulados.'
                  : 'La marca de medición procede del registro; no es una verificación independiente.'}
              </p>
              <nav
                className="demo-explainer-questions"
                aria-label="Preguntas preconfiguradas"
              >
                {DEMO_QUESTIONS.map((q) => (
                  <button
                    type="button"
                    key={q.id}
                    aria-pressed={question === q.id}
                    onClick={() => setQuestion(q.id)}
                  >
                    {q.label}
                  </button>
                ))}
              </nav>
              <h3 className="demo-explainer-question">
                {DEMO_QUESTIONS.find((q) => q.id === question)?.label}
              </h3>
              {view.answer.summary ===
                'No hay datos suficientes para responder' && (
                <p role="status">
                  Información insuficiente para esta pregunta.
                </p>
              )}
              <DemoAnswer answer={view.answer} />
            </>
          )}
        </section>
      )}
    </div>
  )
}
