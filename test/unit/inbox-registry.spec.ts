import { describe, expect, it } from 'vitest'
import { defineMockProviders } from '~/mocks/define'
import type { MockUser } from '~/mocks/core/types'
import { inboxFor, myDayFor, sortInbox } from '~/mocks/registry'
import type { InboxItem } from '~/types/api'

const item = (id: string, patch: Partial<InboxItem> = {}): InboxItem => ({
  id,
  module: 'travel',
  type: 'travel.approval_required',
  reference: null,
  title: id,
  subtitle: null,
  dueAt: null,
  priority: 'normal',
  actingAs: null,
  link: `/travel/requests/${id}`,
  entityId: id,
  createdAt: '2026-10-01T09:00:00.000Z',
  quickActions: [],
  actionsPath: `/travel/requests/${id}`,
  ...patch,
})

const user = { id: 'u1' } as MockUser
const ctx = { now: new Date('2026-10-13T09:00:00.000Z') }

describe('inbox registry', () => {
  it('sorts high priority first, then by due date (nulls last), then oldest first', () => {
    const sorted = sortInbox([
      item('normal-no-due', { createdAt: '2026-10-01T08:00:00.000Z' }),
      item('normal-due-late', { dueAt: '2026-10-20T00:00:00.000Z' }),
      item('high-no-due', { priority: 'high' }),
      item('normal-due-soon', { dueAt: '2026-10-14T00:00:00.000Z' }),
      item('high-due', { priority: 'high', dueAt: '2026-10-15T00:00:00.000Z' }),
      item('normal-no-due-newer', { createdAt: '2026-10-05T08:00:00.000Z' }),
    ])
    expect(sorted.map((entry) => entry.id)).toEqual([
      'high-due',
      'high-no-due',
      'normal-due-soon',
      'normal-due-late',
      'normal-no-due',
      'normal-no-due-newer',
    ])
  })

  it('aggregates every module provider for the user, sorted', () => {
    const training = defineMockProviders({
      inbox: (viewer) => [
        item('t1', { module: 'training', type: 'training.rating_due', title: viewer.id }),
      ],
    })
    const travel = defineMockProviders({
      inbox: () => [item('v1', { priority: 'high', quickActions: ['approve', 'decline'] })],
    })
    const silent = defineMockProviders({})
    const items = inboxFor(user, ctx, [
      ['training', training],
      ['travel', travel],
      ['news', silent],
    ])
    expect(items.map((entry) => entry.id)).toEqual(['v1', 't1'])
    expect(items[1]!.title).toBe('u1')
    expect(items[0]!.actionsPath).toBe('/travel/requests/v1')
  })

  it('caps the inbox at 200 items', () => {
    const many = defineMockProviders({
      inbox: () => Array.from({ length: 250 }, (_, index) => item(`i${index}`)),
    })
    expect(inboxFor(user, ctx, [['travel', many]])).toHaveLength(200)
  })

  it('merges my-day fragments: arrays concatenate, other keys assign', () => {
    const merged = myDayFor(user, ctx, [
      ['training', defineMockProviders({ myDay: () => ({ upcoming: [1], greeting: 'a' }) })],
      ['travel', defineMockProviders({ myDay: () => ({ upcoming: [2], trips: 3 }) })],
    ])
    expect(merged).toEqual({ upcoming: [1, 2], greeting: 'a', trips: 3 })
  })
})
