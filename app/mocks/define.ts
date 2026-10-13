/**
 * Authoring API for module mocks. This file has NO runtime dependency on the mock database, so
 * module seed files can import it without creating import cycles.
 *
 *   app/modules/<m>/mocks/seed.ts       export default defineMockSeed({ run(ctx) { … } })
 *   app/modules/<m>/mocks/handlers.ts   export default defineMockHandlers(({ api }) => [ … ])
 *   app/modules/<m>/mocks/providers.ts  export default defineMockProviders({ workflows, enums, inbox, … })
 */
import type { Faker } from '@faker-js/faker'
import type { RequestHandler } from 'msw'
import type { EnumOption, InboxItem, SearchHit, WorkflowDefinition } from '~/types/api'
import type { MockUser } from './core/types'
import type { MockDb } from './db'

export interface MockContext {
  /** URL for an API path: api('/travel/requests/:id') → `${apiBase}/travel/requests/:id`. */
  api: (path: string) => string
}

export type MockHandlersFactory = (context: MockContext) => RequestHandler[]

export function defineMockHandlers(factory: MockHandlersFactory): MockHandlersFactory {
  return factory
}

export interface SeedContext {
  db: MockDb
  /** Faker seeded deterministically for THIS seed (independent of other modules). */
  faker: Faker
  /** Reference "today" (start of day). Same for every seed of a run. */
  refDate: Date
  /** Deterministic UUID from this seed's faker. */
  uuid: () => string
  /**
   * `d(-3)` = today − 3 days as IsoDate (SPEC §10 "d±n"; same as the backend seed). Relative to the
   * real "today" so due/overdue/high-priority semantics hold every day.
   */
  d: (offset: number) => string
  /** Instant at local time hh:mm on day d(offset), as an ISO timestamp (backend `at`). */
  at: (offset: number, hours?: number, minutes?: number) => string
  /**
   * Like d(offset) but kept on a weekday (Sat → Fri, Sun → Mon) for records where only the weekday
   * matters: training start dates, reminder timestamps (SPEC_RESOLUTIONS #5/#21).
   */
  weekday: (offset: number) => string
}

export interface MockSeed {
  /** Lower runs first. Core (users, org) runs at 0; modules default to 100. */
  order?: number
  run: (context: SeedContext) => void
}

export function defineMockSeed(seed: MockSeed | MockSeed['run']): MockSeed {
  return typeof seed === 'function' ? { run: seed } : seed
}

export interface ProviderContext {
  now: Date
}

/** A job shown on /admin/jobs (SPEC §8) and runnable with "Run now". */
export interface MockJob {
  name: string
  description: string
  slice: 'F' | 'A1' | 'A2' | 'A3' | 'A4'
  /** Cron in APP_TIMEZONE, or null when disabled. */
  cron: string | null
  enabled?: boolean
  /** "Run now" allowed from /admin/jobs (default true; `demo.reset` is CLI/cron only, #29). */
  manual?: boolean
  /** Do the work against the mock db; return the run summary. */
  run: (context: ProviderContext) => Record<string, number | string>
}

/** Anything with a workflow definition (see ~/mocks/workflow). */
export interface WorkflowLike {
  definition: WorkflowDefinition
}

/**
 * Module contributions to foundation endpoints (mirrors the backend's provider framework,
 * SPEC §1 "Cross-module contracts").
 */
export interface MockProviders {
  /** State machines → GET /meta/workflows[/{name}]. */
  workflows?: WorkflowLike[]
  /** Enums → GET /meta/enums. */
  enums?: Record<string, EnumOption[]>
  /** Items for GET /me/inbox (API.md §8). The foundation sorts, filters and counts. */
  inbox?: (user: MockUser, context: ProviderContext) => InboxItem[]
  /** Hits for GET /search (≤ 5, permission-filtered). */
  search?: (user: MockUser, q: string, context: ProviderContext) => SearchHit[]
  /** Fragments for GET /home/my-day (A1/A2 `upcoming`, A3 `assets`, A4 `news`/`links`). */
  myDay?: (user: MockUser, context: ProviderContext) => Record<string, unknown>
  /**
   * Body of GET /<module>/queues/counts for this user (API.md shapes: TrainingCounts, TravelCounts…).
   * Until a module provides it, the foundation answers with zeros (SPEC_RESOLUTIONS #5).
   */
  counts?: (user: MockUser, context: ProviderContext) => Record<string, unknown>
  /** Jobs for /admin/jobs. */
  jobs?: MockJob[]
}

export function defineMockProviders(providers: MockProviders): MockProviders {
  return providers
}
