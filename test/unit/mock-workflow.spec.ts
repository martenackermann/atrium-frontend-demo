import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { USER_IDS } from '~/mocks/core/seed'
import type { MockUser } from '~/mocks/core/types'
import {
  collection,
  db,
  resetDemoData,
  type MockCollection,
  type MockCollectionName,
} from '~/mocks/db'
import { defineMockWorkflow, type WorkflowEntity } from '~/mocks/workflow'

interface Request extends WorkflowEntity {
  status: 'pending_approval' | 'to_book' | 'booked' | 'declined'
  requesterId: string
  approverId: string
  reason?: string | null
}

const workflow = defineMockWorkflow<Request>({
  name: 'test_request',
  label: 'Test request',
  module: 'travel',
  entityType: 'test_request',
  states: {
    pending_approval: { label: 'Awaiting approval', tone: 'waiting' },
    to_book: { label: 'To book', tone: 'moving' },
    booked: { label: 'Booked', tone: 'positive', terminal: true },
    declined: { label: 'Declined', tone: 'negative', terminal: true },
  },
  initialStates: ['pending_approval'],
  transitions: [
    {
      event: 'approve',
      from: ['pending_approval'],
      to: 'to_book',
      label: 'Approve',
      actors: ['Approver'],
      allowed: (entity, user) => (entity.approverId === user.id ? 'approver' : false),
    },
    {
      event: 'decline',
      from: ['pending_approval'],
      to: 'declined',
      label: 'Decline',
      actors: ['Approver'],
      allowed: (entity, user) => (entity.approverId === user.id ? 'approver' : false),
      body: z.object({ reason: z.string().min(1, 'Tell them why.') }),
      apply: ({ body }) => ({ reason: String(body.reason) }),
    },
    {
      event: 'book',
      from: ['to_book'],
      to: 'booked',
      label: 'Book',
      actors: ['Travel desk'],
      allowed: (_entity, user) => (user.roles.includes('travel_desk') ? 'back_office' : false),
    },
  ],
  capabilities: {
    edit: (entity, user) => entity.requesterId === user.id && entity.status === 'pending_approval',
  },
  entityLabel: () => 'Test request',
})

let requests: MockCollection<Request>
let emma: MockUser
let max: MockUser
let tom: MockUser

const statusOf = (thrown: unknown) => (thrown instanceof Response ? thrown.status : null)
const attempt = (run: () => unknown) => {
  try {
    run()
    return null
  } catch (error) {
    return error
  }
}

beforeEach(() => {
  resetDemoData({ refDate: new Date(2026, 9, 13) })
  requests = collection('testRequests' as MockCollectionName) as unknown as MockCollection<Request>
  emma = db.users.find(USER_IDS.emma)!
  max = db.users.find(USER_IDS.max)!
  tom = db.users.find(USER_IDS.tom)!
})

describe('mock workflow engine', () => {
  it('derives availableActions from state, relationship and capabilities', () => {
    const request = requests.insert({
      status: 'pending_approval',
      requesterId: emma.id,
      approverId: max.id,
    })
    expect(workflow.availableActions(request, max)).toEqual(['approve', 'decline'])
    expect(workflow.availableActions(request, emma)).toEqual(['edit'])
    expect(workflow.availableActions(request, tom)).toEqual([])
  })

  it('transitions, writes the audit trail and records how the actor acted', () => {
    const request = requests.insert({
      status: 'pending_approval',
      requesterId: emma.id,
      approverId: max.id,
    })
    const updated = workflow.transition(requests, request, 'approve', max)
    expect(updated.status).toBe('to_book')
    const audit = db.audit.where((entry) => entry.entityId === request.id)
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({
      action: 'approve',
      fromState: 'pending_approval',
      toState: 'to_book',
      actingAs: 'approver',
    })
    expect(workflow.transition(requests, updated, 'book', tom).status).toBe('booked')
  })

  it('answers 404 unknown action, 409 wrong state, 403 not allowed (in that order)', () => {
    const request = requests.insert({
      status: 'pending_approval',
      requesterId: emma.id,
      approverId: max.id,
    })
    expect(statusOf(attempt(() => workflow.transition(requests, request, 'teleport', max)))).toBe(
      404,
    )
    expect(statusOf(attempt(() => workflow.transition(requests, request, 'book', tom)))).toBe(409)
    expect(statusOf(attempt(() => workflow.transition(requests, request, 'approve', emma)))).toBe(
      403,
    )
  })

  it('builds the diagram definition from transitions', () => {
    expect(workflow.definition.states.map((state) => state.id)).toEqual([
      'pending_approval',
      'to_book',
      'booked',
      'declined',
    ])
    expect(workflow.definition.transitions).toContainEqual(
      expect.objectContaining({ from: 'to_book', to: 'booked', event: 'book' }),
    )
  })
})
