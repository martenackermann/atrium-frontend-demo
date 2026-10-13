import type { Me, RoleName } from '~/types/api'

/**
 * Route and navigation visibility rules (SCREENS.md §1.2). A rule list grants access when ANY rule
 * matches. Visibility only — the API enforces every permission (SPEC D5).
 *
 * - a RoleName (`training_office`, `it_admin`, …; `manager` is derived from direct reports)
 * - 'deputy'   → the user is an active deputy for someone today
 * - 'approver' → manager ∨ executive ∨ active deputy (who may see approval queues)
 */
export type AccessRule = RoleName | 'deputy' | 'approver'

export function hasRole(me: Pick<Me, 'roles' | 'isManager' | 'isExecutive'>, role: RoleName) {
  if (role === 'employee') return true
  if (role === 'manager') return me.isManager || me.roles.includes('manager')
  if (role === 'executive') return me.isExecutive || me.roles.includes('executive')
  return me.roles.includes(role)
}

export function matchesRule(me: Me, rule: AccessRule): boolean {
  if (rule === 'deputy') return me.activeDeputyFor.length > 0
  if (rule === 'approver') {
    return hasRole(me, 'manager') || hasRole(me, 'executive') || me.activeDeputyFor.length > 0
  }
  return hasRole(me, rule)
}

/** No rules = every signed-in user. */
export function hasAccess(me: Me | null | undefined, rules?: readonly AccessRule[] | null) {
  if (!me) return false
  if (!rules || rules.length === 0) return true
  return rules.some((rule) => matchesRule(me, rule))
}

/** Back-office module roles; it_admin sees every back office (SPEC §2.1). */
export const BACK_OFFICE: Record<
  'training' | 'travel' | 'assets' | 'people' | 'news',
  AccessRule[]
> = {
  training: ['training_office', 'it_admin'],
  travel: ['travel_desk', 'it_admin'],
  assets: ['asset_admin', 'it_admin'],
  people: ['people_ops', 'it_admin'],
  news: ['news_editor', 'it_admin'],
}
