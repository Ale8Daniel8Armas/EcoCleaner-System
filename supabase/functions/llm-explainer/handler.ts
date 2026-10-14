import type {
  ExplanationContext,
  ExplanationInput,
  ExplanationResult,
} from '../../../packages/core/server/llm/contracts.ts'
import {
  containsSecret,
  isObject,
  isText,
} from '../../../packages/core/server/llm/context.ts'
import { readBoundedText } from '../../../packages/core/server/llm/groq.ts'

export interface VerifiedUser {
  id: string
  role: 'operario' | 'supervisor' | null
}
export interface ResourceRequest {
  kind: ExplanationContext['kind']
  resourceId: string
  question: string
  observations?: string
}
export interface EdgeDependencies {
  enabled: boolean
  allowedOrigins: string[]
  verifyIdentity: (
    token: string,
    signal: AbortSignal,
  ) => Promise<VerifiedUser | null>
  authorizeResource: (
    user: VerifiedUser,
    resource: ResourceRequest,
    signal: AbortSignal,
  ) => Promise<{
    allowed: boolean
    externalProcessingApproved: boolean
    /** El líder definirá cómo verificar este privilegio; no se deduce del rol supervisor. */
    chiefSupervisorVerified: boolean
  }>
  /** Reserva atómica por usuario y global; un contador local no satisface este contrato. */
  consumeDistributedQuota: (
    user: VerifiedUser,
    signal: AbortSignal,
  ) => Promise<boolean>
  loadContext: (
    user: VerifiedUser,
    resource: ResourceRequest,
    token: string,
    signal: AbortSignal,
  ) => Promise<ExplanationContext | null>
  explain: (
    input: ExplanationInput,
    options: { signal: AbortSignal },
  ) => Promise<ExplanationResult>
}

export const isUUID = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )

export function createEdgeHandler(dependencies: EdgeDependencies) {
  const origins = new Set(
    dependencies.allowedOrigins.filter((origin) => {
      try {
        const url = new URL(origin)
        return (
          url.origin === origin &&
          (url.protocol === 'https:' || url.hostname === 'localhost')
        )
      } catch {
        return false
      }
    }),
  )
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin')
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    })
    if (origin && origins.has(origin))
      headers.set('Access-Control-Allow-Origin', origin)
    const send = (status: number, code: string, data?: ExplanationResult) =>
      new Response(JSON.stringify(data ?? { ok: false, code }), {
        status,
        headers,
      })
    if (dependencies.enabled !== true) return send(503, 'EDGE_DISABLED')
    if (origin && !origins.has(origin)) return send(403, 'ORIGIN_NOT_ALLOWED')
    if (request.method === 'OPTIONS') {
      if (
        !origin ||
        request.headers.get('access-control-request-method') !== 'POST'
      )
        return send(403, 'ORIGIN_NOT_ALLOWED')
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
      headers.set(
        'Access-Control-Allow-Headers',
        'authorization, apikey, content-type, x-client-info',
      )
      return new Response(null, { status: 204, headers })
    }
    if (request.method !== 'POST') {
      headers.set('Allow', 'POST, OPTIONS')
      return send(405, 'METHOD_NOT_ALLOWED')
    }
    if (
      request.headers
        .get('content-type')
        ?.split(';')[0]
        .trim()
        .toLowerCase() !== 'application/json'
    )
      return send(415, 'JSON_REQUIRED')
    const auth = request.headers.get('authorization')
    const match = auth?.match(
      /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/,
    )
    if (!match || match[1].length > 8192) return send(401, 'UNAUTHENTICATED')
    const controller = new AbortController()
    const abort = () => controller.abort()
    request.signal.addEventListener('abort', abort, { once: true })
    if (request.signal.aborted) controller.abort()
    const timeout = setTimeout(abort, 12_000)
    const cancelled = new Promise<Response>((resolve) => {
      if (controller.signal.aborted) resolve(send(504, 'REQUEST_TIMEOUT'))
      else
        controller.signal.addEventListener(
          'abort',
          () => resolve(send(504, 'REQUEST_TIMEOUT')),
          { once: true },
        )
    })
    const operation = (async () => {
      try {
        const declaredLength = Number(request.headers.get('content-length'))
        if (declaredLength > 4096) return send(413, 'BODY_TOO_LARGE')
        let body: unknown
        try {
          const envelope = new Response(request.body, {
            headers: request.headers,
          })
          body = JSON.parse(
            await readBoundedText(envelope, 4096, controller.signal),
          )
        } catch {
          return send(400, 'INVALID_BODY')
        }
        if (
          !isObject(body) ||
          Object.keys(body).some(
            (key) =>
              !['kind', 'resourceId', 'question', 'observations'].includes(key),
          ) ||
          ![
            'recipe',
            'deviation',
            'comparison',
            'incompatibilities',
            'effluent',
          ].includes(body.kind as string) ||
          !isUUID(body.resourceId) ||
          !isText(body.question, 700) ||
          (body.observations !== undefined &&
            !isText(body.observations, 1200)) ||
          containsSecret(JSON.stringify(body))
        )
          return send(400, 'INVALID_BODY')
        const resource = body as unknown as ResourceRequest
        const user = await dependencies.verifyIdentity(
          match[1],
          controller.signal,
        )
        if (controller.signal.aborted) return send(504, 'REQUEST_TIMEOUT')
        if (!user || !isUUID(user.id)) return send(401, 'UNAUTHENTICATED')
        if (user.role !== 'supervisor') return send(403, 'FORBIDDEN')
        const access = await dependencies.authorizeResource(
          user,
          resource,
          controller.signal,
        )
        if (controller.signal.aborted) return send(504, 'REQUEST_TIMEOUT')
        if (
          access.allowed !== true ||
          access.externalProcessingApproved !== true ||
          access.chiefSupervisorVerified !== true
        )
          return send(403, 'FORBIDDEN')
        if (
          !(await dependencies.consumeDistributedQuota(user, controller.signal))
        )
          return send(429, 'QUOTA_EXCEEDED')
        if (controller.signal.aborted) return send(504, 'REQUEST_TIMEOUT')
        const context = await dependencies.loadContext(
          user,
          resource,
          match[1],
          controller.signal,
        )
        if (controller.signal.aborted) return send(504, 'REQUEST_TIMEOUT')
        if (!context || context.kind !== resource.kind)
          return send(404, 'CONTEXT_UNAVAILABLE')
        const result = await dependencies.explain(
          {
            context,
            question: resource.question,
            observations: resource.observations,
            disclosure: 'approved_for_external_processing',
          },
          { signal: controller.signal },
        )
        if (result.ok) return send(200, 'OK', result)
        const status =
          result.code === 'RATE_LIMIT' || result.code === 'BUSY'
            ? 429
            : result.code === 'TIMEOUT' || result.code === 'CANCELLED'
              ? 504
              : result.code === 'PROVIDER_NOT_CONFIGURED'
                ? 503
                : result.code === 'INVALID_INPUT' ||
                    result.code === 'INPUT_LIMIT'
                  ? 422
                  : 502
        return send(status, result.code, result)
      } catch {
        return send(503, 'SERVICE_UNAVAILABLE')
      }
    })()
    try {
      return await Promise.race([operation, cancelled])
    } finally {
      clearTimeout(timeout)
      request.signal.removeEventListener('abort', abort)
    }
  }
}
