/**
 * Travel business rules shared by the mock API and the UI — a straight port of the backend's
 * `domain/travel-rules.ts` (SPEC §6.3 reasons, SPEC_RESOLUTIONS #9 route string, §5.2 high
 * priority), so the offline demo never disagrees with the server (DESIGN §12).
 * Pure: no imports from ~/mocks/db (seed-safe).
 */
import type { ApprovalReasonCode } from '~/types/api'
import type { TravelKind, TravelStatus } from '../api/types'

export const APPROVAL_REASON_ORDER: readonly ApprovalReasonCode[] = [
  'vehicle_class_upgrade',
  'car_estate',
  'car_automatic_preferred',
  'car_automatic_required',
  'car_diesel',
  'car_foreign_travel',
  'car_delivery',
  'car_collection',
  'train_saver_fare',
  'train_separate_tickets',
  'flight',
]

export const APPROVAL_REASON_LABELS: Record<ApprovalReasonCode, string> = {
  vehicle_class_upgrade: 'Vehicle class above standard',
  car_estate: 'Estate car',
  car_automatic_preferred: 'Automatic transmission (preferred)',
  car_automatic_required: 'Automatic transmission (guaranteed)',
  car_diesel: 'Diesel engine',
  car_foreign_travel: 'Foreign travel',
  car_delivery: 'Delivery to an address',
  car_collection: 'Collection from an address',
  train_saver_fare: 'Saver fare (non-refundable)',
  train_separate_tickets: 'Separate tickets per traveller',
  flight: 'Flights always need approval',
}

export const EXEMPTION_LABEL = 'Executive travellers approve their own trips'

const CAR_REASONS = new Set<ApprovalReasonCode>(APPROVAL_REASON_ORDER.slice(0, 8))

export interface ApprovalRuleInput {
  kind: TravelKind
  car?: {
    classIsDefault?: boolean | null
    equipment?: {
      estate?: boolean | null
      automaticPreferred?: boolean | null
      automaticRequired?: boolean | null
      diesel?: boolean | null
      foreignTravel?: boolean | null
    } | null
    handoverMode?: string | null
    dropOffMode?: string | null
  } | null
  train?: { fareType?: string | null; separateTickets?: boolean | null } | null
}

/** Every matching reason in SPEC §6.3 order; partial input simply adds fewer reasons. */
export function evaluateApprovalReasons(input: ApprovalRuleInput): ApprovalReasonCode[] {
  const found = new Set<ApprovalReasonCode>()
  if (input.kind === 'car' && input.car) {
    const eq = input.car.equipment ?? {}
    if (input.car.classIsDefault === false) found.add('vehicle_class_upgrade')
    if (eq.estate) found.add('car_estate')
    if (eq.automaticPreferred && !eq.automaticRequired) found.add('car_automatic_preferred')
    if (eq.automaticRequired) found.add('car_automatic_required')
    if (eq.diesel) found.add('car_diesel')
    if (eq.foreignTravel) found.add('car_foreign_travel')
    if (input.car.handoverMode === 'delivery') found.add('car_delivery')
    if (input.car.dropOffMode === 'collection') found.add('car_collection')
  }
  if (input.kind === 'train' && input.train) {
    if (input.train.fareType === 'saver') found.add('train_saver_fare')
    if (input.train.separateTickets) found.add('train_separate_tickets')
  }
  if (input.kind === 'flight') found.add('flight')
  return APPROVAL_REASON_ORDER.filter((code) => found.has(code))
}

/** A car request needs a special-equipment reason (≥ 10 characters) when a car reason applies. */
export function specialEquipmentReasonRequired(reasons: readonly ApprovalReasonCode[]): boolean {
  return reasons.some((code) => CAR_REASONS.has(code))
}

const ARROW = ' → '

/** SPEC_RESOLUTIONS #9: car "{branch/city} → {destination}", train "{from} → {via} → {to}", flight "{from} → {to}". */
export function buildRoute(input: {
  kind: TravelKind
  car?: {
    handoverMode?: string | null
    handoverBranch?: string | null
    handoverCity?: string | null
    destination?: string | null
  } | null
  train?: {
    fromStation?: string | null
    viaStation?: string | null
    toStation?: string | null
  } | null
  flight?: { outboundFrom?: string | null; outboundTo?: string | null } | null
}): string {
  const join = (parts: Array<string | null | undefined>) =>
    parts
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(ARROW)
  if (input.kind === 'car') {
    const car = input.car ?? {}
    const origin = car.handoverMode === 'delivery' ? car.handoverCity : car.handoverBranch
    return join([origin, car.destination])
  }
  if (input.kind === 'train') {
    const train = input.train ?? {}
    return join([train.fromStation, train.viaStation, train.toStation])
  }
  return join([input.flight?.outboundFrom, input.flight?.outboundTo])
}

const DAY_MS = 86_400_000

/** SPEC §5.2 + #11: pending/to-book trips starting within `days` days — future starts only. */
export function isHighPriority(
  status: TravelStatus,
  startsAt: string | Date,
  now: Date,
  days = 3,
): boolean {
  if (status !== 'pending_approval' && status !== 'to_book') return false
  const start = new Date(startsAt).getTime()
  return start > now.getTime() && start <= now.getTime() + days * DAY_MS
}

/** Driver ≥ 18 years at pickup (IsoDates). */
export function isAdultOn(birthDate: string, onDate: string): boolean {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number]
  const [y, m, d] = onDate.split('-').map(Number) as [number, number, number]
  let age = y - by
  if (m < bm || (m === bm && d < bd)) age--
  return age >= 18
}

export const travelReference = (number: number) => `TRV-${String(number).padStart(6, '0')}`
