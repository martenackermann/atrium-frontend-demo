import { navigation } from '~/config/navigation'
import { findNavEntry, flattenNavigation, visibleNavigation } from '~/lib/navigation'

/** The navigation (app/config/navigation.ts) filtered for the signed-in user, plus the active entry. */
export function useNavigation() {
  const auth = useAuthStore()
  const route = useRoute()

  const groups = computed(() => visibleNavigation(navigation, auth.me))
  const sidebarGroups = computed(() => groups.value.filter((group) => !group.hideInSidebar))
  const flat = computed(() => flattenNavigation(groups.value))
  const active = computed(() => findNavEntry(navigation, route.path))

  /** The item (or its parent) is the active section. */
  function isActive(id: string): boolean {
    const entry = active.value
    return Boolean(entry && (entry.item.id === id || entry.parent?.id === id))
  }

  /** Exactly this item is the active page (aria-current="page"). */
  function isCurrent(id: string): boolean {
    return active.value?.item.id === id
  }

  return { groups, sidebarGroups, flat, active, isActive, isCurrent }
}
