import createClient, { type Client, type Middleware } from 'openapi-fetch'
import type { paths } from './schema'
import { toApiError, toNetworkError } from './errors'
import { newIdempotencyKey } from './http'

export type AtriumOpenApiClient = Client<paths>

export interface OpenApiClientOptions {
  baseUrl: string
  getToken: () => string | null | undefined
  onUnauthorized?: (response: Response) => void
  fetch?: typeof globalThis.fetch
}

/**
 * openapi-fetch client typed from the generated `schema.d.ts` (`pnpm api:types`). Paths are
 * relative to the API base (`/health`, not `/api/v1/health`). Until the backend exports its full
 * document, prefer the generic helpers on `useApi()` with the hand-written types in ~/types/api.
 */
export function createOpenApiClient(options: OpenApiClientOptions): AtriumOpenApiClient {
  const client = createClient<paths>({
    baseUrl: options.baseUrl.replace(/\/+$/, ''),
    fetch: options.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args)),
    headers: { Accept: 'application/json' },
  })

  const middleware: Middleware = {
    onRequest({ request }) {
      const token = options.getToken()
      if (token) request.headers.set('Authorization', `Bearer ${token}`)
      if (request.method === 'POST' && !request.headers.has('Idempotency-Key')) {
        request.headers.set('Idempotency-Key', newIdempotencyKey())
      }
      return request
    },
    onResponse({ request, response }) {
      if (response.status === 401 && request.headers.has('Authorization')) {
        options.onUnauthorized?.(response)
      }
      return response
    },
  }

  client.use(middleware)
  return client
}

interface ApiCallResult<T> {
  data?: T
  error?: unknown
  response: Response
}

/**
 * Await an openapi-fetch call and return its data, or throw an ApiError (problem+json normalised).
 *
 * @example const health = await unwrap(api.client.GET('/health'))
 */
export async function unwrap<T>(call: Promise<ApiCallResult<T>>): Promise<T> {
  let result: ApiCallResult<T>
  try {
    result = await call
  } catch (cause) {
    throw toNetworkError(cause)
  }
  if (result.error !== undefined || !result.response.ok) {
    throw toApiError(result.response, result.error)
  }
  return result.data as T
}
