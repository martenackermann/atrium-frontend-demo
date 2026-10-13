import { Building2, GraduationCap, Star } from '@lucide/vue'
import type { Decision, UserRef } from '~/types/api'
import type { RouteStop } from '~/types/ui'
import type { AttendeeStatus, TrainingAttendeeAction } from './api/types'

/**
 * Routing slip of a participation (DESIGN §9 "route track"): requester → (skipped site manager)
 * → manager step → executive step → training office → booked. Built from list items and details.
 */
export interface RouteInput {
  status: AttendeeStatus
  user: UserRef
  approver: UserRef | null
  escalatedFrom: UserRef | null
  executiveApprover: UserRef | null
  requester: UserRef
  availableActions: readonly TrainingAttendeeAction[]
  managerDecision?: Decision | null
  executiveDecision?: Decision | null
  bookingReference?: string | null
}

const PAST_MANAGER: AttendeeStatus[] = [
  'pending_executive_approval',
  'to_book',
  'booked',
  'booking_impossible',
  'cancellation_requested',
  'attended',
  'not_attended',
]
const PAST_BOOKING: AttendeeStatus[] = ['booked', 'attended', 'not_attended']

function decisionWhen(decision: Decision | null | undefined): string | undefined {
  if (!decision) return undefined
  if (decision.autoApproval) return 'Approved automatically'
  return `${decision.actingAs === 'deputy' ? 'As deputy · ' : decision.actingAs === 'manager_chain' ? 'Manager chain · ' : ''}${formatDate(decision.at)}`
}

export function participationRoute(input: RouteInput): RouteStop[] {
  const viewerDecides =
    input.availableActions.includes('approve') || input.availableActions.includes('decline')
  const viewerBooks = input.availableActions.includes('book')
  const declinedAtManager =
    input.status === 'declined' && !input.executiveDecision && Boolean(input.managerDecision)
  const declinedAtExec = input.status === 'declined' && Boolean(input.executiveDecision)
  const withdrawn = input.status === 'cancelled' && !input.managerDecision
  const selfApproved = input.managerDecision?.autoApproval === 'executive_self'

  const stops: RouteStop[] = [
    {
      step: 'Requested',
      who: input.requester.displayName,
      initials: input.requester.initials,
      state: 'done',
    },
  ]
  if (input.escalatedFrom) {
    stops.push({
      step: 'Site manager',
      who: input.escalatedFrom.displayName,
      initials: input.escalatedFrom.initials,
      when: 'Skipped (site manager)',
      state: 'skipped',
    })
  }

  // Manager step
  const managerDone = Boolean(input.managerDecision) && !declinedAtManager
  stops.push({
    step: selfApproved ? 'Executive self-approval' : 'Manager approval',
    who: input.approver?.displayName,
    initials: input.approver?.initials,
    when:
      input.status === 'pending_manager_approval'
        ? viewerDecides
          ? 'Your decision'
          : 'Deciding'
        : declinedAtManager
          ? 'Declined'
          : decisionWhen(input.managerDecision),
    state:
      input.status === 'pending_manager_approval'
        ? 'current'
        : declinedAtManager || (withdrawn && !managerDone)
          ? 'stopped'
          : managerDone || PAST_MANAGER.includes(input.status)
            ? 'done'
            : 'future',
    tone:
      input.status === 'pending_manager_approval' ? (viewerDecides ? 'you' : 'waiting') : undefined,
  })

  // Executive step (≥ threshold)
  if (input.executiveApprover) {
    const pending = input.status === 'pending_executive_approval'
    const done = Boolean(input.executiveDecision) && !declinedAtExec
    stops.push({
      step: 'Executive approval',
      who: input.executiveApprover.displayName,
      initials: input.executiveApprover.initials,
      when: pending
        ? viewerDecides
          ? 'Your decision'
          : 'Deciding'
        : declinedAtExec
          ? 'Declined'
          : decisionWhen(input.executiveDecision),
      state: pending
        ? 'current'
        : declinedAtExec || (input.status === 'cancelled' && !done && managerDone)
          ? 'stopped'
          : done
            ? 'done'
            : 'future',
      tone: pending ? (viewerDecides ? 'you' : 'waiting') : undefined,
    })
  }

  // Booking by the training office
  const bookingState: RouteStop['state'] =
    input.status === 'to_book' || input.status === 'cancellation_requested'
      ? 'current'
      : input.status === 'booking_impossible'
        ? 'stopped'
        : PAST_BOOKING.includes(input.status)
          ? 'done'
          : input.status === 'cancelled' && managerDone && !withdrawn
            ? 'stopped'
            : 'future'
  stops.push({
    step: 'Booking',
    who: 'Training office',
    icon: Building2,
    when:
      input.status === 'to_book'
        ? viewerBooks
          ? 'Book it'
          : 'Books it next'
        : input.status === 'booking_impossible'
          ? 'Not possible yet'
          : input.status === 'cancellation_requested'
            ? 'Reviewing cancellation'
            : input.bookingReference
              ? `Ref ${input.bookingReference}`
              : undefined,
    state: bookingState,
    tone:
      input.status === 'to_book'
        ? viewerBooks
          ? 'you'
          : 'moving'
        : input.status === 'cancellation_requested'
          ? 'waiting'
          : undefined,
  })

  stops.push({
    step: input.status === 'attended' || input.status === 'not_attended' ? 'Feedback' : 'Training',
    who: input.user.displayName,
    icon: input.status === 'attended' ? Star : GraduationCap,
    when:
      input.status === 'attended'
        ? 'Took part'
        : input.status === 'not_attended'
          ? 'Did not take part'
          : input.status === 'booked'
            ? 'Booked'
            : undefined,
    state:
      input.status === 'attended' || input.status === 'not_attended'
        ? 'done'
        : input.status === 'booked'
          ? 'current'
          : 'future',
    tone: input.status === 'booked' ? 'moving' : undefined,
  })
  return stops
}

/** "Waiting for Max Manager" style next-step sentence for lists (SCREENS §4.1). */
export function nextStepText(input: {
  status: AttendeeStatus
  approver: UserRef | null
  executiveApprover: UserRef | null
  openRating?: { loop: number; state: string } | null
}): string {
  if (
    input.openRating &&
    (input.openRating.state === 'due' || input.openRating.state === 'overdue')
  )
    return 'Rate this training'
  switch (input.status) {
    case 'pending_manager_approval':
      return `Waiting for ${input.approver?.displayName ?? 'the approver'}`
    case 'pending_executive_approval':
      return `Waiting for ${input.executiveApprover?.displayName ?? 'the executive'}`
    case 'to_book':
      return 'Waiting for the training office'
    case 'booked':
      return 'Booked'
    case 'booking_impossible':
      return 'Booking not possible yet'
    case 'cancellation_requested':
      return 'Cancellation with the training office'
    case 'attended':
      return 'Done'
    case 'not_attended':
      return 'Did not take part'
    case 'declined':
      return 'Declined'
    case 'cancelled':
      return 'Cancelled'
  }
}

/** Summary line under a compact route: "With Max Manager since 08:41". */
export function routeSummary(input: RouteInput): string | undefined {
  if (input.status === 'pending_manager_approval')
    return `With ${input.approver?.displayName ?? 'the approver'}`
  if (input.status === 'pending_executive_approval')
    return `With ${input.executiveApprover?.displayName ?? 'the executive'} (executive step)`
  if (input.status === 'to_book') return 'With the training office'
  return undefined
}
