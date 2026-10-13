import type { ActingAs, ApprovalReasonCode } from '~/types/api'
import { defineMockSeed, type SeedContext } from '~/mocks/define'
import { recordAudit } from '~/mocks/core/audit'
import { seedAttachment } from '~/mocks/core/files'
import { resolveApprover } from '~/mocks/core/org'
import { USER_IDS } from '~/mocks/core/seed'
import type { MockUser } from '~/mocks/core/types'
import type { TravelStatus } from '../api/types'
import {
  APPROVAL_REASON_LABELS,
  buildRoute,
  evaluateApprovalReasons,
  isHighPriority,
  travelReference,
} from '../lib/rules'
import {
  type AddressSeed,
  type At,
  CAR_CLASSES,
  type SeedEvent,
  TRIPS,
  type TripSpec,
} from './seed-data'
import type { TravelRequestRecord } from './types'

/**
 * Travel demo data (slice A2) — the SPEC §10.3 records of the backend seed (same table, same
 * reference numbers TRV-000001..40), with coherent audit trails, confirmation PDFs and the
 * in-app notifications of the story records.
 */
const NEXT: Record<string, Partial<Record<SeedEvent['type'], TravelStatus>>> = {
  pending_approval: { approve: 'to_book', decline: 'declined', withdraw: 'cancelled' },
  to_book: {
    book: 'booked',
    mark_booking_impossible: 'booking_impossible',
    request_cancellation: 'cancellation_requested',
  },
  booked: { request_cancellation: 'cancellation_requested' },
  booking_impossible: { close: 'cancelled', withdraw: 'cancelled' },
  cancellation_requested: { confirm_cancellation: 'cancelled' },
}

const NOTIFICATION_TEMPLATES = {
  approval_requested: 'travel.approval_requested',
  submitted_to_desk: 'travel.submitted_to_desk',
  approved: 'travel.approved',
  declined: 'travel.declined',
  booked: 'travel.booked',
  booking_impossible: 'travel.booking_impossible',
} as const

/** "Thu, 22 Oct 2026, 09:00" in local time, like the backend's formatDateTime (en-GB). */
const dateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))

/** Trip dates as the backend notifications print them (start – end, or the start only). */
const tripWhen = (startsAt: string, endsAt: string | null) =>
  endsAt ? `${dateTime(startsAt)} – ${dateTime(endsAt)}` : dateTime(startsAt)

export default defineMockSeed({
  order: 120,
  run(ctx: SeedContext) {
    const { db } = ctx
    const at = ([day, hh, mm = 0]: At) => ctx.at(day, hh, mm)
    const user = (handle: string): MockUser => {
      const id = USER_IDS[handle]
      const found = id ? db.users.find(id) : undefined
      if (!found) throw new Error(`[travel seed] unknown user ${handle}`)
      return found
    }

    // Car classes (SPEC §4.3)
    const classes = new Map<string, { id: string; isDefault: boolean }>()
    for (const cls of CAR_CLASSES) {
      const row = db.carRentalClasses.insert({ id: ctx.uuid(), ...cls, active: true })
      classes.set(cls.code, { id: row.id, isDefault: row.isDefault })
    }

    const tom = user('tom')
    const now = new Date()

    for (const spec of TRIPS) {
      const traveller = user(spec.traveller)
      const requester = user(spec.requester ?? spec.traveller)
      const createdAt = at(spec.created)
      const reference = travelReference(spec.n)
      const exempt = traveller.roles.includes('executive')
      const detail = buildDetail(spec, {
        at,
        classes,
        traveller,
        user,
        birthDate: () => birthDate(ctx),
      })
      const reasons: ApprovalReasonCode[] = exempt ? [] : evaluateApprovalReasons(detail.ruleInput)
      const needsApproval = reasons.length > 0
      const resolved = needsApproval ? resolveApprover(db, traveller, requester) : null
      const autoApproved = resolved?.approver.id === requester.id
      let status: TravelStatus = needsApproval && !autoApproved ? 'pending_approval' : 'to_book'

      const record: TravelRequestRecord = {
        id: ctx.uuid(),
        number: spec.n,
        kind: spec.kind,
        status,
        travellerId: traveller.id,
        requesterId: requester.id,
        approverId: resolved?.approver.id ?? null,
        approverSelection: resolved ? 'auto' : null,
        approverReason: resolved?.reason ?? null,
        escalatedFromId: resolved?.escalatedFrom?.id ?? null,
        needsApproval,
        approvalReasons: reasons,
        approvalExemption: exempt ? 'executive_traveller' : null,
        startsAt: detail.startsAt,
        endsAt: detail.endsAt,
        route: detail.route,
        costCenterId: traveller.costCenterId,
        costCenterReason: null,
        recharge: spec.recharge ?? null,
        comment: spec.comment ?? null,
        car: detail.car,
        train: detail.train,
        flight: detail.flight,
        statusBeforeCancellation: null,
        approval: null,
        declinedAt: null,
        declineReason: null,
        bookingImpossibleReason: null,
        cancellationRequestedAt: null,
        cancellationReason: null,
        cancelledAt: null,
        booking: null,
        createdAt,
        updatedAt: createdAt,
        version: 1 + (spec.events?.length ?? 0),
      }

      const audit = (input: {
        at: string
        actorId: string | null
        actingAs: ActingAs
        action: string
        from: string | null
        to: string | null
        reason?: string | null
        summary: string
      }) =>
        recordAudit(db, {
          module: 'travel',
          entityType: 'travel_request',
          entityId: record.id,
          entityLabel: reference,
          action: input.action,
          actorId: input.actorId,
          actingAs: input.actingAs,
          fromState: input.from,
          toState: input.to,
          reason: input.reason ?? null,
          summary: input.summary,
          occurredAt: input.at,
          correlationId: 'seed',
        })

      audit({
        at: createdAt,
        actorId: requester.id,
        actingAs: requester.id === traveller.id ? 'self' : 'requester',
        action: 'create',
        from: null,
        to: needsApproval ? 'pending_approval' : 'to_book',
        summary: `${requester.displayName} submitted the request`,
      })

      let decisionAt: string | null = null
      let bookedAt: string | null = null
      let impossibleAt: string | null = null
      for (const event of spec.events ?? []) {
        const next: TravelStatus | undefined = NEXT[status]?.[event.type]
        if (!next)
          throw new Error(`[travel seed] ${reference}: ${event.type} not allowed in ${status}`)
        const when = at(event.at)
        const from = status
        switch (event.type) {
          case 'approve': {
            const by = event.by ? user(event.by) : resolved!.approver
            const actingAs: ActingAs = event.as ?? 'approver'
            record.approval = {
              at: when,
              byId: by.id,
              actingAs,
              autoApproval: null,
              comment: event.comment ?? null,
            }
            decisionAt = when
            audit({
              at: when,
              actorId: by.id,
              actingAs,
              action: 'approve',
              from,
              to: next,
              summary: `${by.displayName} approved the trip${actingAs === 'deputy' ? ` (as deputy for ${resolved!.approver.displayName})` : ''}`,
            })
            break
          }
          case 'decline': {
            const by = event.by ? user(event.by) : resolved!.approver
            record.approval = {
              at: when,
              byId: by.id,
              actingAs: 'approver',
              autoApproval: null,
              comment: null,
            }
            record.declinedAt = when
            record.declineReason = event.reason
            decisionAt = when
            audit({
              at: when,
              actorId: by.id,
              actingAs: 'approver',
              action: 'decline',
              from,
              to: next,
              reason: event.reason,
              summary: `${by.displayName} declined the trip`,
            })
            break
          }
          case 'withdraw': {
            const by = user(event.by ?? spec.traveller)
            record.cancelledAt = when
            record.cancellationReason = event.reason ?? null
            audit({
              at: when,
              actorId: by.id,
              actingAs: by.id === traveller.id ? 'self' : 'requester',
              action: 'withdraw',
              from,
              to: next,
              reason: event.reason ?? null,
              summary: `${by.displayName} withdrew the request`,
            })
            break
          }
          case 'book': {
            record.booking = {
              bookingNumber: event.bookingNumber,
              pin: event.pin ?? null,
              comment: event.comment ?? null,
              bookedById: tom.id,
              bookedAt: when,
            }
            bookedAt = when
            seedAttachment(db, {
              id: ctx.uuid(),
              originalName: `booking-confirmation-${event.bookingNumber}.pdf`,
              purpose: 'travel_booking_confirmation',
              uploadedById: tom.id,
              entityType: 'travel_booking',
              entityId: record.id,
              createdAt: when,
            })
            audit({
              at: when,
              actorId: tom.id,
              actingAs: 'back_office',
              action: 'book',
              from,
              to: next,
              summary: `${tom.displayName} booked the trip (back office)`,
            })
            break
          }
          case 'mark_booking_impossible':
            record.bookingImpossibleReason = event.reason
            impossibleAt = when
            audit({
              at: when,
              actorId: tom.id,
              actingAs: 'back_office',
              action: 'mark_booking_impossible',
              from,
              to: next,
              reason: event.reason,
              summary: `${tom.displayName} marked the booking as impossible (back office)`,
            })
            break
          case 'request_cancellation': {
            const by = user(event.by ?? spec.traveller)
            record.statusBeforeCancellation = from === 'booked' ? 'booked' : 'to_book'
            record.cancellationRequestedAt = when
            record.cancellationReason = event.reason
            audit({
              at: when,
              actorId: by.id,
              actingAs: by.id === traveller.id ? 'self' : 'requester',
              action: 'request_cancellation',
              from,
              to: next,
              reason: event.reason,
              summary: `${by.displayName} requested cancellation`,
            })
            break
          }
          case 'confirm_cancellation':
            record.cancelledAt = when
            audit({
              at: when,
              actorId: tom.id,
              actingAs: 'back_office',
              action: 'confirm_cancellation',
              from,
              to: next,
              summary: `${tom.displayName} confirmed the cancellation (back office)`,
            })
            break
          case 'close':
            record.cancelledAt = when
            record.cancellationReason = event.reason
            record.bookingImpossibleReason = null
            audit({
              at: when,
              actorId: tom.id,
              actingAs: 'back_office',
              action: 'close',
              from,
              to: next,
              reason: event.reason,
              summary: `${tom.displayName} closed the request (back office)`,
            })
            break
        }
        status = next
        record.updatedAt = when
      }
      if (status !== spec.status) {
        throw new Error(`[travel seed] ${reference} ended in ${status}, expected ${spec.status}`)
      }
      record.status = status
      db.travelRequests.insert(record)

      // In-app notifications of the story records (SPEC_RESOLUTIONS #7).
      for (const note of spec.inApp ?? []) {
        const recipient = user(note.to)
        const approverName = resolved?.approver.displayName ?? ''
        const kind = spec.kind
        const when =
          note.kind === 'approved' || note.kind === 'declined'
            ? decisionAt!
            : note.kind === 'booked'
              ? bookedAt!
              : note.kind === 'booking_impossible'
                ? impossibleAt!
                : createdAt
        const tripDates = tripWhen(record.startsAt, record.endsAt)
        const content = {
          approval_requested: {
            title: `Travel approval needed: ${traveller.displayName} – ${kind} ${record.route}`,
            body: `${traveller.displayName} asks for a ${kind} trip ${record.route} (${tripDates}). Needs approval because: ${reasons.map((r) => APPROVAL_REASON_LABELS[r]).join(', ')}.`,
            link: `/travel/approvals?tab=approvals&selected=${record.id}`,
            high: isHighPriority('pending_approval', record.startsAt, new Date(createdAt)),
          },
          submitted_to_desk: {
            title: `To book: ${kind} ${record.route} for ${traveller.displayName}`,
            body: `The ${kind} trip ${record.route} (${tripDates}) needs no approval${exempt ? ' (Executive travellers approve their own trips)' : ''} and goes straight to the travel desk.`,
            link: `/travel/requests/${record.id}`,
            high: isHighPriority('to_book', record.startsAt, new Date(createdAt)),
          },
          approved: {
            title: `Approved – to book: ${kind} ${record.route}`,
            body: `${approverName} approved the ${kind} trip ${record.route} for ${traveller.displayName}. The travel desk books it next.`,
            link: `/travel/requests/${record.id}`,
            high: isHighPriority('to_book', record.startsAt, new Date(when)),
          },
          declined: {
            title: `Travel request declined: ${record.route}`,
            body: `${approverName} declined the ${kind} trip ${record.route}: ${record.declineReason ?? ''}`,
            link: `/travel/requests/${record.id}`,
            high: false,
          },
          booked: {
            title: `Booked: ${kind} ${record.route}`,
            body: `The ${kind} trip ${record.route} is booked. Booking number ${record.booking?.bookingNumber ?? ''}.${record.booking?.pin ? ' The PIN is available in Atrium.' : ''}`,
            link: `/travel/requests/${record.id}`,
            high: false,
          },
          booking_impossible: {
            title: `Booking not possible: ${record.route}`,
            body: `The travel desk could not book ${record.route}: ${record.bookingImpossibleReason ?? ''}`,
            link: `/travel/requests/${record.id}`,
            high: false,
          },
        }[note.kind]
        db.notifications.insert({
          id: ctx.uuid(),
          userId: recipient.id,
          templateId: NOTIFICATION_TEMPLATES[note.kind],
          module: 'travel',
          title: content.title.slice(0, 140),
          body: content.body.slice(0, 500),
          link: content.link,
          priority: content.high ? 'high' : 'normal',
          readAt: note.read
            ? new Date(
                Math.min(new Date(when).getTime() + 3 * 3_600_000, now.getTime()),
              ).toISOString()
            : null,
          createdAt: when,
        })
      }
    }
  },
})

function birthDate(ctx: SeedContext): string {
  const year = ctx.faker.number.int({ min: 1966, max: 1998 })
  const month = ctx.faker.number.int({ min: 1, max: 12 })
  const day = ctx.faker.number.int({ min: 1, max: 28 })
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

interface DetailContext {
  at: (a: At) => string
  classes: Map<string, { id: string; isDefault: boolean }>
  traveller: MockUser
  user: (handle: string) => MockUser
  birthDate: () => string
}

const copyAddress = (seed: AddressSeed) => ({ ...seed })

function buildDetail(spec: TripSpec, ctx: DetailContext) {
  if (spec.kind === 'car') {
    const car = spec.car!
    const cls = ctx.classes.get(car.classCode)!
    const handoverAddress = typeof car.handover === 'string' ? null : copyAddress(car.handover)
    const dropOff = car.dropOff ?? car.handover
    const dropOffAddress = typeof dropOff === 'string' ? null : copyAddress(dropOff)
    const equipment = {
      estate: false,
      navigation: false,
      automaticPreferred: false,
      automaticRequired: false,
      diesel: false,
      winterTyres: false,
      foreignTravel: false,
      childSeat: false,
      ...car.equipment,
    }
    const handoverMode = handoverAddress ? ('delivery' as const) : ('branch' as const)
    const dropOffMode = dropOffAddress ? ('collection' as const) : ('branch' as const)
    const startsAt = ctx.at(car.pickup)
    const endsAt = ctx.at(car.ret)
    return {
      startsAt,
      endsAt,
      route: buildRoute({
        kind: 'car',
        car: {
          handoverMode,
          handoverBranch: typeof car.handover === 'string' ? car.handover : null,
          handoverCity: handoverAddress?.city ?? null,
          destination: car.destination,
        },
      }),
      ruleInput: {
        kind: 'car' as const,
        car: { classIsDefault: cls.isDefault, equipment, handoverMode, dropOffMode },
      },
      car: {
        vehicleType: car.vehicleType ?? 'car',
        carClassId: cls.id,
        pickupAt: startsAt,
        returnAt: endsAt,
        destination: car.destination,
        equipment,
        foreignCountries: car.countries ?? [],
        expectedKmPerDay: car.km ?? null,
        minPayloadKg: car.payloadKg ?? null,
        handover: {
          mode: handoverMode,
          branch: typeof car.handover === 'string' ? car.handover : null,
          address: handoverAddress,
        },
        dropOff: {
          mode: dropOffMode,
          branch: typeof dropOff === 'string' ? dropOff : null,
          address: dropOffAddress,
        },
        driver: {
          firstName: ctx.traveller.firstName,
          lastName: ctx.traveller.lastName,
          email: ctx.traveller.email,
          phone: ctx.traveller.phone ?? '555-0100',
          birthDate: ctx.birthDate(),
          licenceNumber: null,
          additionalDrivers: null,
        },
        specialEquipmentReason: car.reason ?? null,
      },
      train: null,
      flight: null,
    }
  }
  if (spec.kind === 'train') {
    const train = spec.train!
    const outboundAt = ctx.at(train.out)
    const returnAt = train.ret ? ctx.at(train.ret) : null
    return {
      startsAt: outboundAt,
      endsAt: returnAt,
      route: buildRoute({
        kind: 'train',
        train: { fromStation: train.from, viaStation: train.via, toStation: train.to },
      }),
      ruleInput: {
        kind: 'train' as const,
        train: { fareType: train.fare, separateTickets: train.separate ?? false },
      },
      car: null,
      train: {
        tripType: train.trip,
        outboundAt,
        returnAt,
        fromStation: train.from,
        viaStation: train.via ?? null,
        toStation: train.to,
        fareType: train.fare,
        seatReservations: train.seats ?? 0,
        separateTickets: train.separate ?? false,
        localTransportTicket: train.local ?? false,
        companionIds: (train.companions ?? []).map((handle) => ctx.user(handle).id),
        notes: train.notes ?? null,
      },
      flight: null,
    }
  }
  const flight = spec.flight!
  const outboundAt = ctx.at(flight.out)
  const returnAt = flight.ret ? ctx.at(flight.ret) : null
  return {
    startsAt: outboundAt,
    endsAt: returnAt,
    route: buildRoute({
      kind: 'flight',
      flight: { outboundFrom: flight.from, outboundTo: flight.to },
    }),
    ruleInput: { kind: 'flight' as const },
    car: null,
    train: null,
    flight: {
      tripType: flight.trip,
      outboundDepartureAt: outboundAt,
      outboundFrom: flight.from,
      outboundTo: flight.to,
      returnDepartureAt: returnAt,
      returnFrom: flight.trip === 'return' ? flight.to : null,
      returnTo: flight.trip === 'return' ? flight.from : null,
      handLuggageOnly: flight.handLuggage ?? false,
      notes: flight.notes ?? null,
    },
  }
}
