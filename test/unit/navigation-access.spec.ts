import { beforeAll, describe, expect, it } from 'vitest'
import { navigation } from '~/config/navigation'
import { hasAccess } from '~/lib/access'
import { findNavEntry, flattenNavigation, visibleNavigation } from '~/lib/navigation'
import { toMe } from '~/mocks/core/org'
import { USER_IDS } from '~/mocks/core/seed'
import { db, resetDemoData } from '~/mocks/db'
import type { Me } from '~/types/api'

let me: (handle: 'emma' | 'max' | 'paula' | 'ian' | 'clara' | 'tom') => Me

beforeAll(() => {
  resetDemoData({ refDate: new Date(2026, 9, 13) })
  me = (handle) => toMe(db, db.users.find(USER_IDS[handle])!)
})

const ids = (user: Me) =>
  flattenNavigation(visibleNavigation(navigation, user)).map(({ item }) => item.id)
const groups = (user: Me) => visibleNavigation(navigation, user).map((group) => group.id)

describe('role-aware navigation (SCREENS §1.2)', () => {
  it('shows Emma (employee) only her work, no approvals and no back office', () => {
    expect(groups(me('emma'))).toEqual(['work', 'settings'])
    expect(ids(me('emma'))).not.toContain('training.approvals')
    expect(ids(me('emma'))).not.toContain('travel.approvals')
  })

  it('shows Max (manager, active deputy) the approval queues', () => {
    expect(ids(me('max'))).toEqual(
      expect.arrayContaining(['training.approvals', 'travel.approvals']),
    )
    expect(groups(me('max'))).not.toContain('back-office')
  })

  it('shows Paula the People ops and News back offices only', () => {
    const backOffice = visibleNavigation(navigation, me('paula')).find(
      (group) => group.id === 'back-office',
    )
    expect(backOffice?.items.map((item) => item.id)).toEqual([
      'back-office.people',
      'back-office.news',
    ])
    expect(groups(me('paula'))).not.toContain('admin')
  })

  it('shows Ian (IT admin) every back office and the admin group', () => {
    const backOffice = visibleNavigation(navigation, me('ian')).find(
      (group) => group.id === 'back-office',
    )
    expect(backOffice?.items).toHaveLength(5)
    expect(groups(me('ian'))).toContain('admin')
  })

  it('treats manager, executive and deputy as approvers', () => {
    expect(hasAccess(me('clara'), ['approver'])).toBe(true)
    expect(hasAccess(me('tom'), ['approver'])).toBe(false)
    expect(hasAccess(me('emma'), [])).toBe(true)
    expect(hasAccess(null, [])).toBe(false)
  })

  it('finds the owning nav entry by the longest prefix', () => {
    expect(findNavEntry(navigation, '/travel/requests/123')?.item.id).toBe('travel')
    expect(findNavEntry(navigation, '/back-office/assets/inventory/new')?.item.id).toBe(
      'back-office.assets.inventory',
    )
    expect(findNavEntry(navigation, '/')?.item.id).toBe('home')
  })
})
