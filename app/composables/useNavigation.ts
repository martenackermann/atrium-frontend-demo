import { collectNavEntries, filterNavEntries, groupNavEntries } from '~/lib/navigation'
import type { NavEntry } from '~/types/navigation'

/** Every app/modules/<module>/nav.ts — adding a module needs no change here. */
const navFiles = import.meta.glob<{ default: NavEntry[] }>('~/modules/*/nav.ts', { eager: true })
const allEntries = collectNavEntries(navFiles)

/** Navigation entries of all modules, filtered by the signed-in user's roles. */
export function useNavigation() {
  const auth = useAuthStore()
  const entries = computed(() => filterNavEntries(allEntries, auth.roles))
  const sections = computed(() => groupNavEntries(entries.value))
  return { entries, sections, allEntries }
}
