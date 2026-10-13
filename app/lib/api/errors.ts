import type { ErrorCode } from '~/types/api'

/** Field path -> messages. Paths use vee-validate syntax: "attendees[0].userId". */
export type FieldErrors = Record<string, string[]>

/**
 * Every failed API call surfaces as an ApiError, normalised from RFC 9457 problem+json
 * (API.md §2.4). status 0 = the request never got a response (network error, aborted).
 */
export class ApiError extends Error {
  readonly status: number
  readonly title: string
  readonly detail?: string
  readonly type?: string
  /** API error code (`invalid_transition`, `validation_failed`, …), when the server sent one. */
  readonly code?: ErrorCode | string
  readonly traceId?: string
  readonly instance?: string
  /** 422 `errors`, keyed by vee-validate paths. */
  readonly fieldErrors: FieldErrors
  /** `Retry-After` seconds for 429. */
  readonly retryAfter?: number
  /** The raw response body (parsed JSON when possible). */
  readonly body?: unknown

  constructor(init: {
    status: number
    title: string
    detail?: string
    type?: string
    code?: ErrorCode | string
    traceId?: string
    instance?: string
    fieldErrors?: FieldErrors
    retryAfter?: number
    body?: unknown
    cause?: unknown
  }) {
    super(init.detail ? `${init.title}: ${init.detail}` : init.title, { cause: init.cause })
    this.name = 'ApiError'
    this.status = init.status
    this.title = init.title
    this.detail = init.detail
    this.type = init.type
    this.code = init.code
    this.traceId = init.traceId
    this.instance = init.instance
    this.fieldErrors = init.fieldErrors ?? {}
    this.retryAfter = init.retryAfter
    this.body = init.body
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }

  get isValidationError(): boolean {
    return (this.status === 400 || this.status === 422) && Object.keys(this.fieldErrors).length > 0
  }

  /** First message for a field (handy in templates). */
  fieldError(path: string): string | undefined {
    return this.fieldErrors[path]?.[0]
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}

/** `isProblem(error, 'invalid_transition')` */
export function isProblem(value: unknown, code: ErrorCode | string): value is ApiError {
  return isApiError(value) && value.code === code
}

const DEFAULT_TITLES: Record<number, string> = {
  400: 'Bad request',
  401: 'Not signed in',
  403: 'Not allowed',
  404: 'Not found',
  409: 'Conflict',
  413: 'File too large',
  415: 'Unsupported file type',
  422: 'Validation failed',
  429: 'Too many requests',
  500: 'Server error',
  503: 'Service unavailable',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** "/attendees/0/email" | "attendees.0.email" | ["attendees", 0, "email"] -> "attendees[0].email" */
export function toFieldPath(raw: unknown): string | undefined {
  let segments: string[]
  if (Array.isArray(raw)) {
    segments = raw.map(String)
  } else if (typeof raw === 'string' && raw.length > 0) {
    const trimmed = raw.startsWith('#') ? raw.slice(1) : raw
    segments = trimmed.startsWith('/')
      ? trimmed
          .slice(1)
          .split('/')
          .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
      : trimmed.replace(/\[(\d+)\]/g, '.$1').split('.')
  } else {
    return undefined
  }
  segments = segments.filter((segment) => segment.length > 0)
  if (segments.length === 0) return undefined
  return segments.reduce((path, segment) => {
    if (/^\d+$/.test(segment)) return `${path}[${segment}]`
    return path ? `${path}.${segment}` : segment
  }, '')
}

function pushFieldError(target: FieldErrors, path: unknown, message: unknown) {
  const key = toFieldPath(path)
  if (!key) return
  const messages = (Array.isArray(message) ? message : [message]).filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )
  if (messages.length === 0) return
  const existing = target[key] ?? []
  existing.push(...messages)
  target[key] = existing
}

/**
 * Accepts the common field-error encodings so mocks and the real API cannot drift apart silently:
 * - errors: { "attendees.0.userId": ["msg"] }   ← API.md §2.4 (canonical)
 * - errors: [{ field | pointer | path | name, message | detail | reason }]
 * - fieldErrors / invalid-params / invalidParams
 */
export function extractFieldErrors(body: unknown): FieldErrors {
  const result: FieldErrors = {}
  if (!isRecord(body)) return result
  const candidates = [body.errors, body.fieldErrors, body['invalid-params'], body.invalidParams]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        if (!isRecord(item)) continue
        pushFieldError(
          result,
          item.field ?? item.pointer ?? item.path ?? item.name,
          item.message ?? item.detail ?? item.reason,
        )
      }
    } else if (isRecord(candidate)) {
      for (const [field, messages] of Object.entries(candidate)) {
        pushFieldError(result, field, messages)
      }
    }
  }
  return result
}

const str = (value: unknown) => (typeof value === 'string' && value.length > 0 ? value : undefined)

/** Build an ApiError from an HTTP response and its (already parsed) body. */
export function toApiError(
  response: Pick<Response, 'status' | 'statusText'> & { headers?: Headers },
  body: unknown,
): ApiError {
  const problem = isRecord(body) ? body : undefined
  const status = typeof problem?.status === 'number' ? problem.status : response.status
  const title =
    str(problem?.title) ??
    // NestJS default error shape: { statusCode, message, error }
    str(problem?.error) ??
    str(response.statusText) ??
    DEFAULT_TITLES[status] ??
    `Request failed (${status})`
  let detail = str(problem?.detail)
  if (!detail) detail = str(problem?.message)
  if (!detail && typeof body === 'string' && body.length > 0 && body.length < 500) detail = body
  const code = str(problem?.code)
  const typeCode = str(problem?.type)?.match(/\/problems\/([a-z_]+)$/)?.[1]
  const retryAfter = Number(response.headers?.get?.('Retry-After') ?? NaN)
  return new ApiError({
    status,
    title,
    detail,
    type: str(problem?.type),
    code: code ?? typeCode,
    traceId: str(problem?.traceId),
    instance: str(problem?.instance),
    fieldErrors: extractFieldErrors(body),
    retryAfter: Number.isFinite(retryAfter) ? retryAfter : undefined,
    body,
  })
}

/** Wrap anything thrown while calling the API (fetch TypeError, AbortError, ...) into an ApiError. */
export function toNetworkError(cause: unknown): ApiError {
  if (isApiError(cause)) return cause
  const aborted =
    typeof cause === 'object' &&
    cause !== null &&
    (cause as { name?: unknown }).name === 'AbortError'
  return new ApiError({
    status: 0,
    title: aborted ? 'Request cancelled' : 'Network error',
    detail: aborted ? undefined : "Couldn't reach Atrium. Check your connection and try again.",
    cause,
  })
}

/** User-facing sentence for an error (toast / ProblemAlert). */
export function describeError(error: unknown): { title: string; detail?: string } {
  if (isApiError(error)) {
    if (error.code === 'invalid_transition') {
      return {
        title: 'This request changed in the meantime',
        detail: 'Atrium reloaded it. Check the current state and try again.',
      }
    }
    if (error.code === 'version_conflict') {
      return {
        title: 'Someone else changed this',
        detail: 'Reload to see the latest version, then make your change again.',
      }
    }
    if (error.status === 429) {
      const minutes = error.retryAfter ? Math.max(1, Math.ceil(error.retryAfter / 60)) : undefined
      return {
        title: 'Too many attempts',
        detail: minutes ? `Try again in ${minutes} min.` : 'Try again in a few minutes.',
      }
    }
    return { title: error.title, detail: error.detail }
  }
  return {
    title: 'Something did not work',
    detail: error instanceof Error ? error.message : undefined,
  }
}
