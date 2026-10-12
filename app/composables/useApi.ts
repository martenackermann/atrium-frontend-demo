import type { AtriumApiClient } from '~/lib/api'

/**
 * The typed API client (openapi-fetch). Combine with unwrap() from ~/lib/api:
 *
 *   const api = useApi()
 *   const me = await unwrap(api.GET('/me'))
 *
 * Call it synchronously in setup / at the top of a composable, not after an await.
 */
export function useApi(): AtriumApiClient {
  return useNuxtApp().$api
}
