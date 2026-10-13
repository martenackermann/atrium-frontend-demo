import type { MaybeRefOrGetter } from 'vue'
import { isApiError } from '~/lib/api'
import { createQueryKeys, summaryKey } from '~/lib/query/keys'
import type { Page, TimelineEntry } from '~/types/api'
import type {
  AssetAssignmentDto,
  AssetCounts,
  AssetDashboard,
  AssetDto,
  AssetListItem,
  AssetModelDto,
  DeviceTypeDto,
  ManufacturerDto,
  MyAssets,
  PlatformDto,
} from './types'

/**
 * Assets API layer (owned by slice A3): query keys + Vue Query composables (API.md §6).
 * Mutations invalidate `assetKeys.module`; the summary keys (counts, inbox, my-day) refresh
 * after every mutation automatically.
 */
export const assetKeys = {
  module: ['assets'] as const,
  assets: createQueryKeys('assets', 'assets'),
  mine: createQueryKeys('assets', 'mine'),
  catalog: createQueryKeys('assets', 'catalog'),
  /** ['summary', 'assets', 'counts'] — refreshed after any mutation. */
  counts: summaryKey('assets', 'counts'),
  dashboard: summaryKey('assets', 'dashboard'),
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

/** `GET /assets/mine` — devices waiting for my acceptance, and the ones I use. */
export function useMyAssets() {
  const api = useApi()
  return useQuery({
    queryKey: assetKeys.mine.all,
    queryFn: ({ signal }) => api.get<MyAssets>('/assets/mine', undefined, { signal }),
  })
}

/** `GET /assets/{id}` — admins see every asset, users their own (404 otherwise). */
export function useAsset(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => assetKeys.assets.detail(toValue(id))),
    queryFn: ({ signal }) => api.get<AssetDto>(`/assets/${toValue(id)}`, undefined, { signal }),
    retry: (count, error) => !(isApiError(error) && [403, 404].includes(error.status)) && count < 2,
  })
}

/** `GET /assets` (admin inventory) with the URL-bound list query. */
export function useAssetList(params: MaybeRefOrGetter<Record<string, unknown>>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => assetKeys.assets.list(toValue(params))),
    queryFn: ({ signal }) => api.get<Page<AssetListItem>>('/assets', toValue(params), { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useAssetDashboard() {
  const api = useApi()
  return useQuery({
    queryKey: assetKeys.dashboard,
    queryFn: ({ signal }) => api.get<AssetDashboard>('/assets/dashboard', undefined, { signal }),
  })
}

export function useAssetTimeline(id: MaybeRefOrGetter<string>, enabled: MaybeRefOrGetter<boolean>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => assetKeys.assets.scope('timeline', toValue(id))),
    queryFn: ({ signal }) =>
      api.get<TimelineEntry[]>(`/assets/${toValue(id)}/timeline`, undefined, { signal }),
    enabled: computed(() => toValue(enabled)),
  })
}

export function useAssetAssignments(
  id: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => assetKeys.assets.scope('assignments', toValue(id))),
    queryFn: ({ signal }) =>
      api.get<AssetAssignmentDto[]>(`/assets/${toValue(id)}/assignments`, undefined, { signal }),
    enabled: computed(() => toValue(enabled)),
  })
}

// --- catalogue -------------------------------------------------------------------------------

const CATALOG_STALE = 60_000

export function useDeviceTypes() {
  const api = useApi()
  return useQuery({
    queryKey: assetKeys.catalog.scope('device-types'),
    queryFn: ({ signal }) =>
      api.get<DeviceTypeDto[]>('/assets/catalog/device-types', undefined, { signal }),
    staleTime: CATALOG_STALE,
  })
}

export function useManufacturers(
  params: MaybeRefOrGetter<{ deviceTypeId?: string | null; includeArchived?: boolean }> = {},
) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => assetKeys.catalog.scope('manufacturers', toValue(params))),
    queryFn: ({ signal }) =>
      api.get<ManufacturerDto[]>('/assets/catalog/manufacturers', toValue(params), {
        signal,
      }),
    staleTime: CATALOG_STALE,
  })
}

export function usePlatforms(
  params: MaybeRefOrGetter<{ deviceTypeId?: string | null; includeArchived?: boolean }> = {},
) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => assetKeys.catalog.scope('platforms', toValue(params))),
    queryFn: ({ signal }) =>
      api.get<PlatformDto[]>('/assets/catalog/platforms', toValue(params), { signal }),
    staleTime: CATALOG_STALE,
  })
}

export function useModels(params: MaybeRefOrGetter<Record<string, unknown>>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => assetKeys.catalog.scope('models', toValue(params))),
    queryFn: ({ signal }) =>
      api.get<Page<AssetModelDto>>('/assets/catalog/models', toValue(params), { signal }),
    placeholderData: keepPreviousData,
    staleTime: CATALOG_STALE,
  })
}

/** Invalidate everything of the module (lists, details, catalogue). */
export function useInvalidateAssets() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: assetKeys.module })
}
