import createClient, { type Client, type Middleware } from 'openapi-fetch'
import type { paths } from './schema'
import { toApiError, toNetworkError } from './errors'

export type AtriumApiClient = Client<paths>

export interface ApiClientOptions {
  baseUrl: string
  /** Returns the current bearer token (or a falsy value when signed out). */
  getToken: () => string | null | undefined
  /** Called for every 401 response to a request that carried a token. */
  onUnauthorized?: (response: Response) => void
  fetch?: typeof globalThis.fetch
}

/**
 * Typed client for the Atrium API (paths come from the generated ./schema.d.ts).
 * Use it through useApi() and unwrap() — see CONVENTIONS.md "API client".
 */
export function createApiClient(options: ApiClientOptions): AtriumApiClient {
  const client = createClient<paths>({
    baseUrl: options.baseUrl.replace(/\/+$/, ''),
    // Resolve globalThis.fetch per call (not at creation) so interceptors installed later
    // (MSW in tests) still apply.
    fetch: options.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args)),
    headers: { Accept: 'application/json' },
  })

  const authMiddleware: Middleware = {
    onRequest({ request }) {
      const token = options.getToken()
      if (token) request.headers.set('Authorization', `Bearer ${token}`)
      return request
    },
    onResponse({ request, response }) {
      if (response.status === 401 && request.headers.has('Authorization')) {
        options.onUnauthorized?.(response)
      }
      return response
    },
  }

  client.use(authMiddleware)
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
 * @example const me = await unwrap(api.GET('/me'))
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
