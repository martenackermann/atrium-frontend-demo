/**
 * Mock DTO builders: records → exactly the API.md §4.2 shapes the backend returns (every field
 * present, availableActions computed for the viewer by the mock workflow).
 */
import type { ActingAs, AutoApproval, Decision, Ref } from '~/types/api'
import { attachmentsOf } from '~/mocks/core/files'
import { refOf, userRefById } from '~/mocks/core/org'
import type { MockUser } from '~/mocks/core/types'
import { db } from '~/mocks/db'
import type {
  AttendeeStatus,
  RatingSubmission,
  TrainingAttendeeAction,
  TrainingAttendeeDto,
  TrainingParticipationDetail,
  TrainingParticipationListItem,
  TrainingRatingBrief,
  TrainingRatingDto,
  TrainingRequestAction,
  TrainingRequestDetail,
  TrainingRequestSummary,
} from '../api/types'
import {
  attendeeVisible,
  isHighPriority,
  rateable,
  ratingState,
  reference,
  TRAINING_CONFIG,
  type TrainingViewer,
} from './rules'
import type { TrainingAttendeeRecord, TrainingRatingRecord, TrainingRequestRecord } from './types'
import { trainingWorkflow } from './workflow'

const money = (amountCents: number) => ({ amountCents, currency: 'EUR' as const })
const userRef = (id: string | null | undefined) => userRefById(db, id)

export function requestSummary(
  request: TrainingRequestRecord,
  viewer: TrainingViewer,
): TrainingRequestSummary {
  const attendees = db.trainingAttendees.where((a) => a.requestId === request.id)
  const statusCounts: Partial<Record<AttendeeStatus, number>> = {}
  for (const a of attendees) statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1
  return {
    id: request.id,
    reference: reference(request.number),
    topic: request.topic,
    provider: request.provider,
    format: request.format,
    location: request.location,
    startsOn: request.startsOn,
    endsOn: request.endsOn,
    cost: money(request.costCents),
    requester: userRef(request.requesterId)!,
    attendeeCount: attendees.length,
    statusCounts,
    billingStatus: request.billingStatus,
    actualCost:
      viewer.isBackOffice && request.actualCostCents !== null
        ? money(request.actualCostCents)
        : null,
    executiveStepRequired: request.costCents >= TRAINING_CONFIG.thresholdCents,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  }
}

function decision(
  at: string | null,
  by: string | null,
  as: ActingAs | null,
  auto: AutoApproval | null,
  comment: string | null,
): Decision | null {
  if (!at) return null
  return { at, by: userRef(by), actingAs: as ?? 'system', autoApproval: auto, comment }
}

export function ratingBriefs(attendeeId: string): TrainingRatingBrief[] {
  return db.trainingRatings
    .where((r) => r.attendeeId === attendeeId)
    .sort((a, b) => a.loop - b.loop)
    .map((r) => ({
      id: r.id,
      loop: r.loop,
      state: ratingState(r),
      dueAt: r.dueAt,
      submittedAt: r.submittedAt,
      rater: userRef(r.raterId)!,
    }))
}

export function attendeeActions(attendee: TrainingAttendeeRecord, user: MockUser) {
  return trainingWorkflow.availableActions(attendee, user) as TrainingAttendeeAction[]
}

export function attendeeDto(attendee: TrainingAttendeeRecord, user: MockUser): TrainingAttendeeDto {
  const request = db.trainingRequests.find(attendee.requestId)!
  return {
    id: attendee.id,
    requestId: attendee.requestId,
    user: userRef(attendee.userId)!,
    costCenter: refOf(db, 'costCenters', attendee.costCenterId) as Ref,
    status: attendee.status,
    approver: userRef(attendee.approverId),
    approverReason: attendee.approverReason,
    escalatedFrom: userRef(attendee.escalatedFromId),
    executiveApprover: userRef(attendee.executiveApproverId),
    hotel:
      attendee.hotelNeeded && attendee.hotelCheckInOn && attendee.hotelCheckOutOn
        ? {
            checkInOn: attendee.hotelCheckInOn,
            checkOutOn: attendee.hotelCheckOutOn,
            cost: attendee.hotelCostCents !== null ? money(attendee.hotelCostCents) : null,
          }
        : null,
    goals: { goal1: attendee.goal1, goal2: attendee.goal2, updatedAt: attendee.goalsUpdatedAt },
    bookingReference: attendee.bookingReference,
    managerDecision: decision(
      attendee.managerDecisionAt,
      attendee.managerDecisionById,
      attendee.managerDecisionAs,
      attendee.managerAutoApproval,
      attendee.managerDecisionComment,
    ),
    executiveDecision: decision(
      attendee.executiveDecisionAt,
      attendee.executiveDecisionById,
      attendee.executiveDecisionAs,
      attendee.executiveAutoApproval,
      attendee.executiveDecisionComment,
    ),
    declineReason: attendee.declineReason,
    bookingImpossibleReason: attendee.bookingImpossibleReason,
    cancellationReason: attendee.cancellationReason,
    bookedAt: attendee.bookedAt,
    cancellationRequestedAt: attendee.cancellationRequestedAt,
    cancelledAt: attendee.cancelledAt,
    attachments: attachmentsOf(db, 'training_attendee', attendee.id),
    ratings: ratingBriefs(attendee.id),
    isHighPriority: isHighPriority(attendee.status, request.startsOn),
    availableActions: attendeeActions(attendee, user),
    updatedAt: attendee.updatedAt,
    version: attendee.version,
  }
}

export function listItem(
  attendee: TrainingAttendeeRecord,
  user: MockUser,
  actingAs: ActingAs | null,
): TrainingParticipationListItem {
  const request = db.trainingRequests.find(attendee.requestId)!
  const open = db.trainingRatings.first(
    (r) => r.attendeeId === attendee.id && !r.submittedAt && r.raterId === user.id,
  )
  return {
    id: attendee.id,
    status: attendee.status,
    user: userRef(attendee.userId)!,
    approver: userRef(attendee.approverId),
    approverReason: attendee.approverReason,
    escalatedFrom: userRef(attendee.escalatedFromId),
    executiveApprover: userRef(attendee.executiveApproverId),
    actingAs,
    request: {
      id: request.id,
      reference: reference(request.number),
      topic: request.topic,
      provider: request.provider,
      format: request.format,
      startsOn: request.startsOn,
      endsOn: request.endsOn,
      cost: money(request.costCents),
      executiveStepRequired: request.costCents >= TRAINING_CONFIG.thresholdCents,
      requester: userRef(request.requesterId)!,
    },
    hotelNeeded: attendee.hotelNeeded,
    isHighPriority: isHighPriority(attendee.status, request.startsOn),
    goalsSet: Boolean(attendee.goal1 || attendee.goal2),
    openRating: open
      ? { id: open.id, loop: open.loop, state: ratingState(open), dueAt: open.dueAt }
      : null,
    updatedAt: attendee.updatedAt,
    availableActions: attendeeActions(attendee, user),
  }
}

export function participationDetail(
  attendee: TrainingAttendeeRecord,
  viewer: TrainingViewer,
): TrainingParticipationDetail {
  const request = db.trainingRequests.find(attendee.requestId)!
  return {
    ...attendeeDto(attendee, viewer.user),
    request: {
      ...requestSummary(request, viewer),
      registrationUrl: request.registrationUrl,
      registrationDetails: request.registrationDetails,
      certificateExpected: request.certificateExpected,
      reimbursementAgreement: request.reimbursementAgreement,
      requesterComment: request.requesterComment,
      attachments: attachmentsOf(db, 'training_request', request.id),
    },
  }
}

export function requestActions(
  request: TrainingRequestRecord,
  viewer: TrainingViewer,
): TrainingRequestAction[] {
  const requester = request.requesterId === viewer.user.id
  const attendees = db.trainingAttendees.where((a) => a.requestId === request.id)
  const actions: TrainingRequestAction[] = []
  if (
    viewer.isBackOffice ||
    (requester && attendees.every((a) => a.status === 'pending_manager_approval'))
  )
    actions.push('edit')
  if (viewer.isBackOffice) actions.push('edit_back_office')
  if ((requester || viewer.isBackOffice) && request.startsOn > viewer.today)
    actions.push('add_attendee')
  if (requester || viewer.isBackOffice) actions.push('add_attachment')
  return actions
}

export function requestDetail(
  request: TrainingRequestRecord,
  viewer: TrainingViewer,
): TrainingRequestDetail {
  const attendees = db.trainingAttendees
    .where((a) => a.requestId === request.id && attendeeVisible(db, viewer, a, request))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return {
    ...requestSummary(request, viewer),
    registrationUrl: request.registrationUrl,
    registrationDetails: request.registrationDetails,
    costCenter: refOf(db, 'costCenters', request.costCenterId) as Ref,
    executiveApprover: userRef(request.executiveApproverId),
    certificateExpected: request.certificateExpected,
    reimbursementAgreement: request.reimbursementAgreement,
    requesterComment: request.requesterComment,
    backOffice: viewer.isBackOffice
      ? {
          comment: request.backOfficeComment,
          billingStatus: request.billingStatus,
          actualCost: request.actualCostCents !== null ? money(request.actualCostCents) : null,
        }
      : null,
    attachments: attachmentsOf(db, 'training_request', request.id),
    attendees: attendees.map((a) => attendeeDto(a, viewer.user)),
    availableActions: requestActions(request, viewer),
    version: request.version,
  }
}

function answers(rating: TrainingRatingRecord): RatingSubmission | null {
  if (!rating.submittedAt) return null
  if (rating.loop === 1)
    return {
      loop: 1,
      participated: rating.participated ?? false,
      overallGrade: rating.overallGrade as 1,
      trainerGrade: rating.trainerGrade as 1,
      expectationsGrade: rating.expectationsGrade as 1,
      comment: rating.comment,
    }
  if (rating.loop === 2)
    return {
      loop: 2,
      appliesLearned: rating.appliesLearned ?? 'D',
      supervisorSupported: rating.supervisorSupported ?? 'D',
      worthwhileForOrganization: rating.worthwhileForOrganization ?? 'D',
      comment: rating.comment,
    }
  return {
    loop: 3,
    improvementObserved: (rating.improvementObserved ?? 4) as 1,
    certificationGained: rating.certificationGained ?? false,
    certificationComment: rating.certificationComment,
    comment: rating.comment,
  }
}

export function ratingDto(rating: TrainingRatingRecord, viewer: TrainingViewer): TrainingRatingDto {
  const attendee = db.trainingAttendees.find(rating.attendeeId)!
  const request = db.trainingRequests.find(attendee.requestId)!
  const state = ratingState(rating)
  const canSubmit =
    rating.raterId === viewer.user.id &&
    (state === 'due' || state === 'overdue') &&
    rateable(rating, attendee)
  return {
    id: rating.id,
    loop: rating.loop,
    state,
    rater: userRef(rating.raterId)!,
    attendee: { id: attendee.id, user: userRef(attendee.userId)! },
    training: {
      requestId: request.id,
      reference: reference(request.number),
      topic: request.topic,
      provider: request.provider,
      startsOn: request.startsOn,
      endsOn: request.endsOn,
    },
    dueAt: rating.dueAt,
    submittedAt: rating.submittedAt,
    reminderCount: rating.reminderCount,
    lastRemindedAt: rating.lastRemindedAt,
    answers: answers(rating),
    availableActions: canSubmit ? ['submit'] : [],
  }
}
