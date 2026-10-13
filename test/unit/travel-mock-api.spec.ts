import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createHttpClient } from '~/lib/api/http'
import { isApiError } from '~/lib/api'
import { USER_IDS } from '~/mocks/core/seed'
import { db, resetDemoData } from '~/mocks/db'
import { createMockServer, TEST_API_BASE } from '~/mocks/node'
import type { AttachmentDto, LoginResponse, Page } from '~/types/api'
import type {
  CarRentalClassDto,
  TravelCounts,
  TravelPreview,
  TravelRequestDetail,
  TravelRequestSummary,
} from '~/modules/travel/api/types'

/**
 * Travel mock API (demo mode) against the same MSW handlers the browser uses: it mirrors the
 * backend contract — scopes, the lenient preview (#3), validation, transitions with
 * availableActions, the PIN endpoint (#24) and the desk counts.
 */
const server = createMockServer(TEST_API_BASE)
let token: string | null = null
const api = createHttpClient({ baseUrl: TEST_API_BASE, getToken: () => token })

async function signInAs(personaKey: string) {
  const session = await api.post<LoginResponse>('/auth/demo-login', { personaKey })
  token = session.accessToken
  return session
}
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error,
  )
const list = (query: Record<string, string>) =>
  api.get<Page<TravelRequestSummary>>('/travel/requests', { perPage: '100', ...query })
const byReference = async (reference: string, scope = 'mine') =>
  (await list({ scope, q: reference })).data.find((row) => row.reference === reference)!
const act = (id: string, action: string, body: Record<string, unknown> = {}) =>
  api.post<TravelRequestDetail>(`/travel/requests/${id}/actions/${action}`, body)

async function uploadPdf(name = 'confirmation.pdf') {
  const form = new FormData()
  form.append('purpose', 'travel_booking_confirmation')
  form.append('file', new File(['%PDF-1.4 demo'], name, { type: 'application/pdf' }))
  return api.post<AttachmentDto>('/attachments', form)
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetDemoData({ refDate: new Date(2026, 9, 13) })
  token = null
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('travel mock seed', () => {
  it('seeds 40 requests with explicit references and S-V1 Riverton → Westbay with two reasons', async () => {
    expect(db.travelRequests.count()).toBe(40)
    await signInAs('emma')
    const sv1 = await byReference('TRV-000001')
    expect(sv1.route).toBe('Riverton → Westbay')
    expect(sv1.status).toBe('pending_approval')
    expect(sv1.approvalReasons.map((reason) => reason.code)).toEqual([
      'car_automatic_required',
      'car_foreign_travel',
    ])
    expect(sv1.approver?.displayName).toBe('Max Manager')
    expect(sv1.availableActions).toEqual(['withdraw'])
  })

  it('has exactly one standard class per vehicle type', async () => {
    await signInAs('tom')
    const classes = await api.get<CarRentalClassDto[]>('/travel/car-classes')
    const standard = classes.filter((row) => row.isDefault)
    expect(standard.map((row) => `${row.vehicleType}:${row.code}`).sort()).toEqual([
      'car:ECMR',
      'van:XVMR',
    ])
  })
})

describe('travel requests', () => {
  it('previews leniently while the stepper is half filled (#3)', async () => {
    await signInAs('emma')
    const preview = await api.post<TravelPreview>('/travel/requests/preview', {
      kind: 'train',
      travellerId: USER_IDS.emma,
      train: { fareType: 'saver', outboundAt: 'not a date yet' },
    })
    expect(preview.needsApproval).toBe(true)
    expect(preview.reasons.map((reason) => reason.code)).toEqual(['train_saver_fare'])
    expect(preview.defaultApproverId).toBe(USER_IDS.max)
    expect(preview.approverCandidates.find((c) => c.isDefault)?.user.displayName).toBe(
      'Max Manager',
    )
  })

  it('validates the create body with API dot paths (422)', async () => {
    await signInAs('emma')
    const error = await failure(
      api.post('/travel/requests', {
        kind: 'flight',
        travellerId: USER_IDS.emma,
        flight: { tripType: 'return', handLuggageOnly: false },
      }),
    )
    expect(isApiError(error) && error.status).toBe(422)
    expect(isApiError(error) && Object.keys(error.fieldErrors)).toContain('flight.outboundFrom')
  })

  it('creates a flex train journey that goes straight to the desk', async () => {
    await signInAs('emma')
    const created = await api.post<TravelRequestDetail>('/travel/requests', {
      kind: 'train',
      travellerId: USER_IDS.emma,
      train: {
        tripType: 'one_way',
        outboundAt: '2026-10-28T07:15:00.000Z',
        fromStation: 'Riverton Central',
        toStation: 'Northport Central',
        fareType: 'flex',
        seatReservations: 1,
        separateTickets: false,
        localTransportTicket: false,
      },
    })
    expect(created.reference).toBe('TRV-000041')
    expect(created.status).toBe('to_book')
    expect(created.needsApproval).toBe(false)
    expect(created.route).toBe('Riverton Central → Northport Central')
  })

  it('lets the approver approve, but never the traveller (403)', async () => {
    await signInAs('emma')
    const sv1 = await byReference('TRV-000001')
    expect(await failure(act(sv1.id, 'approve'))).toMatchObject({ status: 403 })

    await signInAs('max')
    const inbox = await list({ scope: 'approvals' })
    expect(inbox.data.map((row) => row.reference)).toContain('TRV-000001')
    const approved = await act(sv1.id, 'approve', { comment: 'Fine for the workshop.' })
    expect(approved.status).toBe('to_book')
    expect(approved.availableActions).not.toContain('approve')
  })

  it('declines with a reason and requires it (422)', async () => {
    await signInAs('max')
    const sv9 = await byReference('TRV-000009', 'approvals')
    const missing = await failure(act(sv9.id, 'decline', {}))
    expect(isApiError(missing) && missing.status).toBe(422)
    const declined = await act(sv9.id, 'decline', { reason: 'A petrol car is fine.' })
    expect(declined.status).toBe('declined')
  })

  it('hides other people’s trips (404)', async () => {
    await signInAs('ian')
    const id = db.travelRequests.all().find((row) => row.number === 1)!.id
    await signInAs('sofia')
    expect(await failure(api.get(`/travel/requests/${id}`))).toMatchObject({ status: 404 })
  })
})

describe('travel desk', () => {
  it('books with a PDF and PIN; the PIN is revealed to the traveller, not to IT admins', async () => {
    await signInAs('tom')
    const sv2 = await byReference('TRV-000002', 'all')
    expect(sv2.availableActions).toEqual(
      expect.arrayContaining(['book', 'mark_booking_impossible']),
    )
    const missingPdf = await failure(
      act(sv2.id, 'book', { bookingNumber: 'DB-1', attachmentIds: [] }),
    )
    expect(isApiError(missingPdf) && missingPdf.status).toBe(422)

    const pdf = await uploadPdf()
    const booked = await act(sv2.id, 'book', {
      bookingNumber: 'DB-48213-7',
      pin: '4821',
      attachmentIds: [pdf.id],
    })
    expect(booked.status).toBe('booked')
    expect(booked.booking?.bookingNumber).toBe('DB-48213-7')
    expect(booked.booking?.pinAvailable).toBe(true)
    expect(booked.booking?.attachments.map((file) => file.originalName)).toEqual([
      'confirmation.pdf',
    ])

    await signInAs('emma')
    const pin = await api.get<{ pin: string }>(`/travel/requests/${sv2.id}/booking/pin`)
    expect(pin.pin).toBe('4821')

    await signInAs('ian')
    const denied = await failure(api.get(`/travel/requests/${sv2.id}/booking/pin`))
    expect(isApiError(denied) ? denied.status : null).toBe(403)
  })

  it('marks a booking impossible, retries it and closes another', async () => {
    await signInAs('tom')
    const sv13 = await byReference('TRV-000013', 'all')
    const impossible = await act(sv13.id, 'mark_booking_impossible', {
      reason: 'No cars left at the branch.',
    })
    expect(impossible.status).toBe('booking_impossible')
    expect(impossible.availableActions).toEqual(expect.arrayContaining(['retry_booking', 'close']))
    const retried = await act(sv13.id, 'retry_booking', {})
    expect(retried.status).toBe('to_book')
  })

  it('confirms a requested cancellation with an optional note', async () => {
    await signInAs('tom')
    const queue = await list({ scope: 'all', status: 'cancellation_requested' })
    expect(queue.data.length).toBeGreaterThan(0)
    const cancelled = await act(queue.data[0]!.id, 'confirm_cancellation', {
      comment: 'No cancellation fee applies.',
    })
    expect(cancelled.status).toBe('cancelled')
  })

  it('counts the desk queues for the travel desk only', async () => {
    await signInAs('tom')
    const counts = await api.get<TravelCounts>('/travel/queues/counts')
    expect(counts.desk?.toBook).toBe((await list({ scope: 'all', status: 'to_book' })).meta.total)
    expect(counts.desk?.toBookHighPriority).toBeGreaterThan(0)

    await signInAs('emma')
    expect((await api.get<TravelCounts>('/travel/queues/counts')).desk).toBeNull()
  })
})
