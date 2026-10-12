import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApiClient, isApiError, unwrap } from '~/lib/api'
import { resetDemoData } from '~/mocks/db'
import { createMockServer, TEST_API_BASE } from '~/mocks/node'

/**
 * Pattern for slice tests: the real API client against the same MSW handlers demo mode uses.
 */
const server = createMockServer(TEST_API_BASE)
let token = ''
let unauthorizedCalls = 0
const api = createApiClient({
  baseUrl: TEST_API_BASE,
  getToken: () => token,
  onUnauthorized: () => unauthorizedCalls++,
})

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetDemoData({ refDate: new Date('2026-10-01T00:00:00.000Z') })
  token = ''
  unauthorizedCalls = 0
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('API client against the mock handlers', () => {
  it('lists personas and signs in with the demo password', async () => {
    const personas = await unwrap(api.GET('/auth/personas'))
    expect(personas[0]?.email).toBe('emma.employee@example.com')

    const login = await unwrap(
      api.POST('/auth/login', {
        body: { email: 'emma.employee@example.com', password: 'demo1234' },
      }),
    )
    token = login.accessToken
    const me = await unwrap(api.GET('/me'))
    expect(me.displayName).toBe('Emma Employee')
    expect(me.roles).toContain('employee')
  })

  it('maps validation problems to field errors', async () => {
    const error = await unwrap(
      api.POST('/auth/login', { body: { email: 'not-an-email', password: '' } }),
    ).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.status).toBe(422)
    expect(isApiError(error) && Object.keys(error.fieldErrors).sort()).toEqual([
      'email',
      'password',
    ])
  })

  it('reports 401 for an invalid token and calls onUnauthorized', async () => {
    token = 'demo.does-not-exist'
    const error = await unwrap(api.GET('/me')).catch((caught: unknown) => caught)
    expect(isApiError(error) && error.status).toBe(401)
    expect(unauthorizedCalls).toBe(1)
  })

  it('answers unknown API paths with a 501 problem', async () => {
    const response = await fetch(`${TEST_API_BASE}/not/mocked/yet`)
    expect(response.status).toBe(501)
    expect(response.headers.get('Content-Type')).toBe('application/problem+json')
  })
})
