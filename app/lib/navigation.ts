import type { Role } from '~/types/auth'
import type { NavEntry, NavSection } from '~/types/navigation'

/** Typed identity helper for app/modules/<module>/nav.ts files. */
export function defineNavEntries(entries: NavEntry[]): NavEntry[] {
  return entries
}

export function canSee(entry: Pick<NavEntry, 'roles'>, roles: readonly Role[]): boolean {
  return !entry.roles?.length || entry.roles.some((role) => roles.includes(role))
}

const byOrder = (a: NavEntry, b: NavEntry) =>
  (a.order ?? 100) - (b.order ?? 100) || a.label.localeCompare(b.label)

/** Drop entries (and children) the user may not see, then sort by order/label. */
export function filterNavEntries(entries: readonly NavEntry[], roles: readonly Role[]): NavEntry[] {
  return entries
    .filter((entry) => canSee(entry, roles))
    .map((entry) =>
      entry.children ? { ...entry, children: filterNavEntries(entry.children, roles) } : entry,
    )
    .sort(byOrder)
}

export function groupNavEntries(entries: readonly NavEntry[]): Record<NavSection, NavEntry[]> {
  const groups: Record<NavSection, NavEntry[]> = { main: [], admin: [] }
  for (const entry of entries) groups[entry.section ?? 'main'].push(entry)
  return groups
}

/** Flatten the default exports of app/modules/<module>/nav.ts files (stable order by path). */
export function collectNavEntries(modules: Record<string, { default?: NavEntry[] }>): NavEntry[] {
  return Object.keys(modules)
    .sort()
    .flatMap((path) => modules[path]?.default ?? [])
}
