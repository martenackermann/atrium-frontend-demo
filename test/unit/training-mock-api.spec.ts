import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createHttpClient } from '~/lib/api/http'
import { isApiError } from '~/lib/api'
import { USER_IDS } from '~/mocks/core/seed'
import { db, resetDemoData } from '~/mocks/db'
import { createMockServer, TEST_API_BASE } from '~/mocks/node'
import { inboxFor } from '~/mocks/registry'
import type { InboxResponse, LoginResponse, Page } from '~/types/api'
import type {
  TrainingCounts,
  TrainingParticipationDetail,
  TrainingParticipationListItem,
  TrainingPreview,
  TrainingRatingDto,
  TrainingRequestDetail,
  TrainingRequestSummary,
} from '~/modules/training/api/types'

/**
 * Training mocks (demo mode) behave like the backend: SPEC §10.2 seed, scopes, routing,
 * transitions with their 403/404/409/422 semantics, ratings, counts and inbox items.
 */
const server = createMockServer(TEST_API_BASE)
let token: string | null = null
const api = createHttpClient({ baseUrl: TEST_API_BASE, getToken: () => token })

async function signInAs(personaKey: string) {
  const session = await api.post<LoginResponse>('/auth/demo-login', { personaKey })
  token = session.accessToken
  return session.user
}
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (isApiError(error) ? error : Promise.reject(error)),
  )
const requestByNumber = (number: number) => db.trainingRequests.first((r) => r.number === number)!
const attendeeOf = (number: number, handle: string) =>
  db.trainingAttendees.first(
    (a) => a.requestId === requestByNumber(number).id && a.userId === USER_IDS[handle],
  )!
const d = (offset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetDemoData()
  token = null
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('training mock seed (SPEC §10.2)', () => {
  it('has 30 requests and 42 attendees in the story distribution', () => {
    expect(db.trainingRequests.count()).toBe(30)
    expect(db.trainingAttendees.count()).toBe(42)
    const by = (status: string) => db.trainingAttendees.count((a) => a.status === status)
    expect({
      pendingManager: by('pending_manager_approval'),
      pendingExec: by('pending_executive_approval'),
      toBook: by('to_book'),
      booked: by('booked'),
      attended: by('attended'),
      notAttended: by('not_attended'),
      declined: by('declined'),
      impossible: by('booking_impossible'),
      cancellationRequested: by('cancellation_requested'),
      cancelled: by('cancelled'),
    }).toEqual({
      pendingManager: 7,
      pendingExec: 3,
      toBook: 5,
      booked: 9,
      attended: 8,
      notAttended: 1,
      declined: 3,
      impossible: 1,
      cancellationRequested: 2,
      cancelled: 3,
    })
    expect(attendeeOf(7, 'hilTech1')).toMatchObject({
      approverId: USER_IDS.max,
      approverReason: 'site_manager_escalation',
      escalatedFromId: USER_IDS.sofia,
    })
  })
})

describe('training mock API', () => {
  it('lists approvals, deputy and team scopes for Max', async () => {
    await signInAs('max')
    const approvals = await api.get<Page<TrainingParticipationListItem>>(
      '/training/participations',
      {
        scope: 'approvals',
      },
    )
    expect(approvals.data.map((p) => p.request.reference).sort()).toEqual([
      'TRN-000001',
      'TRN-000007',
      'TRN-000007',
    ])
    expect(approvals.data[0]!.availableActions).toEqual(['approve', 'decline'])
    const deputy = await api.get<Page<TrainingParticipationListItem>>('/training/participations', {
      scope: 'deputy',
    })
    expect(deputy.data).toHaveLength(2)
    expect(deputy.data.every((p) => p.actingAs === 'deputy')).toBe(true)
    const counts = await api.get<TrainingCounts>('/training/queues/counts')
    expect(counts.approvals).toEqual({ manager: 3, executive: 0, deputy: 2, team: 1 })
  })

  it('approves through the executive step and books', async () => {
    await signInAs('clara')
    const id = attendeeOf(10, 'sofia').id
    const approved = await api.action<TrainingParticipationDetail>(
      `/training/participations/${id}`,
      'approve',
      { comment: 'Go ahead' },
    )
    expect(approved).toMatchObject({
      status: 'to_book',
      executiveDecision: { actingAs: 'executive', comment: 'Go ahead' },
    })
    await signInAs('tina')
    const booked = await api.action<TrainingParticipationDetail>(
      `/training/participations/${id}`,
      'book',
      { bookingReference: 'OLC-1' },
    )
    expect(booked.status).toBe('booked')
    expect(booked.ratings.map((r) => r.loop)).toEqual([1])
  })

  it('answers 403, 404, 409 and 422 like the API', async () => {
    await signInAs('emma')
    const hidden = attendeeOf(8, 'sdkAgent5').id
    expect((await failure(api.get(`/training/participations/${hidden}`)))?.status).toBe(404)
    const own = attendeeOf(1, 'emma').id
    expect((await failure(api.action(`/training/participations/${own}`, 'approve')))?.status).toBe(
      403,
    )
    expect((await failure(api.action(`/training/participations/${own}`, 'book')))?.status).toBe(409)
    await signInAs('max')
    const error = await failure(
      api.action(`/training/participations/${own}`, 'decline', { reason: 'x' }),
    )
    expect(error?.status).toBe(422)
    expect(error?.fieldErrors).toHaveProperty('reason')
  })

  it('creates a request with routing preview and auto-approval', async () => {
    await signInAs('max')
    const preview = await api.post<TrainingPreview>('/training/requests/preview', {
      cost: { amountCents: 50_000, currency: 'EUR' },
      attendees: [{ userId: USER_IDS.emma }, { userId: USER_IDS.arne }],
    })
    expect(preview.attendees[0]).toMatchObject({
      autoApproval: 'requester_is_approver',
      initialState: 'to_book',
    })
    expect(preview.attendees[1]).toMatchObject({ allowed: false })
    const created = await api.post<TrainingRequestDetail>('/training/requests', {
      topic: 'Dispatch planning basics',
      provider: 'Northgate Learning',
      format: 'online',
      startsOn: d(20),
      endsOn: d(20),
      cost: { amountCents: 50_000, currency: 'EUR' },
      certificateExpected: false,
      reimbursementAgreement: false,
      attendees: [{ userId: USER_IDS.emma }],
    })
    expect(created.reference).toBe('TRN-000031')
    expect(created.attendees[0]!.status).toBe('to_book')
    const bad = await failure(
      api.post('/training/requests', {
        topic: 'x',
        provider: 'Northgate Learning',
        format: 'in_person',
        startsOn: d(20),
        endsOn: d(20),
        cost: { amountCents: 50_000, currency: 'EUR' },
        certificateExpected: false,
        reimbursementAgreement: false,
        attendees: [{ userId: USER_IDS.arne }],
      }),
    )
    expect(bad?.status).toBe(422)
  })

  it('submits a due rating and opens the next round', async () => {
    await signInAs('emma')
    const due = await api.get<Page<TrainingRatingDto>>('/training/ratings', {
      state: 'due,overdue',
    })
    const loop2 = due.data.find((r) => r.loop === 2)!
    const done = await api.post<TrainingRatingDto>(`/training/ratings/${loop2.id}/submit`, {
      loop: 2,
      appliesLearned: 'A',
      supervisorSupported: 'B',
      worthwhileForOrganization: 'A',
    })
    expect(done.state).toBe('submitted')
    expect(
      db.trainingRatings.count((r) => r.attendeeId === loop2.attendee.id && r.loop === 3),
    ).toBe(1)
  })

  it('contributes inbox items and office counts', async () => {
    const tina = db.users.find(USER_IDS.tina)!
    const items = inboxFor(tina).filter((item) => item.module === 'training')
    expect(items.filter((i) => i.type === 'training.booking_required')).toHaveLength(5)
    await signInAs('tina')
    const counts = await api.get<TrainingCounts>('/training/queues/counts')
    expect(counts.office).toMatchObject({
      toBook: 5,
      cancellationRequested: 2,
      bookingImpossible: 1,
    })
    const all = await api.get<Page<TrainingRequestSummary>>('/training/requests', {
      scope: 'all',
      perPage: 100,
    })
    expect(all.meta.total).toBe(30)
    const inbox = await api.get<InboxResponse>('/me/inbox')
    expect(inbox.data.some((i) => i.type === 'training.cancellation_review')).toBe(true)
  })
})
