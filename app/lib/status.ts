/**
 * Status presentation (DESIGN.md §2.4, SPEC_RESOLUTIONS #8). Every workflow state renders as
 * icon + word in one of DESIGN's seven tones. State **names** are the API values.
 *
 * - Label and tone come from `/meta/enums` (enum options carry DESIGN tones). Until enums load, the
 *   fallback map below is used. It holds the same labels, so nothing flickers.
 * - Viewer-relative rendering is client-side: when the record's `availableActions` holds a decision
 *   action for the viewer, the badge renders tone `you` with an actor label ("Needs your approval").
 * - Icons always come from this map (lucide, DESIGN §2.4).
 */
import {
  Archive,
  Ban,
  CalendarClock,
  CheckCheck,
  CircleArrowRight,
  CircleCheck,
  CircleDot,
  Hand,
  Hourglass,
  Inbox,
  Package,
  PenLine,
  Pencil,
  RotateCcw,
  Star,
  TicketCheck,
  TriangleAlert,
  Undo2,
  UserRoundX,
  Wrench,
  X,
} from '@lucide/vue'
import type { Component } from 'vue'
import type { EnumOption, Tone } from '~/types/api'

export type DesignTone = Tone

export const DESIGN_TONES: readonly DesignTone[] = [
  'neutral',
  'waiting',
  'you',
  'moving',
  'positive',
  'negative',
  'blocked',
]

export interface StatusPresentation {
  /** Fallback label (same as the API enum label). */
  label: string
  tone: DesignTone
  icon: Component
  /** availableActions that mean "the viewer must act" in this state (decision actions). */
  actorActions?: readonly string[]
  /** Label/icon for the viewer who must act. Tone is always `you`. */
  actorLabel?: string
  actorIcon?: Component
}

export interface ResolvedStatus {
  label: string
  tone: DesignTone
  icon: Component
  actor: boolean
}

const APPROVAL_ACTIONS = ['approve', 'decline'] as const

const approval = (label: string): StatusPresentation => ({
  label,
  tone: 'waiting',
  icon: Hourglass,
  actorActions: APPROVAL_ACTIONS,
  actorLabel: 'Needs your approval',
  actorIcon: PenLine,
})

const toBook: StatusPresentation = {
  label: 'To book',
  tone: 'moving',
  icon: CircleArrowRight,
  actorActions: ['book', 'mark_booking_impossible'],
  actorLabel: 'Book it',
}

const shared = {
  booked: { label: 'Booked', tone: 'positive', icon: TicketCheck },
  declined: { label: 'Declined', tone: 'negative', icon: X },
  booking_impossible: { label: 'Booking impossible', tone: 'blocked', icon: TriangleAlert },
  cancellation_requested: {
    label: 'Cancellation requested',
    tone: 'waiting',
    icon: Undo2,
    actorActions: ['confirm_cancellation', 'reject_cancellation'],
    actorLabel: 'Confirm cancellation',
  },
  cancelled: { label: 'Cancelled', tone: 'neutral', icon: Ban },
} satisfies Record<string, StatusPresentation>

/** enum name (as in /meta/enums) → API value → presentation. */
export const STATUS_MAP: Record<string, Record<string, StatusPresentation>> = {
  attendeeStatus: {
    pending_manager_approval: approval('Awaiting manager'),
    pending_executive_approval: approval('Awaiting executive'),
    to_book: toBook,
    ...shared,
    attended: { label: 'Attended', tone: 'positive', icon: CheckCheck },
    not_attended: { label: 'Did not attend', tone: 'neutral', icon: UserRoundX },
  },
  travelStatus: {
    pending_approval: approval('Awaiting approval'),
    to_book: toBook,
    ...shared,
  },
  ratingState: {
    upcoming: { label: 'Upcoming', tone: 'neutral', icon: CalendarClock },
    due: {
      label: 'Due',
      tone: 'waiting',
      icon: Star,
      actorActions: ['submit'],
      actorLabel: 'Rate it',
    },
    overdue: {
      label: 'Overdue',
      tone: 'negative',
      icon: Star,
      actorActions: ['submit'],
      actorLabel: 'Rate it',
    },
    submitted: { label: 'Submitted', tone: 'positive', icon: CheckCheck },
  },
  assetStatus: {
    in_stock: { label: 'In stock', tone: 'neutral', icon: Package },
    pending_acceptance: {
      label: 'Awaiting acceptance',
      tone: 'waiting',
      icon: Hourglass,
      actorActions: ['accept', 'decline'],
      actorLabel: 'Needs your acceptance',
      actorIcon: Hand,
    },
    in_use: { label: 'In use', tone: 'positive', icon: CircleCheck },
    in_repair: { label: 'In repair', tone: 'blocked', icon: Wrench },
    scrapped: { label: 'Scrapped', tone: 'neutral', icon: Archive },
  },
  peopleRequestStatus: {
    open: {
      label: 'Open',
      tone: 'waiting',
      icon: Inbox,
      actorActions: ['start_work'],
      actorLabel: 'New for you',
    },
    in_progress: { label: 'In progress', tone: 'moving', icon: CircleArrowRight },
    waiting_internal: { label: 'Waiting (internal)', tone: 'waiting', icon: Hourglass },
    // The requester must reply; pages pass :actor (their availableActions can't tell).
    waiting_on_requester: {
      label: 'Waiting on requester',
      tone: 'waiting',
      icon: Hourglass,
      actorLabel: 'Needs your reply',
      actorIcon: PenLine,
    },
    reopened: {
      label: 'Reopened',
      tone: 'moving',
      icon: RotateCcw,
      actorActions: ['start_work'],
      actorLabel: 'Reopened for you',
    },
    completed: { label: 'Completed', tone: 'positive', icon: CheckCheck },
    rejected: { label: 'Rejected', tone: 'negative', icon: X },
    cancelled: { label: 'Cancelled', tone: 'neutral', icon: Ban },
  },
  newsStatus: {
    draft: { label: 'Draft', tone: 'neutral', icon: Pencil },
    scheduled: { label: 'Scheduled', tone: 'moving', icon: CalendarClock },
    published: { label: 'Published', tone: 'positive', icon: CircleCheck },
    archived: { label: 'Archived', tone: 'neutral', icon: Archive },
  },
  billingStatus: {
    open: { label: 'Open', tone: 'waiting', icon: Hourglass },
    invoice_received: { label: 'Invoice received', tone: 'positive', icon: CircleCheck },
    free_of_charge: { label: 'Free of charge', tone: 'neutral', icon: CircleDot },
  },
  /** Not an API enum: DeputyDto.state. */
  deputyState: {
    active: { label: 'Active', tone: 'positive', icon: CircleCheck },
    upcoming: { label: 'Upcoming', tone: 'waiting', icon: CalendarClock },
    expired: { label: 'Expired', tone: 'neutral', icon: Archive },
  },
}

/** Accept DESIGN tones; tolerate legacy API tones (info/warning/success/danger). */
export function toDesignTone(value: string | null | undefined): DesignTone | null {
  if (!value) return null
  if ((DESIGN_TONES as readonly string[]).includes(value)) return value as DesignTone
  const legacy: Record<string, DesignTone> = {
    info: 'waiting',
    warning: 'moving',
    success: 'positive',
    danger: 'negative',
  }
  return legacy[value] ?? null
}

export function sentenceCase(value: string | number): string {
  const text = String(value).replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Resolve how a state renders for the current viewer. `actor` wins when given; otherwise the viewer
 * acts when `availableActions` holds one of the state's decision actions.
 */
export function resolveStatus(
  enumName: string,
  value: string | number,
  options: {
    actor?: boolean
    availableActions?: readonly string[]
    enumOptions?: readonly EnumOption[]
  } = {},
): ResolvedStatus {
  const presentation = STATUS_MAP[enumName]?.[String(value)]
  const option = options.enumOptions?.find((candidate) => String(candidate.value) === String(value))
  const label = option?.label ?? presentation?.label ?? sentenceCase(value)
  const tone = toDesignTone(option?.tone) ?? presentation?.tone ?? 'neutral'
  const icon = presentation?.icon ?? CircleDot

  const actor =
    options.actor ??
    Boolean(
      presentation?.actorActions?.some((action) => options.availableActions?.includes(action)),
    )
  if (actor && presentation?.actorLabel) {
    return {
      label: presentation.actorLabel,
      tone: 'you',
      icon: presentation.actorIcon ?? icon,
      actor,
    }
  }
  return { label, tone, icon, actor: false }
}

/** Icon for a workflow state id, searching the given enum first, then every known enum. */
export function iconForState(stateId: string, enumName?: string): Component {
  if (enumName && STATUS_MAP[enumName]?.[stateId]) return STATUS_MAP[enumName]![stateId]!.icon
  for (const states of Object.values(STATUS_MAP)) {
    if (states[stateId]) return states[stateId]!.icon
  }
  return CircleDot
}

/** Canonical order of positive (primary) actions for ActionBar: the first match is primary. */
export const PRIMARY_ACTIONS = [
  'approve',
  'accept',
  'book',
  'submit',
  'confirm_cancellation',
  'start_work',
  'resume',
  'complete',
  'publish',
  'retry_booking',
  'assign',
  'complete_repair',
] as const

/** Actions that destroy or refuse: rendered `danger`, never primary. */
export const NEGATIVE_ACTIONS = [
  'decline',
  'reject',
  'reject_cancellation',
  'mark_booking_impossible',
  'withdraw',
  'cancel',
  'request_cancellation',
  'scrap',
  'delete',
  'close',
] as const
