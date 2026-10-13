/**
 * The `people_request` state machine for demo mode (SPEC §5.4) - the same transitions, actors and
 * side effects as the backend: status-note / question comments, `people.status_changed` and
 * `people.comment_added` in-app notifications (internal notes are never sent, #19).
 */
import { z } from 'zod'
import { recordAudit } from '~/mocks/core/audit'
import type { MockUser } from '~/mocks/core/types'
import { db } from '~/mocks/db'
import { defineMockWorkflow } from '~/mocks/workflow'
import type { PeopleRequestStatus } from '../api/types'
import {
  backOfficeActingAs,
  canComment,
  canEdit,
  commentAddedText,
  isBackOffice,
  isHighPriority,
  peopleReference,
  peopleSummary,
  statusChangedText,
  statusChangedTitle,
} from './rules'
import type { PeopleRequestRecord } from './types'

export const REOPEN_WINDOW_DAYS = 30
const DAY_MS = 86_400_000

const note = z.strictObject({
  note: z.string().trim().max(2000).nullish(),
})
const requiredNote = z.strictObject({ note: z.string().trim().min(3).max(2000) })
const question = z.strictObject({ question: z.string().trim().min(3).max(2000) })
const reason = z.strictObject({ reason: z.string().trim().min(3).max(1000) })

const ACTIVE: PeopleRequestStatus[] = [
  'open',
  'in_progress',
  'waiting_internal',
  'waiting_on_requester',
  'reopened',
]

const opsOnly = (_: PeopleRequestRecord, user: MockUser) =>
  isBackOffice(user) ? backOfficeActingAs(user) : false

/** In-app notification for a user recipient (functional mailboxes get email only, D17). */
export function notifyUser(
  userId: string | null | undefined,
  row: PeopleRequestRecord,
  input: { templateId: string; title: string; body: string; priority?: 'high' | 'normal' },
) {
  if (!userId) return
  db.notifications.insert({
    userId,
    templateId: input.templateId,
    module: 'people',
    title: input.title.slice(0, 140),
    body: input.body.slice(0, 500),
    link: `/people-requests/${row.id}`,
    priority: input.priority ?? (isHighPriority(row.priority) ? 'high' : 'normal'),
    readAt: null,
    createdAt: new Date().toISOString(),
  })
}

/** SPEC §7 `people.status_changed`: requester (People Ops when the requester acts), cc manager. */
function notifyStatus(
  row: PeopleRequestRecord,
  actor: MockUser,
  extra: { question?: string | null; reason?: string | null; note?: string | null },
) {
  const title = statusChangedTitle(peopleReference(row.number), row.status)
  const body = statusChangedText(row.title, row.status, extra)
  const to = row.requesterId !== actor.id ? row.requesterId : row.assigneeId
  if (to && to !== actor.id)
    notifyUser(to, row, { templateId: 'people.status_changed', title, body })
  if (row.managerId && row.managerId !== actor.id && row.managerId !== row.requesterId) {
    notifyUser(row.managerId, row, { templateId: 'people.status_changed', title, body })
  }
}

/** SPEC §7 `people.comment_added` (+ #19: manager comments reach requester and People Ops). */
export function notifyComment(row: PeopleRequestRecord, author: MockUser, text: string) {
  const recipients = new Set<string>()
  if (row.requesterId === author.id) {
    if (row.assigneeId) recipients.add(row.assigneeId)
  } else if (isBackOffice(author)) {
    recipients.add(row.requesterId)
  } else {
    recipients.add(row.requesterId)
    if (row.assigneeId) recipients.add(row.assigneeId)
  }
  recipients.delete(author.id)
  const added = commentAddedText({
    reference: peopleReference(row.number),
    title: row.title,
    authorName: author.displayName,
    excerpt: text,
  })
  // The backend sends comment notifications with normal priority.
  for (const userId of recipients) notifyUser(userId, row, { ...added, priority: 'normal' })
}

function addComment(
  row: PeopleRequestRecord,
  author: MockUser,
  body: string,
  options: { internal: boolean; kind: 'comment' | 'question' | 'status_note' },
) {
  return db.peopleComments.insert({
    requestId: row.id,
    authorId: author.id,
    body: body.trim(),
    internal: options.internal,
    kind: options.kind,
    createdAt: new Date().toISOString(),
  })
}

const now = () => new Date().toISOString()
const bump = (entity: PeopleRequestRecord) => ({ version: entity.version + 1, updatedAt: now() })

export const peopleWorkflow = defineMockWorkflow<PeopleRequestRecord>({
  name: 'people_request',
  label: 'People request',
  module: 'people',
  entityType: 'people_request',
  entityLabel: (row) => `${peopleReference(row.number)} ${row.title}`,
  initialStates: ['open'],
  states: {
    open: { label: 'Open', tone: 'waiting' },
    in_progress: { label: 'In progress', tone: 'moving' },
    waiting_internal: { label: 'Waiting (internal)', tone: 'waiting' },
    waiting_on_requester: { label: 'Waiting on requester', tone: 'waiting' },
    reopened: { label: 'Reopened', tone: 'moving' },
    completed: { label: 'Completed', tone: 'positive' },
    rejected: { label: 'Rejected', tone: 'negative' },
    cancelled: { label: 'Cancelled', tone: 'neutral', terminal: true },
  },
  transitions: [
    {
      event: 'start_work',
      from: ['open', 'reopened'],
      to: 'in_progress',
      label: 'Start work',
      actors: ['People Ops'],
      allowed: opsOnly,
      body: note,
      apply: ({ entity, user }) => ({ ...bump(entity), assigneeId: entity.assigneeId ?? user.id }),
      summary: ({ user, actingAs }) => peopleSummary(user.displayName, 'start_work', actingAs),
      after: ({ updated, user, body }) => {
        if (body.note)
          addComment(updated, user, String(body.note), { internal: false, kind: 'status_note' })
        notifyStatus(updated, user, { note: (body.note as string | null) ?? null })
      },
    },
    {
      event: 'wait_internal',
      from: ['in_progress'],
      to: 'waiting_internal',
      label: 'Wait (internal)',
      actors: ['People Ops'],
      allowed: opsOnly,
      body: requiredNote,
      apply: ({ entity }) => bump(entity),
      summary: ({ user, actingAs }) => peopleSummary(user.displayName, 'wait_internal', actingAs),
      after: ({ updated, user, body }) => {
        addComment(updated, user, String(body.note), { internal: true, kind: 'status_note' })
        notifyStatus(updated, user, {})
      },
    },
    {
      event: 'wait_on_requester',
      from: ['in_progress'],
      to: 'waiting_on_requester',
      label: 'Ask requester',
      actors: ['People Ops'],
      allowed: opsOnly,
      body: question,
      apply: ({ entity }) => bump(entity),
      summary: ({ user, actingAs }) =>
        peopleSummary(user.displayName, 'wait_on_requester', actingAs),
      after: ({ updated, user, body }) => {
        addComment(updated, user, String(body.question), { internal: false, kind: 'question' })
        notifyStatus(updated, user, { question: String(body.question) })
      },
    },
    {
      event: 'resume',
      from: ['waiting_internal', 'waiting_on_requester'],
      to: 'in_progress',
      label: 'Resume',
      actors: ['People Ops'],
      allowed: opsOnly,
      body: note,
      apply: ({ entity }) => bump(entity),
      summary: ({ user, actingAs }) => peopleSummary(user.displayName, 'resume', actingAs),
      after: ({ updated, user, body }) => {
        if (body.note)
          addComment(updated, user, String(body.note), { internal: false, kind: 'status_note' })
        notifyStatus(updated, user, { note: (body.note as string | null) ?? null })
      },
    },
    {
      event: 'complete',
      from: ['in_progress', 'waiting_internal', 'waiting_on_requester'],
      to: 'completed',
      label: 'Complete',
      actors: ['People Ops'],
      allowed: opsOnly,
      body: note,
      apply: ({ entity }) => ({ ...bump(entity), closedAt: now() }),
      summary: ({ user, actingAs }) => peopleSummary(user.displayName, 'complete', actingAs),
      after: ({ updated, user, body }) => {
        if (body.note)
          addComment(updated, user, String(body.note), { internal: false, kind: 'status_note' })
        notifyStatus(updated, user, { note: (body.note as string | null) ?? null })
      },
    },
    {
      event: 'reject',
      from: ACTIVE,
      to: 'rejected',
      label: 'Reject',
      actors: ['People Ops'],
      allowed: opsOnly,
      body: reason,
      apply: ({ entity, body }) => ({
        ...bump(entity),
        closedAt: now(),
        statusReason: String(body.reason),
      }),
      summary: ({ user, actingAs }) => peopleSummary(user.displayName, 'reject', actingAs),
      after: ({ updated, user, body }) =>
        notifyStatus(updated, user, { reason: String(body.reason) }),
    },
    {
      event: 'cancel',
      from: ACTIVE,
      to: 'cancelled',
      label: 'Cancel',
      actors: ['Requester', 'People Ops'],
      allowed: (entity, user) =>
        isBackOffice(user)
          ? backOfficeActingAs(user)
          : entity.requesterId === user.id
            ? 'requester'
            : false,
      body: reason,
      apply: ({ entity, body }) => ({
        ...bump(entity),
        closedAt: now(),
        statusReason: String(body.reason),
      }),
      summary: ({ user, actingAs }) => peopleSummary(user.displayName, 'cancel', actingAs),
      after: ({ updated, user, body }) =>
        notifyStatus(updated, user, { reason: String(body.reason) }),
    },
    {
      event: 'reopen',
      from: ['completed', 'rejected'],
      to: 'reopened',
      label: 'Reopen',
      actors: ['People Ops', 'Requester (completed, within 30 days)'],
      allowed: (entity, user) => {
        if (isBackOffice(user)) return backOfficeActingAs(user)
        if (entity.requesterId !== user.id || entity.status !== 'completed' || !entity.closedAt)
          return false
        return Date.now() - new Date(entity.closedAt).getTime() <= REOPEN_WINDOW_DAYS * DAY_MS
          ? 'requester'
          : false
      },
      body: reason,
      apply: ({ entity, body }) => ({
        ...bump(entity),
        closedAt: null,
        statusReason: String(body.reason),
      }),
      summary: ({ user, actingAs }) => peopleSummary(user.displayName, 'reopen', actingAs),
      after: ({ updated, user, body }) =>
        notifyStatus(updated, user, { reason: String(body.reason) }),
    },
  ],
  systemTransitions: [
    {
      from: 'waiting_on_requester',
      to: 'in_progress',
      event: 'requester_replied',
      label: 'Requester replies',
      actors: ['Requester'],
    },
  ],
  capabilities: {
    edit: (entity, user) => canEdit(user, entity),
    edit_internal: (_, user) => isBackOffice(user),
    comment: (entity, user) => canComment(user, entity),
    comment_internal: (_, user) => isBackOffice(user),
  },
})

/**
 * A requester's public comment while People Ops waits on them: the system event
 * `requester_replied` moves the request back to in_progress (SPEC §5.4) and notifies the assignee.
 */
export function requesterReplied(row: PeopleRequestRecord, author: MockUser, text: string) {
  const comment = addComment(row, author, text, { internal: false, kind: 'comment' })
  const updated = db.peopleRequests.update(row.id, { status: 'in_progress', ...bump(row) })!
  recordAudit(db, {
    module: 'people',
    entityType: 'people_request',
    entityId: row.id,
    entityLabel: `${peopleReference(row.number)} ${row.title}`,
    action: 'requester_replied',
    actorId: author.id,
    actingAs: 'requester',
    fromState: 'waiting_on_requester',
    toState: 'in_progress',
    summary: peopleSummary(author.displayName, 'requester_replied', 'requester'),
  })
  notifyComment(updated, author, text)
  return comment
}

export { addComment }
