/**
 * Travel API types (owned by slice A2) — transcribed from API.md §5 with SPEC_RESOLUTIONS #3, #9,
 * #11. Replace with generated types once the backend exports `/travel/*` (pnpm api:types).
 */
import type {
  ActingAs,
  Address,
  ApprovalExemptionCode,
  ApprovalReasonCode,
  ApproverCandidate,
  ApproverReason,
  AttachmentDto,
  AutoApproval,
  Decision,
  DeepPartial,
  IsoDate,
  IsoDateTime,
  Ref,
  UserRef,
  Uuid,
} from '~/types/api'

export type TravelKind = 'car' | 'train' | 'flight'
export type TravelStatus =
  | 'pending_approval'
  | 'to_book'
  | 'booked'
  | 'declined'
  | 'booking_impossible'
  | 'cancellation_requested'
  | 'cancelled'
export type VehicleType = 'car' | 'van'
export type HandoverMode = 'branch' | 'delivery'
export type DropOffMode = 'branch' | 'collection'
export type TripType = 'one_way' | 'return'
export type FareType = 'saver' | 'flex'
export type { ApprovalExemptionCode, ApprovalReasonCode }

export type TravelAction =
  | 'approve'
  | 'decline'
  | 'withdraw'
  | 'request_cancellation'
  | 'confirm_cancellation'
  | 'reject_cancellation'
  | 'book'
  | 'mark_booking_impossible'
  | 'retry_booking'
  | 'close'
  | 'view_pin'

export interface ReasonDto {
  code: ApprovalReasonCode
  label: string
}

export interface ExemptionDto {
  code: ApprovalExemptionCode
  label: string
}

export interface TravelRequestSummary {
  id: Uuid
  reference: string
  kind: TravelKind
  status: TravelStatus
  traveller: UserRef
  requester: UserRef
  approver: UserRef | null
  approverReason: ApproverReason | null
  startsAt: IsoDateTime
  endsAt: IsoDateTime | null
  /** 'Riverton → Hillford' (#9) */
  route: string
  needsApproval: boolean
  approvalReasons: ReasonDto[]
  approvalExemption: ExemptionDto | null
  isHighPriority: boolean
  actingAs: ActingAs | null
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  availableActions: TravelAction[]
}

export interface CarEquipment {
  estate: boolean
  navigation: boolean
  automaticPreferred: boolean
  automaticRequired: boolean
  diesel: boolean
  winterTyres: boolean
  foreignTravel: boolean
  childSeat: boolean
}

export interface DriverDto {
  firstName: string
  lastName: string
  email: string
  phone: string
  birthDate: IsoDate
  licenceNumber: string | null
  additionalDrivers: string | null
}

export interface CarDetailDto {
  vehicleType: VehicleType
  carClass: { id: Uuid; code: string; name: string; isDefault: boolean }
  pickupAt: IsoDateTime
  returnAt: IsoDateTime
  /** #9 */
  destination: string
  equipment: CarEquipment
  foreignCountries: string[]
  expectedKmPerDay: number | null
  minPayloadKg: number | null
  handover: { mode: HandoverMode; branch: string | null; address: Address | null }
  dropOff: { mode: DropOffMode; branch: string | null; address: Address | null }
  /** null when not visible (SPEC §3.2) */
  driver: DriverDto | null
  specialEquipmentReason: string | null
}

export interface TrainDetailDto {
  tripType: TripType
  outboundAt: IsoDateTime
  returnAt: IsoDateTime | null
  fromStation: string
  viaStation: string | null
  toStation: string
  fareType: FareType
  seatReservations: number
  separateTickets: boolean
  localTransportTicket: boolean
  companions: UserRef[]
  notes: string | null
}

export interface FlightDetailDto {
  tripType: TripType
  outboundDepartureAt: IsoDateTime
  outboundFrom: string
  outboundTo: string
  returnDepartureAt: IsoDateTime | null
  returnFrom: string | null
  returnTo: string | null
  handLuggageOnly: boolean
  notes: string | null
}

export interface TravelBookingDto {
  bookingNumber: string
  pinAvailable: boolean
  comment: string | null
  bookedBy: UserRef
  bookedAt: IsoDateTime
  attachments: AttachmentDto[]
}

export interface TravelRequestDetail extends TravelRequestSummary {
  escalatedFrom: UserRef | null
  approverSelection: 'auto' | 'manual' | null
  costCenter: Ref
  costCenterReason: string | null
  recharge: { customer: string; projectNumber: string } | null
  comment: string | null
  car: CarDetailDto | null
  train: TrainDetailDto | null
  flight: FlightDetailDto | null
  approval: Decision | null
  declinedAt: IsoDateTime | null
  declineReason: string | null
  bookingImpossibleReason: string | null
  cancellationRequestedAt: IsoDateTime | null
  cancellationReason: string | null
  cancelledAt: IsoDateTime | null
  booking: TravelBookingDto | null
  version: number
}

export interface TravelCounts {
  mine: { active: number }
  approvals: { mine: number; deputy: number; team: number }
  desk: {
    pendingApproval: number
    toBook: number
    toBookHighPriority: number
    cancellationRequested: number
    bookingImpossible: number
  } | null
}

export interface CarRentalClassDto {
  id: Uuid
  code: string
  name: string
  description: string | null
  exampleModels: string | null
  vehicleType: VehicleType
  isDefault: boolean
  sortOrder: number
  active: boolean
}
export type CarRentalClassInput = Omit<CarRentalClassDto, 'id'>

export interface CreateTravelBase {
  travellerId: Uuid
  approverId?: Uuid | null
  costCenterId?: Uuid | null
  costCenterReason?: string | null
  recharge?: { customer: string; projectNumber: string } | null
  comment?: string | null
}

export interface CarInput {
  vehicleType: VehicleType
  carClassId: Uuid
  pickupAt: IsoDateTime
  returnAt: IsoDateTime
  /** #9: required, ≤ 120 */
  destination: string
  equipment: CarEquipment
  foreignCountries?: string[]
  expectedKmPerDay?: number | null
  minPayloadKg?: number | null
  handover: { mode: HandoverMode; branch?: string | null; address?: Address | null }
  dropOff: { mode: DropOffMode; branch?: string | null; address?: Address | null }
  driver: {
    firstName: string
    lastName: string
    email: string
    phone: string
    birthDate: IsoDate
    licenceNumber?: string | null
    additionalDrivers?: string | null
  }
  specialEquipmentReason?: string | null
}

export interface TrainInput {
  tripType: TripType
  outboundAt: IsoDateTime
  returnAt?: IsoDateTime | null
  fromStation: string
  viaStation?: string | null
  toStation: string
  fareType: FareType
  seatReservations: number
  separateTickets: boolean
  localTransportTicket: boolean
  companionIds?: Uuid[]
  notes?: string | null
}

export interface FlightInput {
  tripType: TripType
  outboundDepartureAt: IsoDateTime
  outboundFrom: string
  outboundTo: string
  returnDepartureAt?: IsoDateTime | null
  returnFrom?: string | null
  returnTo?: string | null
  handLuggageOnly: boolean
  notes?: string | null
}

export type CreateTravelRequest =
  | (CreateTravelBase & { kind: 'car'; car: CarInput })
  | (CreateTravelBase & { kind: 'train'; train: TrainInput })
  | (CreateTravelBase & { kind: 'flight'; flight: FlightInput })

/** #3: lenient, partial preview body */
export type TravelPreviewRequest = { kind: TravelKind; travellerId: Uuid } & DeepPartial<
  Omit<CreateTravelBase, 'travellerId'>
> & {
    car?: DeepPartial<CarInput> | null
    train?: DeepPartial<TrainInput> | null
    flight?: DeepPartial<FlightInput> | null
  }

export interface TravelPreview {
  needsApproval: boolean
  reasons: ReasonDto[]
  exemption: ExemptionDto | null
  approverCandidates: ApproverCandidate[]
  defaultApproverId: Uuid | null
  autoApproval: AutoApproval | null
  isHighPriority: boolean
  specialEquipmentReasonRequired: boolean
}
