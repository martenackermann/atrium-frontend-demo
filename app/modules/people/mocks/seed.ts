import { defineMockSeed, type SeedContext } from '~/mocks/define'
import { recordAudit } from '~/mocks/core/audit'
import { DEPARTMENTS, SEED_USERS, SITES, USER_IDS } from '~/mocks/core/seed'
import type { PeopleRequestStatus } from '../api/types'
import {
  peopleReference,
  peopleSummary,
  STATUS_LABELS,
  statusChangedText,
  TYPE_LABELS,
} from './rules'
import { type At, JOB_ROLES, PEOPLE_STORY, type StoryEvent } from './story'
import './types'

/**
 * People demo data (slice A4): the 37 job roles and the 15 requests of SPEC §10.5 with explicit
 * reference numbers (SPEC_RESOLUTIONS #21), their comments, audit history and the in-app
 * notifications the backend seed writes (#7) - the same values as the backend seed.
 */

const TARGET: Record<StoryEvent['action'], PeopleRequestStatus> = {
  start_work: 'in_progress',
  wait_internal: 'waiting_internal',
  wait_on_requester: 'waiting_on_requester',
  resume: 'in_progress',
  complete: 'completed',
  reject: 'rejected',
  cancel: 'cancelled',
  reopen: 'reopened',
}

const PEOPLE_OPS_HANDLES = new Set(['paula', 'ppl3'])

function seedPeople(ctx: SeedContext) {
  const { db } = ctx
  const at = ([day, hour, minute]: At) => ctx.at(day, hour, minute)
  const userId = (handle: string) => {
    const id = USER_IDS[handle]
    if (!id) throw new Error(`[people seed] unknown user handle "${handle}"`)
    return id
  }
  const seedUser = (handle: string) => SEED_USERS.find((user) => user.handle === handle)!
  const displayName = (handle: string) => {
    const user = seedUser(handle)
    return `${user.firstName} ${user.lastName}`
  }
  const departmentId = (code: string | null | undefined) =>
    code ? (DEPARTMENTS.find((d) => d.code === code)?.id ?? null) : null
  const siteId = (code: string | null | undefined) =>
    code ? (SITES.find((s) => s.code === code)?.id ?? null) : null

  const roleIds = new Map<string, string>()
  for (const role of JOB_ROLES) {
    const row = db.jobRoles.insert({
      id: ctx.uuid(),
      name: role.name,
      category: role.category,
      active: true,
    })
    roleIds.set(role.name, row.id)
  }

  for (const story of PEOPLE_STORY) {
    const subject = story.subject ? seedUser(story.subject) : undefined
    const managerId = story.manager ? userId(story.manager) : (subject?.managerId ?? null)
    const createdAt = at(story.createdAt)
    const reference = peopleReference(story.number)
    const last = story.history.at(-1)
    const status: PeopleRequestStatus = last ? TARGET[last.action] : 'open'
    const closing = [...story.history]
      .reverse()
      .find((e) => ['complete', 'reject', 'cancel'].includes(e.action))
    const lastReason = [...story.history].reverse().find((e) => e.reason)?.reason ?? null
    const assignee = story.history.find((e) => e.action === 'start_work')?.by
    const updatedAt = [
      story.createdAt,
      ...story.history.map((e) => e.at),
      ...story.comments.map((c) => c.at),
    ]
      .map(at)
      .reduce((a, b) => (a > b ? a : b))
    const pd = story.personalData

    const row = db.peopleRequests.insert({
      id: ctx.uuid(),
      number: story.number,
      type: story.type,
      title: story.title,
      priority: story.priority,
      status,
      jobRoleId: story.jobRole ? roleIds.get(story.jobRole)! : null,
      subjectUserId: subject?.id ?? null,
      salutation: story.salutation ?? null,
      firstName: subject?.firstName ?? story.firstName!,
      lastName: subject?.lastName ?? story.lastName!,
      effectiveDate: ctx.d(story.effective),
      departmentId: departmentId(story.department ?? subject?.departmentCode),
      siteId: siteId(story.site ?? subject?.siteCode),
      managerId,
      managerDeputyId: story.managerDeputy ? userId(story.managerDeputy) : null,
      requesterId: userId(story.requester),
      assigneeId: assignee ? userId(assignee) : null,
      reason: story.reason ?? null,
      furtherInformation: story.furtherInformation ?? null,
      equipmentNotes: story.equipmentNotes ?? null,
      personalData: {
        birthDate: pd?.birthDate ?? null,
        placeOfBirth: pd?.placeOfBirth ?? null,
        nationality: pd?.nationality ?? null,
        privateAddress: pd?.privateAddress ?? null,
        privatePhone: pd?.privatePhone ?? null,
        privateEmail: pd?.privateEmail ?? null,
      },
      internalNote: story.internalNote ?? null,
      statusReason: lastReason,
      closedAt:
        closing && ['completed', 'rejected', 'cancelled'].includes(status) ? at(closing.at) : null,
      version: 1 + story.history.length,
      createdAt,
      updatedAt,
    })

    const label = `${reference} ${story.title}`
    const notify = (
      to: string | null,
      title: string,
      body: string,
      when: string,
      templateId: string,
    ) => {
      if (!to) return
      db.notifications.insert({
        id: ctx.uuid(),
        userId: to,
        templateId,
        module: 'people',
        title,
        body,
        link: `/people-requests/${row.id}`,
        priority: story.priority === 'critical' || story.priority === 'high' ? 'high' : 'normal',
        // Older updates are read; the last three days are still unread.
        readAt: when < ctx.at(-3, 0, 0) ? when : null,
        createdAt: when,
      })
    }

    recordAudit(db, {
      module: 'people',
      entityType: 'people_request',
      entityId: row.id,
      entityLabel: label,
      action: 'create',
      actorId: row.requesterId,
      actingAs: 'requester',
      toState: 'open',
      occurredAt: createdAt,
      summary: peopleSummary(displayName(story.requester), 'create', 'requester'),
      correlationId: 'seed',
    })
    const subjectName = `${row.firstName} ${row.lastName}`
    const typeLabel = TYPE_LABELS[story.type].toLowerCase()
    const createdTitle = `New ${typeLabel} request: ${story.title}`
    const createdBody = `${displayName(story.requester)} requested ${typeLabel} for ${subjectName} (${reference}). Effective: ${formatShort(row.effectiveDate)}.`
    notify(row.requesterId, createdTitle, createdBody, createdAt, 'people.request_created')
    if (managerId && managerId !== row.requesterId) {
      notify(managerId, createdTitle, createdBody, createdAt, 'people.request_created')
    }

    let from: PeopleRequestStatus = 'open'
    for (const event of story.history) {
      const actorId = userId(event.by)
      const when = at(event.at)
      const to = TARGET[event.action]
      const actingAs = PEOPLE_OPS_HANDLES.has(event.by) ? 'back_office' : 'requester'
      recordAudit(db, {
        module: 'people',
        entityType: 'people_request',
        entityId: row.id,
        entityLabel: label,
        action: event.action,
        actorId,
        actingAs,
        fromState: from,
        toState: to,
        reason: event.reason ?? null,
        occurredAt: when,
        summary: peopleSummary(displayName(event.by), event.action, actingAs),
        correlationId: 'seed',
      })
      const text = event.question ?? event.note
      if (text) {
        db.peopleComments.insert({
          id: ctx.uuid(),
          requestId: row.id,
          authorId: actorId,
          body: text,
          internal: event.action === 'wait_internal',
          kind: event.question ? 'question' : 'status_note',
          createdAt: when,
        })
      }
      const title = `${reference} is now ${STATUS_LABELS[to]}`
      const body = statusChangedText(story.title, to, {
        question: event.question,
        reason: event.reason,
        note: event.action === 'wait_internal' ? null : event.note,
      })
      if (actorId !== row.requesterId) {
        notify(row.requesterId, title, body, when, 'people.status_changed')
      }
      if (managerId && managerId !== actorId && managerId !== row.requesterId) {
        notify(managerId, title, body, when, 'people.status_changed')
      }
      from = to
    }

    for (const comment of story.comments) {
      db.peopleComments.insert({
        id: ctx.uuid(),
        requestId: row.id,
        authorId: userId(comment.by),
        body: comment.body,
        internal: comment.internal ?? false,
        kind: 'comment',
        createdAt: at(comment.at),
      })
    }
  }
}

/** "Tue 27 Oct" (seeds run outside the Nuxt runtime, so no auto-imported utils here). */
function formatShort(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(year!, month! - 1, day!))
    .replace(',', '')
}

export default defineMockSeed({ order: 100, run: seedPeople })
