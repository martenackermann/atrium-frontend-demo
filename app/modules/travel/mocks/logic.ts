/**
 * Travel mock API logic (demo mode): visibility (SPEC §3.2), scopes (#13, #18), DTO mapping
 * (API.md §5.2), create/preview validation mirroring the backend. Handlers and providers use it.
 */
import type { ActingAs, ApproverCandidate } from '~/types/api'
import { timelineFor } from '~/mocks/core/audit'
import { attachmentsOf } from '~/mocks/core/files'
import {
  approverCandidates,
  canDecide,
  isActiveDeputy,
  isoDay,
  managerChain,
  refOf,
  reportingTree,
  resolveApprover,
  toUserRef,
  userRefById,
} from '~/mocks/core/org'
import type { MockUser } from '~/mocks/core/types'
import { db } from '~/mocks/db'
import { userHasRole } from '~/mocks/http'
import type {
  CarRentalClassDto,
  TravelAction,
  TravelRequestDetail,
  TravelRequestSummary,
} from '../api/types'
import {
  APPROVAL_REASON_LABELS,
  EXEMPTION_LABEL,
  isHighPriority,
  travelReference,
} from '../lib/rules'
import type { TravelRequestRecord } from './types'

export const HIGH_PRIORITY_DAYS = 3
export const ACTIVE_STATUSES = [
  'pending_approval',
  'to_book',
  'booked',
  'booking_impossible',
  'cancellation_requested',
] as const

export const isDesk = (user: MockUser) => userHasRole(user, 'travel_desk')
export const seesAll = (user: MockUser) => isDesk(user) || userHasRole(user, 'it_admin')

/** "Today" as IsoDate in local time (the demo runs in the browser's zone). */
export const today = () => isoDay()
export const dayOf = (iso: string) => isoDay(new Date(iso))

export function isDeputyOfApprover(row: TravelRequestRecord, user: MockUser): boolean {
  return Boolean(row.approverId && isActiveDeputy(db, user.id, row.approverId))
}

/** SPEC §3.2 "View request". */
export function canView(row: TravelRequestRecord, user: MockUser): boolean {
  if (seesAll(user)) return true
  if ([row.travellerId, row.requesterId, row.approverId].includes(user.id)) return true
  if (row.train?.companionIds.includes(user.id)) return true
  if (isDeputyOfApprover(row, user)) return true
  return reportingTree(db, user.id).has(row.travellerId)
}

export function canSeeDriver(row: TravelRequestRecord, user: MockUser): boolean {
  return (
    seesAll(user) ||
    [row.travellerId, row.requesterId, row.approverId].includes(user.id) ||
    isDeputyOfApprover(row, user)
  )
}

/** PIN (SPEC_RESOLUTIONS #24): traveller, requester, travel desk — while the booking is live. */
export function canViewPin(row: TravelRequestRecord, user: MockUser): boolean {
  if (!row.booking?.pin) return false
  if (row.status !== 'booked' && row.status !== 'cancellation_requested') return false
  return isDesk(user) || row.travellerId === user.id || row.requesterId === user.id
}

export function decideRight(row: TravelRequestRecord, user: MockUser): ActingAs | false {
  if (!row.approverId) return false
  return canDecide(db, user, { approverId: row.approverId, kind: 'manager' }, row.travellerId)
}

export function visible(id: string, user: MockUser): TravelRequestRecord | undefined {
  const row = db.travelRequests.find(id)
  return row && canView(row, user) ? row : undefined
}

export type TravelScope = 'mine' | 'approvals' | 'deputy' | 'team' | 'all'

export function principalsOf(user: MockUser): string[] {
  return db.deputies
    .where((d) => d.deputyId === user.id && isActiveDeputy(db, user.id, d.principalId))
    .map((d) => d.principalId)
}

export function inScope(row: TravelRequestRecord, user: MockUser, scope: TravelScope): boolean {
  switch (scope) {
    case 'mine':
      return (
        row.travellerId === user.id ||
        row.requesterId === user.id ||
        Boolean(row.train?.companionIds.includes(user.id))
      )
    case 'approvals':
      return (
        row.status === 'pending_approval' &&
        row.approverId === user.id &&
        row.travellerId !== user.id
      )
    case 'deputy':
      return (
        row.status === 'pending_approval' &&
        row.travellerId !== user.id &&
        Boolean(row.approverId && principalsOf(user).includes(row.approverId))
      )
    case 'team':
      return reportingTree(db, user.id).has(row.travellerId)
    case 'all':
      return true
  }
}

const userRef = (id: string) =>
  userRefById(db, id) ?? {
    id,
    displayName: 'Former colleague',
    email: 'former@example.com',
    jobTitle: null,
    initials: 'FC',
  }

export function toSummary(
  row: TravelRequestRecord,
  user: MockUser,
  actions: TravelAction[],
): TravelRequestSummary {
  return {
    id: row.id,
    reference: travelReference(row.number),
    kind: row.kind,
    status: row.status,
    traveller: userRef(row.travellerId),
    requester: userRef(row.requesterId),
    approver: row.approverId ? userRef(row.approverId) : null,
    approverReason: row.approverReason,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    route: row.route,
    needsApproval: row.needsApproval,
    approvalReasons: row.approvalReasons.map((code) => ({
      code,
      label: APPROVAL_REASON_LABELS[code],
    })),
    approvalExemption: row.approvalExemption
      ? { code: row.approvalExemption, label: EXEMPTION_LABEL }
      : null,
    isHighPriority: isHighPriority(row.status, row.startsAt, new Date(), HIGH_PRIORITY_DAYS),
    actingAs: row.status === 'pending_approval' ? decideRight(row, user) || null : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    availableActions: actions,
  }
}

export function toDetail(
  row: TravelRequestRecord,
  user: MockUser,
  actions: TravelAction[],
): TravelRequestDetail {
  const carClass = row.car ? db.carRentalClasses.find(row.car.carClassId) : undefined
  return {
    ...toSummary(row, user, actions),
    escalatedFrom: row.escalatedFromId ? userRef(row.escalatedFromId) : null,
    approverSelection: row.approverSelection,
    costCenter: refOf(db, 'costCenters', row.costCenterId) ?? {
      id: row.costCenterId,
      code: '—',
      name: 'Unknown',
    },
    costCenterReason: row.costCenterReason,
    recharge: row.recharge,
    comment: row.comment,
    car: row.car
      ? {
          vehicleType: row.car.vehicleType,
          carClass: {
            id: row.car.carClassId,
            code: carClass?.code ?? '—',
            name: carClass?.name ?? 'Unknown class',
            isDefault: carClass?.isDefault ?? false,
          },
          pickupAt: row.car.pickupAt,
          returnAt: row.car.returnAt,
          destination: row.car.destination,
          equipment: row.car.equipment,
          foreignCountries: row.car.foreignCountries,
          expectedKmPerDay: row.car.expectedKmPerDay,
          minPayloadKg: row.car.minPayloadKg,
          handover: row.car.handover,
          dropOff: row.car.dropOff,
          driver: canSeeDriver(row, user) ? row.car.driver : null,
          specialEquipmentReason: row.car.specialEquipmentReason,
        }
      : null,
    train: row.train
      ? {
          tripType: row.train.tripType,
          outboundAt: row.train.outboundAt,
          returnAt: row.train.returnAt,
          fromStation: row.train.fromStation,
          viaStation: row.train.viaStation,
          toStation: row.train.toStation,
          fareType: row.train.fareType,
          seatReservations: row.train.seatReservations,
          separateTickets: row.train.separateTickets,
          localTransportTicket: row.train.localTransportTicket,
          companions: row.train.companionIds.map(userRef),
          notes: row.train.notes,
        }
      : null,
    flight: row.flight,
    approval: row.approval
      ? {
          at: row.approval.at,
          by: row.approval.byId ? userRef(row.approval.byId) : null,
          actingAs: row.approval.actingAs,
          autoApproval: row.approval.autoApproval,
          comment: row.approval.comment,
        }
      : null,
    declinedAt: row.declinedAt,
    declineReason: row.declineReason,
    bookingImpossibleReason: row.bookingImpossibleReason,
    cancellationRequestedAt: row.cancellationRequestedAt,
    cancellationReason: row.cancellationReason,
    cancelledAt: row.cancelledAt,
    booking: row.booking
      ? {
          bookingNumber: row.booking.bookingNumber,
          pinAvailable: Boolean(row.booking.pin),
          comment: row.booking.comment,
          bookedBy: userRef(row.booking.bookedById),
          bookedAt: row.booking.bookedAt,
          attachments: attachmentsOf(db, 'travel_booking', row.id),
        }
      : null,
    version: row.version,
  }
}

export function timelineOf(row: TravelRequestRecord) {
  return timelineFor(db, [{ entityType: 'travel_request', entityId: row.id }])
}

export function toCarClassDto(row: CarRentalClassDto): CarRentalClassDto {
  return { ...row }
}

/** Approver chain of a traveller as the preview returns it (API.md ApproverChain candidates). */
export function chainFor(
  traveller: MockUser,
  requester: MockUser,
): { candidates: ApproverCandidate[]; defaultId: string | null } {
  if (traveller.roles.includes('executive')) {
    return {
      candidates: managerChain(db, traveller).map((u, index) => ({
        user: toUserRef(u),
        level: index + 1,
        isSiteManager: u.isSiteManager,
        isDefault: false,
        selectable: u.active && !u.isSiteManager,
        reason: null,
      })),
      defaultId: null,
    }
  }
  const chain = approverCandidates(db, traveller, requester)
  return { candidates: chain.candidates, defaultId: chain.default?.user.id ?? null }
}

export function mayCreateFor(user: MockUser, travellerId: string): boolean {
  return seesAll(user) || user.id === travellerId || reportingTree(db, user.id).has(travellerId)
}

export { resolveApprover }
