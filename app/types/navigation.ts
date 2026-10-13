import type { Component, MaybeRefOrGetter } from 'vue'
import type { AccessRule } from '~/lib/access'

export type NavGroupId = 'work' | 'back-office' | 'admin' | 'settings'

export interface NavItem {
  /** Stable id; badges and commands refer to it: 'training', 'training.approvals'. */
  id: string
  label: string
  to: string
  icon?: Component
  /** Visible when ANY rule matches; omitted = every signed-in user. */
  access?: AccessRule[]
  /** Sub-items (indented, no icon). */
  children?: NavItem[]
  /** Two-key shortcut, e.g. ['g', 't']. */
  shortcut?: [string, string]
  /** Paths that also mark this item active (prefix match), e.g. detail pages. */
  match?: string[]
}

export interface NavGroup {
  id: NavGroupId
  /** Group label in the sidebar (null = no label, the first group). */
  label: string | null
  items: NavItem[]
  /** Listed in ⌘K and the account menu, but not in the sidebar. */
  hideInSidebar?: boolean
}

/** What a badge source returns. A bare number is a plain count. */
export interface NavBadgeValue {
  count: number | null | undefined
  /** plain = tabular numeral; you = marker pill (needs you); urgent = negative numeral */
  tone?: 'plain' | 'you' | 'urgent'
  /** Accessible label, e.g. "3 ratings due". */
  label?: string
}

/**
 * Badge source: called inside the shell component's setup (may use Vue Query composables).
 * Return null/undefined/0 to hide the badge.
 */
export type NavBadgeSource = () => MaybeRefOrGetter<NavBadgeValue | number | null | undefined>
