import { keepPreviousData } from '@tanstack/vue-query'
import { isApiError, type QueryParams } from '~/lib/api'
import { createQueryKeys, summaryKey } from '~/lib/query/keys'
import type { Page, TimelineEntry } from '~/types/api'
import type {
  RatingStats,
  TrainingCounts,
  TrainingParticipationDetail,
  TrainingParticipationListItem,
  TrainingPreview,
  TrainingPreviewRequest,
  TrainingRatingDto,
  TrainingRequestDetail,
  TrainingRequestSummary,
} from './types'

/**
 * Training API layer (slice A1): query keys + Vue Query composables over API.md §4.
 * Mutations invalidate `trainingKeys.module`; every `['summary']` key (inbox, counts, my-day)
 * is refreshed after any mutation by the vue-query plugin.
 */
export const trainingKeys = {
  module: ['training'] as const,
  requests: createQueryKeys('training', 'requests'),
  participations: createQueryKeys('training', 'participations'),
  ratings: createQueryKeys('training', 'ratings'),
  /** ['summary', 'training', 'counts'] — refreshed after any mutation. */
  counts: summaryKey('training', 'counts'),
}

/** `GET /training/queues/counts` for nav badges, tabs and Home tiles (404 tolerated → null). */
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

export function useParticipations(
  params: MaybeRefOrGetter<QueryParams>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => trainingKeys.participations.list(toValue(params))),
    queryFn: ({ signal }) =>
      api.get<Page<TrainingParticipationListItem>>('/training/participations', toValue(params), {
        signal,
      }),
    placeholderData: keepPreviousData,
    enabled: computed(() => toValue(enabled)),
  })
}

export function useParticipation(id: MaybeRefOrGetter<string | null | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => trainingKeys.participations.detail(toValue(id) ?? '')),
    queryFn: ({ signal }) =>
      api.get<TrainingParticipationDetail>(`/training/participations/${toValue(id)}`, undefined, {
        signal,
      }),
    enabled: computed(() => Boolean(toValue(id))),
  })
}

export function useParticipationTimeline(id: MaybeRefOrGetter<string | null | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => trainingKeys.participations.scope('timeline', toValue(id) ?? '')),
    queryFn: ({ signal }) =>
      api.get<TimelineEntry[]>(`/training/participations/${toValue(id)}/timeline`, undefined, {
        signal,
      }),
    enabled: computed(() => Boolean(toValue(id))),
  })
}

export function useTrainingRequests(params: MaybeRefOrGetter<QueryParams>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => trainingKeys.requests.list(toValue(params))),
    queryFn: ({ signal }) =>
      api.get<Page<TrainingRequestSummary>>('/training/requests', toValue(params), { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useTrainingRequest(id: MaybeRefOrGetter<string | null | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => trainingKeys.requests.detail(toValue(id) ?? '')),
    queryFn: ({ signal }) =>
      api.get<TrainingRequestDetail>(`/training/requests/${toValue(id)}`, undefined, { signal }),
    enabled: computed(() => Boolean(toValue(id))),
  })
}

export function useRequestTimeline(id: MaybeRefOrGetter<string | null | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => trainingKeys.requests.scope('timeline', toValue(id) ?? '')),
    queryFn: ({ signal }) =>
      api.get<TimelineEntry[]>(`/training/requests/${toValue(id)}/timeline`, undefined, { signal }),
    enabled: computed(() => Boolean(toValue(id))),
  })
}

export function useRatings(params: MaybeRefOrGetter<QueryParams>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => trainingKeys.ratings.list(toValue(params))),
    queryFn: ({ signal }) =>
      api.get<Page<TrainingRatingDto>>('/training/ratings', toValue(params), { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useRating(id: MaybeRefOrGetter<string | null | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => trainingKeys.ratings.detail(toValue(id) ?? '')),
    queryFn: ({ signal }) =>
      api.get<TrainingRatingDto>(`/training/ratings/${toValue(id)}`, undefined, { signal }),
    enabled: computed(() => Boolean(toValue(id))),
  })
}

export function useRatingStats(params: MaybeRefOrGetter<QueryParams>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => trainingKeys.ratings.scope('stats', toValue(params))),
    queryFn: ({ signal }) =>
      api.get<RatingStats>('/training/ratings/stats', toValue(params), { signal }),
    placeholderData: keepPreviousData,
  })
}

/**
 * Live routing preview for the stepper (`POST /training/requests/preview`, #15). Pass a
 * debounced body; the last result stays visible while a new one loads.
 */
export function useTrainingPreview(body: MaybeRefOrGetter<TrainingPreviewRequest>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => trainingKeys.requests.scope('preview', toValue(body))),
    queryFn: ({ signal }) =>
      api.post<TrainingPreview>('/training/requests/preview', toValue(body), { signal }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  })
}
