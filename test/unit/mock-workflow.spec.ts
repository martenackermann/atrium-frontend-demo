import { describe, expect, it } from 'vitest'
import { defineMockWorkflow } from '~/mocks/workflow'

interface Attendee {
  id: string
  status: 'pending_approval' | 'to_book' | 'booked' | 'declined'
  approverId: string
}
interface Actor {
  id: string
}

const workflow = defineMockWorkflow<Attendee, Actor>()({
  approve: {
    from: ['pending_approval'],
    to: 'to_book',
    guard: (attendee, user) => attendee.approverId === user.id,
  },
  decline: {
    from: ['pending_approval'],
    to: 'declined',
    guard: (attendee, user) => attendee.approverId === user.id,
  },
  book: { from: ['to_book'], to: 'booked' },
})

const attendee: Attendee = { id: 'a1', status: 'pending_approval', approverId: 'm1' }

describe('defineMockWorkflow', () => {
  it('lists available actions per status and user', () => {
    expect(workflow.availableActions(attendee, { id: 'm1' })).toEqual(['approve', 'decline'])
    expect(workflow.availableActions(attendee, { id: 'someone-else' })).toEqual([])
    expect(workflow.availableActions({ ...attendee, status: 'to_book' }, { id: 'x' })).toEqual([
      'book',
    ])
  })

  it('returns the next status or throws problem responses', () => {
    expect(workflow.transition(attendee, 'approve', { id: 'm1' })).toBe('to_book')

    const wrongState = catchResponse(() =>
      workflow.transition({ ...attendee, status: 'booked' }, 'approve', { id: 'm1' }),
    )
    expect(wrongState.status).toBe(409)

    const notAllowed = catchResponse(() => workflow.transition(attendee, 'approve', { id: 'x' }))
    expect(notAllowed.status).toBe(403)
  })
})

function catchResponse(fn: () => unknown): Response {
  try {
    fn()
  } catch (error) {
    if (error instanceof Response) return error
    throw error
  }
  throw new Error('expected a thrown Response')
}
