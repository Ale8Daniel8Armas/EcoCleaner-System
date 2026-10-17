const element = (id) => document.getElementById(id)
let state
let latest
let busy = false

const errorText = (code) =>
  ({
    FIRST_GENERATION_FAILED:
      'La primera generación falló. La sesión quedó detenida para revisar la evidencia; no se reintenta.',
    PROVIDER_REJECTED_SESSION:
      'Groq rechazó la solicitud o se agotó su cuota. La sesión quedó detenida.',
    LOCAL_MINUTE_BUDGET:
      'Espera a que se renueve el presupuesto del minuto; no se envió esta pregunta al proveedor.',
    DAILY_TOKEN_BUDGET:
      'Se alcanzó el presupuesto de tokens autorizado para la prueba.',
    ACCOUNT_TPM_TOO_LOW:
      'El límite de tokens por minuto confirmado no alcanza para este contexto.',
    DUPLICATE_QUESTION:
      'Esa pregunta ya se envió con este contexto. No se repite una generación para buscar otro resultado.',
    SESSION_LIMIT: 'Se alcanzó el máximo de generaciones de esta sesión.',
    INVALID_QUESTION:
      'Introduce una pregunta de hasta 700 caracteres, sin claves, correos, URLs ni HTML.',
    INPUT_BUDGET: 'El contexto supera el presupuesto de entrada del adaptador.',
  })[code] ?? `La solicitud no se completó (${code ?? 'CONEXIÓN_LOCAL'}).`

async function api(url, body) {
  const response = await fetch(
    url,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {},
  )
  const data = await response.json()
  if (!response.ok) throw data
  return data
}
function updateContext() {
  const selected = state?.scenarios.find(
    (item) => item.id === element('scenario').value,
  )
  element('context').textContent = JSON.stringify(
    selected?.context ?? {},
    null,
    2,
  )
}
async function refresh() {
  state = await api('/api/state')
  if (!element('scenario').options.length) {
    for (const scenario of state.scenarios) {
      const option = document.createElement('option')
      option.value = scenario.id
      option.textContent = `${scenario.id} · ${scenario.category}`
      element('scenario').append(option)
    }
    updateContext()
  }
  element('session-status').textContent =
    `${state.model} · ${state.generations}/${state.maxGenerations} generaciones · presupuesto conservador reservado ${state.usedTokenBudget}/${state.authorizedTokenBudget} tokens. ${state.halted ? errorText(state.halted) : 'Sesión exclusivamente local y sintética.'}`
  element('send').disabled =
    busy || Boolean(state.halted) || state.submissions >= state.maxGenerations
}
function section(title, text) {
  const article = document.createElement('article')
  const heading = document.createElement('h3')
  heading.textContent = title
  const paragraph = document.createElement('p')
  paragraph.textContent = text
  article.append(heading, paragraph)
  element('answer').append(article)
}
function show(attempt) {
  latest = attempt
  element('reply').hidden = false
  element('answer').replaceChildren()
  const transport = attempt.transport[0]
  element('reply-title').textContent = attempt.result.ok
    ? 'Respuesta generada con Groq (prueba local)'
    : 'Generación fallida o respuesta descartada'
  element('technical').textContent =
    `Contrato: ${attempt.technical} · HTTP ${transport?.httpStatus ?? 'sin respuesta'} · ${attempt.elapsedMs} ms · ${transport?.usage?.totalTokens ?? 'sin dato'} tokens reportados · ID: ${transport?.responseId ?? 'no disponible'}. Calidad: pendiente de revisión.`
  if (attempt.result.ok) {
    const answer = attempt.result.explanation
    section('Resumen', answer.summary)
    section(
      'Análisis del consumo',
      answer.consumptionAnalysis ??
        'El modelo no incluyó un análisis adicional de consumo.',
    )
    section(
      'Recomendación preliminar',
      `${answer.recommendation.text}\n${answer.recommendation.justification}`,
    )
    section(
      'Evidencia',
      answer.evidenceIds
        .map((id) => `${id}: ${JSON.stringify(attempt.preparedFacts[id])}`)
        .join('\n'),
    )
    section('Limitaciones', answer.limitations.join('\n'))
  } else {
    section(
      'Error controlado',
      `${attempt.result.code}: ${attempt.result.fallback.text}\nTexto de respaldo del sistema; no es una respuesta generada por Groq.`,
    )
  }
  element('raw-response').textContent = JSON.stringify(
    {
      question: attempt.question,
      transport: attempt.transport,
      validation: attempt.result,
    },
    null,
    2,
  )
  element('review-status').textContent = ''
  element('reason').value = ''
}
element('scenario').addEventListener('change', updateContext)
element('question-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  if (busy) return
  busy = true
  element('send').disabled = true
  element('request-status').className = ''
  element('request-status').textContent =
    'Consultando la API real de Groq desde el servidor local…'
  try {
    show(
      await api('/api/question', {
        scenarioId: element('scenario').value,
        question: element('question').value,
      }),
    )
    element('request-status').textContent =
      'Solicitud finalizada. Revisa el contrato, la evidencia y la calidad por separado.'
  } catch (error) {
    element('request-status').className = 'error'
    element('request-status').textContent =
      errorText(error.code) +
      (error.retryAfterMs
        ? ` Puedes intentarlo tras ${Math.ceil(error.retryAfterMs / 1000)} segundos.`
        : '')
  } finally {
    busy = false
    await refresh().catch(() => {})
  }
})
element('review-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  if (!latest) return
  try {
    const review = await api('/api/review', {
      id: latest.id,
      status: element('quality').value,
      reason: element('reason').value,
    })
    element('review-status').textContent =
      `Revisión guardada: ${review.status}. La respuesta original se conserva sin cambios.`
  } catch (error) {
    element('review-status').textContent = errorText(error.code)
  }
})
element('stop').addEventListener('click', async () => {
  await api('/api/stop', {})
  element('session-status').textContent =
    'Ejecutor cerrado. Para una prueba posterior, vuelve a iniciarlo desde PowerShell.'
  element('send').disabled = true
})
refresh().catch(() => {
  element('session-status').textContent = 'No se pudo abrir la sesión local.'
})
