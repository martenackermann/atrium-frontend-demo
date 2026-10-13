import { isApiError } from '~/lib/api'
import { createQueryKeys, summaryKey } from '~/lib/query/keys'
import type { TravelCounts } from './types'

/**
 * Travel API layer (owned by slice A2): query keys + Vue Query composables.
 * See CONVENTIONS.md "How to build a slice" → API.
 */
export const travelKeys = {
  requests: createQueryKeys('travel', 'requests'),
  carClasses: createQueryKeys('travel', 'car-classes'),
  /** ['summary', 'travel', 'counts'] — refreshed after any mutation. */
  counts: summaryKey('travel', 'counts'),
}

/** `GET /travel/queues/counts` for nav badges and Home tiles (404 tolerated → null). */
export function useTravelCounts() {
  const api = useApi()
  const auth = useAuthStore()
  return useQuery({
    queryKey: travelKeys.counts,
    queryFn: async ({ signal }) => {
      try {
        return await api.get<TravelCounts>('/travel/queues/counts', undefined, { signal })
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
