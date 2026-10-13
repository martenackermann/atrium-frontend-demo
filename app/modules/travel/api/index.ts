import { isApiError } from '~/lib/api'
import { createQueryKeys, summaryKey } from '~/lib/query/keys'
import type { Page, TimelineEntry } from '~/types/api'
import { TRAVEL_ACTION_MESSAGES } from '../constants'
import type {
  CarRentalClassDto,
  TravelCounts,
  TravelPreview,
  TravelPreviewRequest,
  TravelRequestDetail,
  TravelRequestSummary,
  VehicleType,
} from './types'

/**
 * Travel API layer (owned by slice A2): query keys + Vue Query composables.
 * See CONVENTIONS.md "How to build a slice" → API.
 */
export const travelKeys = {
  requests: createQueryKeys('travel', 'requests'),
  carClasses: createQueryKeys('travel', 'car-classes'),
  preview: createQueryKeys('travel', 'preview'),
  /** ['summary', 'travel', 'counts'] — refreshed after any mutation. */
  counts: summaryKey('travel', 'counts'),
}

export type TravelListParams = Record<string, string | number | boolean | undefined>

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

/** `GET /travel/requests` with a scope (mine | approvals | deputy | team | all) and filters. */
export function useTravelRequests(params: MaybeRefOrGetter<TravelListParams>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => travelKeys.requests.list(toValue(params))),
    queryFn: ({ signal }) =>
      api.get<Page<TravelRequestSummary>>('/travel/requests', toValue(params), { signal }),
    placeholderData: keepPreviousData,
  })
}

/** `GET /travel/requests/{id}` (404 = not visible). */
export function useTravelRequest(id: MaybeRefOrGetter<string | null | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => travelKeys.requests.detail(toValue(id) ?? '')),
    queryFn: ({ signal }) =>
      api.get<TravelRequestDetail>(`/travel/requests/${toValue(id)}`, undefined, { signal }),
    enabled: computed(() => Boolean(toValue(id))),
    retry: (count, error) => !(isApiError(error) && error.status < 500) && count < 2,
  })
}

/** `GET /travel/requests/{id}/timeline` (ascending). */
export function useTravelTimeline(id: MaybeRefOrGetter<string | null | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => travelKeys.requests.scope('timeline', toValue(id) ?? '')),
    queryFn: ({ signal }) =>
      api.get<TimelineEntry[]>(`/travel/requests/${toValue(id)}/timeline`, undefined, { signal }),
    enabled: computed(() => Boolean(toValue(id))),
  })
}

/** `GET /travel/car-classes` (active; `includeInactive` for the desk). */
export function useCarClasses(
  params: MaybeRefOrGetter<{ vehicleType?: VehicleType; includeInactive?: boolean }> = {},
) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => travelKeys.carClasses.list(toValue(params))),
    queryFn: ({ signal }) =>
      api.get<CarRentalClassDto[]>('/travel/car-classes', toValue(params), { signal }),
    staleTime: 5 * 60_000,
  })
}

/**
 * Live preview for the steppers (SCREENS §5.3): `POST /travel/requests/preview`, debounced 400 ms,
 * lenient body (SPEC_RESOLUTIONS #3). `null` body = not ready (no traveller yet).
 */
export function useTravelPreview(body: MaybeRefOrGetter<TravelPreviewRequest | null>) {
  const api = useApi()
  const serialized = computed(() => {
    const value = toValue(body)
    return value ? JSON.stringify(value) : null
  })
  const debounced = refDebounced(serialized, 400)
  return useQuery({
    queryKey: computed(() => travelKeys.preview.scope(debounced.value ?? '')),
    queryFn: ({ signal }) =>
      api.post<TravelPreview>(
        '/travel/requests/preview',
        JSON.parse(debounced.value!) as TravelPreviewRequest,
        { signal },
      ),
    enabled: computed(() => Boolean(debounced.value)),
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
  })
}

/** Workflow actions on one request (toasts, invalidation, 409 refetch). */
export function useTravelActions(id: MaybeRefOrGetter<string | null | undefined>) {
  return useWorkflowAction<TravelRequestDetail>({
    resourcePath: () => `/travel/requests/${toValue(id)}`,
    invalidate: [travelKeys.requests.module],
    messages: TRAVEL_ACTION_MESSAGES,
  })
}
