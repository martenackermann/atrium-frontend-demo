/**
 * Mock twin of the backend attendee machine (SPEC §5.1 + SPEC_RESOLUTIONS #11): states, events,
 * permissions (approver / deputy / manager chain via the core rules, owner, requester, back office)
 * and side effects (decisions, rating rows, booking documents, notifications).
 *
 * Each transition splits `permit` (who) from `guard` (dates / state context): availableActions
 * needs both; the actions endpoint answers 403 for `permit` and 409 for `guard` like the API.
 */
import { z } from 'zod'
import type { ActingAs, AttachmentDto } from '~/types/api'
import { recordAudit } from '~/mocks/core/audit'
import { linkAttachments } from '~/mocks/core/files'
import type { MockUser } from '~/mocks/core/types'
import { db } from '~/mocks/db'
import { defineMockWorkflow, type MockTransition, type TransitionContext } from '~/mocks/workflow'
import type { AttendeeStatus } from '../api/types'
import {
  addDays,
  decideRight,
  GOALS_EDITABLE,
  hasRole,
  startOfDayIso,
  summaryOf,
  today,
  TRAINING_CONFIG,
} from './rules'
import { notifyTransition } from './notify'
import type { TrainingAttendeeRecord } from './types'

type Entity = TrainingAttendeeRecord
type Ctx = TransitionContext<Entity>

const requestOf = (entity: Entity) => db.trainingRequests.find(entity.requestId)!
/** Whose step a deputy decides: the executive on the executive step, else the approver. */
const principalName = (entity: Entity) =>
  db.users.find(
    (entity.status === 'pending_executive_approval'
      ? entity.executiveApproverId
      : entity.approverId) ?? '',
  )?.displayName ?? null
const backOffice = (user: MockUser): ActingAs | false =>
  hasRole(user, 'it_admin') ? 'admin' : hasRole(user, 'training_office') ? 'back_office' : false
const ownerOrRequester = (entity: Entity, user: MockUser): ActingAs | false =>
  entity.userId === user.id
    ? 'self'
    : requestOf(entity).requesterId === user.id
      ? 'requester'
      : false

const notStarted = (entity: Entity) => requestOf(entity).startsOn >= today()
const notEnded = (entity: Entity) => requestOf(entity).endsOn >= today()

const reason = z.string().trim().min(3, 'Add a reason (at least 3 characters).').max(1000)
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null)
const BODIES = {
  approve: z.strictObject({ comment: optionalText(1000) }),
  decline: z.strictObject({ reason }),
  withdraw: z.strictObject({ reason: optionalText(1000) }),
  request_cancellation: z.strictObject({ reason }),
  confirm_cancellation: z.strictObject({ comment: optionalText(2000) }),
  reject_cancellation: z.strictObject({ reason }),
  book: z.strictObject({
    bookingReference: optionalText(100),
    comment: optionalText(2000),
    attachmentIds: z.array(z.string()).max(10).nullish(),
  }),
  mark_booking_impossible: z.strictObject({ reason }),
  retry_booking: z.strictObject({ comment: optionalText(2000) }),
  close: z.strictObject({ reason }),
}

interface TrainingTransition extends MockTransition<Entity> {
  permit: (entity: Entity, user: MockUser) => ActingAs | false
  guard?: (entity: Entity, user: MockUser) => boolean
}

function step(
  definition: Omit<TrainingTransition, 'allowed'> & { allowed?: never },
): TrainingTransition {
  return {
    ...definition,
    allowed: (entity, user) =>
      (definition.guard?.(entity, user) ?? true) ? definition.permit(entity, user) : false,
    summary: (ctx) =>
      summaryOf(
        'training_attendee',
        definition.event,
        ctx.user.displayName,
        ctx.actingAs,
        ctx.actingAs === 'deputy' ? principalName(ctx.entity) : null,
      ),
  }
}

/** Fields of the decision on the current step. */
function decision(ctx: Ctx, comment: string | null): Partial<Entity> {
  const now = ctx.now.toISOString()
  return ctx.from === 'pending_executive_approval'
    ? {
        executiveDecisionAt: now,
        executiveDecisionById: ctx.user.id,
        executiveDecisionAs: ctx.actingAs,
        executiveDecisionComment: comment,
        executiveAutoApproval: null,
      }
    : {
        managerDecisionAt: now,
        managerDecisionById: ctx.user.id,
        managerDecisionAs: ctx.actingAs,
        managerDecisionComment: comment,
        managerAutoApproval: null,
      }
}

const touch = (ctx: Ctx): Partial<Entity> => ({
  version: ctx.entity.version + 1,
  updatedAt: ctx.now.toISOString(),
})

const after = (ctx: Ctx & { to: string; updated: Entity }) => notifyTransition(ctx)

const PENDING = ['pending_manager_approval', 'pending_executive_approval']

export const TRAINING_TRANSITIONS: TrainingTransition[] = [
  step({
    event: 'approve',
    from: PENDING,
    to: ['pending_executive_approval', 'to_book'],
    label: 'Approve',
    actors: ['Approver', 'Executive', 'Deputy', 'Manager chain'],
    permit: (entity, user) => decideRight(db, user, entity),
    guard: notStarted,
    body: BODIES.approve,
    resolveTo: ({ entity, user }) => {
      if (entity.status === 'pending_executive_approval') return 'to_book'
      const exec = entity.executiveApproverId
      return exec && exec !== user.id && exec !== requestOf(entity).requesterId
        ? 'pending_executive_approval'
        : 'to_book'
    },
    apply: (ctx) => {
      const patch: Partial<Entity> = {
        ...touch(ctx),
        ...decision(ctx, (ctx.body.comment as string | null) ?? null),
      }
      // D8: the executive step completes with the manager step (same approver / requester).
      if (
        ctx.from === 'pending_manager_approval' &&
        ctx.to === 'to_book' &&
        ctx.entity.executiveApproverId
      ) {
        Object.assign(patch, {
          executiveDecisionAt: ctx.now.toISOString(),
          executiveDecisionById: ctx.entity.executiveApproverId,
          executiveDecisionAs: 'system',
          executiveDecisionComment: null,
          executiveAutoApproval:
            ctx.entity.executiveApproverId === ctx.user.id
              ? 'same_approver'
              : 'requester_is_approver',
        })
      }
      return patch
    },
    after: (ctx) => {
      if (ctx.updated.executiveAutoApproval && ctx.from === 'pending_manager_approval') {
        recordAudit(db, {
          module: 'training',
          entityType: 'training_attendee',
          entityId: ctx.entity.id,
          entityLabel: db.users.find(ctx.entity.userId)?.displayName ?? 'Participation',
          action: 'auto_approve',
          actorId: null,
          actingAs: 'system',
          fromState: 'pending_executive_approval',
          toState: 'to_book',
          reason: ctx.updated.executiveAutoApproval,
          summary: summaryOf('training_attendee', 'auto_approve', null, 'system'),
        })
      }
      after(ctx)
    },
  }),
  step({
    event: 'decline',
    from: PENDING,
    to: 'declined',
    label: 'Decline',
    actors: ['Approver', 'Executive', 'Deputy', 'Manager chain'],
    permit: (entity, user) => decideRight(db, user, entity),
    body: BODIES.decline,
    apply: (ctx) => ({
      ...touch(ctx),
      ...decision(ctx, ctx.body.reason as string),
      declineReason: ctx.body.reason as string,
    }),
    after,
  }),
  step({
    event: 'withdraw',
    from: [...PENDING, 'booking_impossible'],
    to: 'cancelled',
    label: 'Withdraw',
    actors: ['Attendee', 'Requester', 'Training office'],
    permit: (entity, user) =>
      ownerOrRequester(entity, user) ||
      (PENDING.includes(entity.status) ? backOffice(user) : false),
    body: BODIES.withdraw,
    apply: (ctx) => ({
      ...touch(ctx),
      cancelledAt: ctx.now.toISOString(),
      cancellationReason: (ctx.body.reason as string | null) ?? null,
    }),
    after,
  }),
  step({
    event: 'request_cancellation',
    from: ['to_book', 'booked'],
    to: 'cancellation_requested',
    label: 'Request cancellation',
    actors: ['Attendee', 'Requester'],
    permit: ownerOrRequester,
    guard: notEnded,
    body: BODIES.request_cancellation,
    apply: (ctx) => ({
      ...touch(ctx),
      statusBeforeCancellation: ctx.entity.status,
      cancellationRequestedAt: ctx.now.toISOString(),
      cancellationReason: ctx.body.reason as string,
    }),
    after,
  }),
  step({
    event: 'confirm_cancellation',
    from: ['cancellation_requested'],
    to: 'cancelled',
    label: 'Confirm cancellation',
    actors: ['Training office'],
    permit: (_, user) => backOffice(user),
    body: BODIES.confirm_cancellation,
    apply: (ctx) => ({ ...touch(ctx), cancelledAt: ctx.now.toISOString() }),
    after: (ctx) => {
      for (const rating of db.trainingRatings.where(
        (r) => r.attendeeId === ctx.entity.id && r.loop === 1 && !r.submittedAt,
      ))
        db.trainingRatings.remove(rating.id)
      after(ctx)
    },
  }),
  step({
    event: 'reject_cancellation',
    from: ['cancellation_requested'],
    to: ['booked', 'to_book'],
    label: 'Reject cancellation',
    actors: ['Training office'],
    permit: (_, user) => backOffice(user),
    body: BODIES.reject_cancellation,
    resolveTo: ({ entity }) =>
      entity.statusBeforeCancellation === 'booked' ? 'booked' : 'to_book',
    apply: (ctx) => ({
      ...touch(ctx),
      statusBeforeCancellation: null,
      cancellationRequestedAt: null,
      cancellationReason: null,
    }),
    after,
  }),
  step({
    event: 'book',
    from: ['to_book'],
    to: 'booked',
    label: 'Book',
    actors: ['Training office'],
    permit: (_, user) => backOffice(user),
    body: BODIES.book,
    apply: (ctx) => ({
      ...touch(ctx),
      bookedAt: ctx.now.toISOString(),
      bookedById: ctx.user.id,
      bookingReference: (ctx.body.bookingReference as string | null) ?? null,
    }),
    after: (ctx) => {
      linkAttachments(db, (ctx.body.attachmentIds as string[] | null) ?? [], {
        entityType: 'training_attendee',
        entityId: ctx.entity.id,
        uploaderId: ctx.user.id,
        purpose: 'training_booking_document',
      }) satisfies AttachmentDto[]
      const request = requestOf(ctx.entity)
      if (!db.trainingRatings.first((r) => r.attendeeId === ctx.entity.id && r.loop === 1)) {
        db.trainingRatings.insert({
          attendeeId: ctx.entity.id,
          loop: 1,
          raterId: ctx.entity.userId,
          dueAt: startOfDayIso(addDays(request.endsOn, TRAINING_CONFIG.loop1DelayDays)),
          submittedAt: null,
          lastRemindedAt: null,
          reminderCount: 0,
          participated: null,
          overallGrade: null,
          trainerGrade: null,
          expectationsGrade: null,
          appliesLearned: null,
          supervisorSupported: null,
          worthwhileForOrganization: null,
          improvementObserved: null,
          certificationGained: null,
          certificationComment: null,
          comment: null,
          createdAt: ctx.now.toISOString(),
        })
      }
      after(ctx)
    },
  }),
  step({
    event: 'mark_booking_impossible',
    from: ['to_book'],
    to: 'booking_impossible',
    label: 'Mark booking impossible',
    actors: ['Training office'],
    permit: (_, user) => backOffice(user),
    body: BODIES.mark_booking_impossible,
    apply: (ctx) => ({ ...touch(ctx), bookingImpossibleReason: ctx.body.reason as string }),
    after,
  }),
  step({
    event: 'retry_booking',
    from: ['booking_impossible'],
    to: 'to_book',
    label: 'Retry booking',
    actors: ['Training office'],
    permit: (_, user) => backOffice(user),
    guard: notStarted,
    body: BODIES.retry_booking,
    apply: (ctx) => ({ ...touch(ctx), bookingImpossibleReason: null }),
  }),
  step({
    event: 'close',
    from: ['booking_impossible'],
    to: 'cancelled',
    label: 'Close',
    actors: ['Training office'],
    permit: (_, user) => backOffice(user),
    body: BODIES.close,
    apply: (ctx) => ({
      ...touch(ctx),
      cancelledAt: ctx.now.toISOString(),
      cancellationReason: ctx.body.reason as string,
    }),
    after,
  }),
]

export const trainingWorkflow = defineMockWorkflow<Entity>({
  name: 'training_attendee',
  label: 'Training participation',
  module: 'training',
  entityType: 'training_attendee',
  initialStates: ['pending_manager_approval', 'pending_executive_approval', 'to_book'],
  states: {
    pending_manager_approval: { label: 'Awaiting manager', tone: 'waiting' },
    pending_executive_approval: { label: 'Awaiting executive', tone: 'waiting' },
    to_book: { label: 'To book', tone: 'moving' },
    booked: { label: 'Booked', tone: 'positive' },
    booking_impossible: { label: 'Booking impossible', tone: 'blocked' },
    cancellation_requested: { label: 'Cancellation requested', tone: 'waiting' },
    attended: { label: 'Attended', tone: 'positive', terminal: true },
    not_attended: { label: 'Did not attend', tone: 'neutral', terminal: true },
    declined: { label: 'Declined', tone: 'negative', terminal: true },
    cancelled: { label: 'Cancelled', tone: 'neutral', terminal: true },
  },
  transitions: TRAINING_TRANSITIONS,
  systemTransitions: [
    {
      from: 'booked',
      to: 'attended',
      event: 'submit_rating_1',
      label: 'Feedback round 1',
      actors: ['Attendee'],
    },
    {
      from: 'booked',
      to: 'not_attended',
      event: 'submit_rating_1',
      label: 'Feedback round 1',
      actors: ['Attendee'],
    },
  ],
  capabilities: {
    // SPEC §5.1 goals: the attendee, while pending/to book/booked and before the start.
    edit_goals: (entity, user) =>
      entity.userId === user.id &&
      GOALS_EDITABLE.includes(entity.status) &&
      requestOf(entity).startsOn > today(),
  },
  entityLabel: (entity) => db.users.find(entity.userId)?.displayName ?? 'Participation',
})

/**
 * API error order for `POST …/actions/{action}` (backend WorkflowService): unknown action 404 →
 * no permission: 403 if the state knows the action, else 409 → body 422 → guard 409.
 */
export type ActionCheck =
  | { kind: 'unknown' }
  | { kind: 'forbidden' }
  | { kind: 'invalid' }
  | { kind: 'ok'; transition: TrainingTransition }

export function checkAction(entity: Entity, action: string, user: MockUser): ActionCheck {
  const candidates = TRAINING_TRANSITIONS.filter((t) => t.event === action)
  if (!candidates.length) return { kind: 'unknown' }
  const inState = candidates.filter((t) => t.from.includes(entity.status))
  const permitted = inState.find((t) => t.permit(entity, user))
  if (!permitted) return inState.length ? { kind: 'forbidden' } : { kind: 'invalid' }
  if (permitted.guard && !permitted.guard(entity, user)) return { kind: 'invalid' }
  return { kind: 'ok', transition: permitted }
}

export const isAttendeeStatus = (value: string): value is AttendeeStatus =>
  Object.keys(trainingWorkflow.config.states).includes(value)
