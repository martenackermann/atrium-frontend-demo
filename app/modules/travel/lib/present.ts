/**
 * Presentation helpers for travel requests: human titles ("Car rental to Westbay"), the
 * approval chip text, the routing slip stops (DESIGN §1 "routing slip") and fact lines.
 */
import { Check, CircleX, Stamp, TicketCheck } from '@lucide/vue'
import type { RouteStop } from '~/types/ui'
import { formatDateRange, formatDateTime } from '~/utils/format'
import { countryName, KIND_META } from '../constants'
import type { TravelRequestDetail, TravelRequestSummary, TravelStatus } from '../api/types'

/** Last word of a station/airport name: "Westbay Central" → "Westbay". */
export function placeOf(name: string | null | undefined): string {
  if (!name) return ''
  return name.replace(/\s+(Central|Airport|branch|Branch)$/, '').trim()
}

/** Destination of the route string (last stop). */
export function destinationOf(route: string): string {
  const parts = route.split('→').map((part) => part.trim())
  return placeOf(parts[parts.length - 1] ?? route)
}

/** "Car rental to Westbay", "Train journey to Hillford", "Flight to Northport". */
export function requestTitle(request: Pick<TravelRequestSummary, 'kind' | 'route'>): string {
  const destination = destinationOf(request.route)
  return destination
    ? `${KIND_META[request.kind].noun} to ${destination}`
    : KIND_META[request.kind].noun
}

/** Approval chip in lists (SCREENS §5.1). */
export function approvalChip(
  request: Pick<TravelRequestSummary, 'needsApproval' | 'approvalReasons' | 'approvalExemption'> &
    Partial<Pick<TravelRequestSummary, 'status'>>,
): {
  label: string
  tone: 'waiting' | 'positive' | 'neutral'
  decided: boolean
} {
  if (request.approvalExemption)
    return { label: 'Executive exemption', tone: 'neutral', decided: false }
  if (!request.needsApproval)
    return { label: 'No approval needed', tone: 'positive', decided: false }
  const n = request.approvalReasons.length
  const reasons = `${n} reason${n === 1 ? '' : 's'}`
  // After the decision the chip says so (desk queues show approved trips).
  if (request.status && APPROVED_STATUSES.has(request.status))
    return { label: `Approved · ${reasons}`, tone: 'positive', decided: true }
  // Declined, or cancelled/withdrawn before a decision: the reasons are history now.
  if (request.status === 'declined' || request.status === 'cancelled')
    return { label: `Needed approval · ${reasons}`, tone: 'neutral', decided: true }
  return { label: `Needs approval · ${reasons}`, tone: 'waiting', decided: false }
}

const APPROVED_STATUSES = new Set<TravelStatus>([
  'to_book',
  'booked',
  'booking_impossible',
  'cancellation_requested',
])

/** "Tue 21 Oct, 08:00 → Wed 22 Oct, 18:00" or a one-way start. */
export function tripWhen(startsAt: string, endsAt: string | null): string {
  return endsAt
    ? `${formatDateTime(startsAt)} → ${formatDateTime(endsAt)}`
    : formatDateTime(startsAt)
}

/** "21–23 Oct" style short range for list rows. */
export function tripDates(startsAt: string, endsAt: string | null): string {
  return formatDateRange(startsAt, endsAt, { weekday: true })
}

/** One line of the main choices: "Economy ECMR · automatic guaranteed · Netherlands". */
export function mainChoices(detail: TravelRequestDetail): string {
  if (detail.car) {
    const car = detail.car
    const gearbox = car.equipment.automaticRequired
      ? 'automatic guaranteed'
      : car.equipment.automaticPreferred
        ? 'automatic preferred'
        : 'manual'
    const extras = [
      car.equipment.estate && 'estate',
      car.equipment.diesel && 'diesel',
      car.equipment.navigation && 'navigation',
      car.equipment.winterTyres && 'winter tyres',
      car.equipment.childSeat && 'child seat',
    ].filter(Boolean)
    const abroad = car.foreignCountries.length
      ? `abroad: ${car.foreignCountries.map(countryName).join(', ')}`
      : null
    return [`${car.carClass.name} ${car.carClass.code}`, gearbox, ...extras, abroad]
      .filter(Boolean)
      .join(' · ')
  }
  if (detail.train) {
    const t = detail.train
    return [
      t.fareType === 'saver' ? 'Saver fare' : 'Flex fare',
      t.tripType === 'return' ? 'return' : 'one way',
      t.seatReservations
        ? `${t.seatReservations} seat${t.seatReservations === 1 ? '' : 's'}`
        : null,
      t.separateTickets ? 'separate tickets' : null,
      t.companions.length
        ? `+${t.companions.length} colleague${t.companions.length === 1 ? '' : 's'}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ')
  }
  if (detail.flight) {
    const f = detail.flight
    return [
      f.tripType === 'return' ? 'Return' : 'One way',
      f.handLuggageOnly ? 'hand luggage only' : null,
    ]
      .filter(Boolean)
      .join(' · ')
  }
  return ''
}

/**
 * The route of a request as routing-slip stops (DESIGN §1/§8.3): Submitted → (skipped site
 * manager) → Approval → Booking → Booked, with the current stop in the viewer's tone.
 */
export function routeStops(detail: TravelRequestDetail): RouteStop[] {
  const stops: RouteStop[] = [
    {
      step: 'Submitted',
      who: detail.requester.displayName,
      initials: detail.requester.initials,
      when: formatDateTime(detail.createdAt),
      state: 'done',
    },
  ]
  const actions = detail.availableActions
  if (detail.needsApproval && detail.approver) {
    if (detail.escalatedFrom) {
      stops.push({
        step: 'Site manager',
        who: `${detail.escalatedFrom.displayName} (skipped)`,
        initials: detail.escalatedFrom.initials,
        state: 'skipped',
      })
    }
    const decided = detail.approval
    const declined = detail.status === 'declined'
    const pending = detail.status === 'pending_approval'
    stops.push({
      step: actions.includes('approve') ? 'Your approval' : 'Approval',
      who: decided?.by?.displayName ?? detail.approver.displayName,
      initials: decided?.by?.initials ?? detail.approver.initials,
      icon: decided?.autoApproval ? Check : undefined,
      when: decided
        ? `${declined ? 'Declined' : decided.autoApproval ? 'Approved automatically' : 'Approved'} ${formatDateTime(decided.at)}`
        : pending
          ? `Waiting since ${formatDateTime(detail.createdAt)}`
          : undefined,
      state: declined
        ? 'stopped'
        : pending
          ? 'current'
          : detail.status === 'cancelled' && !decided
            ? 'skipped'
            : 'done',
      tone: pending ? (actions.includes('approve') ? 'you' : 'waiting') : undefined,
    })
  }
  if (detail.status === 'declined') return stops

  const booked = Boolean(detail.booking)
  const bookingState: RouteStop['state'] =
    detail.status === 'booking_impossible'
      ? 'stopped'
      : booked
        ? 'done'
        : detail.status === 'to_book'
          ? 'current'
          : detail.status === 'cancelled' || detail.status === 'cancellation_requested'
            ? 'skipped'
            : 'future'
  stops.push({
    step: 'Booking',
    who: detail.booking?.bookedBy.displayName ?? 'Travel desk',
    initials: detail.booking?.bookedBy.initials ?? 'TD',
    when: booked
      ? `Booked ${formatDateTime(detail.booking!.bookedAt)}`
      : detail.status === 'booking_impossible'
        ? 'Booking not possible'
        : 'Books and stores the PIN',
    state: bookingState,
    tone: bookingState === 'current' ? (actions.includes('book') ? 'you' : 'moving') : undefined,
  })

  if (detail.status === 'cancellation_requested') {
    stops.push({
      step: 'Cancellation',
      who: 'Travel desk',
      icon: CircleX,
      when: detail.cancellationRequestedAt
        ? `Requested ${formatDateTime(detail.cancellationRequestedAt)}`
        : undefined,
      state: 'current',
      tone: actions.includes('confirm_cancellation') ? 'you' : 'waiting',
    })
  } else if (detail.status === 'cancelled') {
    stops.push({
      step: 'Cancelled',
      icon: CircleX,
      when: detail.cancelledAt ? formatDateTime(detail.cancelledAt) : undefined,
      state: 'stopped',
    })
  } else {
    stops.push({
      step: 'Booked',
      icon: TicketCheck,
      when: booked ? 'Confirmation emailed' : 'Confirmation by email',
      state: booked ? 'done' : 'future',
    })
  }
  return stops
}

/** "With Max Manager since 08:41" summary line for compact slips. */
export function whereNow(
  detail: Pick<TravelRequestSummary, 'status' | 'approver' | 'availableActions'>,
): string {
  switch (detail.status) {
    case 'pending_approval':
      return detail.availableActions.includes('approve')
        ? 'Waiting for your approval'
        : `With ${detail.approver?.displayName ?? 'the approver'}`
    case 'to_book':
      return 'With the travel desk'
    case 'booked':
      return 'Booked'
    case 'booking_impossible':
      return 'Booking not possible'
    case 'cancellation_requested':
      return 'Cancellation with the travel desk'
    case 'declined':
      return 'Declined'
    case 'cancelled':
      return 'Cancelled'
  }
}

/** The approval route for the stepper slip: You submit → approver approves → Travel desk books. */
export function plannedStops(input: {
  requester: { displayName: string; initials: string }
  approver: { displayName: string; initials: string } | null
  needsApproval: boolean
  autoApproved: boolean
  exempt: boolean
}): RouteStop[] {
  const stops: RouteStop[] = [
    {
      step: 'You submit',
      who: 'After the Review step',
      initials: input.requester.initials,
      state: 'current',
      tone: 'you',
    },
  ]
  if (input.needsApproval && input.approver) {
    stops.push({
      step: input.autoApproved
        ? 'Approved automatically'
        : `${input.approver.displayName} approves`,
      who: input.autoApproved
        ? 'You are the approver'
        : 'You can pick someone else on Costs & approval',
      initials: input.approver.initials,
      state: 'future',
    })
  } else {
    stops.push({
      step: input.exempt ? 'No approval (executive)' : 'No approval needed',
      who: 'Goes straight to the travel desk',
      icon: Stamp,
      state: 'skipped',
    })
  }
  stops.push({
    step: 'Travel desk books',
    who: 'Booking number by email, PIN in Atrium',
    initials: 'TD',
    state: 'future',
  })
  return stops
}
