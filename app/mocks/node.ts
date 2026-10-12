import { setupServer } from 'msw/node'
import { buildMockHandlers } from './handlers'

export const TEST_API_BASE = 'http://localhost:3100/api/v1'

/**
 * MSW server with the same handlers as demo mode, for Vitest (no latency).
 *
 * @example
 * const server = createMockServer()
 * beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
 * afterEach(() => server.resetHandlers())
 * afterAll(() => server.close())
 */
export function createMockServer(apiBase = TEST_API_BASE) {
  return setupServer(...buildMockHandlers(apiBase, { latency: 0 }))
}
