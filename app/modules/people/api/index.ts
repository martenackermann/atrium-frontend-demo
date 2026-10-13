import { keepPreviousData } from '@tanstack/vue-query'
import { isApiError } from '~/lib/api'
import { createQueryKeys, summaryKey } from '~/lib/query/keys'
import type { Page, TimelineEntry } from '~/types/api'
import type {
  JobRoleDto,
  PeopleCommentDto,
  PeopleCounts,
  PeopleRequestDetail,
  PeopleRequestSummary,
} from './types'

/**
 * People-request API layer (owned by slice A4): query keys + Vue Query composables
 * (API.md §7.1). Every mutation invalidates the module root and the `['summary']` aggregates.
 */
export const peopleKeys = {
  requests: createQueryKeys('people', 'requests'),
  jobRoles: createQueryKeys('people', 'job-roles'),
  /** ['summary', 'people', 'counts'] — refreshed after any mutation. */
  counts: summaryKey('people', 'counts'),
}

export const requestPath = (id: string) => `/people/requests/${id}`

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

/** `GET /people/requests` with URL-bound list params. */
export function usePeopleRequests(params: MaybeRefOrGetter<Record<string, unknown>>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => peopleKeys.requests.list(toValue(params))),
    queryFn: ({ signal }) =>
      api.get<Page<PeopleRequestSummary>>(
        '/people/requests',
        toValue(params) as Record<string, string>,
        { signal },
      ),
    placeholderData: keepPreviousData,
  })
}

export function usePeopleRequest(id: MaybeRefOrGetter<string | null | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => peopleKeys.requests.detail(toValue(id) ?? '')),
    queryFn: ({ signal }) =>
      api.get<PeopleRequestDetail>(requestPath(toValue(id)!), undefined, { signal }),
    enabled: computed(() => Boolean(toValue(id))),
    retry: (count, error) => !(isApiError(error) && [403, 404].includes(error.status)) && count < 2,
  })
}

export function usePeopleComments(id: MaybeRefOrGetter<string | null | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => peopleKeys.requests.scope('comments', toValue(id) ?? '')),
    queryFn: ({ signal }) =>
      api.get<PeopleCommentDto[]>(`${requestPath(toValue(id)!)}/comments`, undefined, { signal }),
    enabled: computed(() => Boolean(toValue(id))),
  })
}

export function usePeopleTimeline(id: MaybeRefOrGetter<string | null | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => peopleKeys.requests.scope('timeline', toValue(id) ?? '')),
    queryFn: ({ signal }) =>
      api.get<TimelineEntry[]>(`${requestPath(toValue(id)!)}/timeline`, undefined, { signal }),
    enabled: computed(() => Boolean(toValue(id))),
  })
}

export function useJobRoles(includeInactive: MaybeRefOrGetter<boolean> = false) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() =>
      peopleKeys.jobRoles.list({ includeInactive: toValue(includeInactive) }),
    ),
    queryFn: ({ signal }) =>
      api.get<JobRoleDto[]>(
        '/people/job-roles',
        toValue(includeInactive) ? { includeInactive: 'true' } : undefined,
        { signal },
      ),
    staleTime: 5 * 60_000,
  })
}

/** Workflow actions on one request (toast, invalidation, 409 refetch, 422 rethrown). */
export function usePeopleAction(id: MaybeRefOrGetter<string | null | undefined>) {
  return useWorkflowAction<PeopleRequestDetail>({
    resourcePath: () => requestPath(toValue(id) ?? ''),
    invalidate: [peopleKeys.requests.module],
  })
}
