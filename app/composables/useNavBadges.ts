import type { ComputedRef } from 'vue'
import { coreKeys } from '~/lib/query/core'
import type { NavBadgeMap } from '~/lib/registry'
import type { InboxCounts } from '~/types/api'
import type { NavBadgeValue } from '~/types/navigation'

/** Every app/modules/<module>/badges.ts — adding badges needs no change here. */
const badgeFiles = import.meta.glob<{ default: NavBadgeMap }>('~/modules/*/badges.ts', {
  eager: true,
})

export const navBadgeSources: NavBadgeMap = Object.assign(
  {},
  ...Object.keys(badgeFiles)
    .sort()
    .map((path) => badgeFiles[path]?.default ?? {}),
)

export function normaliseBadge(
  value: NavBadgeValue | number | null | undefined,
): NavBadgeValue | null {
  if (value === null || value === undefined) return null
  const badge: NavBadgeValue = typeof value === 'number' ? { count: value } : value
  return badge.count ? { tone: 'plain', ...badge } : null
}

/** Inbox counts (`/me/inbox/counts`): the shell's Inbox badge. Refetched every 60 s and on focus. */
export function useInboxCounts() {
  const api = useApi()
  const auth = useAuthStore()
  return useQuery({
    queryKey: coreKeys.inboxCounts,
    queryFn: ({ signal }) => api.get<InboxCounts>('/me/inbox/counts', undefined, { signal }),
    enabled: computed(() => auth.isAuthenticated),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

/**
 * Resolve the badge of each given nav item id. Call it in a component's setup: the badge sources
 * run there once (they may use Vue Query). The foundation provides the Inbox badge.
 */
export function useNavBadges(ids: readonly string[]) {
  const inbox = useInboxCounts()

  const sources: Record<string, ComputedRef<NavBadgeValue | null>> = {}
  for (const id of ids) {
    const source = navBadgeSources[id]
    if (!source) continue
    const value = source()
    sources[id] = computed(() => normaliseBadge(toValue(value)))
  }

  const inboxBadge = computed<NavBadgeValue | null>(() => {
    const counts = inbox.data.value
    if (!counts?.total) return null
    return {
      count: counts.total,
      tone: 'you',
      label: `${counts.total} to do${counts.high ? `, ${counts.high} urgent` : ''}`,
    }
  })

  function badge(id: string): NavBadgeValue | null {
    if (id === 'inbox') return inboxBadge.value
    return sources[id]?.value ?? null
  }

  return { badge, inboxCounts: inbox.data }
}
