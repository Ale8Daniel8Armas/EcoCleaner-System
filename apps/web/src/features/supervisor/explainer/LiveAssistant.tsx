import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { LiveChatResult } from './live-contracts'
import { ChatText } from './ChatText'
import { loadAssistantData, type AssistantDataMode } from './assistant-data'
import { displayLiveText, projectLiveData } from './live-data'
import './demo-explainer.css'

interface LocalState {
  provider: string
  model: string
  appDataApproved: boolean
  generations: number
  maxGenerations: number
  usedTokenBudget: number
  authorizedTokenBudget: number
  maxOutputTokens?: number
  minimumRequestTokenBudget?: number
  halted: string | null
}
interface LiveReply {
  id: string
  result: LiveChatResult
  telemetry: {
    model: string | null
    httpStatus: number
    elapsedMs: number
    responseId: string
    usage: { totalTokens: number } | null
  } | null
  coverage: { available: number; included: number; partial: boolean }
  state: LocalState
}
const questions = [
  '¿Qué debería revisar primero y con qué evidencia?',
  '¿Hubo sobredosis o valores sobre el máximo de la ficha?',
  '¿Qué variantes se recomiendan y cuáles se descartan?',
  '¿Qué productos tienen incompatibilidades documentadas?',
  '¿Qué sabemos sobre las decisiones de efluente?',
  '¿Qué información falta para interpretar estos resultados?',
]
const messages: Record<string, string> = {
  PRODUCTION_NOT_CONFIGURED:
    'El asistente todavía no está habilitado. Contacta al administrador.',
  SESSION_TRANSFERRED:
    'El presupuesto fue transferido al asistente público. Esta sesión local ya no admite consultas.',
  LOCAL_MINUTE_BUDGET:
    'Se alcanzó el límite temporal. Espera un minuto antes de enviar otra pregunta.',
  DAILY_TOKEN_BUDGET:
    'El presupuesto restante no alcanza para enviar esta consulta con su contexto y respuesta. No se hizo otra llamada a Groq.',
  SESSION_LIMIT:
    'Se alcanzó el máximo de preguntas autorizado para esta sesión.',
  APP_CONTEXT_BUDGET:
    'El resumen no cabe en el presupuesto disponible. No se envió ninguna llamada.',
  APP_DATA_NOT_APPROVED:
    'El servidor local no tiene habilitado el uso de estos datos.',
  DUPLICATE_QUESTION:
    'Esa pregunta ya se envió con estos mismos datos. Su resultado se conserva en las evidencias.',
  INVALID_QUESTION:
    'Revisa la pregunta: no incluyas correos, claves, enlaces ni datos personales.',
  INVALID_APP_CONTEXT:
    'No se pudo preparar un contexto válido con los registros cargados.',
  PROVIDER_REJECTED_SESSION:
    'El proveedor rechazó la sesión. Revisa la configuración antes de continuar.',
  PROVIDER_CONFIGURATION_REJECTED:
    'Groq no devolvió una respuesta con el formato requerido. La validación del contexto combinado sigue pendiente.',
}

export function LiveAssistant({ request = fetch }: { request?: typeof fetch }) {
  const [context, setContext] = useState<ReturnType<
    typeof projectLiveData
  > | null>(null)
  const [local, setLocal] = useState<LocalState | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataMode, setDataMode] = useState<AssistantDataMode>('auto')
  const [simulatedScenario, setSimulatedScenario] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [asked, setAsked] = useState('')
  const [turns, setTurns] = useState<
    Array<{
      question: string
      reply: LiveReply
      labels: Record<string, string>
    }>
  >([])
  const [error, setError] = useState('')
  const active = useRef(true)
  const controller = useRef<AbortController | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!field.current) return
    field.current.style.height = 'auto'
    field.current.style.height = `${Math.min(field.current.scrollHeight, 220)}px`
  }, [draft])
  const reload = useCallback(
    async (mode: AssistantDataMode) => {
      setLoading(true)
      setError('')
      setContext(null)
      setTurns([])
      setAsked('')
      try {
        const [data, response] = await Promise.all([
          loadAssistantData(mode),
          request('/api/app/state', {
            cache: 'no-store',
            credentials: 'same-origin',
          }),
        ])
        if (!response.ok) throw new Error('SERVER_UNAVAILABLE')
        const state: LocalState = await response.json()
        if (active.current) {
          setContext(projectLiveData(data.snapshot, data.catalog))
          setSimulatedScenario(data.simulatedScenario)
          setDataMode(mode)
          setLocal(state)
        }
      } catch {
        if (active.current)
          setError(
            'No se pudo conectar con el asistente o cargar los registros. Actualiza los datos para intentarlo de nuevo.',
          )
      } finally {
        if (active.current) setLoading(false)
      }
    },
    [request],
  )
  useEffect(() => {
    active.current = true
    const initialLoad = setTimeout(() => void reload('auto'), 0)
    return () => {
      clearTimeout(initialLoad)
      active.current = false
      controller.current?.abort()
    }
  }, [reload])
  const send = async (question: string) => {
    if (
      !context ||
      busy ||
      controller.current ||
      !question.trim() ||
      !local?.appDataApproved
    )
      return
    controller.current = new AbortController()
    setBusy(true)
    setError('')
    setAsked(question.trim())
    setDraft('')
    try {
      const response = await request('/api/app/question', {
        method: 'POST',
        credentials: 'same-origin',
        signal: controller.current.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: context.anonymizeQuestion(question.trim()),
          data: context.payload,
          historyIds: turns
            .filter((turn) => turn.reply.result.ok)
            .slice(-3)
            .map((turn) => turn.reply.id),
        }),
      })
      const body = await response.json()
      if (!response.ok)
        throw new Error(
          messages[body.code] ??
            'No se pudo completar la consulta. Los registros no se modificaron.',
        )
      if (active.current) {
        setTurns((previous) =>
          [
            ...previous,
            {
              question: question.trim(),
              reply: body as LiveReply,
              labels: context.labels,
            },
          ].slice(-12),
        )
        setLocal(body.state)
      }
    } catch (caught) {
      if (active.current)
        setError(
          caught instanceof Error && caught.name === 'AbortError'
            ? 'Consulta cancelada. El proveedor puede haber consumido tokens antes de cancelarse.'
            : caught instanceof Error
              ? caught.message
              : 'No se pudo completar la consulta.',
        )
    } finally {
      if (active.current) setBusy(false)
      controller.current = null
      field.current?.focus()
    }
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void send(draft)
  }
  const canSend =
    !loading &&
    !busy &&
    !!context &&
    !!local?.appDataApproved &&
    !local.halted &&
    local.generations < local.maxGenerations &&
    local.authorizedTokenBudget - local.usedTokenBudget >=
      (local.minimumRequestTokenBudget ?? local.maxOutputTokens ?? 768)
  return (
    <div className="demo-explainer live-assistant">
      <div className="live-status-row">
        <p className="live-data-status">
          {loading
            ? 'Cargando datos…'
            : context
              ? `${context.payload.snapshot.tasks.length} tareas · ${context.payload.catalog.products.length} productos`
              : 'Datos no disponibles'}
          {context &&
            (context.payload.catalog.simulated ||
              context.payload.snapshot.catalogSimulated) && (
              <span className="live-data-badge">Datos de demostración</span>
            )}
        </p>
        <details className="live-session-details">
          <summary>Datos y sesión</summary>
          <div className="live-session-content">
            <p>
              Las respuestas usan las tareas cargadas, sin filtro de fechas. No
              incluyen causas verificadas, costos ni mediciones de pH del
              efluente.
            </p>
            {context && (
              <p>
                Origen de tareas:{' '}
                {context.payload.snapshot.origin === 'supabase'
                  ? 'Supabase'
                  : simulatedScenario
                    ? 'escenario simulado aislado'
                    : 'este navegador'}
                . El catálogo no sustituye los resultados de las tareas.
              </p>
            )}
            {simulatedScenario && (
              <p>
                Escenario separado de los registros cargados: usa datos
                ficticios y cálculos del core; no contiene mediciones físicas ni
                guarda registros.
              </p>
            )}
            <button
              className="supervisor-header-btn live-data-switch"
              type="button"
              disabled={loading || busy}
              onClick={() =>
                void reload(simulatedScenario ? 'loaded' : 'simulation')
              }
            >
              {simulatedScenario
                ? 'Usar datos cargados'
                : 'Usar escenario simulado'}
            </button>
            {local && (
              <p className="live-session-usage">
                {local.generations}/{local.maxGenerations} consultas ·{' '}
                {local.usedTokenBudget}/{local.authorizedTokenBudget} tokens
                utilizados o reservados. Preguntar no modifica los datos.
              </p>
            )}
            <button
              className="supervisor-header-btn"
              type="button"
              disabled={loading || busy}
              onClick={() => void reload(dataMode)}
            >
              Actualizar datos
            </button>
            <p className="live-session-hint">
              Al actualizar se reinicia esta conversación.
            </p>
          </div>
        </details>
      </div>
      <p className="live-review-note">
        Las explicaciones requieren revisión humana.
      </p>
      {simulatedScenario && (
        <p className="live-simulation-note">
          Escenario simulado · sin mediciones físicas. Solo se utiliza en este
          asistente.
        </p>
      )}
      {context?.payload.snapshot.limitations.includes('remote_unavailable') && (
        <p role="status" className="live-empty-data">
          Supabase no estuvo disponible. Se muestran únicamente los datos
          guardados en este navegador.
        </p>
      )}
      {context && context.payload.snapshot.tasks.length === 0 && (
        <p className="live-empty-data" role="status">
          No hay tareas cargadas. Puedes consultar el catálogo o hacer preguntas
          generales.
        </p>
      )}
      {local && !local.appDataApproved && (
        <p role="alert" className="demo-explainer-error">
          El uso de datos operativos no está habilitado en este servidor.
        </p>
      )}
      {local?.halted && (
        <p role="alert" className="demo-explainer-error">
          La sesión está detenida: {messages[local.halted] ?? local.halted}.
        </p>
      )}
      {local && local.generations >= local.maxGenerations && (
        <p role="alert" className="demo-explainer-error">
          Se alcanzó el máximo de consultas autorizado para esta sesión. El modo
          demo sigue disponible.
        </p>
      )}
      {local &&
        local.authorizedTokenBudget - local.usedTokenBudget <
          (local.minimumRequestTokenBudget ?? local.maxOutputTokens ?? 768) && (
          <p role="alert" className="demo-explainer-error">
            Quedan {local.authorizedTokenBudget - local.usedTokenBudget} tokens
            del presupuesto local: no alcanzan para otra consulta con su
            contexto y respuesta. El total incluye reservas de llamadas sin
            consumo reportado. El modo demo sigue disponible.
          </p>
        )}

      <section className="live-suggestions" aria-label="Ideas para empezar">
        <h2 className="live-section-label">Preguntas sugeridas</h2>
        <nav
          className="live-question-chips"
          aria-label="Preguntas sugeridas para Groq"
        >
          <button
            type="button"
            className="live-summary-chip"
            aria-label="Explicar resultados con Groq"
            title="Generar un resumen de los resultados disponibles"
            disabled={!canSend}
            onClick={() =>
              void send(
                'Resume los resultados disponibles, los problemas principales y qué debería revisar primero. Distingue los datos faltantes.',
              )
            }
          >
            Resumen de tareas
          </button>
          {questions.map((question, index) => (
            <button
              key={question}
              type="button"
              className="live-question-chip"
              aria-label={question}
              title={question}
              disabled={!canSend}
              onClick={() => {
                setDraft(question)
                field.current?.focus()
              }}
            >
              {
                [
                  '¿Qué revisar primero?',
                  'Sobredosis y desvíos',
                  'Comparar procedimientos',
                  'Productos incompatibles',
                  'Decisiones de efluentes',
                  'Información que falta',
                ][index]
              }
            </button>
          ))}
        </nav>
      </section>

      <section className="live-conversation" aria-label="Chat del asistente">
        <div className="live-conversation-heading">
          <h2>Conversación</h2>
          {turns.length > 0 && (
            <button
              type="button"
              className="live-clear-button"
              disabled={busy}
              onClick={() => {
                setTurns([])
                setAsked('')
                setError('')
              }}
            >
              Limpiar conversación
            </button>
          )}
        </div>
        <div
          role="log"
          aria-label="Conversación con EcoCleaner"
          aria-live="polite"
          className="live-chat-log"
        >
          {turns.length === 0 && !busy && !error && (
            <div className="live-chat-empty">
              <p>¿En qué te ayudo?</p>
              <span>Elige una pregunta sugerida o escribe la tuya.</span>
            </div>
          )}
          {turns.map(({ question, reply, labels }) => {
            const result = reply.result
            const show = (text: string) => displayLiveText(text, labels)
            return (
              <article key={reply.id} className="live-chat-turn">
                <div className="live-user-message">
                  <span>Tú</span>
                  <h3 className="demo-explainer-question">{question}</h3>
                </div>
                <div className="live-assistant-message">
                  {result.ok ? (
                    <>
                      <p className="live-answer-source">
                        {result.source === 'llm'
                          ? 'EcoCleaner · Groq'
                          : 'Respuesta simulada (prueba de interfaz)'}
                      </p>
                      <p className="live-chat-answer">
                        <ChatText
                          text={show(
                            result.answer.replace(
                              /\[([A-Za-z][A-Za-z0-9_.-]{0,140})\]/g,
                              (reference, key) =>
                                Object.hasOwn(result.evidence, key)
                                  ? ''
                                  : reference,
                            ),
                          )}
                        />
                      </p>
                      {result.warnings.map((warning) => (
                        <p key={warning} className="demo-explainer-notice">
                          {warning}
                        </p>
                      ))}
                    </>
                  ) : (
                    <p role="alert" className="demo-explainer-error">
                      {result.fallback.text} Este aviso es del sistema.
                      {!reply.state.halted && ' Puedes enviar otra pregunta.'}
                    </p>
                  )}
                  {reply.coverage.partial && (
                    <p className="demo-explainer-notice">
                      Se incluyó una selección del detalle disponible para esta
                      consulta.
                    </p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
        {(busy || error) && asked && (
          <div className="live-user-message live-pending-question">
            <span>Tú</span>
            <h3 className="demo-explainer-question">{asked}</h3>
          </div>
        )}
        {busy && (
          <div className="live-progress" role="status">
            <span>Groq está preparando la respuesta…</span>
            <button
              type="button"
              className="live-clear-button"
              onClick={() => controller.current?.abort()}
            >
              Cancelar
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="demo-explainer-error live-request-error">
            {error}
          </p>
        )}

        <form
          className="demo-conversation-form live-composer"
          onSubmit={submit}
        >
          <label htmlFor="live-question">Tu pregunta</label>
          <div className="demo-conversation-controls live-composer-controls">
            <textarea
              ref={field}
              id="live-question"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              maxLength={700}
              required
              placeholder="Pregúntame sobre tareas, consumos, procedimientos o resultados..."
              aria-describedby="live-input-help"
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault()
                  if (canSend && draft.trim()) void send(draft)
                }
              }}
            />
            <button
              type="submit"
              className="primary-button live-send-button"
              aria-label="Enviar a Groq"
              disabled={!canSend || !draft.trim()}
            >
              {busy ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
          <div className="live-composer-help">
            <p id="live-input-help">
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
