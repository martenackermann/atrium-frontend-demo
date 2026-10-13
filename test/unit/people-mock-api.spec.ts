import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createHttpClient } from '~/lib/api/http'
import { isApiError } from '~/lib/api'
import { USER_IDS } from '~/mocks/core/seed'
import { db, resetDemoData } from '~/mocks/db'
import { createMockServer, TEST_API_BASE } from '~/mocks/node'
import type {
  JobRoleDto,
  PeopleCommentDto,
  PeopleCounts,
  PeopleRequestDetail,
  PeopleRequestSummary,
} from '~/modules/people/api/types'
import type { InboxResponse, LoginResponse, Page, TimelineEntry } from '~/types/api'

/** People mocks (slice A4): same story records, rules and errors as the backend (API.md §7.1). */
const server = createMockServer(TEST_API_BASE)
let token: string | null = null
const api = createHttpClient({ baseUrl: TEST_API_BASE, getToken: () => token })

async function as(personaKey: string) {
  token = (await api.post<LoginResponse>('/auth/demo-login', { personaKey })).accessToken
}
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (isApiError(error) ? error : null),
  )
const byNumber = (number: number) => db.peopleRequests.first((row) => row.number === number)!.id

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetDemoData({ refDate: new Date(2026, 9, 13) })
  token = null
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('people mock API', () => {
  it('seeds 15 requests with explicit references and 37 job roles (SPEC §10.5)', () => {
    expect(db.peopleRequests.count()).toBe(15)
    expect(
      db.peopleRequests
        .all()
        .map((row) => row.number)
        .sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
    expect(db.jobRoles.count()).toBe(37)
    const byStatus: Record<string, number> = {}
    for (const row of db.peopleRequests.all())
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
    expect(byStatus).toEqual({
      open: 2,
      in_progress: 3,
      waiting_internal: 2,
      waiting_on_requester: 2,
      reopened: 1,
      completed: 3,
      rejected: 1,
      cancelled: 1,
    })
  })

  it("gives Emma a reply to-do and Paula's triage queue", async () => {
    await as('emma')
    const inbox = await api.get<InboxResponse>('/me/inbox', { module: 'people' })
    expect(inbox.data.map((item) => [item.type, item.reference, item.subtitle])).toEqual([
      ['people.reply_required', 'PPL-000004', 'Which regions do you need to plan for?'],
    ])
    await as('paula')
    const ops = await api.get<InboxResponse>('/me/inbox', { module: 'people' })
    expect(ops.data.map((item) => item.reference)).toEqual([
      'PPL-000008',
      'PPL-000009',
      'PPL-000005',
    ])
    const counts = await api.get<PeopleCounts>('/people/queues/counts')
    expect(counts.ops).toEqual({
      open: 2,
      reopened: 1,
      inProgress: 3,
      waiting: 4,
      unassigned: 2,
      critical: 1,
    })
  })

  it('redacts personal data for it_admin and hides requests from others (404)', async () => {
    const id = byNumber(6)
    await as('ian')
    const asIan = await api.get<PeopleRequestDetail>(`/people/requests/${id}`)
    expect(asIan).toMatchObject({ personalData: null, personalDataRedacted: true })
    expect(asIan.internalNote).toBe('Waiting for laptop from IT stock')
    await as('emma')
    expect((await failure(api.get(`/people/requests/${id}`)))?.status).toBe(404)
    expect((await failure(api.get('/people/requests', { scope: 'all' })))?.status).toBe(403)
  })

  it('runs the reply flow: requester comment -> in_progress', async () => {
    const id = byNumber(4)
    await as('emma')
    const reply = await api.post<PeopleCommentDto>(`/people/requests/${id}/comments`, {
      body: 'Riverton and Westbay.',
    })
    expect(reply.kind).toBe('comment')
    const detail = await api.get<PeopleRequestDetail>(`/people/requests/${id}`)
    expect(detail).toMatchObject({ status: 'in_progress', openQuestion: null })
    const timeline = await api.get<TimelineEntry[]>(`/people/requests/${id}/timeline`)
    expect(timeline.at(-1)?.action).toBe('requester_replied')
  })

  it('applies the workflow with the API error order', async () => {
    const id = byNumber(5)
    await as('emma')
    expect((await failure(api.action(`/people/requests/${id}`, 'start_work')))?.status).toBe(404)
    await as('sofia')
    expect((await failure(api.action(`/people/requests/${id}`, 'start_work')))?.status).toBe(403)
    expect((await failure(api.action(`/people/requests/${id}`, 'complete')))?.code).toBe(
      'invalid_transition',
    )
    await as('paula')
    const started = await api.action<PeopleRequestDetail>(`/people/requests/${id}`, 'start_work')
    expect(started.assignee?.displayName).toBe('Paula People-Ops')
    const asked = await failure(
      api.action(`/people/requests/${id}`, 'wait_on_requester', { question: '?' }),
    )
    expect(asked?.status).toBe(422)
    const waiting = await api.action<PeopleRequestDetail>(
      `/people/requests/${id}`,
      'wait_internal',
      {
        note: 'Waiting for IT',
      },
    )
    expect(waiting.status).toBe('waiting_internal')
    await as('sofia')
    const comments = await api.get<PeopleCommentDto[]>(`/people/requests/${id}/comments`)
    expect(comments.some((c) => c.body === 'Waiting for IT')).toBe(false)
    const cancelled = await api.action<PeopleRequestDetail>(`/people/requests/${id}`, 'cancel', {
      reason: 'Plans changed.',
    })
    expect(cancelled).toMatchObject({ status: 'cancelled', availableActions: [] })
  })

  it('creates requests with per-field validation and the reporting-tree rule', async () => {
    await as('emma')
    const invalid = await failure(
      api.post('/people/requests', {
        type: 'onboarding',
        title: 'New hire',
        effectiveDate: '2030-01-01',
      }),
    )
    expect(Object.keys(invalid!.fieldErrors).sort()).toEqual([
      'firstName',
      'jobRoleId',
      'lastName',
      'managerId',
    ])
    const outsideTree = await failure(
      api.post('/people/requests', {
        type: 'offboarding',
        title: 'Max leaves',
        subjectUserId: USER_IDS.max,
        effectiveDate: '2030-01-01',
      }),
    )
    expect(outsideTree?.fieldErrors.subjectUserId).toBeDefined()
    const roles = await api.get<JobRoleDto[]>('/people/job-roles')
    const created = await api.post<PeopleRequestDetail>('/people/requests', {
      type: 'role_change',
      title: 'Access to the van calendar',
      subjectUserId: USER_IDS.emma,
      effectiveDate: '2030-02-01',
    })
    expect(created).toMatchObject({
      reference: 'PPL-000016',
      status: 'open',
      jobRole: null,
      manager: { displayName: 'Max Manager' },
      availableActions: ['cancel', 'edit', 'comment'],
    })
    expect(roles).toHaveLength(37)
    const list = await api.get<Page<PeopleRequestSummary>>('/people/requests', { q: 'PPL-000016' })
    expect(list.data.map((row) => row.id)).toEqual([created.id])
  })

  it('lets the requester edit while open and keeps internal fields for People Ops', async () => {
    const id = byNumber(5)
    await as('sofia')
    const edited = await api.patch<PeopleRequestDetail>(`/people/requests/${id}`, {
      priority: 'high',
    })
    expect(edited.priority).toBe('high')
    expect(
      (await failure(api.patch(`/people/requests/${id}`, { internalNote: 'x' })))?.status,
    ).toBe(403)
    await as('ian')
    expect(
      (await failure(api.patch(`/people/requests/${id}`, { personalData: { privatePhone: '1' } })))
        ?.status,
    ).toBe(403)
  })
})
