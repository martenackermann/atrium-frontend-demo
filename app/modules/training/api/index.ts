import { isApiError } from '~/lib/api'
import { createQueryKeys, summaryKey } from '~/lib/query/keys'
import type { TrainingCounts } from './types'

/**
 * Training API layer (owned by slice A1): query keys + Vue Query composables.
 * See CONVENTIONS.md "How to build a slice" → API.
 */
export const trainingKeys = {
  requests: createQueryKeys('training', 'requests'),
  participations: createQueryKeys('training', 'participations'),
  ratings: createQueryKeys('training', 'ratings'),
  /** ['summary', 'training', 'counts'] — refreshed after any mutation. */
  counts: summaryKey('training', 'counts'),
}

/** `GET /training/queues/counts` for nav badges and Home tiles (404 tolerated → null). */
export function useTrainingCounts() {
  const api = useApi()
  const auth = useAuthStore()
  return useQuery({
    queryKey: trainingKeys.counts,
    queryFn: async ({ signal }) => {
      try {
        return await api.get<TrainingCounts>('/training/queues/counts', undefined, { signal })
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
