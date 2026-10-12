/**
 * Server-side list behaviour for mocks: filter -> search -> sort -> paginate, returning the
 * standard Paginated<T> envelope. Query parameters (see ListQuery in ~/types/api):
 *
 *   ?page=2&pageSize=20&sort=-createdAt,title&q=excel&status=booked,to_book
 *
 * Unknown sort fields produce a 400 problem (like the real API); unknown filters are ignored.
 */
import { HttpResponse } from 'msw'
import type { Paginated } from '~/types/api'
import { badRequest } from './http'

type SortValue = string | number | boolean | Date | null | undefined
type FieldOf<T> = Extract<keyof T, string>

export interface ListOptions<T> {
  /** Fields (or a projection) searched by `q`; every whitespace-separated term must match. */
  search?: Array<FieldOf<T>> | ((item: T) => string)
  /** Query param -> field (exact match, comma-separated = any of) or custom predicate. */
  filters?: Record<string, FieldOf<T> | ((item: T, values: string[]) => boolean)>
  /** Sortable keys: field names, or param -> accessor. */
  sort?: Array<FieldOf<T>> | Record<string, FieldOf<T> | ((item: T) => SortValue)>
  /** e.g. "-createdAt". */
  defaultSort?: string
  defaultPageSize?: number
  maxPageSize?: number
}

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

function paramsOf(input: Request | URL | URLSearchParams): URLSearchParams {
  if (input instanceof URLSearchParams) return input
  if (input instanceof URL) return input.searchParams
  return new URL(input.url).searchParams
}

function toInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalise(value: SortValue): string | number | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'boolean') return value ? 1 : 0
  return value
}

function compare(a: SortValue, b: SortValue): number {
  const left = normalise(a)
  const right = normalise(b)
  if (left === null && right === null) return 0
  if (left === null) return 1 // nulls last, regardless of direction
  if (right === null) return -1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right), 'en', { sensitivity: 'base', numeric: true })
}

function matchesValue(fieldValue: unknown, values: string[]): boolean {
  if (Array.isArray(fieldValue)) return fieldValue.some((item) => values.includes(String(item)))
  return values.includes(String(fieldValue))
}

export function listResult<T>(
  items: readonly T[],
  input: Request | URL | URLSearchParams,
  options: ListOptions<T> = {},
): Paginated<T> {
  const params = paramsOf(input)
  let rows = [...items]

  // Filters
  for (const [param, filter] of Object.entries(options.filters ?? {})) {
    const raw = params.get(param)
    if (raw === null || raw === '') continue
    const values = raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    rows = rows.filter((item) =>
      typeof filter === 'function'
        ? filter(item, values)
        : matchesValue((item as Record<string, unknown>)[filter], values),
    )
  }

  // Search
  const q = params.get('q')?.trim().toLowerCase()
  if (q && options.search) {
    const terms = q.split(/\s+/)
    const search = options.search
    const haystack = (item: T) =>
      (typeof search === 'function'
        ? search(item)
        : search.map((field) => String(item[field] ?? '')).join(' ')
      ).toLowerCase()
    rows = rows.filter((item) => {
      const text = haystack(item)
      return terms.every((term) => text.includes(term))
    })
  }

  // Sort
  const sortParam = params.get('sort') || options.defaultSort
  if (sortParam) {
    const accessors: Record<string, (item: T) => SortValue> = {}
    const sortable = options.sort ?? []
    if (Array.isArray(sortable)) {
      for (const field of sortable) accessors[field] = (item) => item[field] as SortValue
    } else {
      for (const [key, accessor] of Object.entries(sortable)) {
        accessors[key] =
          typeof accessor === 'function' ? accessor : (item) => item[accessor] as SortValue
      }
    }
    const keys = sortParam
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const descending = part.startsWith('-')
        const name = descending ? part.slice(1) : part
        const accessor = accessors[name]
        if (!accessor) throw badRequest(`Sorting by "${name}" is not supported.`)
        return { accessor, direction: descending ? -1 : 1 }
      })
    rows = rows
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        for (const { accessor, direction } of keys) {
          const left = accessor(a.item)
          const right = accessor(b.item)
          const result = compare(left, right)
          if (result !== 0) {
            const leftNull = normalise(left) === null
            const rightNull = normalise(right) === null
            return leftNull || rightNull ? result : result * direction
          }
        }
        return a.index - b.index
      })
      .map(({ item }) => item)
  }

  // Paginate
  const maxPageSize = options.maxPageSize ?? MAX_PAGE_SIZE
  const pageSize = Math.min(
    Math.max(toInt(params.get('pageSize'), options.defaultPageSize ?? DEFAULT_PAGE_SIZE), 1),
    maxPageSize,
  )
  const total = rows.length
  const totalPages = Math.max(Math.ceil(total / pageSize), 1)
  const page = Math.max(toInt(params.get('page'), 1), 1)
  const start = (page - 1) * pageSize

  return {
    data: rows.slice(start, start + pageSize),
    meta: { page, pageSize, total, totalPages },
  }
}

/** listResult(...) wrapped in a JSON response. */
export function listResponse<T>(
  items: readonly T[],
  input: Request | URL | URLSearchParams,
  options?: ListOptions<T>,
) {
  return HttpResponse.json(listResult(items, input, options))
}
