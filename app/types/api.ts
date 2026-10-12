/**
 * Transport-level shapes shared by the API client, Vue Query composables and MSW mocks.
 *
 * TODO(2b): align the list envelope and query parameter names with _spec/atrium/API.md.
 * Everything that depends on them goes through Paginated<T>/ListQuery and app/mocks/list.ts,
 * so a change here is a single-place change.
 */

export type SortDirection = 'asc' | 'desc'

/** Standard query string for list endpoints. */
export interface ListQuery {
  page?: number
  pageSize?: number
  /** Comma-separated sort fields, "-" prefix = descending, e.g. "-createdAt,title". */
  sort?: string
  /** Free-text search. */
  q?: string
  /** Additional, endpoint-specific filters (exact match; comma-separated = any of). */
  [filter: string]: string | number | boolean | undefined
}

export interface PageMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface Paginated<T> {
  data: T[]
  meta: PageMeta
}

/** RFC 9457 problem details as returned by the API (and emulated by mocks). */
export interface ProblemDetails {
  type?: string
  title: string
  status: number
  detail?: string
  instance?: string
  /** Field-level validation errors. */
  errors?: Array<{ field: string; message: string }>
  [extension: string]: unknown
}
