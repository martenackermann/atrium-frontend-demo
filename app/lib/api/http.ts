import { ApiError, toApiError, toNetworkError } from './errors'

export type QueryScalar = string | number | boolean | null | undefined
export type QueryValue = QueryScalar | readonly (string | number | boolean)[]
export type QueryParams = Record<string, QueryValue>

/** API.md §1: lists are comma-separated, booleans `true`/`false`; empty values are omitted. */
export function toSearchParams(query?: QueryParams | object): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, raw] of Object.entries(query as QueryParams)) {
    if (raw === undefined || raw === null || raw === '') continue
    if (Array.isArray(raw)) {
      if (raw.length === 0) continue
      params.set(key, raw.join(','))
    } else {
      params.set(key, String(raw))
    }
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

export function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID()
}

export interface RequestOptions {
  query?: QueryParams | object
  /** JSON-serialised unless it is FormData. */
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  /** POST only. Defaults to a fresh UUID; pass a stable key to make a retried submit safe. */
  idempotencyKey?: string
  /** How to read a successful body. Defaults to JSON (empty/204 → undefined). */
  parse?: 'json' | 'text' | 'blob'
}

export interface HttpClientOptions {
  baseUrl: string
  getToken: () => string | null | undefined
  /** Called for every 401 response to a request that carried a token. */
  onUnauthorized?: () => void
  fetch?: typeof globalThis.fetch
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '')
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Small typed HTTP client for the Atrium API: bearer token, `Idempotency-Key` on every POST,
 * problem+json → ApiError, 401 → onUnauthorized. Used through `useApi()`.
 */
export function createHttpClient(options: HttpClientOptions) {
  const base = options.baseUrl.replace(/\/+$/, '')
  // Resolve fetch per call so interceptors installed later (MSW in tests) still apply.
  const doFetch: typeof globalThis.fetch = (input, init) =>
    (options.fetch ?? globalThis.fetch)(input, init)

  function url(path: string, query?: RequestOptions['query']): string {
    return `${base}${path.startsWith('/') ? path : `/${path}`}${toSearchParams(query)}`
  }

  async function request<T>(
    method: HttpMethod,
    path: string,
    init: RequestOptions = {},
  ): Promise<T> {
    const headers = new Headers({ Accept: 'application/json', ...init.headers })
    const token = options.getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)

    let body: BodyInit | undefined
    if (init.body instanceof FormData) {
      body = init.body
    } else if (init.body !== undefined) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(init.body)
    }
    if (method === 'POST' && !headers.has('Idempotency-Key')) {
      headers.set('Idempotency-Key', init.idempotencyKey ?? newIdempotencyKey())
    }

    let response: Response
    try {
      response = await doFetch(url(path, init.query), {
        method,
        headers,
        body,
        signal: init.signal,
      })
    } catch (cause) {
      throw toNetworkError(cause)
    }

    if (!response.ok) {
      const errorBody = await readBody(response)
      if (response.status === 401 && token) options.onUnauthorized?.()
      throw toApiError(response, errorBody)
    }

    if (response.status === 204) return undefined as T
    if (init.parse === 'blob') return (await response.blob()) as T
    if (init.parse === 'text') return (await response.text()) as T
    const data = await readBody(response)
    // A 2xx that isn't JSON is not an API answer - e.g. a host's SPA fallback (index.html) for a
    // request the demo service worker let through while the page was unloading. Fail like a
    // network error instead of handing an HTML string to code that expects a DTO.
    if (typeof data === 'string') {
      throw new ApiError({
        status: 0,
        title: 'Unexpected response',
        detail: "Atrium's API answered with something that isn't JSON. Try again.",
        code: 'invalid_response',
        body: data.slice(0, 200),
      })
    }
    return data as T
  }

  return {
    baseUrl: base,
    url,
    request,
    get: <T>(path: string, query?: RequestOptions['query'], init?: Omit<RequestOptions, 'query'>) =>
      request<T>('GET', path, { ...init, query }),
    post: <T>(path: string, body?: unknown, init?: Omit<RequestOptions, 'body'>) =>
      request<T>('POST', path, { ...init, body }),
    put: <T>(path: string, body?: unknown, init?: Omit<RequestOptions, 'body'>) =>
      request<T>('PUT', path, { ...init, body }),
    patch: <T>(path: string, body?: unknown, init?: Omit<RequestOptions, 'body'>) =>
      request<T>('PATCH', path, { ...init, body }),
    delete: <T = void>(path: string, init?: RequestOptions) => request<T>('DELETE', path, init),
    /**
     * Workflow transition: `POST {resourcePath}/actions/{action}` → full detail DTO.
     * @example api.action<TravelRequestDetail>(`/travel/requests/${id}`, 'approve', { comment })
     */
    action: <T>(
      resourcePath: string,
      action: string,
      body: unknown = {},
      init?: Omit<RequestOptions, 'body'>,
    ) =>
      request<T>('POST', `${resourcePath.replace(/\/+$/, '')}/actions/${action}`, {
        ...init,
        body,
      }),
  }
}

export type HttpClient = ReturnType<typeof createHttpClient>
