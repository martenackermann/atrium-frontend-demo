/**
 * Mock-side provider registry (mirrors the backend's provider framework, SPEC §1 and
 * SPEC_RESOLUTIONS #5). Collects every app/modules/<module>/mocks/providers.ts by glob — slices
 * never edit foundation files to plug in.
 */
import type { EnumCatalog, EnumOption, InboxItem, SearchHit } from '~/types/api'
import { CORE_ENUMS } from './core/enums'
import type { MockUser } from './core/types'
import type { MockJob, MockProviders, ProviderContext, WorkflowLike } from './define'

const providerFiles = import.meta.glob<{ default: MockProviders }>(
  '~/modules/*/mocks/providers.ts',
  { eager: true },
)

function moduleName(path: string): string {
  return /modules\/([^/]+)\/mocks\/providers\.ts$/.exec(path)?.[1] ?? path
}

/** [module, providers] in a stable order. */
export function moduleProviders(): Array<[string, MockProviders]> {
  return Object.keys(providerFiles)
    .sort()
    .map((path) => [moduleName(path), providerFiles[path]?.default ?? {}])
}

export const context = (): ProviderContext => ({ now: new Date() })

export function enumCatalog(): EnumCatalog {
  const catalog: Record<string, EnumOption[]> = { ...CORE_ENUMS }
  for (const [, providers] of moduleProviders()) Object.assign(catalog, providers.enums ?? {})
  return catalog as EnumCatalog
}

export function workflows(): WorkflowLike[] {
  return moduleProviders().flatMap(([, providers]) => providers.workflows ?? [])
}

const PRIORITY_ORDER = { high: 0, normal: 1 } as const

/** API.md §3.2: priority high first, then dueAt ascending (nulls last), then createdAt ascending. */
export function sortInbox(items: InboxItem[]): InboxItem[] {
  return [...items].sort(
    (a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      (a.dueAt === b.dueAt
        ? 0
        : a.dueAt === null
          ? 1
          : b.dueAt === null
            ? -1
            : a.dueAt.localeCompare(b.dueAt)) ||
      a.createdAt.localeCompare(b.createdAt),
  )
}

/** Every module's inbox items for the user, sorted, capped at 200 (`providers` for tests). */
export function inboxFor(
  user: MockUser,
  ctx: ProviderContext = context(),
  providers: Array<[string, MockProviders]> = moduleProviders(),
): InboxItem[] {
  const items = providers.flatMap(([, entry]) => entry.inbox?.(user, ctx) ?? [])
  return sortInbox(items).slice(0, 200)
}

export function searchFor(
  user: MockUser,
  q: string,
  ctx: ProviderContext = context(),
): SearchHit[] {
  return moduleProviders().flatMap(([, providers]) =>
    (providers.search?.(user, q, ctx) ?? []).slice(0, 5),
  )
}

/** Merged my-day fragments: arrays are concatenated, other values assigned. */
export function myDayFor(
  user: MockUser,
  ctx: ProviderContext = context(),
  providers: Array<[string, MockProviders]> = moduleProviders(),
): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  for (const [, entry] of providers) {
    for (const [key, value] of Object.entries(entry.myDay?.(user, ctx) ?? {})) {
      const existing = merged[key]
      merged[key] =
        Array.isArray(existing) && Array.isArray(value) ? [...existing, ...value] : value
    }
  }
  return merged
}

/** Counts from the module's provider (`counts`), or undefined → the zero stub applies. */
export function countsFor(module: string, user: MockUser, ctx: ProviderContext = context()) {
  const entry = moduleProviders().find(([name]) => name === module)
  return entry?.[1].counts?.(user, ctx)
}

export function moduleJobs(): MockJob[] {
  return moduleProviders().flatMap(([, providers]) => providers.jobs ?? [])
}
