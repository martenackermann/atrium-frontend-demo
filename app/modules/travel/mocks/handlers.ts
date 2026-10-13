import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { recordAudit } from '~/mocks/core/audit'
import { resolveApprover } from '~/mocks/core/org'
import type { MockUser } from '~/mocks/core/types'
import { db } from '~/mocks/db'
import { defineMockHandlers } from '~/mocks/define'
import {
  conflict,
  created,
  forbidden,
  notFound,
  ok,
  param,
  readJson,
  requireUser,
  validationProblem,
} from '~/mocks/http'
import { csv, listResponse } from '~/mocks/list'
import type { CarRentalClassDto, TravelKind } from '../api/types'
import {
  APPROVAL_REASON_LABELS,
  buildRoute,
  evaluateApprovalReasons,
  EXEMPTION_LABEL,
  isAdultOn,
  isHighPriority,
  specialEquipmentReasonRequired,
  travelReference,
} from '../lib/rules'
import {
  canViewPin,
  chainFor,
  dayOf,
  HIGH_PRIORITY_DAYS,
  inScope,
  isDesk,
  mayCreateFor,
  seesAll,
  timelineOf,
  toDetail,
  toSummary,
  type TravelScope,
  visible,
} from './logic'
import type { TravelRequestRecord } from './types'
import { notify, notifyApprovalRequested, travelWorkflow } from './workflow'

/**
 * Travel API for demo mode (API.md §5): lists with scopes, preview, create, detail, actions,
 * PIN, timeline, export and the car-class catalogue — same DTOs, errors and availableActions as
 * the backend. Static paths come before `/:id` (SPEC_RESOLUTIONS #30).
 */
const actionsOf = (row: TravelRequestRecord, user: MockUser) =>
  travelWorkflow.availableActions(row, user) as ReturnType<typeof toSummary>['availableActions']
const summaryOf = (row: TravelRequestRecord, user: MockUser) =>
  toSummary(row, user, actionsOf(row, user))
const detailOf = (row: TravelRequestRecord, user: MockUser) =>
  toDetail(row, user, actionsOf(row, user))

const SCOPES = ['mine', 'approvals', 'deputy', 'team', 'all'] as const

function filterRows(
  user: MockUser,
  params: URLSearchParams,
  scope: TravelScope,
): TravelRequestRecord[] {
  const now = new Date()
  const q = params.get('q')?.trim().toLowerCase() ?? ''
  const reference = /^trv-(\d{1,9})$/i.exec(q)?.[1]
  const from = params.get('from')
  const to = params.get('to')
  return db.travelRequests.where((row) => {
    if (!visible(row.id, user) || !inScope(row, user, scope)) return false
    if (reference) return row.number === Number(reference)
    if (q) {
      const traveller = db.users.find(row.travellerId)?.displayName ?? ''
      if (!`${row.route} ${traveller}`.toLowerCase().includes(q)) return false
    }
    if (from && dayOf(row.startsAt) < from) return false
    if (to && dayOf(row.startsAt) > to) return false
    if (
      params.get('highPriority') === 'true' &&
      !isHighPriority(row.status, row.startsAt, now, HIGH_PRIORITY_DAYS)
    ) {
      return false
    }
    return true
  })
}

// ------------------------------------------------------------------------------------------------
// Create / preview bodies (API.md §5.3 + #9 destination); preview is lenient (#3).
// ------------------------------------------------------------------------------------------------
const text = (max: number) => z.string().trim().min(1, 'Fill this in.').max(max)
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null)
const isoDateTime = z.string().datetime({ message: 'Choose a date and time.' })
const address = z.object({
  street: text(120),
  houseNumber: text(20),
  postalCode: text(12),
  city: text(80),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Use a two-letter country code.'),
})
const equipment = z.object({
  estate: z.boolean(),
  navigation: z.boolean(),
  automaticPreferred: z.boolean(),
  automaticRequired: z.boolean(),
  diesel: z.boolean(),
  winterTyres: z.boolean(),
  foreignTravel: z.boolean(),
  childSeat: z.boolean(),
})
const base = {
  travellerId: z.string().uuid('Choose the traveller.'),
  approverId: z.string().nullish(),
  costCenterId: z.string().nullish(),
  costCenterReason: optionalText(500),
  recharge: z.object({ customer: text(120), projectNumber: text(120) }).nullish(),
  comment: optionalText(2000),
}
const createSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('car'),
    ...base,
    car: z.object({
      vehicleType: z.enum(['car', 'van']),
      carClassId: z.string().min(1, 'Choose a class.'),
      pickupAt: isoDateTime,
      returnAt: isoDateTime,
      destination: text(120),
      equipment,
      foreignCountries: z.array(z.string()).max(20).default([]),
      expectedKmPerDay: z.number().int().min(0).max(5000).nullish(),
      minPayloadKg: z.number().int().min(0).max(20000).nullish(),
      handover: z.object({
        mode: z.enum(['branch', 'delivery']),
        branch: optionalText(120),
        address: address.nullish(),
      }),
      dropOff: z.object({
        mode: z.enum(['branch', 'collection']),
        branch: optionalText(120),
        address: address.nullish(),
      }),
      driver: z.object({
        firstName: text(80),
        lastName: text(80),
        email: z.string().email('Enter a valid email address.'),
        phone: z.string().trim().min(3, 'Enter a phone number.').max(40),
        birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the birth date.'),
        licenceNumber: optionalText(40),
        additionalDrivers: optionalText(500),
      }),
      specialEquipmentReason: optionalText(1000),
    }),
  }),
  z.object({
    kind: z.literal('train'),
    ...base,
    train: z.object({
      tripType: z.enum(['one_way', 'return']),
      outboundAt: isoDateTime,
      returnAt: isoDateTime.nullish(),
      fromStation: text(120),
      viaStation: optionalText(120),
      toStation: text(120),
      fareType: z.enum(['saver', 'flex']),
      seatReservations: z.number().int().min(0).max(6),
      separateTickets: z.boolean(),
      localTransportTicket: z.boolean(),
      companionIds: z.array(z.string()).max(5).default([]),
      notes: optionalText(2000),
    }),
  }),
  z.object({
    kind: z.literal('flight'),
    ...base,
    flight: z.object({
      tripType: z.enum(['one_way', 'return']),
      outboundDepartureAt: isoDateTime,
      outboundFrom: text(120),
      outboundTo: text(120),
      returnDepartureAt: isoDateTime.nullish(),
      returnFrom: optionalText(120),
      returnTo: optionalText(120),
      handLuggageOnly: z.boolean(),
      notes: optionalText(2000),
    }),
  }),
])
type CreateBody = z.infer<typeof createSchema>

interface PreviewBody {
  kind?: TravelKind
  travellerId?: string
  approverId?: string | null
  car?: {
    carClassId?: string | null
    pickupAt?: string | null
    equipment?: Record<string, boolean | null> | null
    handover?: { mode?: string | null } | null
    dropOff?: { mode?: string | null } | null
  } | null
  train?: {
    outboundAt?: string | null
    fareType?: string | null
    separateTickets?: boolean | null
  } | null
  flight?: { outboundDepartureAt?: string | null } | null
}

function reasonsFor(kind: TravelKind, body: PreviewBody) {
  const cls = body.car?.carClassId ? db.carRentalClasses.find(body.car.carClassId) : undefined
  return evaluateApprovalReasons({
    kind,
    car: body.car
      ? {
          classIsDefault: cls ? cls.isDefault : null,
          equipment: body.car.equipment ?? null,
          handoverMode: body.car.handover?.mode ?? null,
          dropOffMode: body.car.dropOff?.mode ?? null,
        }
      : null,
    train: body.train ?? null,
  })
}

function preview(user: MockUser, body: PreviewBody) {
  const errors: Record<string, string> = {}
  if (!body.kind || !['car', 'train', 'flight'].includes(body.kind)) {
    errors.kind = 'Choose car, train or flight.'
  }
  const traveller = body.travellerId ? db.users.find(body.travellerId) : undefined
  if (!traveller?.active) errors.travellerId = 'Choose an active colleague.'
  else if (!mayCreateFor(user, traveller.id)) {
    errors.travellerId = 'You can only request for yourself or your team'
  }
  if (Object.keys(errors).length || !traveller || !body.kind) throw validationProblem(errors)
  const kind = body.kind
  const exempt = traveller.roles.includes('executive')
  const reasons = exempt ? [] : reasonsFor(kind, body)
  const needsApproval = reasons.length > 0
  const chain = chainFor(traveller, user)
  const chosen =
    body.approverId && chain.candidates.some((c) => c.user.id === body.approverId && c.selectable)
      ? body.approverId
      : chain.defaultId
  const autoApproval =
    needsApproval && chosen === user.id ? ('requester_is_approver' as const) : null
  const start =
    kind === 'car'
      ? body.car?.pickupAt
      : kind === 'train'
        ? body.train?.outboundAt
        : body.flight?.outboundDepartureAt
  const validStart = start && !Number.isNaN(new Date(start).getTime()) ? start : null
  return {
    needsApproval,
    reasons: reasons.map((code) => ({ code, label: APPROVAL_REASON_LABELS[code] })),
    exemption: exempt ? { code: 'executive_traveller' as const, label: EXEMPTION_LABEL } : null,
    approverCandidates: chain.candidates,
    defaultApproverId: chain.defaultId,
    autoApproval,
    isHighPriority: validStart
      ? isHighPriority(
          needsApproval && !autoApproval ? 'pending_approval' : 'to_book',
          validStart,
          new Date(),
          HIGH_PRIORITY_DAYS,
        )
      : false,
    specialEquipmentReasonRequired: kind === 'car' && specialEquipmentReasonRequired(reasons),
  }
}

interface KindPlan {
  startsAt: string
  endsAt: string | null
  route: string
  reasons: ReturnType<typeof evaluateApprovalReasons>
  car: TravelRequestRecord['car']
  train: TravelRequestRecord['train']
  flight: TravelRequestRecord['flight']
}

function planCar(
  body: Extract<CreateBody, { kind: 'car' }>,
  backOffice: boolean,
  add: (field: string, message: string) => void,
): KindPlan {
  const c = body.car
  const now = new Date()
  const cls = db.carRentalClasses.find(c.carClassId)
  if (!cls?.active) add('car.carClassId', 'Choose an active car class.')
  else if (cls.vehicleType !== c.vehicleType) {
    add('car.carClassId', 'The class does not fit the vehicle type.')
  }
  if (!backOffice && new Date(c.pickupAt) <= now)
    add('car.pickupAt', 'The pickup must be in the future.')
  if (new Date(c.returnAt) <= new Date(c.pickupAt)) {
    add('car.returnAt', 'The return must be after the pickup.')
  }
  if (c.equipment.foreignTravel && c.foreignCountries.length === 0) {
    add('car.foreignCountries', 'Choose at least one country.')
  }
  if (c.vehicleType !== 'van' && c.minPayloadKg != null) {
    add('car.minPayloadKg', 'Only vans have a minimum payload.')
  }
  if (c.handover.mode === 'branch' && !c.handover.branch)
    add('car.handover.branch', 'Enter the branch.')
  if (c.handover.mode === 'delivery' && !c.handover.address) {
    add('car.handover.address', 'Enter the delivery address.')
  }
  if (c.dropOff.mode === 'branch' && !c.dropOff.branch)
    add('car.dropOff.branch', 'Enter the branch.')
  if (c.dropOff.mode === 'collection' && !c.dropOff.address) {
    add('car.dropOff.address', 'Enter the collection address.')
  }
  if (!isAdultOn(c.driver.birthDate, dayOf(c.pickupAt))) {
    add('car.driver.birthDate', 'The driver must be at least 18 years old at pickup.')
  }
  const handoverAddress = c.handover.mode === 'delivery' ? (c.handover.address ?? null) : null
  const dropOffAddress = c.dropOff.mode === 'collection' ? (c.dropOff.address ?? null) : null
  const upper = (a: typeof handoverAddress) =>
    a && { ...a, countryCode: a.countryCode.toUpperCase() }
  const startsAt = new Date(c.pickupAt).toISOString()
  const endsAt = new Date(c.returnAt).toISOString()
  return {
    startsAt,
    endsAt,
    route: buildRoute({
      kind: 'car',
      car: {
        handoverMode: c.handover.mode,
        handoverBranch: c.handover.branch,
        handoverCity: handoverAddress?.city,
        destination: c.destination,
      },
    }),
    reasons: evaluateApprovalReasons({
      kind: 'car',
      car: {
        classIsDefault: cls?.isDefault ?? true,
        equipment: c.equipment,
        handoverMode: c.handover.mode,
        dropOffMode: c.dropOff.mode,
      },
    }),
    car: {
      vehicleType: c.vehicleType,
      carClassId: c.carClassId,
      pickupAt: startsAt,
      returnAt: endsAt,
      destination: c.destination,
      equipment: c.equipment,
      foreignCountries: c.equipment.foreignTravel
        ? [...new Set(c.foreignCountries.map((x) => x.toUpperCase()))]
        : [],
      expectedKmPerDay: c.expectedKmPerDay ?? null,
      minPayloadKg: c.vehicleType === 'van' ? (c.minPayloadKg ?? null) : null,
      handover: {
        mode: c.handover.mode,
        branch: c.handover.mode === 'branch' ? c.handover.branch : null,
        address: upper(handoverAddress),
      },
      dropOff: {
        mode: c.dropOff.mode,
        branch: c.dropOff.mode === 'branch' ? c.dropOff.branch : null,
        address: upper(dropOffAddress),
      },
      driver: {
        firstName: c.driver.firstName,
        lastName: c.driver.lastName,
        email: c.driver.email.toLowerCase(),
        phone: c.driver.phone,
        birthDate: c.driver.birthDate,
        licenceNumber: c.driver.licenceNumber,
        additionalDrivers: c.driver.additionalDrivers,
      },
      specialEquipmentReason: c.specialEquipmentReason,
    },
    train: null,
    flight: null,
  }
}

function planTrain(
  body: Extract<CreateBody, { kind: 'train' }>,
  backOffice: boolean,
  add: (field: string, message: string) => void,
): KindPlan {
  const t = body.train
  if (!backOffice && new Date(t.outboundAt) <= new Date()) {
    add('train.outboundAt', 'The journey must start in the future.')
  }
  if (t.tripType === 'return') {
    if (!t.returnAt) add('train.returnAt', 'Enter the return date and time.')
    else if (new Date(t.returnAt) <= new Date(t.outboundAt)) {
      add('train.returnAt', 'The return must be after the outbound journey.')
    }
  } else if (t.returnAt) add('train.returnAt', 'A one-way journey has no return.')
  const seen = new Set<string>()
  t.companionIds.forEach((id, index) => {
    const field = `train.companionIds.${index}`
    if (id === body.travellerId) add(field, 'The traveller is already on the booking.')
    else if (seen.has(id)) add(field, 'This colleague is already listed.')
    else if (!db.users.find(id)?.active) add(field, 'Choose an active colleague.')
    seen.add(id)
  })
  const startsAt = new Date(t.outboundAt).toISOString()
  const endsAt = t.tripType === 'return' && t.returnAt ? new Date(t.returnAt).toISOString() : null
  return {
    startsAt,
    endsAt,
    route: buildRoute({ kind: 'train', train: t }),
    reasons: evaluateApprovalReasons({ kind: 'train', train: t }),
    car: null,
    train: {
      tripType: t.tripType,
      outboundAt: startsAt,
      returnAt: endsAt,
      fromStation: t.fromStation,
      viaStation: t.viaStation,
      toStation: t.toStation,
      fareType: t.fareType,
      seatReservations: t.seatReservations,
      separateTickets: t.separateTickets,
      localTransportTicket: t.localTransportTicket,
      companionIds: t.companionIds,
      notes: t.notes,
    },
    flight: null,
  }
}

function planFlight(
  body: Extract<CreateBody, { kind: 'flight' }>,
  backOffice: boolean,
  add: (field: string, message: string) => void,
): KindPlan {
  const f = body.flight
  if (!backOffice && new Date(f.outboundDepartureAt) <= new Date()) {
    add('flight.outboundDepartureAt', 'The flight must depart in the future.')
  }
  if (f.tripType === 'return') {
    if (!f.returnDepartureAt) add('flight.returnDepartureAt', 'Enter the return departure.')
    else if (new Date(f.returnDepartureAt) <= new Date(f.outboundDepartureAt)) {
      add('flight.returnDepartureAt', 'The return must be after the outbound flight.')
    }
    if (!f.returnFrom) add('flight.returnFrom', 'Enter the return departure airport.')
    if (!f.returnTo) add('flight.returnTo', 'Enter the return destination airport.')
  }
  const startsAt = new Date(f.outboundDepartureAt).toISOString()
  const endsAt =
    f.tripType === 'return' && f.returnDepartureAt
      ? new Date(f.returnDepartureAt).toISOString()
      : null
  return {
    startsAt,
    endsAt,
    route: buildRoute({ kind: 'flight', flight: f }),
    reasons: evaluateApprovalReasons({ kind: 'flight' }),
    car: null,
    train: null,
    flight: {
      tripType: f.tripType,
      outboundDepartureAt: startsAt,
      outboundFrom: f.outboundFrom,
      outboundTo: f.outboundTo,
      returnDepartureAt: endsAt,
      returnFrom: f.tripType === 'return' ? f.returnFrom : null,
      returnTo: f.tripType === 'return' ? f.returnTo : null,
      handLuggageOnly: f.handLuggageOnly,
      notes: f.notes,
    },
  }
}

const KIND_NOUN = { car: 'rental car', train: 'train journey', flight: 'flight' } as const

function createRequest(user: MockUser, body: CreateBody): TravelRequestRecord {
  const errors: Record<string, string> = {}
  const add = (field: string, message: string) => {
    errors[field] ??= message
  }
  const backOffice = seesAll(user)
  const traveller = db.users.find(body.travellerId)
  if (!traveller?.active) add('travellerId', 'Choose an active colleague.')
  else if (!mayCreateFor(user, traveller.id)) {
    add('travellerId', 'You can only request for yourself or your team')
  }
  if (body.costCenterId && !db.costCenters.find(body.costCenterId)?.active) {
    add('costCenterId', 'Choose an active cost centre.')
  }
  const costCenterId = body.costCenterId || traveller?.costCenterId || ''
  const otherCostCenter = Boolean(traveller && costCenterId !== traveller.costCenterId)
  if (otherCostCenter && !body.costCenterReason) {
    add('costCenterReason', 'Explain why another cost centre pays for this trip.')
  }

  const plan =
    body.kind === 'car'
      ? planCar(body, backOffice, add)
      : body.kind === 'train'
        ? planTrain(body, backOffice, add)
        : planFlight(body, backOffice, add)
  const exempt = Boolean(traveller?.roles.includes('executive'))
  const reasons = exempt ? [] : plan.reasons
  if (
    body.kind === 'car' &&
    specialEquipmentReasonRequired(reasons) &&
    (body.car.specialEquipmentReason ?? '').length < 10
  ) {
    add('car.specialEquipmentReason', 'Explain in at least 10 characters why you need this.')
  }
  const needsApproval = reasons.length > 0
  let approver: {
    id: string
    reason: TravelRequestRecord['approverReason']
    escalatedFromId: string | null
    selection: 'auto' | 'manual'
  } | null = null
  if (needsApproval && traveller?.active) {
    const resolved = resolveApprover(db, traveller, user)
    if (body.approverId && body.approverId !== resolved.approver.id) {
      const candidate = chainFor(traveller, user).candidates.find(
        (c) => c.user.id === body.approverId,
      )
      if (!candidate?.selectable) {
        add('approverId', "Choose an approver from the traveller's management chain.")
      } else
        approver = {
          id: candidate.user.id,
          reason: null,
          escalatedFromId: null,
          selection: 'manual',
        }
    } else {
      approver = {
        id: resolved.approver.id,
        reason: resolved.reason,
        escalatedFromId: resolved.escalatedFrom?.id ?? null,
        selection: 'auto',
      }
    }
  }
  if (Object.keys(errors).length) throw validationProblem(errors)

  const autoApproved = approver?.id === user.id
  const createdAt = new Date().toISOString()
  const number = Math.max(0, ...db.travelRequests.all().map((row) => row.number)) + 1
  const record = db.travelRequests.insert({
    number,
    kind: body.kind,
    status: needsApproval && !autoApproved ? 'pending_approval' : 'to_book',
    travellerId: body.travellerId,
    requesterId: user.id,
    approverId: approver?.id ?? null,
    approverSelection: approver?.selection ?? null,
    approverReason: approver?.reason ?? null,
    escalatedFromId: approver?.escalatedFromId ?? null,
    needsApproval,
    approvalReasons: reasons,
    approvalExemption: exempt ? 'executive_traveller' : null,
    startsAt: plan.startsAt,
    endsAt: plan.endsAt,
    route: plan.route,
    costCenterId,
    costCenterReason: otherCostCenter ? (body.costCenterReason ?? null) : null,
    recharge: body.recharge ?? null,
    comment: body.comment ?? null,
    car: plan.car,
    train: plan.train,
    flight: plan.flight,
    statusBeforeCancellation: null,
    approval: autoApproved
      ? {
          at: createdAt,
          byId: user.id,
          actingAs: 'system',
          autoApproval: 'requester_is_approver',
          comment: null,
        }
      : null,
    declinedAt: null,
    declineReason: null,
    bookingImpossibleReason: null,
    cancellationRequestedAt: null,
    cancellationReason: null,
    cancelledAt: null,
    booking: null,
    createdAt,
    updatedAt: createdAt,
    version: 1,
  })
  const reference = travelReference(record.number)
  recordAudit(db, {
    module: 'travel',
    entityType: 'travel_request',
    entityId: record.id,
    entityLabel: reference,
    action: 'create',
    actorId: user.id,
    actingAs: record.travellerId === user.id ? 'self' : isDesk(user) ? 'back_office' : 'requester',
    toState: needsApproval ? 'pending_approval' : 'to_book',
    summary: `${user.displayName} submitted the request`,
  })
  if (autoApproved) {
    recordAudit(db, {
      module: 'travel',
      entityType: 'travel_request',
      entityId: record.id,
      entityLabel: reference,
      action: 'auto_approve',
      actorId: user.id,
      actingAs: 'system',
      fromState: 'pending_approval',
      toState: 'to_book',
      reason: 'requester_is_approver',
      summary: `${user.displayName} approved automatically`,
    })
  }
  if (record.requesterId !== record.travellerId) {
    notify([record.travellerId], {
      templateId: 'travel.created_for_you',
      title: `${user.displayName} requested a ${KIND_NOUN[record.kind]} for you`,
      body: `${user.displayName} requested a ${KIND_NOUN[record.kind]} for you: ${record.route}.`,
      link: `/travel/requests/${record.id}`,
    })
  }
  if (record.status === 'pending_approval') notifyApprovalRequested(record)
  return record
}

const carClassFields = {
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}$/, 'Use a 4-letter code, e.g. ECMR'),
  name: z.string().trim().min(2, 'Enter a name.').max(80),
  description: optionalText(500),
  exampleModels: optionalText(200),
  vehicleType: z.enum(['car', 'van']),
  isDefault: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
  active: z.boolean(),
}
const createCarClassSchema = z.object({
  ...carClassFields,
  isDefault: carClassFields.isDefault.default(false),
  sortOrder: carClassFields.sortOrder.default(0),
  active: carClassFields.active.default(true),
})
const updateCarClassSchema = z.object(carClassFields).partial()

function toCsv(rows: TravelRequestRecord[]): string {
  const cell = (value: unknown) => {
    const t = value === null || value === undefined ? '' : String(value)
    return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const header = [
    'Reference',
    'Kind',
    'Status',
    'Traveller',
    'Requester',
    'Approver',
    'Route',
    'Starts',
    'Ends',
    'Needs approval',
    'Approval reasons',
    'Booking number',
    'Created',
  ]
  const lines = [
    header,
    ...rows.map((r) => [
      travelReference(r.number),
      r.kind,
      r.status,
      db.users.find(r.travellerId)?.displayName,
      db.users.find(r.requesterId)?.displayName,
      r.approverId ? db.users.find(r.approverId)?.displayName : '',
      r.route,
      r.startsAt,
      r.endsAt ?? '',
      r.needsApproval ? 'yes' : 'no',
      r.approvalReasons.map((code) => APPROVAL_REASON_LABELS[code]).join('; '),
      r.booking?.bookingNumber ?? '',
      r.createdAt,
    ]),
  ]
  return `${String.fromCharCode(0xfeff)}${lines.map((line) => line.map(cell).join(',')).join('\r\n')}\r\n`
}

export default defineMockHandlers(({ api }) => [
  http.get(api('/travel/requests/export.csv'), ({ request }) => {
    const user = requireUser(request)
    if (!seesAll(user)) throw forbidden('Only the travel desk can export requests.')
    const params = new URL(request.url).searchParams
    const kinds = csv(params, 'kind')
    const statuses = csv(params, 'status')
    const rows = filterRows(user, params, 'all')
      .filter(
        (row) =>
          (!kinds.length || kinds.includes(row.kind)) &&
          (!statuses.length || statuses.includes(row.status)),
      )
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    return new HttpResponse(toCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="travel-requests-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }),

  http.get(api('/travel/requests'), ({ request }) => {
    const user = requireUser(request)
    const params = new URL(request.url).searchParams
    const scope = (params.get('scope') ?? 'mine') as TravelScope
    if (!SCOPES.includes(scope)) throw validationProblem({ scope: 'Unknown scope.' })
    if (scope === 'all' && !seesAll(user)) {
      throw forbidden('Only the travel desk can list all requests.')
    }
    return listResponse(filterRows(user, params, scope), request, {
      filters: { kind: 'kind', status: 'status' },
      sort: { startsAt: 'startsAt', createdAt: 'createdAt', status: 'status' },
      defaultSort: scope === 'mine' ? '-createdAt' : 'startsAt',
      map: (row) => summaryOf(row, user),
    })
  }),

  http.post(api('/travel/requests/preview'), async ({ request }) => {
    const user = requireUser(request)
    const body = await readJson<PreviewBody>(request)
    return ok(preview(user, body ?? {}) as never)
  }),

  http.post(api('/travel/requests'), async ({ request }) => {
    const user = requireUser(request)
    const body = (await readJson(request, createSchema as never)) as CreateBody
    const record = createRequest(user, body)
    return created(detailOf(record, user) as never, api(`/travel/requests/${record.id}`))
  }),

  http.get(api('/travel/requests/:id'), ({ request, params }) => {
    const user = requireUser(request)
    const row = visible(param(params.id), user)
    if (!row) throw notFound()
    return ok(detailOf(row, user) as never)
  }),

  travelWorkflow.actionsHandler(api('/travel/requests/:id/actions/:action'), {
    collection: db.travelRequests,
    find: (id, user) => visible(id, user),
    toDto: (row, user) => detailOf(row, user) as never,
  }),

  http.get(api('/travel/requests/:id/booking/pin'), ({ request, params }) => {
    const user = requireUser(request)
    const row = visible(param(params.id), user)
    if (!row || !row.booking?.pin || !['booked', 'cancellation_requested'].includes(row.status)) {
      throw notFound()
    }
    if (!canViewPin(row, user)) {
      throw forbidden('Only the traveller, the requester and the travel desk can see the PIN.')
    }
    recordAudit(db, {
      module: 'travel',
      entityType: 'travel_request',
      entityId: row.id,
      entityLabel: travelReference(row.number),
      action: 'view_pin',
      actorId: user.id,
      actingAs:
        row.travellerId === user.id
          ? 'self'
          : row.requesterId === user.id
            ? 'requester'
            : 'back_office',
      summary: `${user.displayName} viewed the booking PIN`,
    })
    return ok({ pin: row.booking.pin })
  }),

  http.get(api('/travel/requests/:id/timeline'), ({ request, params }) => {
    const user = requireUser(request)
    const row = visible(param(params.id), user)
    if (!row) throw notFound()
    return ok(timelineOf(row) as never)
  }),

  http.get(api('/travel/car-classes'), ({ request }) => {
    const user = requireUser(request)
    const params = new URL(request.url).searchParams
    const vehicleType = params.get('vehicleType')
    const includeInactive = params.get('includeInactive') === 'true' && seesAll(user)
    const rows = db.carRentalClasses
      .where(
        (row) =>
          (!vehicleType || row.vehicleType === vehicleType) && (includeInactive || row.active),
      )
      .sort(
        (a, b) =>
          a.vehicleType.localeCompare(b.vehicleType) ||
          a.sortOrder - b.sortOrder ||
          a.code.localeCompare(b.code),
      )
    return ok(rows as never)
  }),

  http.post(api('/travel/car-classes'), async ({ request }) => {
    const user = requireUser(request)
    if (!seesAll(user)) throw forbidden()
    const input = (await readJson(request, createCarClassSchema as never)) as CarRentalClassDto
    if (db.carRentalClasses.first((row) => row.code === input.code)) {
      throw conflict('A car class with this code already exists.')
    }
    const current = db.carRentalClasses.first(
      (row) => row.vehicleType === input.vehicleType && row.isDefault,
    )
    const isDefault = input.isDefault || !current
    if (isDefault && !input.active)
      throw validationProblem({ active: 'The standard class must be active.' })
    if (isDefault && current) db.carRentalClasses.update(current.id, { isDefault: false })
    const row = db.carRentalClasses.insert({ ...input, isDefault })
    return created(row as never, api(`/travel/car-classes/${row.id}`))
  }),

  http.patch(api('/travel/car-classes/:id'), async ({ request, params }) => {
    const user = requireUser(request)
    if (!seesAll(user)) throw forbidden()
    const current = db.carRentalClasses.find(param(params.id))
    if (!current) throw notFound()
    const input = (await readJson(
      request,
      updateCarClassSchema as never,
    )) as Partial<CarRentalClassDto>
    if (
      input.code &&
      input.code !== current.code &&
      db.carRentalClasses.first((row) => row.code === input.code)
    ) {
      throw conflict('A car class with this code already exists.')
    }
    if (current.isDefault) {
      if (input.isDefault === false) {
        throw validationProblem({ isDefault: 'Make another class the standard first.' })
      }
      if (input.active === false) {
        throw validationProblem({
          active:
            'The standard class cannot be deactivated. Make another class the standard first.',
        })
      }
      if (input.vehicleType && input.vehicleType !== current.vehicleType) {
        throw validationProblem({
          vehicleType: 'The standard class cannot change its vehicle type.',
        })
      }
    }
    const next = { ...current, ...input }
    if (next.isDefault && !next.active) {
      throw validationProblem({ active: 'The standard class must be active.' })
    }
    if (input.isDefault && !current.isDefault) {
      for (const other of db.carRentalClasses.where(
        (row) => row.vehicleType === next.vehicleType && row.isDefault && row.id !== current.id,
      )) {
        db.carRentalClasses.update(other.id, { isDefault: false })
      }
    }
    return ok(db.carRentalClasses.update(current.id, input)! as never)
  }),
])
