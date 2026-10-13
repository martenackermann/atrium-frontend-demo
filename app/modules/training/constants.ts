import {
  Ban,
  Check,
  CircleArrowRight,
  RotateCcw,
  TicketCheck,
  TriangleAlert,
  Undo2,
  X,
} from '@lucide/vue'
import type { ActionConfig } from '~/types/ui'
import type { AttendeeStatus, Likert, RatingLoop, TrainingFormat } from './api/types'

/**
 * ActionBar config for participation actions (API order). `book` opens the booking dialog
 * (reference + documents) instead of running directly — see TrainingParticipationActions.
 */
export const TRAINING_ACTIONS: Record<string, ActionConfig> = {
  approve: { label: 'Approve', icon: Check, kbd: 'A', variant: 'primary' },
  decline: {
    label: 'Decline…',
    icon: X,
    kbd: 'D',
    reason: {
      title: 'Decline this training?',
      description: 'The attendee and the requester are told why. Nothing is booked.',
      label: 'Tell them why',
      hint: 'The attendee and the requester see this reason in their email.',
      confirmLabel: 'Decline training',
    },
  },
  withdraw: {
    label: 'Withdraw',
    icon: Undo2,
    confirm: {
      title: 'Withdraw this request?',
      description: 'The participation is cancelled. Nobody needs to decide on it any more.',
      confirmLabel: 'Withdraw request',
      cancelLabel: 'Keep request',
    },
    variant: 'danger',
  },
  request_cancellation: {
    label: 'Request cancellation…',
    icon: Undo2,
    reason: {
      title: 'Ask to cancel this training?',
      description:
        'The training office confirms the cancellation, or explains why it is no longer possible.',
      label: 'Why cancel?',
      hint: 'The training office sees this reason.',
      confirmLabel: 'Request cancellation',
    },
    variant: 'secondary',
  },
  confirm_cancellation: {
    label: 'Confirm cancellation',
    icon: Ban,
    confirm: {
      title: 'Confirm the cancellation?',
      description: 'The participation is cancelled and the attendee is told by email.',
      confirmLabel: 'Confirm cancellation',
      cancelLabel: 'Back',
    },
    variant: 'primary',
  },
  reject_cancellation: {
    label: 'Reject cancellation…',
    icon: RotateCcw,
    reason: {
      title: 'Keep the participation?',
      description: 'The participation goes back to where it was. The attendee sees your reason.',
      label: 'Why it stays',
      confirmLabel: 'Reject cancellation',
    },
  },
  book: { label: 'Book it…', icon: TicketCheck, variant: 'primary' },
  mark_booking_impossible: {
    label: 'Booking impossible…',
    icon: TriangleAlert,
    reason: {
      title: 'Mark the booking as impossible?',
      description: 'The attendee and the requester are told. You can retry the booking later.',
      label: 'What went wrong',
      hint: 'For example "Provider fully booked until next quarter".',
      confirmLabel: 'Mark impossible',
    },
    variant: 'danger',
  },
  retry_booking: { label: 'Retry booking', icon: CircleArrowRight, variant: 'primary' },
  close: {
    label: 'Close…',
    icon: Ban,
    reason: {
      title: 'Close this participation?',
      description: 'It is cancelled for good. The attendee and the requester see your reason.',
      label: 'Reason',
      confirmLabel: 'Close participation',
    },
    variant: 'danger',
  },
}

/** Toast per action: the result echoes the verb (DESIGN §10). */
export const ACTION_MESSAGES: Record<string, string> = {
  approve: 'Approved.',
  decline: 'Declined. The attendee is told why.',
  withdraw: 'Withdrawn.',
  request_cancellation: 'Cancellation requested. The training office confirms it.',
  confirm_cancellation: 'Cancellation confirmed.',
  reject_cancellation: 'Cancellation rejected. The participation stays as it was.',
  book: 'Booked. The attendee gets the details by email.',
  mark_booking_impossible: 'Marked as impossible. The attendee is told.',
  retry_booking: 'Back in the booking queue.',
  close: 'Closed.',
}

export const FORMAT_LABEL: Record<TrainingFormat, string> = {
  in_person: 'In person',
  online: 'Online',
  hybrid: 'Hybrid',
}

export const ROUND_LABEL: Record<RatingLoop, string> = {
  1: 'Your feedback',
  2: 'Putting it into practice',
  3: "Manager's view",
}

export const LIKERT_OPTIONS: { value: Likert; label: string }[] = [
  { value: 'A', label: 'Fully agree' },
  { value: 'B', label: 'Mostly agree' },
  { value: 'C', label: 'Partly agree' },
  { value: 'D', label: 'Disagree' },
]

export const IMPROVEMENT_OPTIONS = [
  { value: '1', label: 'Clearly visible' },
  { value: '2', label: 'Visible' },
  { value: '3', label: 'Barely visible' },
  { value: '4', label: 'Not visible' },
] as const

export const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6].map((grade) => ({
  value: String(grade),
  label: String(grade),
}))

/** School grades, 1 = excellent … 6 = insufficient (DESIGN §10). */
export const GRADE_WORDS: Record<number, string> = {
  1: 'Excellent',
  2: 'Good',
  3: 'Satisfactory',
  4: 'Sufficient',
  5: 'Poor',
  6: 'Insufficient',
}

export const ATTENDEE_STATUSES: AttendeeStatus[] = [
  'pending_manager_approval',
  'pending_executive_approval',
  'to_book',
  'booked',
  'booking_impossible',
  'cancellation_requested',
  'attended',
  'not_attended',
  'declined',
  'cancelled',
]

export const THRESHOLD_CENTS = 500_000
