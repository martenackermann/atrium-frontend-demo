import { navigation } from '~/config/navigation'
import { findNavEntry } from '~/lib/navigation'
import type { Crumb } from '~/types/ui'

// The detail label set by the current page ("TRV-000031"); reset on every navigation.
const tail = ref<string | null>(null)

/**
 * Breadcrumbs derived from the navigation config + the page's `definePageMeta({ title })`.
 * Detail pages name themselves: `useBreadcrumbTail(() => request.value?.reference)`.
 */
export function useBreadcrumbs() {
  const route = useRoute()

  const crumbs = computed<Crumb[]>(() => {
    const entry = findNavEntry(navigation, route.path)
    const list: Crumb[] = []
    if (entry?.parent) list.push({ label: entry.parent.label, to: entry.parent.to })
    if (entry) list.push({ label: entry.item.label, to: entry.item.to })
    const pageTitle = route.meta.title
    const last = tail.value ?? (pageTitle && pageTitle !== entry?.item.label ? pageTitle : null)
    if (last && (!entry || !entry.exact || tail.value)) list.push({ label: last })
    if (list.length === 0) list.push({ label: pageTitle ?? 'Atrium' })
    // The last crumb is the current page.
    const current = list[list.length - 1]!
    list[list.length - 1] = { label: current.label }
    return list
  })

  const title = computed(() => crumbs.value[crumbs.value.length - 1]?.label ?? 'Atrium')

  return { crumbs, title }
}

/** Name the current detail page in the breadcrumbs ("TRV-000031", "Emma Employee"). */
export function useBreadcrumbTail(label: MaybeRefOrGetter<string | null | undefined>) {
  watchEffect(() => {
    tail.value = toValue(label) || null
  })
  onScopeDispose(() => {
    tail.value = null
  })
}

/** Called by the router plugin on every navigation. */
export function resetBreadcrumbTail() {
  tail.value = null
}
