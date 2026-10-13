/**
 * Slice extension points on the frontend (no shared-file edits needed):
 *
 *   app/modules/<module>/badges.ts    export default defineNavBadges({ 'training.ratings': () => … })
 *   app/modules/<module>/commands.ts  export default defineCommands([ { id, group: 'create', … } ])
 *
 * Both are collected by glob (useNavBadges, useCommands). Mock-side registries live in
 * app/modules/<module>/mocks/providers.ts (see ~/mocks/define).
 */
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { AccessRule } from '~/lib/access'
import type { NavBadgeSource } from '~/types/navigation'

/** Nav item id → badge source. Ids are the ones in app/config/navigation.ts. */
export type NavBadgeMap = Record<string, NavBadgeSource>

export function defineNavBadges(badges: NavBadgeMap): NavBadgeMap {
  return badges
}

export type CommandGroup = 'inbox' | 'create' | 'jump' | 'search' | 'demo' | 'preferences'

export interface AppCommand {
  /** Unique id, prefixed with the module: 'travel.new-car'. */
  id: string
  group: CommandGroup
  label: string
  icon?: Component
  /** Extra words the palette matches on. */
  keywords?: string[]
  /** Navigate here … */
  to?: RouteLocationRaw
  /** … or run this. */
  run?: () => void | Promise<void>
  /** Visible when ANY rule matches; omitted = everyone. */
  access?: AccessRule[]
  /** Also list it in the sidebar "New request" menu and the mobile "New" sheet. */
  newRequest?: boolean
  /** Order within its group (lower first). Default 100. */
  order?: number
  /** Right-aligned hint text (mono ID, shortcut…). */
  hint?: string
}

export function defineCommands(commands: AppCommand[]): AppCommand[] {
  return commands
}
