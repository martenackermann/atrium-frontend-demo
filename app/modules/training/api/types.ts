/**
 * Training API types (owned by slice A1) — API.md §4 with SPEC_RESOLUTIONS #11 (`close`),
 * #14–#16; identical to the backend's zod DTOs (atrium-backend-demo `src/modules/training/dto`).
 */
import type {
  ActingAs,
  ApproverReason,
  AttachmentDto,
  AutoApproval,
  Decision,
  IsoDate,
  IsoDateTime,
  Money,
  Ref,
  UserRef,
  Uuid,
} from '~/types/api'

export type TrainingFormat = 'in_person' | 'online' | 'hybrid'
export type AttendeeStatus =
  | 'pending_manager_approval'
  | 'pending_executive_approval'
  | 'to_book'
  | 'booked'
  | 'declined'
  | 'booking_impossible'
  | 'cancellation_requested'
  | 'cancelled'
  | 'attended'
  | 'not_attended'
export type BillingStatus = 'open' | 'invoice_received' | 'free_of_charge'
export type RatingLoop = 1 | 2 | 3
export type RatingState = 'upcoming' | 'due' | 'overdue' | 'submitted'
export type SchoolGrade = 1 | 2 | 3 | 4 | 5 | 6
export type Likert = 'A' | 'B' | 'C' | 'D'
export type Improvement = 1 | 2 | 3 | 4

export type TrainingRequestAction = 'edit' | 'edit_back_office' | 'add_attendee' | 'add_attachment'
export type TrainingAttendeeAction =
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
  | 'edit_goals'

export interface TrainingRequestSummary {
  id: Uuid
  reference: string
  topic: string
  provider: string
  format: TrainingFormat
  location: string | null
  startsOn: IsoDate
  endsOn: IsoDate
  cost: Money
  requester: UserRef
  attendeeCount: number
  statusCounts: Partial<Record<AttendeeStatus, number>>
  billingStatus: BillingStatus
  executiveStepRequired: boolean
  /** null unless training_office / it_admin (#16) */
  actualCost: Money | null
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface TrainingRequestDetail extends TrainingRequestSummary {
  registrationUrl: string | null
  registrationDetails: string | null
  costCenter: Ref
  executiveApprover: UserRef | null
  certificateExpected: boolean
  reimbursementAgreement: boolean
  requesterComment: string | null
  backOffice: {
    comment: string | null
    billingStatus: BillingStatus
    actualCost: Money | null
  } | null
  attachments: AttachmentDto[]
  attendees: TrainingAttendeeDto[]
  availableActions: TrainingRequestAction[]
  version: number
}

export interface TrainingRatingBrief {
  id: Uuid
  loop: RatingLoop
  state: RatingState
  dueAt: IsoDateTime
  submittedAt: IsoDateTime | null
  rater: UserRef
}

export interface TrainingAttendeeDto {
  id: Uuid
  requestId: Uuid
  user: UserRef
  costCenter: Ref
  status: AttendeeStatus
  approver: UserRef | null
  approverReason: ApproverReason
  /** the skipped site manager */
  escalatedFrom: UserRef | null
  executiveApprover: UserRef | null
  hotel: { checkInOn: IsoDate; checkOutOn: IsoDate; cost: Money | null } | null
  goals: { goal1: string | null; goal2: string | null; updatedAt: IsoDateTime | null }
  bookingReference: string | null
  managerDecision: Decision | null
  executiveDecision: Decision | null
  declineReason: string | null
  bookingImpossibleReason: string | null
  cancellationReason: string | null
  bookedAt: IsoDateTime | null
  cancellationRequestedAt: IsoDateTime | null
  cancelledAt: IsoDateTime | null
  attachments: AttachmentDto[]
  ratings: TrainingRatingBrief[]
  isHighPriority: boolean
  availableActions: TrainingAttendeeAction[]
  updatedAt: IsoDateTime
  version: number
}

export interface TrainingParticipationListItem {
  id: Uuid
  status: AttendeeStatus
  user: UserRef
  approver: UserRef | null
  approverReason: ApproverReason
  escalatedFrom: UserRef | null
  executiveApprover: UserRef | null
  /** viewer's relation for approval scopes: 'approver' | 'deputy' | 'manager_chain' | 'executive' */
  actingAs: ActingAs | null
  request: {
    id: Uuid
    reference: string
    topic: string
    provider: string
    format: TrainingFormat
    startsOn: IsoDate
    endsOn: IsoDate
    cost: Money
    executiveStepRequired: boolean
    requester: UserRef
  }
  hotelNeeded: boolean
  isHighPriority: boolean
  /** #14 */
  goalsSet: boolean
  openRating: { id: Uuid; loop: RatingLoop; state: RatingState; dueAt: IsoDateTime } | null
  updatedAt: IsoDateTime
  availableActions: TrainingAttendeeAction[]
}

export interface TrainingParticipationDetail extends TrainingAttendeeDto {
  request: TrainingRequestSummary & {
    registrationUrl: string | null
    registrationDetails: string | null
    certificateExpected: boolean
    reimbursementAgreement: boolean
    requesterComment: string | null
    attachments: AttachmentDto[]
  }
}

export interface Rating1Answers {
  loop: 1
  participated: boolean
  overallGrade: SchoolGrade | null
  trainerGrade: SchoolGrade | null
  expectationsGrade: SchoolGrade | null
  comment: string | null
}
export interface Rating2Answers {
  loop: 2
  appliesLearned: Likert
  supervisorSupported: Likert
  worthwhileForOrganization: Likert
  comment: string | null
}
export interface Rating3Answers {
  loop: 3
  improvementObserved: Improvement
  certificationGained: boolean
  certificationComment: string | null
  comment: string | null
}
export type RatingSubmission = Rating1Answers | Rating2Answers | Rating3Answers

export interface TrainingRatingDto {
  id: Uuid
  loop: RatingLoop
  state: RatingState
  rater: UserRef
  attendee: { id: Uuid; user: UserRef }
  training: {
    requestId: Uuid
    reference: string
    topic: string
    provider: string
    startsOn: IsoDate
    endsOn: IsoDate
  }
  dueAt: IsoDateTime
  submittedAt: IsoDateTime | null
  reminderCount: number
  lastRemindedAt: IsoDateTime | null
  answers: RatingSubmission | null
  availableActions: 'submit'[]
}

export interface RatingStats {
  from: IsoDate | null
  to: IsoDate | null
  loop1: {
    submitted: number
    participatedRate: number
    avgOverall: number | null
    avgTrainer: number | null
    avgExpectations: number | null
  }
  loop2: {
    submitted: number
    distribution: Record<
      'appliesLearned' | 'supervisorSupported' | 'worthwhileForOrganization',
      Record<Likert, number>
    >
  }
  loop3: {
    submitted: number
    distribution: Record<Improvement, number>
    certificationRate: number | null
  }
  open: { due: number; overdue: number; maxedOut: number }
}

export interface TrainingCounts {
  mine: { active: number; ratingsDue: number; goalsMissing: number }
  approvals: { manager: number; executive: number; deputy: number; team: number }
  office: {
    toBook: number
    cancellationRequested: number
    pendingApproval: number
    bookingImpossible: number
    ratingsOverdue: number
    billingOpen: number
  } | null
}

export interface AttendeeInput {
  userId: Uuid
  costCenterId?: Uuid | null
  hotel?: { checkInOn: IsoDate; checkOutOn: IsoDate; cost?: Money | null } | null
}

export interface CreateTrainingRequest {
  topic: string
  provider: string
  format: TrainingFormat
  location?: string | null
  registrationUrl?: string | null
  registrationDetails?: string | null
  startsOn: IsoDate
  endsOn: IsoDate
  cost: Money
  costCenterId?: Uuid | null
  executiveApproverId?: Uuid | null
  certificateExpected: boolean
  reimbursementAgreement: boolean
  requesterComment?: string | null
  attendees: AttendeeInput[]
  attachmentIds?: Uuid[]
}

export type UpdateTrainingRequest = Partial<
  Omit<CreateTrainingRequest, 'attendees' | 'attachmentIds'>
> & {
  version?: number
}

export interface UpdateTrainingBackOffice {
  billingStatus?: BillingStatus
  actualCost?: Money | null
  backOfficeComment?: string | null
  version?: number
}

/** #15: executiveApproverId, attendees may be empty */
export interface TrainingPreviewRequest {
  cost?: Money | null
  executiveApproverId?: Uuid | null
  attendees: { userId: Uuid }[]
}

export interface TrainingPreview {
  executiveStepRequired: boolean
  threshold: Money
  executiveCandidates: UserRef[]
  /** Echo of the chosen executive approver (#15), null below the threshold or when not chosen. */
  executiveApprover: UserRef | null
  attendees: Array<{
    user: UserRef
    approver: UserRef | null
    approverReason: ApproverReason
    escalatedFrom: UserRef | null
    autoApproval: AutoApproval | null
    activeDeputies: UserRef[]
    allowed: boolean
    notAllowedReason: string | null
    /** #15 */
    initialState: AttendeeStatus
    executiveAutoApproval: AutoApproval | null
  }>
}

/** Query of `GET /training/participations` (API.md §4.1 + #16 highPriority). */
export type ParticipationScope = 'mine' | 'approvals' | 'executive' | 'deputy' | 'team' | 'all'
