/**
 * Response helpers for MSW handlers so every mock behaves like the real API (API.md §1, §2.4):
 * JSON bodies, RFC 9457 problem+json with `code` + `traceId`, 422 `errors` keyed by dot paths,
 * bearer-token auth and role checks.
 *
 * Error helpers RETURN a Response; `throw` them to short-circuit a resolver (MSW 2 uses a thrown
 * Response as the mocked response), e.g. `throw notFound()`.
 */
import { HttpResponse, type JsonBodyType } from 'msw'
import type { ZodType } from 'zod'
import { hasRole } from '~/lib/access'
import type { ErrorCode, Problem, RoleName } from '~/types/api'
import type { MockUser } from './core/types'
import { rolesOf, toMe } from './core/org'
import { db, type MockCollection, type MockRecord } from './db'

export const PROBLEM_CONTENT_TYPE = 'application/problem+json'
const PROBLEM_TYPE_BASE = 'https://atrium.example.com/problems/'

const DEFAULTS: Record<number, { code: ErrorCode; title: string }> = {
  400: { code: 'validation_failed', title: 'Bad request' },
  401: { code: 'unauthenticated', title: 'Not signed in' },
  403: { code: 'forbidden', title: 'Not allowed' },
  404: { code: 'not_found', title: 'Not found' },
  409: { code: 'conflict', title: 'Conflict' },
  413: { code: 'payload_too_large', title: 'File too large' },
  415: { code: 'unsupported_media_type', title: 'Unsupported file type' },
  422: { code: 'validation_failed', title: 'Validation failed' },
  429: { code: 'rate_limited', title: 'Too many requests' },
  500: { code: 'internal_error', title: 'Server error' },
}

let traceSequence = 0

export interface ProblemInit {
  code?: ErrorCode | string
  title?: string
  detail?: string
  /** 422 field errors: dot paths with numeric indices (`attendees.0.userId`). */
  errors?: Record<string, string[]>
  instance?: string
  headers?: Record<string, string>
}

export function problem(status: number, init: ProblemInit = {}) {
  const defaults = DEFAULTS[status] ?? { code: 'internal_error', title: 'Error' }
  const code = (init.code ?? defaults.code) as ErrorCode
  const body: Problem = {
    type: `${PROBLEM_TYPE_BASE}${code}`,
    title: init.title ?? defaults.title,
    status,
    code,
    traceId: `req_mock${(++traceSequence).toString(36)}`,
    ...(init.detail ? { detail: init.detail } : {}),
    ...(init.instance ? { instance: init.instance } : {}),
    ...(init.errors ? { errors: init.errors } : {}),
  }
  return HttpResponse.json(body as unknown as JsonBodyType, {
    status,
    headers: { 'Content-Type': PROBLEM_CONTENT_TYPE, ...init.headers },
  })
}

export const unauthorized = (detail = 'Sign in again to continue.') =>
  problem(401, { code: 'unauthenticated', detail })
export const forbidden = (detail = "You don't have permission to do this.") =>
  problem(403, { code: 'forbidden', detail })
/** Invisible resources are 404 too (API.md §1 "Visibility"). */
export const notFound = (
  detail = "We couldn't find that. It may not exist, or you may not have access.",
) => problem(404, { code: 'not_found', detail })
export const conflict = (detail: string, code: ErrorCode = 'conflict') =>
  problem(409, { code, detail })
export const invalidTransition = (action: string, state: string) =>
  problem(409, {
    code: 'invalid_transition',
    title: 'Action not available',
    detail: `Action '${action}' is not available in state '${state}'.`,
  })
export const validationProblem = (errors: Record<string, string | string[]>, detail?: string) =>
  problem(422, {
    code: 'validation_failed',
    detail: detail ?? 'Some fields need your attention.',
    errors: Object.fromEntries(
      Object.entries(errors).map(([field, messages]) => [
        field,
        Array.isArray(messages) ? messages : [messages],
      ]),
    ),
  })

export const ok = <T extends JsonBodyType>(body: T, init?: ResponseInit) =>
  HttpResponse.json(body, init)
export const created = <T extends JsonBodyType>(body: T, location?: string) =>
  HttpResponse.json(body, {
    status: 201,
    headers: location ? { Location: location } : undefined,
  })
export const accepted = <T extends JsonBodyType>(body: T) =>
  HttpResponse.json(body, { status: 202 })
export const noContent = () => new HttpResponse(null, { status: 204 })

/** zod issue path → API dot path: ['attendees', 0, 'userId'] → 'attendees.0.userId'. */
export function toDotPath(path: ReadonlyArray<PropertyKey>): string {
  return path.map(String).join('.') || '_'
}

/**
 * Parse a JSON request body. With a zod schema, invalid input throws a 422 whose `errors` use the
 * API's dot paths — share the schema between the form and the mock.
 */
export async function readJson<T = unknown>(request: Request, schema?: ZodType<T>): Promise<T> {
  let body: unknown = {}
  const text = await request.text()
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      throw problem(400, { detail: 'Request body must be valid JSON.' })
    }
  }
  if (!schema) return body as T
  const result = schema.safeParse(body)
  if (result.success) return result.data
  const errors: Record<string, string[]> = {}
  for (const issue of result.error.issues) {
    const key = toDotPath(issue.path)
    ;(errors[key] ??= []).push(issue.message)
  }
  throw validationProblem(errors)
}

// ---------------------------------------------------------------------------------------------
// Demo auth: the token is an opaque "demo.<userId>" string issued by /auth/login.
// ---------------------------------------------------------------------------------------------

export const DEMO_PASSWORD = 'demo1234'
const TOKEN_PREFIX = 'demo.'

export function issueDemoToken(user: Pick<MockUser, 'id'>): string {
  return `${TOKEN_PREFIX}${user.id}`
}

/** Current user from the Authorization header, or undefined. */
export function currentUser(request: Request): MockUser | undefined {
  const header = request.headers.get('Authorization') ?? ''
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]
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

/** Role check including derived roles (`employee`, `manager`). */
export function userHasRole(user: MockUser, role: RoleName): boolean {
  const roles = rolesOf(db, user)
  return hasRole(
    { roles, isManager: roles.includes('manager'), isExecutive: user.roles.includes('executive') },
    role,
  )
}

export function hasAnyRole(user: MockUser, roles: readonly RoleName[]): boolean {
  return roles.some((role) => userHasRole(user, role))
}

/** Current user with ANY of the roles, or throw 401/403. */
export function requireRole(request: Request, ...roles: RoleName[]): MockUser {
  const user = requireUser(request)
  if (!hasAnyRole(user, roles)) throw forbidden()
  return user
}

/** Me DTO for a user. */
export const meOf = (user: MockUser) => toMe(db, user)

/** Record by id or throw 404. */
export function findOr404<T extends MockRecord>(
  collection: MockCollection<T>,
  id: string | readonly string[] | undefined,
): T {
  const key = Array.isArray(id) ? id[0] : id
  const record = typeof key === 'string' ? collection.find(key) : undefined
  if (!record) throw notFound()
  return record
}

/** A path param as a string. */
export const param = (value: string | readonly string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? ''
