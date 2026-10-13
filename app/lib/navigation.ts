import { hasAccess } from '~/lib/access'
import type { Me } from '~/types/api'
import type { NavGroup, NavItem } from '~/types/navigation'

/** Groups with only the items (and children) the user may see; empty groups are dropped. */
export function visibleNavigation(groups: readonly NavGroup[], me: Me | null): NavGroup[] {
  const filterItems = (items: readonly NavItem[]): NavItem[] =>
    items
      .filter((item) => hasAccess(me, item.access))
      .map((item) => (item.children ? { ...item, children: filterItems(item.children) } : item))
  return groups
    .map((group) => ({ ...group, items: filterItems(group.items) }))
    .filter((group) => group.items.length > 0)
}

/** Depth-first list of items with their parent (for breadcrumbs, ⌘K "Jump to"). */
export function flattenNavigation(
  groups: readonly NavGroup[],
): Array<{ item: NavItem; parent: NavItem | null; group: NavGroup }> {
  const result: Array<{ item: NavItem; parent: NavItem | null; group: NavGroup }> = []
  for (const group of groups) {
    for (const item of group.items) {
      result.push({ item, parent: null, group })
      for (const child of item.children ?? []) result.push({ item: child, parent: item, group })
    }
  }
  return result
}

function isPrefix(path: string, prefix: string): boolean {
  if (prefix === '/') return path === '/'
  return path === prefix || path.startsWith(`${prefix}/`)
}

/**
 * The nav entry that owns a path: the longest `to` (or `match`) prefix. Used to mark the active
 * sidebar item and to build breadcrumbs.
 */
export function findNavEntry(
  groups: readonly NavGroup[],
  path: string,
): { item: NavItem; parent: NavItem | null; exact: boolean } | null {
  let best: { item: NavItem; parent: NavItem | null; exact: boolean; length: number } | null = null
  for (const { item, parent } of flattenNavigation(groups)) {
    for (const candidate of [item.to, ...(item.match ?? [])]) {
      if (isPrefix(path, candidate) && (!best || candidate.length > best.length)) {
        best = { item, parent, exact: path === item.to, length: candidate.length }
      }
    }
  }
  return best ? { item: best.item, parent: best.parent, exact: best.exact } : null
}
