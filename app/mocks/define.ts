/**
 * Authoring API for module mocks. This file has NO runtime dependencies on the mock database,
 * so module seed files can import from it without creating import cycles.
 */
import type { Faker } from '@faker-js/faker'
import type { RequestHandler } from 'msw'
import type { MockDb } from './db'

export interface MockContext {
  /** Absolute/relative URL for an API path: api('/training/requests') -> `${apiBase}/training/requests`. */
  api: (path: string) => string
}

export type MockHandlersFactory = (context: MockContext) => RequestHandler[]

/**
 * Default export of app/modules/<module>/mocks/handlers.ts.
 *
 * @example
 * export default defineMockHandlers(({ api }) => [
 *   http.get(api('/news'), ({ request }) => listResponse(db.newsArticles.all(), request)),
 * ])
 */
export function defineMockHandlers(factory: MockHandlersFactory): MockHandlersFactory {
  return factory
}

export interface SeedContext {
  db: MockDb
  /** Faker instance seeded deterministically for THIS seed (independent of other modules). */
  faker: Faker
  /** Reference "now" for relative dates. Same value for every seed of a run. */
  refDate: Date
  /** Deterministic UUID (v4 format) from this seed's faker. */
  uuid: () => string
}

export interface MockSeed {
  /** Lower runs first. Core (users) runs at 0; modules default to 100. */
  order?: number
  run: (context: SeedContext) => void
}

/** Default export of app/modules/<module>/mocks/seed.ts. */
export function defineMockSeed(seed: MockSeed | MockSeed['run']): MockSeed {
  return typeof seed === 'function' ? { run: seed } : seed
}
