import http from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createLocalSession,
  LocalFailure,
  preflightGroq,
  validateAccount,
} from './session.mjs'

const directory = path.dirname(fileURLToPath(import.meta.url))
const repository = path.resolve(directory, '../..')
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
])

export function createLocalServer(
  session,
  { onStop = () => {}, application, connectOrigins = [] } = {},
) {
  const token = randomBytes(32).toString('hex')
  const controllers = new Set()
  const server = http.createServer(async (request, response) => {
    const address = server.address()
    const origin = `http://127.0.0.1:${address.port}`
    const send = (status, value) => {
      if (!response.destroyed) {
        response.writeHead(status, {
          'Content-Type': 'application/json; charset=utf-8',
        })
        response.end(JSON.stringify(value))
      }
    }
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('X-Frame-Options', 'DENY')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader(
      'Content-Security-Policy',
      application
        ? `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:${server.address().port} ${connectOrigins.join(' ')}; img-src 'self' data: blob:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`
        : "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    )
    const controller = new AbortController()
    controllers.add(controller)
    response.on('close', () => {
      controllers.delete(controller)
      if (!response.writableFinished) controller.abort()
    })
    try {
      if (
        request.socket.remoteAddress !== '127.0.0.1' ||
        request.headers.host !== `127.0.0.1:${address.port}`
      )
        throw new LocalFailure('LOOPBACK_ONLY', 403)
      if (request.headers.origin && request.headers.origin !== origin)
        throw new LocalFailure('ORIGIN_NOT_ALLOWED', 403)
      const url = new URL(request.url, origin)
      if ((url.search || url.hash) && url.pathname.startsWith('/api/'))
        throw new LocalFailure('INVALID_URL')
      if (application && !url.pathname.startsWith('/api/')) {
        application(request, response)
        return
      }
      const setCookie = () =>
        response.setHeader(
          'Set-Cookie',
          `ecocleaner_groq_local=${token}; HttpOnly; SameSite=Strict; Path=/`,
        )
      const appState = () => {
        const state = session.state()
        return {
          provider: state.provider,
          model: state.model,
          appDataApproved: state.appDataApproved,
          generations: state.generations,
          maxGenerations: state.maxGenerations,
          usedTokenBudget: state.usedTokenBudget,
          authorizedTokenBudget: state.authorizedTokenBudget,
          maxOutputTokens: state.maxOutputTokens,
          busy: state.busy,
          halted: state.halted,
        }
      }
      if (
        application &&
        request.method === 'GET' &&
        url.pathname === '/api/app/state'
      ) {
        setCookie()
        send(200, appState())
        return
      }
      if (!application && assets.has(url.pathname)) {
        if (request.method !== 'GET')
          throw new LocalFailure('METHOD_NOT_ALLOWED', 405)
        const [file, type] = assets.get(url.pathname)
        if (file === 'index.html')
          response.setHeader(
            'Set-Cookie',
            `ecocleaner_groq_local=${token}; HttpOnly; SameSite=Strict; Path=/`,
          )
        response.writeHead(200, { 'Content-Type': type })
        response.end(await readFile(path.join(directory, file)))
        return
      }
      const cookie = request.headers.cookie
        ?.split(';')
        .map((value) => value.trim())
        .find((value) => value.startsWith('ecocleaner_groq_local='))
        ?.slice('ecocleaner_groq_local='.length)
      const candidate = Buffer.from(cookie ?? '')
      const expected = Buffer.from(token)
      if (
        candidate.length !== expected.length ||
        !timingSafeEqual(candidate, expected)
      )
        throw new LocalFailure('LOCAL_SESSION_REQUIRED', 401)
      if (request.method === 'GET' && url.pathname === '/api/state') {
        send(200, session.state())
        return
      }
      if (request.method !== 'POST')
        throw new LocalFailure('METHOD_NOT_ALLOWED', 405)
      if (request.headers.origin !== origin)
        throw new LocalFailure('ORIGIN_REQUIRED', 403)
      if (request.headers['content-type']?.split(';')[0] !== 'application/json')
        throw new LocalFailure('JSON_REQUIRED', 415)
      const maxBody =
        application && url.pathname === '/api/app/question' ? 256_000 : 4096
      if (Number(request.headers['content-length']) > maxBody)
        throw new LocalFailure('BODY_TOO_LARGE', 413)
      const chunks = []
      let size = 0
      for await (const chunk of request) {
        size += chunk.length
        if (size > maxBody) throw new LocalFailure('BODY_TOO_LARGE', 413)
        chunks.push(chunk)
      }
      let body
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        throw new LocalFailure('INVALID_JSON')
      }
      if (!body || Array.isArray(body) || typeof body !== 'object')
        throw new LocalFailure('INVALID_BODY')
      if (application && url.pathname === '/api/app/question') {
        if (
          Object.keys(body).some(
            (key) => !['question', 'data', 'historyIds'].includes(key),
          ) ||
          !Object.hasOwn(body, 'question') ||
          !Object.hasOwn(body, 'data')
        )
          throw new LocalFailure('INVALID_BODY')
        const attempt = await session.ask(
          { mode: 'app', ...body },
          controller.signal,
        )
        const transport = attempt.transport[0]
        send(200, {
          id: attempt.id,
          result: attempt.result,
          telemetry: transport
            ? {
                at: transport.at,
                provider: transport.provider,
                model: transport.reportedModel,
                httpStatus: transport.httpStatus,
                responseId: transport.responseId,
                elapsedMs: transport.elapsedMs,
                usage: transport.usage,
              }
            : null,
          coverage: {
            available: attempt.preparedFacts['alcance.hechos_disponibles'],
            included: attempt.preparedFacts['alcance.hechos_incluidos'],
            partial: attempt.preparedFacts['alcance.detalle_parcial'],
          },
          state: appState(),
        })
        return
      }
      if (url.pathname === '/api/question') {
        send(200, await session.ask(body, controller.signal))
        return
      }
      if (url.pathname === '/api/review') {
        send(200, await session.review(body))
        return
      }
      if (url.pathname === '/api/stop') {
        send(200, { stopped: true })
        setImmediate(onStop)
        return
      }
      throw new LocalFailure('NOT_FOUND', 404)
    } catch (error) {
      if (error instanceof LocalFailure)
        send(error.status, {
          ok: false,
          code: error.code,
          retryAfterMs: error.retryAfterMs,
        })
      else send(500, { ok: false, code: 'LOCAL_TEST_ERROR' })
    }
  })
  return {
    server,
    cancelPending: () => {
      for (const controller of controllers) controller.abort()
    },
  }
}

async function main() {
  const appMode = process.argv.includes('--app')
  const appDataApproved = appMode && process.argv.includes('--allow-app-data')
  const portIndex = process.argv.indexOf('--port')
  const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 5187
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535)
    throw new LocalFailure('INVALID_PORT')
  const accountFile = process.env.ECOCLEANER_GROQ_ACCOUNT_FILE
  if (!accountFile) throw new LocalFailure('ACCOUNT_CONFIRMATION_REQUIRED')
  const account = validateAccount(
    JSON.parse(await readFile(accountFile, 'utf8')),
  )
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey?.trim()) throw new LocalFailure('GROQ_KEY_MISSING')
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const evidenceBase = path.join(
    path.dirname(repository),
    'evidencias',
    'groq-real-local',
  )
  const resumeIndex = process.argv.indexOf('--resume')
  const resume = resumeIndex >= 0
  const requestedResume = resume
    ? path.resolve(process.argv[resumeIndex + 1] ?? '')
    : null
  if (
    resume &&
    (!requestedResume.startsWith(evidenceBase + path.sep) ||
      !path.basename(requestedResume).startsWith('run-'))
  )
    throw new LocalFailure('INVALID_RESUME_DIRECTORY')
  const evidenceDirectory =
    requestedResume ??
    path.join(
      path.dirname(repository),
      'evidencias',
      'groq-real-local',
      day,
      `run-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`,
    )
  await mkdir(evidenceDirectory, { recursive: true })
  const preflight = await preflightGroq(apiKey)
  await writeFile(
    path.join(
      evidenceDirectory,
      resume ? `preflight-resume-${Date.now()}.json` : 'preflight.json',
    ),
    JSON.stringify(preflight, null, 2),
    { flag: 'wx' },
  )
  if (!preflight.ok) throw new LocalFailure(preflight.code, 503)
  const session = await createLocalSession({
    apiKey,
    account,
    evidenceDirectory,
    resume,
    appDataApproved,
    resumeReviewedConfiguration: process.argv.includes(
      '--reviewed-configuration',
    ),
    ...(process.argv.includes('--budget')
      ? {
          approvedTokenBudget: Number(
            process.argv[process.argv.indexOf('--budget') + 1],
          ),
        }
      : {}),
    ...(process.argv.includes('--max-generations')
      ? {
          approvedMaxGenerations: Number(
            process.argv[process.argv.indexOf('--max-generations') + 1],
          ),
        }
      : {}),
    ...(appMode
      ? {
          estimateInputTokens: (await import('./token-budget.mjs'))
            .estimateTokens,
        }
      : {}),
  })
  let closed = false
  const stop = () => {
    if (closed) return
    closed = true
    running.cancelPending()
    running.server.close()
    console.log(
      'Ejecutor local cerrado. No se cambió la Edge Function ni producción.',
    )
  }
  let vite
  let middleware
  const connectOrigins = []
  if (appMode) {
    const { loadEnv } = await import('vite')
    const env = loadEnv(
      'development',
      path.join(repository, 'apps/web'),
      'VITE_',
    )
    try {
      const source = new URL(env.VITE_SUPABASE_URL)
      if (source.protocol === 'https:') connectOrigins.push(source.origin)
    } catch {
      /* Sin URL remota válida, solo se permiten conexiones locales. */
    }
  }
  const running = createLocalServer(session, {
    onStop: () => {
      stop()
      void vite?.close()
    },
    ...(appMode
      ? {
          application: (request, response) => middleware(request, response),
          connectOrigins,
        }
      : {}),
  })
  if (appMode) {
    process.env.VITE_LOCAL_LLM = 'true'
    const { createServer } = await import('vite')
    vite = await createServer({
      root: path.join(repository, 'apps/web'),
      server: {
        middlewareMode: true,
        host: '127.0.0.1',
        allowedHosts: ['127.0.0.1'],
        hmr: { server: running.server },
        fs: {
          allow: [repository],
          deny: [
            '.env',
            '.env.*',
            '*.{crt,pem}',
            '**/.git/**',
            '**/scripts/**',
            '**/packages/core/server/**',
          ],
        },
      },
    })
    middleware = vite.middlewares
  }
  running.server.on('error', () => {
    console.error('LOCAL_SERVER_ERROR')
    process.exitCode = 1
  })
  running.server.listen(port, '127.0.0.1', () => {
    console.log(`Prueba local: http://127.0.0.1:${port}/`)
    console.log(`Evidencias: ${evidenceDirectory}`)
    console.log(
      `Modelo disponible y autenticación de Groq aceptada. Generaciones conservadas: ${session.state().generations}.`,
    )
  })
  const stopAll = () => {
    stop()
    void vite?.close()
  }
  process.once('SIGINT', stopAll)
  process.once('SIGTERM', stopAll)
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      error instanceof LocalFailure ? error.code : 'LOCAL_STARTUP_ERROR',
    )
    process.exitCode = 1
  })
}
