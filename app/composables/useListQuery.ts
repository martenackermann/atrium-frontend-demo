import {
  nextSort,
  parseListQuery,
  serializeListQuery,
  toApiQuery,
  type ListQueryOptions,
  type ListState,
} from '~/lib/list-query'

/**
 * Server-side list state bound to the URL (page, perPage, sort, q, filters).
 *
 *   const list = useListQuery({ filters: ['status', 'kind'], multi: ['status'], defaultSort: '-createdAt' })
 *   const query = useQuery({ queryKey: computed(() => keys.list(list.apiQuery.value)), … })
 *   <DataTable :list="list" … />
 */
export function useListQuery(options: ListQueryOptions = {}) {
  const route = useRoute()
  const router = useRouter()

  const state = computed<ListState>(() => parseListQuery(route.query, options))
  const apiQuery = computed(() => toApiQuery(state.value))
  const activeFilterCount = computed(
    () =>
      Object.values(state.value.filters).filter((value) =>
        Array.isArray(value) ? value.length > 0 : Boolean(value),
      ).length + (state.value.q ? 1 : 0),
  )

  function update(patch: Partial<ListState>, resetPage = true) {
    const next: ListState = {
      ...state.value,
      ...patch,
      filters: { ...state.value.filters, ...patch.filters },
    }
    if (resetPage && patch.page === undefined) next.page = 1
    void router.replace({ query: serializeListQuery(next, options, route.query) })
  }

  return {
    state,
    apiQuery,
    activeFilterCount,
    update,
    setPage: (page: number) => update({ page }, false),
    setPerPage: (perPage: number) => update({ perPage }),
    setSort: (sort: string | null) => update({ sort }),
    toggleSort: (field: string) => update({ sort: nextSort(state.value.sort, field) }),
    setSearch: (q: string) => update({ q }),
    setFilter: (key: string, value: string | string[] | undefined) =>
      update({ filters: { [key]: value ?? '' } as Record<string, string | string[]> }),
    clear: () =>
      update({
        q: '',
        filters: Object.fromEntries((options.filters ?? []).map((key) => [key, ''])),
      }),
  }
}

export type ListQueryController = ReturnType<typeof useListQuery>
