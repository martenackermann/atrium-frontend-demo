import type { EnumOption, InboxItem, SearchHit } from '~/types/api'
import { db } from '~/mocks/db'
import { defineMockProviders } from '~/mocks/define'
import type { PeopleCounts, PeopleRequestStatus } from '../api/types'
import {
  canView,
  isBackOffice,
  isClosedStatus,
  isHighPriority,
  isMine,
  parsePeopleReference,
  peopleReference,
  STATUS_LABELS,
  TYPE_LABELS,
} from './rules'
import { peopleWorkflow } from './workflow'

/**
 * People-request contributions to foundation endpoints (slice A4): the workflow diagram, enums,
 * inbox items (API.md §8 `people.reply_required` / `people.triage_required`), ⌘K search and
 * `/people/queues/counts` - the same rules as the backend providers.
 */
const o = (value: string, label: string, tone: EnumOption['tone'] = null): EnumOption => ({
  value,
  label,
  tone,
  description: null,
})

/** Calendar date -> 00:00 local as an ISO instant (SPEC_RESOLUTIONS #31). */
const dueAt = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year!, month! - 1, day!).toISOString()
}
const shortDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(year!, month! - 1, day!))
    .replace(',', '')
}
const excerpt = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text
const active = (status: PeopleRequestStatus) => !isClosedStatus(status)

export default defineMockProviders({
  workflows: [peopleWorkflow],
  enums: {
    peopleRequestType: [
      o('onboarding', 'Onboarding'),
      o('offboarding', 'Offboarding'),
      o('role_change', 'Role or access change'),
    ],
    peopleRequestStatus: [
      o('open', 'Open', 'waiting'),
      o('in_progress', 'In progress', 'moving'),
      o('waiting_internal', 'Waiting (internal)', 'waiting'),
      o('waiting_on_requester', 'Waiting on requester', 'waiting'),
      o('reopened', 'Reopened', 'moving'),
      o('completed', 'Completed', 'positive'),
      o('rejected', 'Rejected', 'negative'),
      o('cancelled', 'Cancelled', 'neutral'),
    ],
    priority: [
      o('critical', 'Critical', 'negative'),
      o('high', 'High', 'moving'),
      o('normal', 'Normal', 'neutral'),
      o('low', 'Low', 'neutral'),
    ],
    salutation: [o('mr', 'Mr'), o('ms', 'Ms'), o('mx', 'Mx')],
    peopleCommentKind: [
      o('comment', 'Comment'),
      o('question', 'Question'),
      o('status_note', 'Status note'),
    ],
  },

  inbox: (user) => {
    const items: InboxItem[] = db.peopleRequests
      .where((row) => row.requesterId === user.id && row.status === 'waiting_on_requester')
      .map((row) => {
        const question = db.peopleComments
          .where((c) => c.requestId === row.id && c.kind === 'question' && !c.internal)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
        return {
          id: `people.reply_required:${row.id}`,
          module: 'people',
          type: 'people.reply_required',
          reference: peopleReference(row.number),
          title: `Reply needed: ${row.title}`,
          subtitle: question ? excerpt(question.body, 120) : null,
          dueAt: dueAt(row.effectiveDate),
          priority: isHighPriority(row.priority) ? 'high' : 'normal',
          actingAs: 'requester',
          link: `/people-requests/${row.id}`,
          actionsPath: `/people/requests/${row.id}`,
          entityId: row.id,
          createdAt: row.updatedAt,
          quickActions: [],
        }
      })
    // it_admin supervises through navigation and gets no back-office items (API.md §8).
    if (user.roles.includes('people_ops')) {
      const triage = db.peopleRequests.where(
        (r) =>
          (r.status === 'open' || r.status === 'reopened') &&
          (r.assigneeId === null || r.assigneeId === user.id) &&
          r.subjectUserId !== user.id,
      )
      for (const row of triage) {
        const requester = db.users.find(row.requesterId)
        items.push({
          id: `people.triage_required:${row.id}`,
          module: 'people',
          type: 'people.triage_required',
          reference: peopleReference(row.number),
          title: `${TYPE_LABELS[row.type]}: ${row.title}`,
          subtitle: `${requester?.displayName ?? 'Someone'} · effective ${shortDate(row.effectiveDate)}`,
          dueAt: dueAt(row.effectiveDate),
          priority: isHighPriority(row.priority) ? 'high' : 'normal',
          actingAs: 'back_office',
          link: `/back-office/people?queue=open&selected=${row.id}`,
          actionsPath: `/people/requests/${row.id}`,
          entityId: row.id,
          createdAt: row.createdAt,
          quickActions: [],
        })
      }
    }
    return items
  },

  search: (user, q) => {
    const reference = parsePeopleReference(q)
    const term = q.trim().toLowerCase()
    return db.peopleRequests
      .where(
        (row) =>
          canView(user, row) &&
          (reference !== null
            ? row.number === reference
            : `${row.title} ${row.firstName} ${row.lastName}`.toLowerCase().includes(term)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((row): SearchHit => ({
        module: 'people',
        type: 'people_request',
        id: row.id,
        reference: peopleReference(row.number),
        title: row.title,
        subtitle: `${TYPE_LABELS[row.type]} · ${row.firstName} ${row.lastName} · ${STATUS_LABELS[row.status]} · ${shortDate(row.effectiveDate)}`,
        link: `/people-requests/${row.id}`,
      }))
  },

  counts: (user): PeopleCounts & Record<string, unknown> => {
    const rows = db.peopleRequests.all()
    const ops = isBackOffice(user)
      ? {
          open: rows.filter((r) => r.status === 'open').length,
          reopened: rows.filter((r) => r.status === 'reopened').length,
          inProgress: rows.filter((r) => r.status === 'in_progress').length,
          waiting: rows.filter(
            (r) => r.status === 'waiting_internal' || r.status === 'waiting_on_requester',
          ).length,
          unassigned: rows.filter((r) => active(r.status) && r.assigneeId === null).length,
          critical: rows.filter((r) => active(r.status) && r.priority === 'critical').length,
        }
      : null
    return {
      mine: {
        open: rows.filter((r) => isMine(user, r) && active(r.status)).length,
        waitingOnMe: rows.filter(
          (r) => r.requesterId === user.id && r.status === 'waiting_on_requester',
        ).length,
      },
      ops,
    }
  },
})
