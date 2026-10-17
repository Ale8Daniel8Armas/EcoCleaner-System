import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { loadAssistantData } from './assistant-data'
import { ChatText } from './ChatText'
import {
  createPreparedDemoReply,
  DEMO_CHAT_GROUPS,
  DEMO_CHAT_QUESTIONS,
  type PreparedReply,
} from './demo-chat'
import './demo-explainer.css'
import './live-assistant.css'

type AssistantData = Awaited<ReturnType<typeof loadAssistantData>>
interface Turn {
  id: number
  question: string
  reply: PreparedReply
}

export function DemoChatAssistant() {
  const [data, setData] = useState<AssistantData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [library, setLibrary] = useState(false)
  const [group, setGroup] =
    useState<(typeof DEMO_CHAT_GROUPS)[number]>('Para empezar')
  const field = useRef<HTMLTextAreaElement>(null)
  const log = useRef<HTMLDivElement>(null)
  const active = useRef(true)
  const nextId = useRef(0)
  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const loaded = await loadAssistantData('auto')
      if (!active.current) return
      setData(loaded)
      setTurns([])
      setDraft('')
    } catch {
      if (active.current)
        setError('No se pudieron cargar los registros. Vuelve a intentarlo.')
    } finally {
      if (active.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    active.current = true
    const timer = setTimeout(() => void reload(), 0)
    return () => {
      active.current = false
      clearTimeout(timer)
    }
  }, [reload])
  useEffect(() => {
    if (!field.current) return
    field.current.style.height = 'auto'
    field.current.style.height = `${Math.min(field.current.scrollHeight, 220)}px`
  }, [draft])
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [turns])
  const choose = (question: string) => {
    setDraft(question)
    setLibrary(false)
    field.current?.focus()
  }
  const send = () => {
    if (!data || loading || !draft.trim()) return
    try {
      const question = draft.trim()
      const reply = createPreparedDemoReply(
        question,
        data.snapshot,
        data.catalog,
        turns.at(-1)?.reply.topic ?? null,
      )
      setTurns((previous) =>
        [...previous, { id: ++nextId.current, question, reply }].slice(-18),
      )
      setDraft('')
      setError('')
      field.current?.focus()
    } catch {
      setError(
        'No se pudo preparar la respuesta con estos registros. Vuelve a cargar la página para intentarlo de nuevo.',
      )
    }
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    send()
  }
  const ready = !!data && !loading
  return (
    <div className="demo-explainer live-assistant demo-chat-assistant">
      <div className="live-status-row">
        <p className="live-data-status">
          {loading
            ? 'Cargando datos…'
            : data
              ? `${data.snapshot.tasks.length} tareas · ${data.catalog.products.length} productos`
              : 'Datos no disponibles'}
          {data?.simulatedScenario && (
            <span className="live-data-badge">Datos de demostración</span>
          )}
        </p>
      </div>
      {data?.snapshot.limitations.includes('remote_unavailable') && (
        <p role="status" className="live-empty-data">
          Supabase no estuvo disponible. Se muestran únicamente los datos
          guardados en este navegador.
        </p>
      )}
      {data && !data.snapshot.tasks.length && (
        <p role="status" className="live-empty-data">
          No hay tareas cargadas. Puedes consultar conceptos y el catálogo.
        </p>
      )}
      {error && (
        <p role="alert" className="demo-explainer-error">
          {error}{' '}
          {!data && (
            <button
              type="button"
              className="live-clear-button"
              onClick={() => void reload()}
            >
              Reintentar
            </button>
          )}
        </p>
      )}

      <section className="live-suggestions" aria-label="Ideas para empezar">
        <div className="demo-question-library-heading">
          <h2 className="live-section-label">Preguntas sugeridas</h2>
          <button
            type="button"
            className="live-clear-button"
            aria-expanded={library}
            aria-controls="demo-question-library"
            onClick={() => setLibrary(!library)}
          >
            {library
              ? 'Ocultar preguntas'
              : `Ver todas las preguntas (${DEMO_CHAT_QUESTIONS.length})`}
          </button>
        </div>
        <nav
          className="live-question-chips"
          aria-label="Preguntas sugeridas para la demo"
        >
          {DEMO_CHAT_QUESTIONS.filter((question) => question.chip).map(
            (question, index) => (
              <button
                key={question.id}
                type="button"
                className={
                  index === 0 ? 'live-summary-chip' : 'live-question-chip'
                }
                disabled={!ready}
                title={question.label}
                onClick={() => choose(question.label)}
              >
                {question.chip}
              </button>
            ),
          )}
        </nav>
        {library && (
          <div id="demo-question-library" className="demo-question-library">
            <p>
              Elige una pregunta para escribirla en el chat. Pulsa Enviar cuando
              estés listo.
            </p>
            <nav
              className="demo-question-categories"
              aria-label="Temas de las preguntas"
            >
              {DEMO_CHAT_GROUPS.map((item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={group === item}
                  onClick={() => setGroup(item)}
                >
                  {item}
                </button>
              ))}
            </nav>
            <div className="demo-question-list">
              {DEMO_CHAT_QUESTIONS.filter(
                (question) => question.group === group,
              ).map((question) => (
                <button
                  key={question.id}
                  type="button"
                  disabled={!ready}
                  onClick={() => choose(question.label)}
                >
                  {question.label}
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="live-conversation" aria-label="Chat del asistente">
        <div className="live-conversation-heading">
          <h2>Conversación</h2>
          {turns.length > 0 && (
            <button
              type="button"
              className="live-clear-button"
              onClick={() => {
                setTurns([])
                setError('')
                field.current?.focus()
              }}
            >
              Limpiar conversación
            </button>
          )}
        </div>
        <div
          ref={log}
          role="log"
          aria-label="Conversación con EcoCleaner"
          aria-live="polite"
          className="live-chat-log"
        >
          {!turns.length && (
            <div className="live-chat-empty">
              <p>¿En qué te ayudo?</p>
              <span>Elige una pregunta sugerida o escribe la tuya.</span>
            </div>
          )}
          {turns.map((turn) => (
            <article key={turn.id} className="live-chat-turn">
              <div className="live-user-message">
                <span>Tú</span>
                <h3 className="demo-explainer-question">{turn.question}</h3>
              </div>
              <div className="live-assistant-message">
                <p className="live-answer-source">EcoCleaner · Demo</p>
                <p className="live-chat-answer">
                  <ChatText text={turn.reply.answer} />
                </p>
              </div>
            </article>
          ))}
        </div>
        <form
          className="demo-conversation-form live-composer"
          onSubmit={submit}
        >
          <label htmlFor="demo-chat-question">Tu pregunta</label>
          <div className="demo-conversation-controls live-composer-controls">
            <textarea
              ref={field}
              id="demo-chat-question"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              maxLength={700}
              required
              placeholder="Pregúntame sobre tareas, consumos, procedimientos o resultados..."
              aria-describedby="demo-chat-help"
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault()
                  send()
                }
              }}
            />
            <button
              type="submit"
              className="primary-button live-send-button"
              aria-label="Enviar pregunta"
              disabled={!ready || !draft.trim()}
            >
              Enviar
            </button>
          </div>
          <div className="live-composer-help">
            <p id="demo-chat-help">
              <span className="live-keyboard-help">
                Enter para enviar · Shift+Enter para nueva línea.{' '}
              </span>
              No incluyas datos personales.
            </p>
            <span aria-hidden="true">{draft.length}/700</span>
          </div>
        </form>
      </section>
    </div>
  )
}
