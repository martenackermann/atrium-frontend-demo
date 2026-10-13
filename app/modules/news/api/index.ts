import { keepPreviousData } from '@tanstack/vue-query'
import { isApiError } from '~/lib/api'
import { createQueryKeys } from '~/lib/query/keys'
import type { Page, TimelineEntry } from '~/types/api'
import type { NewsPostDetail, NewsPostSummary, UsefulLinkDto } from './types'

/**
 * News + links API layer (owned by slice A4): query keys + Vue Query composables
 * (API.md §7.2-§7.3).
 */
export const newsKeys = {
  posts: createQueryKeys('news', 'posts'),
  links: createQueryKeys('news', 'links'),
}

export const postPath = (id: string) => `/news/${id}`

export function useNewsList(params: MaybeRefOrGetter<Record<string, unknown>>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => newsKeys.posts.list(toValue(params))),
    queryFn: ({ signal }) =>
      api.get<Page<NewsPostSummary>>('/news', toValue(params) as Record<string, string>, {
        signal,
      }),
    placeholderData: keepPreviousData,
  })
}

export function useNewsPost(id: MaybeRefOrGetter<string | null | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => newsKeys.posts.detail(toValue(id) ?? '')),
    queryFn: ({ signal }) => api.get<NewsPostDetail>(postPath(toValue(id)!), undefined, { signal }),
    enabled: computed(() => Boolean(toValue(id))),
    retry: (count, error) => !(isApiError(error) && [403, 404].includes(error.status)) && count < 2,
  })
}

export function useNewsTimeline(id: MaybeRefOrGetter<string | null | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => newsKeys.posts.scope('timeline', toValue(id) ?? '')),
    queryFn: ({ signal }) =>
      api.get<TimelineEntry[]>(`${postPath(toValue(id)!)}/timeline`, undefined, { signal }),
    enabled: computed(() => Boolean(toValue(id))),
  })
}

export function useLinks(includeInactive: MaybeRefOrGetter<boolean> = false) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => newsKeys.links.list({ includeInactive: toValue(includeInactive) })),
    queryFn: ({ signal }) =>
      api.get<UsefulLinkDto[]>(
        '/links',
        toValue(includeInactive) ? { includeInactive: 'true' } : undefined,
        { signal },
      ),
  })
}
