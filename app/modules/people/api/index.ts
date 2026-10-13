import { isApiError } from '~/lib/api'
import { createQueryKeys, summaryKey } from '~/lib/query/keys'
import type { PeopleCounts } from './types'

/**
 * People-request API layer (owned by slice A4): query keys + Vue Query composables.
 * See CONVENTIONS.md "How to build a slice" → API.
 */
export const peopleKeys = {
  requests: createQueryKeys('people', 'requests'),
  jobRoles: createQueryKeys('people', 'job-roles'),
  /** ['summary', 'people', 'counts'] — refreshed after any mutation. */
  counts: summaryKey('people', 'counts'),
}

/** `GET /people/queues/counts` for nav badges and Home tiles (404 tolerated → null). */
export function usePeopleCounts() {
  const api = useApi()
  const auth = useAuthStore()
  return useQuery({
    queryKey: peopleKeys.counts,
    queryFn: async ({ signal }) => {
      try {
        return await api.get<PeopleCounts>('/people/queues/counts', undefined, { signal })
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
