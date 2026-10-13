/**
 * List state ↔ URL query (SCREENS §1.7: "All filters live in the URL query"). Pure functions, so
 * DataTable state is shareable, bookmarkable and unit-testable.
 */
import type { LocationQuery, LocationQueryRaw } from 'vue-router'

export interface ListState {
  page: number
  perPage: number
  sort: string | null
  q: string
  /** Module filters; multi-value filters are arrays (comma-separated in the URL and the API). */
  filters: Record<string, string | string[]>
}

export interface ListQueryOptions {
  /** Filter keys this list understands (others in the URL are ignored). */
  filters?: readonly string[]
  /** Filters that hold several values (`status=to_book,booked`). */
  multi?: readonly string[]
  defaultPerPage?: number
  defaultSort?: string | null
}

export const PER_PAGE_OPTIONS = [10, 25, 50, 100] as const

const first = (value: LocationQuery[string] | undefined): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : undefined
}

const positiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function parseListQuery(query: LocationQuery, options: ListQueryOptions = {}): ListState {
  const filters: Record<string, string | string[]> = {}
  for (const key of options.filters ?? []) {
    const raw = first(query[key])
    if (!raw) continue
    filters[key] = options.multi?.includes(key) ? raw.split(',').filter(Boolean) : raw
  }
  return {
    page: positiveInt(first(query.page), 1),
    perPage: Math.min(positiveInt(first(query.perPage), options.defaultPerPage ?? 25), 100),
    sort: first(query.sort) ?? options.defaultSort ?? null,
    q: first(query.q) ?? '',
    filters,
  }
}

/** Only non-default values go into the URL. Unrelated query keys are preserved. */
export function serializeListQuery(
  state: ListState,
  options: ListQueryOptions = {},
  base: LocationQuery = {},
): LocationQueryRaw {
  const query = new Map<string, LocationQueryRaw[string]>(Object.entries(base))
  const set = (key: string, value: string | null | undefined) => {
    if (value === null || value === undefined || value === '') query.delete(key)
    else query.set(key, value)
  }
  set('page', state.page > 1 ? String(state.page) : null)
  set('perPage', state.perPage !== (options.defaultPerPage ?? 25) ? String(state.perPage) : null)
  set('sort', state.sort && state.sort !== (options.defaultSort ?? null) ? state.sort : null)
  set('q', state.q.trim())
  for (const key of options.filters ?? []) {
    const value = state.filters[key]
    set(key, Array.isArray(value) ? value.join(',') : value)
  }
  return Object.fromEntries(query)
}

/** API query params (API.md §1): `page`, `perPage`, `sort`, `q`, filters comma-joined. */
export function toApiQuery(state: ListState): Record<string, string | number> {
  const params: Record<string, string | number> = { page: state.page, perPage: state.perPage }
  if (state.sort) params.sort = state.sort
  if (state.q.trim()) params.q = state.q.trim()
  for (const [key, value] of Object.entries(state.filters)) {
    const joined = Array.isArray(value) ? value.join(',') : value
    if (joined) params[key] = joined
  }
  return params
}

/** Next sort when a header is clicked: field → -field → (default). */
export function nextSort(current: string | null, field: string): string | null {
  if (current === field) return `-${field}`
  if (current === `-${field}`) return null
  return field
}

export function sortDirection(current: string | null, field: string): 'asc' | 'desc' | null {
  if (current === field) return 'asc'
  if (current === `-${field}`) return 'desc'
  return null
}
