import { Component, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, SubmitEvent } from 'react'
import { obtenerDatosExplicadorSupervisor } from '../../../services/supervisor'
import { canShowDemo } from './config'
import type {
  DemoExplanation,
  DemoSnapshot,
  ExplainerInput,
  DemoReference,
} from './contracts'
import { createReferenceFormatter } from './references'
import {
  createDemoConversationReply,
  MAX_DEMO_QUESTION_LENGTH,
  resolveDemoQuestion,
} from './conversation'
import type { DemoConversationReply } from './conversation'
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

export function DemoAnswer({
  answer,
  references,
  showReferences = false,
}: {
  answer: DemoExplanation
  references?: DemoReference[]
  showReferences?: boolean
}) {
  const sections = [
    ['Resumen', answer.summary],
    ['Evidencia', answer.evidence],
    ['Recomendación preliminar', answer.preliminaryRecommendation],
    ['Limitaciones', answer.limitations],
  ]
  return (
    <>
      <div className="demo-explainer-answer" aria-live="polite">
        {sections.map(([title, text]) => (
          <section key={title}>
            <h4>{title}</h4>
            <p>{text}</p>
          </section>
        ))}
      </div>
      {showReferences && (
        <DemoReferenceDetails answer={answer} references={references} />
      )}
    </>
  )
}

export function DemoReferenceDetails({
  answer,
  references = [],
}: {
  answer: DemoExplanation
  references?: DemoReference[]
}) {
  const [open, setOpen] = useState(false)
  const matching = useMemo(() => {
    const content = Object.values(answer).join('\n')
    const show = createReferenceFormatter({ references })
    return references
      .filter(
        (ref) =>
          content.includes(ref.label) &&
          (!ref.taskKey || content.includes(show(ref.taskKey))),
      )
      .map((ref) => ({
        ...ref,
        parentLabel: ref.taskKey ? show(ref.taskKey) : null,
      }))
  }, [answer, references])
  if (!matching.length) return null
  return (
    <details
      className="demo-reference-details"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Ver referencias de los registros</summary>
      {open && (
        <>
          <p>
            Los nombres anteriores identifican la actividad. Estos códigos
            completos permiten rastrear los registros si hace falta una revisión
            técnica.
          </p>
          <div className="demo-reference-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Elemento</th>
                  <th>Identificador completo</th>
                </tr>
              </thead>
              <tbody>
                {matching.map((ref) => (
                  <tr key={JSON.stringify([ref.key, ref.taskKey ?? null])}>
                    <td>
                      {ref.label}
                      {ref.parentLabel && <small>{ref.parentLabel}</small>}
                    </td>
                    <td>{ref.id ?? 'Referencia local de esta carga'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </details>
  )
}

export function DemoExplainer({
  role,
  mode = import.meta.env.VITE_LLM_MODE,
  initialPanel,
}: {
  role: unknown
  mode?: unknown
  initialPanel?: 'explanation' | 'conversation'
}) {
  const visible = canShowDemo(role, mode)
  const [panel, setPanel] = useState<'explanation' | 'conversation' | null>(
    initialPanel ?? null,
  )
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null)
  const [failed, setFailed] = useState(false)
  const [question, setQuestion] = useState<DemoQuestionId>('period')
  const button = useRef<HTMLButtonElement>(null)
  const conversationButton = useRef<HTMLButtonElement>(null)
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
      <div className="demo-explainer-actions">
        <button
          ref={button}
          type="button"
          className="supervisor-header-btn"
          aria-expanded={panel === 'explanation'}
          aria-controls="demo-explainer-panel"
          onClick={() =>
            setPanel(panel === 'explanation' ? null : 'explanation')
          }
        >
          Explicar resultados (demo)
        </button>
        <button
          ref={conversationButton}
          type="button"
          className="supervisor-header-btn"
          aria-expanded={panel === 'conversation'}
          aria-controls="demo-explainer-panel"
          onClick={() =>
            setPanel(panel === 'conversation' ? null : 'conversation')
          }
        >
          Conversatorio (demo)
        </button>
      </div>
      {panel && (
        <section
          id="demo-explainer-panel"
          className="demo-explainer-panel"
          aria-labelledby="demo-explainer-title"
        >
          <div className="demo-explainer-heading">
            <h2 id="demo-explainer-title">
              {panel === 'conversation'
                ? 'Conversatorio (demo)'
                : 'Explicación de resultados'}
            </h2>
            <button
              type="button"
              className="supervisor-header-btn"
              onClick={() => {
                setPanel(null)
                if (panel === 'conversation')
                  conversationButton.current?.focus()
                else button.current?.focus()
              }}
            >
              {panel === 'conversation'
                ? 'Cerrar conversatorio'
                : 'Cerrar explicación'}
            </button>
          </div>
          <p className="demo-explainer-notice">{DEMO_NOTICE}</p>
          <p className="demo-explainer-scope">
            Todas las áreas · tareas cargadas · sin filtro de fechas. Las
            respuestas identifican las tareas, áreas y variantes por sus nombres
            operativos.
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
              {panel === 'conversation' ? (
                <DemoConversation input={view.input} />
              ) : (
                <>
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
                  <DemoAnswer
                    answer={view.answer}
                    references={view.input.references}
                  />
                </>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}

export function DemoConversation({ input }: { input: ExplainerInput }) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState<DemoConversationReply | null>(null)
  const field = useRef<HTMLInputElement>(null)
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (pending.current !== null) clearTimeout(pending.current)
    },
    [],
  )
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending.current !== null || !draft.trim()) return
    const questionId = resolveDemoQuestion(draft)
    setDraft('')
    setReply(null)
    setBusy(true)
    field.current?.focus()
    // El cierre asíncrono retiene solo la categoría, nunca la pregunta escrita.
    pending.current = setTimeout(() => {
      setReply(createDemoConversationReply(questionId, input))
      setBusy(false)
      pending.current = null
    }, 0)
  }
  return (
    <div className="demo-conversation">
      <p id="demo-conversation-help">
        Escribe una pregunta sobre las categorías disponibles. Cada consulta es
        independiente y muestra la categoría completa sobre los datos cargados;
        no aplica filtros por nombres, fechas o variantes escritos en la
        pregunta. El texto se borra al enviar y no se guarda ni se envía a
        servicios externos. No es un chatbot generativo.
      </p>
      {!input.completed && (
        <p role="status">
          No hay tareas completadas; las respuestas indicarán la información
          disponible y la que falta.
        </p>
      )}
      <form onSubmit={submit} className="demo-conversation-form">
        <label htmlFor="demo-conversation-prompt">Tu pregunta</label>
        <div className="demo-conversation-controls">
          <input
            ref={field}
            id="demo-conversation-prompt"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={MAX_DEMO_QUESTION_LENGTH}
            required
            autoComplete="off"
            aria-describedby="demo-conversation-help demo-conversation-length"
            placeholder="Ej.: ¿Hubo sobredosis?"
          />
          <button
            type="submit"
            className="primary-button"
            disabled={busy || !draft.trim()}
          >
            Enviar
          </button>
        </div>
        <p id="demo-conversation-length">
          Máximo {MAX_DEMO_QUESTION_LENGTH} caracteres. También puedes enviar
          con Enter.
        </p>
      </form>
      {busy && <p role="status">Interpretando la pregunta localmente…</p>}
      {reply && (
        <div
          className="demo-conversation-reply"
          role={reply.kind === 'error' ? 'alert' : undefined}
        >
          <h3>
            {reply.questionId
              ? DEMO_QUESTIONS.find(
                  (question) => question.id === reply.questionId,
                )?.label
              : 'Respuesta del modo demostración'}
          </h3>
          <DemoAnswer answer={reply.answer} references={input.references} />
        </div>
      )}
    </div>
  )
}
