/**
 * Response helpers for MSW handlers so every mock behaves like the real API:
 * JSON bodies, RFC 9457 problem+json errors, bearer-token auth and role checks.
 *
 * Error helpers RETURN a Response; `throw` them to short-circuit a resolver (MSW 2 uses a thrown
 * Response as the mocked response), e.g. `throw notFound('Training request')`.
 */
import { HttpResponse, type JsonBodyType } from 'msw'
import type { ZodType } from 'zod'
import { toFieldPath } from '~/lib/api/errors'
import type { ProblemDetails } from '~/types/api'
import type { Role } from '~/types/auth'
import type { MockUser } from './core/types'
import { db, type MockCollection, type MockRecord } from './db'

export const PROBLEM_CONTENT_TYPE = 'application/problem+json'
const PROBLEM_TYPE_BASE = 'https://atrium.example.com/problems/'

const TITLES: Record<number, string> = {
  400: 'Bad request',
  401: 'Not signed in',
  403: 'Not allowed',
  404: 'Not found',
  409: 'Conflict',
  422: 'Validation failed',
  500: 'Server error',
  501: 'Not implemented',
}

export type FieldErrorInput =
  Array<{ field: string; message: string }> | Record<string, string | string[]>

function toErrorList(errors: FieldErrorInput): Array<{ field: string; message: string }> {
  if (Array.isArray(errors)) return errors
  return Object.entries(errors).flatMap(([field, messages]) =>
    (Array.isArray(messages) ? messages : [messages]).map((message) => ({ field, message })),
  )
}

export interface ProblemInit {
  title?: string
  detail?: string
  /** Short slug ("validation") or full URI. */
  type?: string
  errors?: FieldErrorInput
  extensions?: Record<string, unknown>
}

export function problem(status: number, init: ProblemInit = {}) {
  const body: ProblemDetails = {
    type: init.type
      ? init.type.includes(':')
        ? init.type
        : `${PROBLEM_TYPE_BASE}${init.type}`
      : 'about:blank',
    title: init.title ?? TITLES[status] ?? 'Error',
    status,
    ...(init.detail ? { detail: init.detail } : {}),
    ...(init.errors ? { errors: toErrorList(init.errors) } : {}),
    ...init.extensions,
  }
  return HttpResponse.json(body, {
    status,
    headers: { 'Content-Type': PROBLEM_CONTENT_TYPE },
  })
}

export const badRequest = (detail?: string) => problem(400, { detail })
export const unauthorized = (detail = 'Please sign in again.') => problem(401, { detail })
export const forbidden = (detail = 'You are not allowed to do this.') => problem(403, { detail })
export const notFound = (what = 'Resource') => problem(404, { detail: `${what} was not found.` })
export const conflict = (detail: string) => problem(409, { detail })
export const validationProblem = (errors: FieldErrorInput, detail?: string) =>
  problem(422, {
    type: 'validation',
    errors,
    detail: detail ?? 'Please check the highlighted fields.',
  })

export const ok = <T extends JsonBodyType>(body: T, init?: ResponseInit) =>
  HttpResponse.json(body, init)
export const created = <T extends JsonBodyType>(body: T) => HttpResponse.json(body, { status: 201 })
export const noContent = () => new HttpResponse(null, { status: 204 })

/**
 * Parse a JSON request body. With a zod schema, invalid input throws a 422 problem whose field
 * errors use the same paths as the form (share the schema between form and mock).
 */
export async function readJson<T = unknown>(request: Request, schema?: ZodType<T>): Promise<T> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw badRequest('Request body must be valid JSON.')
  }
  if (!schema) return body as T
  const result = schema.safeParse(body)
  if (result.success) return result.data
  throw validationProblem(
    result.error.issues.map((issue) => ({
      field: toFieldPath(issue.path.map(String)) ?? '',
      message: issue.message,
    })),
  )
}

// ---------------------------------------------------------------------------------------------
// Demo auth: the token is an opaque "demo.<userId>" string issued by POST /auth/login.
// ---------------------------------------------------------------------------------------------

export const DEMO_PASSWORD = 'demo1234'
const TOKEN_PREFIX = 'demo.'

export function issueDemoToken(user: Pick<MockUser, 'id'>): string {
  return `${TOKEN_PREFIX}${user.id}`
}

/** Current user from the Authorization header, or undefined. */
export function currentUser(request: Request): MockUser | undefined {
  const header = request.headers.get('Authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  const token = match?.[1]
  if (!token?.startsWith(TOKEN_PREFIX)) return undefined
  const user = db.users.find(token.slice(TOKEN_PREFIX.length))
  return user?.active ? user : undefined
}

/** Current user or throw 401. */
export function requireUser(request: Request): MockUser {
  const user = currentUser(request)
  if (!user) throw unauthorized()
  return user
}

export function hasAnyRole(user: Pick<MockUser, 'roles'>, roles: readonly Role[]): boolean {
  return roles.some((role) => user.roles.includes(role))
}

/** Current user with ANY of the roles, or throw 401/403. */
export function requireRole(request: Request, ...roles: Role[]): MockUser {
  const user = requireUser(request)
  if (!hasAnyRole(user, roles)) throw forbidden()
  return user
}

/** Record by id or throw 404. */
export function findOr404<T extends MockRecord>(
  collection: MockCollection<T>,
  id: string | readonly string[] | undefined,
  what = 'Resource',
): T {
  const key = Array.isArray(id) ? id[0] : id
  const record = typeof key === 'string' ? collection.find(key) : undefined
  if (!record) throw notFound(what)
  return record
}
