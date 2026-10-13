import type { LocationQueryRaw, Router } from 'vue-router'

let pending: { path: string; query: LocationQueryRaw } | null = null

/**
 * Patches the current route's query (`undefined` removes a key) without losing a patch that is
 * still being navigated to. Several parts of a page may patch the URL at the same moment - a
 * debounced search and SplitInbox's auto-selection of the first row - and `{ ...route.query }`
 * reads the query before the other navigation has finished, silently dropping its change.
 */
export function patchQuery(
  router: Router,
  patch: LocationQueryRaw,
  mode: 'replace' | 'push' = 'replace',
): Promise<unknown> {
  const current = router.currentRoute.value
  const base = pending && pending.path === current.path ? pending.query : current.query
  const entry = { path: current.path, query: { ...base, ...patch } }
  pending = entry
  const navigation =
    mode === 'push' ? router.push({ query: entry.query }) : router.replace({ query: entry.query })
  return navigation.finally(() => {
    if (pending === entry) pending = null
  })
}
