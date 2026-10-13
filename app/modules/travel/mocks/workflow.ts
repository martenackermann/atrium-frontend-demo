/**
 * The travel_request state machine for demo mode (SPEC §5.2 + SPEC_RESOLUTIONS #11, #24) with the
 * same events, guards and permissions as the backend's XState machine.
 */
import { z } from 'zod'
import { activeDeputiesOf } from '~/mocks/core/org'
import type { MockUser } from '~/mocks/core/types'
import { db } from '~/mocks/db'
import { defineMockWorkflow } from '~/mocks/workflow'
import { linkAttachments } from '~/mocks/core/files'
import { APPROVAL_REASON_LABELS, isHighPriority, travelReference } from '../lib/rules'
import { canViewPin, dayOf, decideRight, HIGH_PRIORITY_DAYS, seesAll, today } from './logic'
import type { TravelRequestRecord } from './types'

const reason = z.object({ reason: z.string().trim().min(3).max(1000) })
const optionalComment = z.object({ comment: z.string().trim().max(2000).nullish() })

const ownerOrRequester = (row: TravelRequestRecord, user: MockUser) =>
  row.travellerId === user.id ? 'self' : row.requesterId === user.id ? 'requester' : false
const desk = (_row: TravelRequestRecord, user: MockUser) => (seesAll(user) ? 'back_office' : false)
const tripNotOver = (row: TravelRequestRecord) => dayOf(row.endsAt ?? row.startsAt) >= today()

/** In-app notifications for user recipients (D17); mailbox mails are skipped in the offline demo. */
export function notify(
  userIds: Array<string | null | undefined>,
  input: { templateId: string; title: string; body: string; link: string; high?: boolean },
) {
  const now = new Date().toISOString()
  for (const userId of new Set(userIds.filter((id): id is string => Boolean(id)))) {
    db.notifications.insert({
      userId,
      templateId: input.templateId,
      module: 'travel',
      title: input.title.slice(0, 140),
      body: input.body.slice(0, 500),
      link: input.link,
      priority: input.high ? 'high' : 'normal',
      readAt: null,
      createdAt: now,
    })
  }
}

const link = (row: TravelRequestRecord) => `/travel/requests/${row.id}`
const people = (row: TravelRequestRecord) => [row.travellerId, row.requesterId]

export const travelWorkflow = defineMockWorkflow<TravelRequestRecord>({
  name: 'travel_request',
  label: 'Travel request',
  module: 'travel',
  entityType: 'travel_request',
  entityLabel: (row) => travelReference(row.number),
  initialStates: ['pending_approval', 'to_book'],
  states: {
    pending_approval: { label: 'Awaiting approval', tone: 'waiting' },
    to_book: { label: 'To book', tone: 'moving' },
    booked: { label: 'Booked', tone: 'positive' },
    booking_impossible: { label: 'Booking impossible', tone: 'blocked' },
    cancellation_requested: { label: 'Cancellation requested', tone: 'waiting' },
    declined: { label: 'Declined', tone: 'negative', terminal: true },
    cancelled: { label: 'Cancelled', tone: 'neutral', terminal: true },
  },
  transitions: [
    {
      event: 'approve',
      from: ['pending_approval'],
      to: 'to_book',
      label: 'Approve',
      actors: ['Approver', 'Deputy', 'Manager chain'],
      // #11: no approval once the trip has started (decline / withdraw remain).
      allowed: (row, user) => (dayOf(row.startsAt) >= today() ? decideRight(row, user) : false),
      body: optionalComment,
      apply: ({ user, actingAs, body, now }) => ({
        approval: {
          at: now.toISOString(),
          byId: user.id,
          actingAs,
          autoApproval: null,
          comment: (body.comment as string | null | undefined) ?? null,
        },
      }),
      summary: ({ user, actingAs, entity }) =>
        `${user.displayName} approved the trip${actingAs === 'deputy' ? ` (as deputy for ${db.users.find(entity.approverId ?? '')?.displayName ?? 'the approver'})` : actingAs === 'manager_chain' ? ' (as manager chain)' : ''}`,
      after: ({ updated, user }) =>
        notify(people(updated), {
          templateId: 'travel.approved',
          title: `Approved – to book: ${updated.kind} ${updated.route}`,
          body: `${user.displayName} approved the ${updated.kind} trip ${updated.route}. The travel desk books it next.`,
          link: link(updated),
          high: isHighPriority(updated.status, updated.startsAt, new Date(), HIGH_PRIORITY_DAYS),
        }),
    },
    {
      event: 'decline',
      from: ['pending_approval'],
      to: 'declined',
      label: 'Decline',
      actors: ['Approver', 'Deputy', 'Manager chain'],
      allowed: (row, user) => decideRight(row, user),
      body: reason,
      apply: ({ user, actingAs, body, now }) => ({
        approval: {
          at: now.toISOString(),
          byId: user.id,
          actingAs,
          autoApproval: null,
          comment: null,
        },
        declinedAt: now.toISOString(),
        declineReason: body.reason as string,
      }),
      summary: ({ user }) => `${user.displayName} declined the trip`,
      after: ({ updated, user, body }) =>
        notify(people(updated), {
          templateId: 'travel.declined',
          title: `Travel request declined: ${updated.route}`,
          body: `${user.displayName} declined the ${updated.kind} trip ${updated.route}: ${String(body.reason)}`,
          link: link(updated),
        }),
    },
    {
      event: 'withdraw',
      from: ['pending_approval', 'booking_impossible'],
      to: 'cancelled',
      label: 'Withdraw',
      actors: ['Traveller', 'Requester'],
      allowed: ownerOrRequester,
      body: z.object({ reason: z.string().trim().max(1000).nullish() }),
      apply: ({ body, now }) => ({
        cancelledAt: now.toISOString(),
        cancellationReason: (body.reason as string | null | undefined) || null,
      }),
      summary: ({ user }) => `${user.displayName} withdrew the request`,
      after: ({ updated, user, from }) => {
        if (from !== 'pending_approval') return
        notify([updated.approverId], {
          templateId: 'travel.withdrawn',
          title: `Withdrawn: ${db.users.find(updated.travellerId)?.displayName ?? ''} – ${updated.route}`,
          body: `${user.displayName} withdrew the ${updated.kind} trip ${updated.route}. No decision is needed any more.`,
          link: link(updated),
        })
      },
    },
    {
      event: 'request_cancellation',
      from: ['to_book', 'booked'],
      to: 'cancellation_requested',
      label: 'Request cancellation',
      actors: ['Traveller', 'Requester'],
      allowed: (row, user) => (tripNotOver(row) ? ownerOrRequester(row, user) : false),
      body: reason,
      apply: ({ from, body, now }) => ({
        statusBeforeCancellation: from === 'booked' ? 'booked' : 'to_book',
        cancellationRequestedAt: now.toISOString(),
        cancellationReason: body.reason as string,
      }),
      summary: ({ user }) => `${user.displayName} requested cancellation`,
    },
    {
      event: 'confirm_cancellation',
      from: ['cancellation_requested'],
      to: 'cancelled',
      label: 'Confirm cancellation',
      actors: ['Travel desk'],
      allowed: desk,
      body: optionalComment,
      apply: ({ now }) => ({ cancelledAt: now.toISOString() }),
      summary: ({ user }) => `${user.displayName} confirmed the cancellation (back office)`,
      after: ({ updated }) =>
        notify(people(updated), {
          templateId: 'travel.cancelled',
          title: `Cancelled: ${updated.route}`,
          body: `The travel desk cancelled ${updated.route}.`,
          link: link(updated),
        }),
    },
    {
      event: 'reject_cancellation',
      from: ['cancellation_requested'],
      to: ['to_book', 'booked'],
      resolveTo: ({ entity }) => entity.statusBeforeCancellation ?? 'booked',
      label: 'Reject cancellation',
      actors: ['Travel desk'],
      allowed: desk,
      body: reason,
      apply: () => ({
        statusBeforeCancellation: null,
        cancellationRequestedAt: null,
        cancellationReason: null,
      }),
      summary: ({ user }) => `${user.displayName} rejected the cancellation (back office)`,
      after: ({ updated, body }) =>
        notify(people(updated), {
          templateId: 'travel.cancellation_rejected',
          title: `Cancellation not possible: ${updated.route}`,
          body: `The travel desk could not cancel ${updated.route}: ${String(body.reason)}`,
          link: link(updated),
        }),
    },
    {
      event: 'book',
      from: ['to_book'],
      to: 'booked',
      label: 'Book',
      actors: ['Travel desk'],
      allowed: desk,
      body: z.object({
        bookingNumber: z.string().trim().min(1, 'Enter the booking number.').max(60),
        pin: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9]{4,12}$/, 'The PIN must be 4-12 letters or digits.')
          .nullish()
          .or(z.literal('')),
        comment: z.string().trim().max(2000).nullish(),
        attachmentIds: z
          .array(z.string())
          .min(1, 'Attach the booking confirmation (PDF).')
          .max(5, 'Attach at most 5 files.'),
      }),
      apply: ({ entity, user, body, now }) => {
        linkAttachments(db, body.attachmentIds as string[], {
          entityType: 'travel_booking',
          entityId: entity.id,
          uploaderId: user.id,
          purpose: 'travel_booking_confirmation',
        })
        return {
          booking: {
            bookingNumber: String(body.bookingNumber),
            pin: (body.pin as string | null | undefined) || null,
            comment: (body.comment as string | null | undefined) || null,
            bookedById: user.id,
            bookedAt: now.toISOString(),
          },
        }
      },
      summary: ({ user }) => `${user.displayName} booked the trip (back office)`,
      after: ({ updated }) =>
        notify([...people(updated), ...(updated.train?.companionIds ?? [])], {
          templateId: 'travel.booked',
          title: `Booked: ${updated.kind} ${updated.route}`,
          body: `The ${updated.kind} trip ${updated.route} is booked. Booking number ${updated.booking?.bookingNumber ?? ''}.${updated.booking?.pin ? ' The PIN is available in Atrium.' : ''}`,
          link: link(updated),
        }),
    },
    {
      event: 'mark_booking_impossible',
      from: ['to_book'],
      to: 'booking_impossible',
      label: 'Mark booking impossible',
      actors: ['Travel desk'],
      allowed: desk,
      body: reason,
      apply: ({ body }) => ({ bookingImpossibleReason: body.reason as string }),
      summary: ({ user }) => `${user.displayName} marked the booking as impossible (back office)`,
      after: ({ updated, body }) =>
        notify(people(updated), {
          templateId: 'travel.booking_impossible',
          title: `Booking not possible: ${updated.route}`,
          body: `The travel desk could not book ${updated.route}: ${String(body.reason)}`,
          link: link(updated),
        }),
    },
    {
      event: 'retry_booking',
      from: ['booking_impossible'],
      to: 'to_book',
      label: 'Retry booking',
      actors: ['Travel desk'],
      allowed: (row, user) => (new Date(row.startsAt) > new Date() ? desk(row, user) : false),
      body: optionalComment,
      apply: () => ({ bookingImpossibleReason: null }),
      summary: ({ user }) => `${user.displayName} retried the booking (back office)`,
    },
    {
      event: 'close',
      from: ['booking_impossible'],
      to: 'cancelled',
      label: 'Close',
      actors: ['Travel desk'],
      allowed: desk,
      body: reason,
      apply: ({ body, now }) => ({
        cancelledAt: now.toISOString(),
        cancellationReason: body.reason as string,
        bookingImpossibleReason: null,
      }),
      summary: ({ user }) => `${user.displayName} closed the request (back office)`,
      after: ({ updated, body }) =>
        notify(people(updated), {
          templateId: 'travel.cancelled',
          title: `Cancelled: ${updated.route}`,
          body: `The travel desk cancelled ${updated.route}. ${String(body.reason)}`,
          link: link(updated),
        }),
    },
  ],
  capabilities: { view_pin: canViewPin },
})

/** Approval-request notification for a new pending request (approver + active deputies cc). */
export function notifyApprovalRequested(row: TravelRequestRecord) {
  if (!row.approverId) return
  const traveller = db.users.find(row.travellerId)
  const deputies = activeDeputiesOf(db, row.approverId).filter((u) => u.id !== row.travellerId)
  notify([row.approverId, ...deputies.map((d) => d.id)], {
    templateId: 'travel.approval_requested',
    title: `Travel approval needed: ${traveller?.displayName ?? ''} – ${row.kind} ${row.route}`,
    body: `${traveller?.displayName ?? ''} asks for a ${row.kind} trip ${row.route}. Needs approval because: ${row.approvalReasons.map((r) => APPROVAL_REASON_LABELS[r]).join(', ')}.`,
    link: `/travel/approvals?tab=approvals&selected=${row.id}`,
    high: isHighPriority(row.status, row.startsAt, new Date(), HIGH_PRIORITY_DAYS),
  })
}
