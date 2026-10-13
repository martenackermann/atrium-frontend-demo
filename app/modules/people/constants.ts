/**
 * People-request vocabulary for the UI (owned by slice A4): type cards, ActionBar config, the
 * queues of the People Ops split view and the routing slip of a request.
 */
import {
  Ban,
  CircleCheck,
  CirclePlay,
  Hourglass,
  MessageCircleQuestion,
  RotateCcw,
  UserMinus,
  UserPlus,
  UserRoundCog,
  X,
} from '@lucide/vue'
import type { Component } from 'vue'
import type { ActionConfig, RouteStop } from '~/types/ui'
import { formatDate } from '~/utils/format'
import type {
  PeopleRequestStatus,
  PeopleRequestSummary,
  PeopleRequestType,
  Priority,
} from './api/types'

export const TYPE_META: Record<
  PeopleRequestType,
  { label: string; short: string; icon: Component; effectiveLabel: string; description: string }
> = {
  onboarding: {
    label: 'Onboarding',
    short: 'Onboarding',
    icon: UserPlus,
    effectiveLabel: 'Start date',
    description: 'A new colleague joins: accounts, equipment, badge and a first day that works.',
  },
  offboarding: {
    label: 'Offboarding',
    short: 'Offboarding',
    icon: UserMinus,
    effectiveLabel: 'Last working day',
    description: 'Someone leaves: hand-over, returned equipment and closed accounts.',
  },
  role_change: {
    label: 'Role or access change',
    short: 'Role change',
    icon: UserRoundCog,
    effectiveLabel: 'Change date',
    description: 'A new role, a promotion or access to a tool someone needs for their work.',
  },
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
}

export const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABELS) as Priority[]).map((value) => ({
  value,
  label: PRIORITY_LABELS[value],
}))

export const CLOSED_STATUSES: readonly PeopleRequestStatus[] = [
  'completed',
  'rejected',
  'cancelled',
]
export const isClosed = (status: PeopleRequestStatus) => CLOSED_STATUSES.includes(status)

/** People Ops queues (SCREENS §7.4): open (open + reopened) · in progress · waiting · closed · all. */
export const OPS_QUEUES = {
  open: { label: 'Open', statuses: ['open', 'reopened'] },
  in_progress: { label: 'In progress', statuses: ['in_progress'] },
  waiting: { label: 'Waiting', statuses: ['waiting_internal', 'waiting_on_requester'] },
  closed: { label: 'Closed', statuses: ['completed', 'rejected', 'cancelled'] },
  all: { label: 'All', statuses: [] },
} as const satisfies Record<string, { label: string; statuses: readonly PeopleRequestStatus[] }>
export type OpsQueue = keyof typeof OPS_QUEUES

/** ActionBar configuration (API.md §7.1 action bodies). */
export const PEOPLE_ACTIONS: Record<string, ActionConfig> = {
  start_work: { label: 'Start work', icon: CirclePlay, variant: 'primary' },
  wait_internal: {
    label: 'Waiting (internal)',
    icon: Hourglass,
    reason: {
      title: 'Wait on another team',
      description: 'The request pauses until you resume it. The requester sees the new status.',
      label: 'Internal note',
      hint: 'Only People Ops sees this note. It is never emailed.',
      confirmLabel: 'Set to waiting',
      field: 'note',
    },
  },
  wait_on_requester: {
    label: 'Ask requester',
    icon: MessageCircleQuestion,
    reason: {
      title: 'Ask the requester',
      description: 'The request waits for their reply; their answer moves it back to you.',
      label: 'Your question',
      hint: 'The requester and the manager see this question in Atrium and by email.',
      confirmLabel: 'Send question',
      field: 'question',
    },
  },
  resume: { label: 'Resume', icon: CirclePlay, variant: 'primary' },
  complete: {
    label: 'Complete',
    icon: CircleCheck,
    confirm: {
      title: 'Complete this request?',
      description: 'The requester and the manager are told it is done.',
      confirmLabel: 'Complete request',
    },
  },
  reject: {
    label: 'Reject…',
    icon: X,
    reason: {
      title: 'Reject this request?',
      description: 'The requester is told why. People Ops can reopen it later.',
      label: 'Tell them why',
      hint: 'The requester and the manager see this reason.',
      confirmLabel: 'Reject request',
    },
  },
  cancel: {
    label: 'Cancel request…',
    icon: Ban,
    reason: {
      title: 'Cancel this request?',
      description: 'People Ops stops working on it. You can start a new request at any time.',
      label: 'Reason',
      hint: 'People Ops and the manager see this reason.',
      confirmLabel: 'Cancel request',
    },
  },
  reopen: {
    label: 'Reopen…',
    icon: RotateCcw,
    reason: {
      title: 'Reopen this request?',
      description: 'It goes back to People Ops with your reason.',
      label: 'What is still missing?',
      hint: 'People Ops and the manager see this reason.',
      confirmLabel: 'Reopen request',
    },
  },
}

export const ACTION_MESSAGES: Record<string, string> = {
  start_work: 'Work started.',
  wait_internal: 'Set to waiting (internal).',
  wait_on_requester: 'Question sent to the requester.',
  resume: 'Work resumed.',
  complete: 'Completed. The requester is told.',
  reject: 'Rejected.',
  cancel: 'Request cancelled.',
  reopen: 'Reopened.',
}

const WAITING_ON_REQUESTER = 'waiting_on_requester'

/**
 * Routing slip of a people request (DESIGN §1): requester → People Ops (who works on it) → done.
 * `viewerIsRequester` turns the requester stop into the marker while People Ops waits on them.
 */
export function peopleRoute(
  request: Pick<PeopleRequestSummary, 'status' | 'requester' | 'assignee' | 'createdAt'>,
  viewerIsRequester = false,
): RouteStop[] {
  const waitingOnRequester = request.status === WAITING_ON_REQUESTER
  const opsWho = request.assignee?.displayName ?? 'People Ops'
  const opsInitials = request.assignee?.initials ?? 'PO'
  const closed = isClosed(request.status)
  const stopped = request.status === 'rejected' || request.status === 'cancelled'
  return [
    {
      step: waitingOnRequester ? 'Reply needed' : 'Requested',
      who: request.requester.displayName,
      initials: request.requester.initials,
      when: waitingOnRequester ? undefined : formatDate(request.createdAt),
      state: waitingOnRequester ? 'current' : 'done',
      tone: waitingOnRequester ? (viewerIsRequester ? 'you' : 'waiting') : undefined,
    },
    {
      step:
        request.status === 'open' || request.status === 'reopened'
          ? 'Waiting for People Ops'
          : 'People Ops',
      who: opsWho,
      initials: opsInitials,
      state: closed ? (stopped ? 'stopped' : 'done') : waitingOnRequester ? 'future' : 'current',
      tone:
        request.status === 'in_progress' || request.status === 'reopened' ? 'moving' : 'waiting',
    },
    {
      step: request.status === 'completed' ? 'Completed' : 'Done',
      icon: CircleCheck,
      state: request.status === 'completed' ? 'done' : stopped ? 'skipped' : 'future',
    },
  ]
}

/** "With Paula People-Ops", "Waiting for your reply", "Completed on Tue 6 Oct". */
export function routeSummary(
  request: Pick<PeopleRequestSummary, 'status' | 'assignee' | 'updatedAt'>,
  viewerIsRequester = false,
): string {
  switch (request.status) {
    case 'open':
      return 'Waiting for People Ops to pick it up'
    case 'reopened':
      return `Reopened, with ${request.assignee?.displayName ?? 'People Ops'}`
    case 'in_progress':
      return `With ${request.assignee?.displayName ?? 'People Ops'}`
    case 'waiting_internal':
      return `${request.assignee?.displayName ?? 'People Ops'} waits on another team`
    case 'waiting_on_requester':
      return viewerIsRequester ? 'Waiting for your reply' : 'Waiting for the requester'
    case 'completed':
      return `Completed ${formatDate(request.updatedAt, { weekday: false })}`
    case 'rejected':
      return 'Rejected by People Ops'
    case 'cancelled':
      return 'Cancelled'
  }
}
