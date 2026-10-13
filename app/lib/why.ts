/**
 * "Why you're seeing this" sentences (DESIGN §8.3, SCREENS §1.7) from a list item's `actingAs`
 * and approval facts. Shared by the approval split views of training and travel.
 */
import type { ActingAs, ApproverReason, UserRef } from '~/types/api'
import { formatDate } from '~/utils/format'

export interface WhySeeingInput {
  actingAs: ActingAs | null
  /** The subject (attendee / traveller). */
  subject: Pick<UserRef, 'displayName'>
  approverReason?: ApproverReason | null
  escalatedFrom?: Pick<UserRef, 'displayName'> | null
  /** For deputies: whose step it is and until when. */
  principal?: Pick<UserRef, 'displayName'> | null
  deputyUntil?: string | null
}

const firstName = (user: Pick<UserRef, 'displayName'>) => user.displayName.split(' ')[0]

export function whySeeingText(input: WhySeeingInput): string {
  const name = firstName(input.subject)
  switch (input.actingAs) {
    case 'deputy': {
      const until = input.deputyUntil
        ? ` until ${formatDate(input.deputyUntil, { weekday: false })}`
        : ''
      return input.principal
        ? `You're deputy for ${input.principal.displayName}${until}.`
        : "You're a deputy for this step's approver."
    }
    case 'manager_chain':
      return `You're in ${name}'s management chain, above the assigned approver.`
    case 'executive':
      return 'You approve trainings that cost €5,000 or more.'
    case 'approver':
      if (input.approverReason === 'site_manager_escalation' && input.escalatedFrom) {
        return `Escalated past ${input.escalatedFrom.displayName} (site manager). Approvals for their team come to you.`
      }
      if (input.approverReason === 'manager_unavailable') {
        return `${name}'s manager is unavailable, so the request moved up to you.`
      }
      if (input.approverReason === 'fallback') {
        return `No regular approver was found for ${name}, so it came to you.`
      }
      return `You're ${name}'s manager.`
    case 'back_office':
      return 'Your desk handles this queue.'
    default:
      return `You have a role on ${name}'s request.`
  }
}
