import { isApiError } from '~/lib/api'
import { summaryKey } from '~/lib/query/keys'
import type { Page } from '~/types/api'
import type { HomePeopleRequest, MyDay } from './types'

/**
 * Home API layer (owned by slice A4). `GET /home/my-day` aggregates every module, so its key lives
 * under ['summary', …] and refreshes after any mutation. Other modules are reached through their
 * API only (modules never import each other).
 */
export const homeKeys = {
  myDay: summaryKey('home', 'my-day'),
  myPeopleRequests: summaryKey('home', 'people-requests'),
  counts: (module: string) => summaryKey('home', 'counts', module),
}

export function useMyDay() {
  const api = useApi()
  return useQuery({
    queryKey: homeKeys.myDay,
    queryFn: ({ signal }) => api.get<MyDay>('/home/my-day', undefined, { signal }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

const OPEN_PEOPLE_STATUSES = 'open,in_progress,waiting_internal,waiting_on_requester,reopened'

/** My own open people requests (as requester) for "My open requests". */
export function useMyPeopleRequests() {
  const api = useApi()
  const auth = useAuthStore()
  return useQuery({
    queryKey: homeKeys.myPeopleRequests,
    queryFn: async ({ signal }) => {
      try {
        const page = await api.get<Page<HomePeopleRequest>>(
          '/people/requests',
          { scope: 'mine', status: OPEN_PEOPLE_STATUSES, perPage: 20, sort: 'effectiveDate' },
          { signal },
        )
        return page.data.filter((row) => row.requester.id === auth.me?.id)
      } catch (error) {
        if (isApiError(error) && [404, 501].includes(error.status)) return []
        throw error
      }
    },
  })
}

/** A module's `/…/queues/counts` for the back-office tiles (404/501 → null: no tile). */
export function useQueueCounts<T>(path: string, enabled: MaybeRefOrGetter<boolean>) {
  const api = useApi()
  return useQuery({
    queryKey: homeKeys.counts(path),
    queryFn: async ({ signal }) => {
      try {
        return await api.get<T>(path, undefined, { signal })
      } catch (error) {
        if (isApiError(error) && [404, 501].includes(error.status)) return null
        throw error
      }
    },
    enabled: computed(() => toValue(enabled)),
    retry: false,
  })
}
