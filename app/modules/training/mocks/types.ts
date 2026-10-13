/**
 * Mock records of the training module (SPEC §4.2) — the same columns as the backend tables
 * (`training_requests`, `training_attendees`, `training_ratings`), dates as IsoDate strings and
 * timestamps as ISO strings.
 */
import type { ActingAs, ApproverReason, AutoApproval } from '~/types/api'
import type { AttendeeStatus, BillingStatus, Likert, TrainingFormat } from '../api/types'

export interface TrainingRequestRecord {
  id: string
  number: number
  topic: string
  provider: string
  format: TrainingFormat
  location: string | null
  registrationUrl: string | null
  registrationDetails: string | null
  startsOn: string
  endsOn: string
  costCents: number
  costCenterId: string
  executiveApproverId: string | null
  certificateExpected: boolean
  reimbursementAgreement: boolean
  requesterComment: string | null
  requesterId: string
  backOfficeComment: string | null
  billingStatus: BillingStatus
  actualCostCents: number | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface TrainingAttendeeRecord {
  id: string
  requestId: string
  userId: string
  costCenterId: string
  status: AttendeeStatus
  statusBeforeCancellation: AttendeeStatus | null
  approverId: string | null
  approverReason: ApproverReason
  escalatedFromId: string | null
  executiveApproverId: string | null
  hotelNeeded: boolean
  hotelCheckInOn: string | null
  hotelCheckOutOn: string | null
  hotelCostCents: number | null
  goal1: string | null
  goal2: string | null
  goalsUpdatedAt: string | null
  goalsRemindedAt: string | null
  bookingReference: string | null
  managerDecisionAt: string | null
  managerDecisionById: string | null
  managerDecisionAs: ActingAs | null
  managerDecisionComment: string | null
  managerAutoApproval: AutoApproval | null
  executiveDecisionAt: string | null
  executiveDecisionById: string | null
  executiveDecisionAs: ActingAs | null
  executiveDecisionComment: string | null
  executiveAutoApproval: AutoApproval | null
  declineReason: string | null
  bookingImpossibleReason: string | null
  cancellationReason: string | null
  bookedAt: string | null
  bookedById: string | null
  cancellationRequestedAt: string | null
  cancelledAt: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface TrainingRatingRecord {
  id: string
  attendeeId: string
  loop: 1 | 2 | 3
  raterId: string
  dueAt: string
  submittedAt: string | null
  lastRemindedAt: string | null
  reminderCount: number
  participated: boolean | null
  overallGrade: number | null
  trainerGrade: number | null
  expectationsGrade: number | null
  appliesLearned: Likert | null
  supervisorSupported: Likert | null
  worthwhileForOrganization: Likert | null
  improvementObserved: number | null
  certificationGained: boolean | null
  certificationComment: string | null
  comment: string | null
  createdAt: string
}

declare module '~/mocks/db' {
  interface MockCollections {
    trainingRequests: TrainingRequestRecord
    trainingAttendees: TrainingAttendeeRecord
    trainingRatings: TrainingRatingRecord
  }
}
