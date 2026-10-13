import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createHttpClient } from '~/lib/api/http'
import { isApiError } from '~/lib/api'
import { USER_IDS } from '~/mocks/core/seed'
import { db, resetDemoData } from '~/mocks/db'
import { createMockServer, TEST_API_BASE } from '~/mocks/node'
import type {
  ApproverChain,
  DeputiesResponse,
  EnumCatalog,
  InboxResponse,
  LoginResponse,
  Me,
  Page,
  Persona,
  UserSummary,
} from '~/types/api'

/**
 * Pattern for slice tests: the real HTTP client against the same MSW handlers demo mode uses.
 * `resetDemoData({ refDate })` makes every relative date (ctx.d(n)) deterministic.
 */
const server = createMockServer(TEST_API_BASE)
let token: string | null = null
const api = createHttpClient({ baseUrl: TEST_API_BASE, getToken: () => token })

async function signInAs(personaKey: string) {
  const session = await api.post<LoginResponse>('/auth/demo-login', { personaKey })
  token = session.accessToken
  return session
}
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error,
  )

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetDemoData({ refDate: new Date(2026, 9, 13) })
  token = null
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('core mock API', () => {
  it('seeds the 52-user org from users.json with the backend ids', () => {
    expect(db.users.count()).toBe(52)
    expect(db.users.find(USER_IDS.emma)?.email).toBe('emma.employee@example.com')
    expect(db.users.all().every((user) => user.email.endsWith('@example.com'))).toBe(true)
  })

  it('lists the 9 personas and signs in with the demo password', async () => {
    const personas = await api.get<Persona[]>('/auth/personas')
    expect(personas.map((persona) => persona.key)).toEqual([
      'emma',
      'max',
      'sofia',
      'clara',
      'tom',
      'tina',
      'arne',
      'paula',
      'ian',
    ])
    const session = await api.post<LoginResponse>('/auth/login', {
      email: 'max.manager@example.com',
      password: 'demo1234',
    })
    token = session.accessToken
    const me = await api.get<Me>('/me')
    expect(me.displayName).toBe('Max Manager')
    expect(me.isManager).toBe(true)
    expect(me.activeDeputyFor.map((entry) => entry.principal.displayName)).toContain('Priya Raman')
  })

  it('rejects a wrong password with 401 invalid_credentials and bad input with 422', async () => {
    const wrong = await failure(
      api.post('/auth/login', { email: 'emma.employee@example.com', password: 'nope' }),
    )
    expect(isApiError(wrong) && [wrong.status, wrong.code]).toEqual([401, 'invalid_credentials'])
    const invalid = await failure(api.post('/auth/login', { email: 'not-an-email', password: '' }))
    expect(isApiError(invalid) && invalid.status).toBe(422)
    expect(isApiError(invalid) && Object.keys(invalid.fieldErrors).sort()).toEqual([
      'email',
      'password',
    ])
  })

  it('answers 401 for a missing or unknown token', async () => {
    expect(isApiError(await failure(api.get('/me'))) && 401).toBe(401)
    token = 'demo.does-not-exist'
    const error = await failure(api.get('/me'))
    expect(isApiError(error) && error.status).toBe(401)
  })

  it('searches users by name for the UserPicker', async () => {
    await signInAs('emma')
    const page = await api.get<Page<UserSummary>>('/users', { q: 'priya' })
    expect(page.data.map((user) => user.displayName)).toEqual(['Priya Raman'])
    expect(page.meta).toMatchObject({ page: 1, total: 1 })
  })

  it('resolves approvers: direct manager, and site-manager escalation (SPEC §6.1)', async () => {
    await signInAs('max')
    const emma = await api.get<ApproverChain>(`/users/${USER_IDS.emma}/approvers`)
    expect(emma.default).toMatchObject({ reason: 'direct_manager' })
    expect(emma.default?.user.displayName).toBe('Max Manager')

    const hilTech = await api.get<ApproverChain>(`/users/${USER_IDS.hilTech1}/approvers`)
    expect(hilTech.default?.reason).toBe('site_manager_escalation')
    expect(hilTech.default?.user.displayName).toBe('Max Manager')
  })

  it('manages deputies with overlap protection', async () => {
    await signInAs('max')
    const before = await api.get<DeputiesResponse>('/me/deputies')
    expect(before.asPrincipal.map((row) => row.deputy.displayName)).toEqual(['Sofia Site-Manager'])
    expect(before.asDeputy[0]?.state).toBe('active')

    const overlap = await failure(
      api.post('/me/deputies', {
        deputyId: USER_IDS.sofia,
        validFrom: '2026-10-25',
        validTo: '2026-10-30',
      }),
    )
    expect(isApiError(overlap) && overlap.status).toBe(409)
  })

  it('forbids deputies for employees without reports', async () => {
    await signInAs('emma')
    const error = await failure(api.post('/me/deputies', { deputyId: USER_IDS.max }))
    expect(isApiError(error) && error.status).toBe(403)
  })

  it('serves the inbox envelope and the zero count stubs', async () => {
    await signInAs('emma')
    const inbox = await api.get<InboxResponse>('/me/inbox')
    expect(inbox.meta).toMatchObject({ total: inbox.data.length })
    const counts = await api.get<Record<string, unknown>>('/travel/queues/counts')
    expect(counts).toBeTypeOf('object')
  })

  it('serves enums and guards admin endpoints by role', async () => {
    await signInAs('emma')
    const enums = await api.get<EnumCatalog>('/meta/enums')
    expect(Object.keys(enums)).toEqual(
      expect.arrayContaining(['role', 'travelStatus', 'attendeeStatus']),
    )
    const forbidden = await failure(api.get('/admin/users'))
    expect(isApiError(forbidden) && forbidden.status).toBe(403)

    await signInAs('ian')
    const users = await api.get<Page<UserSummary>>('/admin/users', { perPage: 10 })
    expect(users.meta.total).toBe(52)
    const reset = await failure(api.post('/admin/jobs/demo.reset/run'))
    expect(isApiError(reset) && reset.status).toBe(403)
  })

  it('rejects a manager cycle with 422 on managerId', async () => {
    await signInAs('ian')
    const error = await failure(
      api.patch(`/admin/users/${USER_IDS.max}`, { managerId: USER_IDS.emma }),
    )
    expect(isApiError(error) && error.status).toBe(422)
    expect(isApiError(error) && error.fieldError('managerId')).toMatch(/reports to/)
  })
})
