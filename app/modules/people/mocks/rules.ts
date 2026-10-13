/**
 * Pure people-request rules shared by the mock seed, handlers and workflow (no database import):
 * references, visibility (SPEC §3.4, SPEC_RESOLUTIONS #24/#25), timeline sentences and the
 * notification texts of SPEC §7 - the same rules as the backend.
 */
import type { ActingAs } from '~/types/api'
import type { MockUser } from '~/mocks/core/types'
import type { PeopleRequestStatus, PeopleRequestType, Priority } from '../api/types'
import type { PeopleRequestRecord } from './types'

export const peopleReference = (number: number) => `PPL-${String(number).padStart(6, '0')}`

export const parsePeopleReference = (q: string): number | null => {
  const match = /^PPL-(\d{1,9})$/i.exec(q.trim())
  return match ? Number(match[1]) : null
}

export const TYPE_LABELS: Record<PeopleRequestType, string> = {
  onboarding: 'Onboarding',
  offboarding: 'Offboarding',
  role_change: 'Role or access change',
}

export const STATUS_LABELS: Record<PeopleRequestStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_internal: 'Waiting (internal)',
  waiting_on_requester: 'Waiting on requester',
  reopened: 'Reopened',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const CLOSED: readonly PeopleRequestStatus[] = ['completed', 'rejected', 'cancelled']
export const isClosedStatus = (status: PeopleRequestStatus) => CLOSED.includes(status)
export const isHighPriority = (priority: Priority) => priority === 'critical' || priority === 'high'

/** people_ops or it_admin (stored roles). */
export const isBackOffice = (user: Pick<MockUser, 'roles'>) =>
  user.roles.includes('people_ops') || user.roles.includes('it_admin')

type Relations = Pick<PeopleRequestRecord, 'requesterId' | 'managerId' | 'managerDeputyId'>

export const canView = (user: MockUser, row: Relations) =>
  isBackOffice(user) ||
  row.requesterId === user.id ||
  row.managerId === user.id ||
  row.managerDeputyId === user.id

export const isMine = (user: MockUser, row: Relations) =>
  row.requesterId === user.id || row.managerId === user.id || row.managerDeputyId === user.id

/** Personal data and people documents: requester, manager, people_ops - never it_admin (D13). */
export const canSeePersonalData = (user: MockUser, row: Relations) =>
  user.roles.includes('people_ops') || row.requesterId === user.id || row.managerId === user.id

export const canEdit = (user: MockUser, row: Relations & { status: PeopleRequestStatus }) =>
  isBackOffice(user)
    ? !isClosedStatus(row.status)
    : row.requesterId === user.id && row.status === 'open'

export const canComment = (user: MockUser, row: Relations & { status: PeopleRequestStatus }) =>
  !isClosedStatus(row.status) &&
  (isBackOffice(user) || row.requesterId === user.id || row.managerId === user.id)

/** actingAs of a back-office actor. */
export const backOfficeActingAs = (user: Pick<MockUser, 'roles'>): ActingAs =>
  user.roles.includes('people_ops') ? 'back_office' : 'admin'

const PHRASES: Record<string, string> = {
  create: 'created the request',
  update: 'updated the request',
  start_work: 'started work',
  wait_internal: 'set the request to waiting (internal)',
  wait_on_requester: 'asked the requester a question',
  requester_replied: 'replied to the question',
  resume: 'resumed work',
  complete: 'completed the request',
  reject: 'rejected the request',
  cancel: 'cancelled the request',
  reopen: 'reopened the request',
}

const SUFFIX: Partial<Record<ActingAs, string>> = {
  back_office: ' (back office)',
  admin: ' (as admin)',
}

/** Timeline sentence, as the backend renders it: "Paula People-Ops started work (back office)". */
export function peopleSummary(actorName: string, action: string, actingAs: ActingAs): string {
  return `${actorName} ${PHRASES[action] ?? action.replace(/_/g, ' ')}${SUFFIX[actingAs] ?? ''}`
}

const STATUS_TEXT: Partial<Record<PeopleRequestStatus, string>> = {
  in_progress: 'People Ops is working on it.',
  waiting_internal: 'People Ops is waiting on another team and tells you when it moves on.',
  waiting_on_requester: 'People Ops needs your reply before they can continue.',
  reopened: 'The request was reopened.',
  completed: 'The request is complete.',
  rejected: 'The request was rejected.',
  cancelled: 'The request was cancelled.',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
}

/** The backend's `truncate`: at most `max` characters, with an ellipsis when cut. */
const truncate = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`

/** "Tue 27 Oct" for a calendar date (en-GB, like the backend `shortDate`). */
export function shortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(year!, month! - 1, day!))
    .replace(',', '')
}

/** In-app title of `people.status_changed`: sentence case, the label reads lower case. */
export const statusChangedTitle = (reference: string, status: PeopleRequestStatus) =>
  `${reference} is now ${STATUS_LABELS[status].toLowerCase()}`

/** In-app text of `people.status_changed` (internal notes never included, #19). */
export function statusChangedText(
  title: string,
  status: PeopleRequestStatus,
  extra: { question?: string | null; reason?: string | null; note?: string | null },
) {
  return [
    `${title}: ${STATUS_TEXT[status] ?? `Now ${STATUS_LABELS[status].toLowerCase()}.`}`,
    extra.question ? `Question: ${extra.question}` : null,
    extra.reason ? `Reason: ${extra.reason}` : null,
    extra.note ? `Note: ${extra.note}` : null,
  ]
    .filter(Boolean)
    .join(' ')
}

/** In-app title and body of `people.request_created` (no personal data). */
export function requestCreatedText(c: {
  reference: string
  type: PeopleRequestType
  title: string
  effectiveDate: string
  priority: Priority
  requesterName: string
  subjectName: string
}) {
  const typeLabel = TYPE_LABELS[c.type].toLowerCase()
  return {
    templateId: 'people.request_created',
    title: `New ${typeLabel} request: ${c.title}`,
    body: `${c.requesterName} requested ${typeLabel} for ${c.subjectName} (${c.reference}). ${EFFECTIVE_LABELS[c.type]}: ${shortDate(c.effectiveDate)}. Priority: ${PRIORITY_LABELS[c.priority]}.`,
  }
}

/** In-app title and body of `people.comment_added` (excerpt ≤ 300 characters). */
export function commentAddedText(c: {
  reference: string
  title: string
  authorName: string
  excerpt: string
}) {
  return {
    templateId: 'people.comment_added',
    title: `New comment on ${c.reference}`,
    body: `${c.authorName} on ${c.title}: ${truncate(c.excerpt, 300)}`,
  }
}

export const EFFECTIVE_LABELS: Record<PeopleRequestType, string> = {
  onboarding: 'Start date',
  offboarding: 'Last working day',
  role_change: 'Change date',
}
