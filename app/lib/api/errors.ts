import type { ProblemDetails } from '~/types/api'

/** Field path -> messages. Paths use vee-validate syntax: "attendees[0].email". */
export type FieldErrors = Record<string, string[]>

/**
 * Every failed API call surfaces as an ApiError (normalised from RFC 9457 problem+json).
 * status 0 = the request never got a response (network error, CORS, aborted).
 */
export class ApiError extends Error {
  readonly status: number
  readonly title: string
  readonly detail?: string
  readonly type?: string
  readonly fieldErrors: FieldErrors
  /** The raw response body (parsed JSON when possible). */
  readonly body?: unknown

  constructor(init: {
    status: number
    title: string
    detail?: string
    type?: string
    fieldErrors?: FieldErrors
    body?: unknown
    cause?: unknown
  }) {
    super(init.detail ? `${init.title}: ${init.detail}` : init.title, { cause: init.cause })
    this.name = 'ApiError'
    this.status = init.status
    this.title = init.title
    this.detail = init.detail
    this.type = init.type
    this.fieldErrors = init.fieldErrors ?? {}
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

const DEFAULT_TITLES: Record<number, string> = {
  400: 'Bad request',
  401: 'Not signed in',
  403: 'Not allowed',
  404: 'Not found',
  409: 'Conflict',
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
 * - errors: [{ field | pointer | path | name, message | detail | reason }]
 * - errors | fieldErrors: { "title": ["msg"] | "msg" }
 * - invalid-params | invalidParams: [{ name, reason }]  (RFC 7807 example)
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

/** Build an ApiError from an HTTP response and its (already parsed) body. */
export function toApiError(
  response: Pick<Response, 'status' | 'statusText'>,
  body: unknown,
): ApiError {
  const problem = isRecord(body) ? (body as Partial<ProblemDetails>) : undefined
  const status = typeof problem?.status === 'number' ? problem.status : response.status
  const title =
    (typeof problem?.title === 'string' && problem.title) ||
    // NestJS default error shape: { statusCode, message, error }
    (isRecord(body) && typeof body.error === 'string' && body.error) ||
    response.statusText ||
    DEFAULT_TITLES[status] ||
    `Request failed (${status})`
  let detail = typeof problem?.detail === 'string' ? problem.detail : undefined
  if (!detail && isRecord(body) && typeof body.message === 'string') detail = body.message
  if (!detail && typeof body === 'string' && body.length > 0 && body.length < 500) detail = body
  return new ApiError({
    status,
    title,
    detail,
    type: typeof problem?.type === 'string' ? problem.type : undefined,
    fieldErrors: extractFieldErrors(body),
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
    detail: aborted
      ? undefined
      : 'The server could not be reached. Check your connection and try again.',
    cause,
  })
}
