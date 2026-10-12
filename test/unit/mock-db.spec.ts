import { describe, expect, it } from 'vitest'
import { db, exportDemoData, resetDemoData } from '~/mocks/db'

const refDate = new Date('2026-10-01T00:00:00.000Z')

describe('mock database', () => {
  it('seeds deterministically for the same seed and reference date', () => {
    const first = resetDemoData({ refDate })
    const second = resetDemoData({ refDate })
    expect(second.collections).toEqual(first.collections)
    expect(first.seeds[0]).toBe('core')
  })

  it('seeds the demo personas with a manager hierarchy', () => {
    resetDemoData({ refDate })
    const emma = db.users.first((user) => user.email === 'emma.employee@example.com')
    const manager = emma?.managerId ? db.users.find(emma.managerId) : undefined
    expect(manager?.email).toBe('mark.manager@example.com')
    expect(db.users.count((user) => user.persona !== null)).toBeGreaterThanOrEqual(5)
  })

  it('supports CRUD and returns copies', () => {
    resetDemoData({ refDate })
    const before = db.users.count()
    const created = db.users.insert({
      email: 'new.hire@example.com',
      firstName: 'New',
      lastName: 'Hire',
      displayName: 'New Hire',
      jobTitle: null,
      department: null,
      costCenter: null,
      location: null,
      managerId: null,
      roles: ['employee'],
      active: true,
      persona: null,
    })
    expect(db.users.count()).toBe(before + 1)

    const copy = db.users.find(created.id)!
    copy.firstName = 'Mutated'
    expect(db.users.find(created.id)?.firstName).toBe('New')

    expect(db.users.update(created.id, { jobTitle: 'Analyst' })?.jobTitle).toBe('Analyst')
    expect(db.users.remove(created.id)).toBe(true)
    expect(db.users.find(created.id)).toBeUndefined()
  })

  it('reset discards changes', () => {
    resetDemoData({ refDate })
    const snapshot = exportDemoData()
    db.users.clear()
    expect(db.users.count()).toBe(0)
    resetDemoData({ refDate })
    expect(exportDemoData().collections).toEqual(snapshot.collections)
  })
})
