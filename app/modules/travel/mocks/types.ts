/**
 * Mock records of the travel module (demo mode). They mirror the backend tables closely; the
 * handlers turn them into the API DTOs (API.md §5.2). Plain JSON (dates as ISO strings).
 */
import type { ActingAs, ApprovalReasonCode, ApproverReason, AutoApproval } from '~/types/api'
import type {
  CarDetailDto,
  CarRentalClassDto,
  DriverDto,
  FlightDetailDto,
  TrainDetailDto,
  TravelKind,
  TravelStatus,
} from '../api/types'

export interface TravelCarRecord extends Omit<CarDetailDto, 'carClass' | 'driver'> {
  carClassId: string
  driver: DriverDto
}

export interface TravelTrainRecord extends Omit<TrainDetailDto, 'companions'> {
  companionIds: string[]
}

export interface TravelRequestRecord {
  id: string
  number: number
  kind: TravelKind
  status: TravelStatus
  travellerId: string
  requesterId: string
  approverId: string | null
  approverSelection: 'auto' | 'manual' | null
  approverReason: ApproverReason | null
  escalatedFromId: string | null
  needsApproval: boolean
  approvalReasons: ApprovalReasonCode[]
  approvalExemption: 'executive_traveller' | null
  startsAt: string
  endsAt: string | null
  route: string
  costCenterId: string
  costCenterReason: string | null
  recharge: { customer: string; projectNumber: string } | null
  comment: string | null
  car: TravelCarRecord | null
  train: TravelTrainRecord | null
  flight: FlightDetailDto | null
  statusBeforeCancellation: 'to_book' | 'booked' | null
  /** Decision of the approval step (approve, auto-approval or decline). */
  approval: {
    at: string
    byId: string | null
    actingAs: ActingAs
    autoApproval: AutoApproval | null
    comment: string | null
  } | null
  declinedAt: string | null
  declineReason: string | null
  bookingImpossibleReason: string | null
  cancellationRequestedAt: string | null
  cancellationReason: string | null
  cancelledAt: string | null
  /** The PIN is kept in clear text only in this in-browser demo; the API encrypts it (D12). */
  booking: {
    bookingNumber: string
    pin: string | null
    comment: string | null
    bookedById: string
    bookedAt: string
  } | null
  createdAt: string
  updatedAt: string
  version: number
}

export type CarRentalClassRecord = CarRentalClassDto

declare module '~/mocks/db' {
  interface MockCollections {
    travelRequests: TravelRequestRecord
    carRentalClasses: CarRentalClassRecord
  }
}
