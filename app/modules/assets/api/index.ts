import { isApiError } from '~/lib/api'
import { createQueryKeys, summaryKey } from '~/lib/query/keys'
import type { AssetCounts } from './types'

/**
 * Assets API layer (owned by slice A3): query keys + Vue Query composables.
 * See CONVENTIONS.md "How to build a slice" → API.
 */
export const assetKeys = {
  assets: createQueryKeys('assets', 'assets'),
  mine: createQueryKeys('assets', 'mine'),
  catalog: createQueryKeys('assets', 'catalog'),
  /** ['summary', 'assets', 'counts'] — refreshed after any mutation. */
  counts: summaryKey('assets', 'counts'),
}

/** `GET /assets/queues/counts` for nav badges and Home tiles (404 tolerated → null). */
export function useAssetCounts() {
  const api = useApi()
  const auth = useAuthStore()
  return useQuery({
    queryKey: assetKeys.counts,
    queryFn: async ({ signal }) => {
      try {
        return await api.get<AssetCounts>('/assets/queues/counts', undefined, { signal })
      } catch (error) {
        if (isApiError(error) && [404, 501].includes(error.status)) return null
        throw error
      }
    },
    enabled: computed(() => auth.isAuthenticated),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  })
}
