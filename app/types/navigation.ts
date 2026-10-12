import type { Component, MaybeRefOrGetter } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { Role } from './auth'

/** Top-level groups of the app shell navigation. */
export type NavSection = 'main' | 'admin'

export interface NavEntry {
  /** Unique, stable id, prefixed with the module name: "training.requests". */
  id: string
  label: string
  to: RouteLocationRaw
  icon?: Component
  /** Defaults to "main". */
  section?: NavSection
  /** Lower comes first. Defaults to 100. */
  order?: number
  /** Visible when the user has ANY of these roles. Omit/empty = every signed-in user. */
  roles?: Role[]
  /**
   * Optional counter (e.g. queue size). Called inside the shell component's setup,
   * so it may use Vue Query composables. Return null/undefined/0 to hide the badge.
   */
  badge?: () => MaybeRefOrGetter<number | null | undefined>
  children?: NavEntry[]
}
