import type { EnumOption, InboxItem, SearchHit } from '~/types/api'
import { recordAudit } from '~/mocks/core/audit'
import { db } from '~/mocks/db'
import { defineMockProviders } from '~/mocks/define'
import type { TrainingCounts } from '../api/types'
import {
  ACTIVE,
  addDays,
  decideRight,
  inScope,
  isHighPriority,
  parseReference,
  rateable,
  ratingState,
  reference,
  requestVisible,
  startOfDayIso,
  summaryOf,
  today,
  TRAINING_CONFIG,
  viewerOf,
} from './rules'
import { trainingWorkflow } from './workflow'

/**
 * Training contributions to the foundation endpoints (mirror of the backend providers):
 * workflow diagram, enums, inbox (API.md §8), search, my-day `upcoming`, queue counts and the
 * two reminder jobs ("Run now" on /admin/jobs works on the demo data, SPEC_RESOLUTIONS #10).
 */
const o = (value: string | number, label: string, tone: EnumOption['tone'] = null): EnumOption => ({
  value,
  label,
  tone,
  description: null,
})

const DAY_MS = 86_400_000

const fmtRange = (start: string, end: string) => {
  const fmt = (iso: string, parts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', parts).format(new Date(`${iso}T12:00:00`)).replace(',', '')
  if (start === end) return fmt(start, { weekday: 'short', day: 'numeric', month: 'short' })
  return `${fmt(start, { day: 'numeric', month: 'short' })} – ${fmt(end, { day: 'numeric', month: 'short' })}`
}
const euros = (cents: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100)

export default defineMockProviders({
  workflows: [trainingWorkflow],
  enums: {
    trainingFormat: [o('in_person', 'In person'), o('online', 'Online'), o('hybrid', 'Hybrid')],
    attendeeStatus: [
      o('pending_manager_approval', 'Awaiting manager', 'waiting'),
      o('pending_executive_approval', 'Awaiting executive', 'waiting'),
      o('to_book', 'To book', 'moving'),
      o('booked', 'Booked', 'positive'),
      o('declined', 'Declined', 'negative'),
      o('booking_impossible', 'Booking impossible', 'blocked'),
      o('cancellation_requested', 'Cancellation requested', 'waiting'),
      o('cancelled', 'Cancelled', 'neutral'),
      o('attended', 'Attended', 'positive'),
      o('not_attended', 'Did not attend', 'neutral'),
    ],
    billingStatus: [
      o('open', 'Open', 'waiting'),
      o('invoice_received', 'Invoice received', 'positive'),
      o('free_of_charge', 'Free of charge', 'neutral'),
    ],
    ratingState: [
      o('upcoming', 'Upcoming', 'neutral'),
      o('due', 'Due', 'waiting'),
      o('overdue', 'Overdue', 'negative'),
      o('submitted', 'Submitted', 'positive'),
    ],
    likert: [
      o('A', 'Fully agree'),
      o('B', 'Mostly agree'),
      o('C', 'Partly agree'),
      o('D', 'Disagree'),
    ],
    improvement: [
      o(1, 'Clearly visible'),
      o(2, 'Visible'),
      o(3, 'Barely visible'),
      o(4, 'Not visible'),
    ],
  },

  inbox: (user, { now }) => {
    const viewer = viewerOf(db, user)
    const day = viewer.today
    const items: InboxItem[] = []
    const approvers = [user.id, ...viewer.principals]
    const name = (id: string) => db.users.find(id)?.displayName ?? ''

    for (const a of db.trainingAttendees.where(
      (row) =>
        row.userId !== user.id &&
        ((row.status === 'pending_manager_approval' && approvers.includes(row.approverId ?? '')) ||
          (row.status === 'pending_executive_approval' &&
            approvers.includes(row.executiveApproverId ?? ''))),
    )) {
      const request = db.trainingRequests.find(a.requestId)!
      const exec = a.status === 'pending_executive_approval'
      const stepApprover = exec ? a.executiveApproverId : a.approverId
      const asDeputy = stepApprover !== user.id
      const tab = asDeputy ? 'deputy' : exec ? 'executive' : 'approvals'
      items.push({
        id: `training.approval_required:${a.id}`,
        module: 'training',
        type: 'training.approval_required',
        reference: reference(request.number),
        title: `Approve training: ${name(a.userId)}`,
        subtitle: `${request.topic} · ${fmtRange(request.startsOn, request.endsOn)} · ${euros(request.costCents)}${asDeputy ? ` · for ${name(stepApprover ?? '')}` : ''}${exec ? ' · executive step' : ''}`,
        dueAt: startOfDayIso(request.startsOn),
        priority: isHighPriority(a.status, request.startsOn, day) ? 'high' : 'normal',
        actingAs: asDeputy ? 'deputy' : exec ? 'executive' : 'approver',
        link: `/training/approvals?tab=${tab}&selected=${a.id}`,
        actionsPath: `/training/participations/${a.id}`,
        entityId: a.id,
        createdAt: a.updatedAt,
        quickActions: request.startsOn >= day ? ['approve', 'decline'] : ['decline'],
      })
    }

    if (viewer.isTrainingOffice) {
      for (const a of db.trainingAttendees.where(
        (row) => row.status === 'to_book' || row.status === 'cancellation_requested',
      )) {
        const request = db.trainingRequests.find(a.requestId)!
        const booking = a.status === 'to_book'
        items.push({
          id: `training.${booking ? 'booking_required' : 'cancellation_review'}:${a.id}`,
          module: 'training',
          type: booking ? 'training.booking_required' : 'training.cancellation_review',
          reference: reference(request.number),
          title: booking ? `Book: ${request.topic}` : `Cancellation: ${request.topic}`,
          subtitle: booking
            ? `${name(a.userId)} · ${request.provider}`
            : `${name(a.userId)}${a.cancellationReason ? ` · ${a.cancellationReason}` : ''}`,
          dueAt: startOfDayIso(request.startsOn),
          priority: booking
            ? isHighPriority(a.status, request.startsOn, day)
              ? 'high'
              : 'normal'
            : request.startsOn >= day && request.startsOn <= addDays(day, 3)
              ? 'high'
              : 'normal',
          actingAs: 'back_office',
          link: `/back-office/training?queue=${booking ? 'to_book' : 'cancellations'}&selected=${a.id}`,
          actionsPath: `/training/participations/${a.id}`,
          entityId: a.id,
          createdAt: a.updatedAt,
          quickActions: [],
        })
      }
    }

    for (const rating of db.trainingRatings.where(
      (r) => r.raterId === user.id && !r.submittedAt && new Date(r.dueAt) <= now,
    )) {
      const a = db.trainingAttendees.find(rating.attendeeId)!
      if (!rateable(rating, a)) continue
      const request = db.trainingRequests.find(a.requestId)!
      items.push({
        id: `training.rating_due:${rating.id}`,
        module: 'training',
        type: 'training.rating_due',
        reference: reference(request.number),
        title:
          rating.loop === 3
            ? `Rate ${name(a.userId)}'s progress: ${request.topic}`
            : `Rate: ${request.topic}`,
        subtitle: `Feedback round ${rating.loop} of 3`,
        dueAt: rating.dueAt,
        priority: ratingState(rating, now) === 'overdue' ? 'high' : 'normal',
        actingAs: 'self',
        link: `/training/ratings/${rating.id}`,
        actionsPath: `/training/ratings/${rating.id}`,
        entityId: rating.id,
        createdAt: rating.createdAt,
        quickActions: [],
      })
    }

    const horizon = addDays(day, TRAINING_CONFIG.goalsReminderDaysBefore)
    for (const a of db.trainingAttendees.where(
      (row) => row.userId === user.id && row.status === 'booked' && !row.goal1 && !row.goal2,
    )) {
      const request = db.trainingRequests.find(a.requestId)!
      if (!(request.startsOn > day && request.startsOn <= horizon)) continue
      items.push({
        id: `training.goals_missing:${a.id}`,
        module: 'training',
        type: 'training.goals_missing',
        reference: reference(request.number),
        title: `Set goals: ${request.topic}`,
        subtitle: `Starts ${fmtRange(request.startsOn, request.startsOn)}`,
        dueAt: startOfDayIso(request.startsOn),
        priority: 'normal',
        actingAs: 'self',
        link: `/training/participations/${a.id}#goals`,
        actionsPath: `/training/participations/${a.id}`,
        entityId: a.id,
        createdAt: a.updatedAt,
        quickActions: [],
      })
    }
    return items
  },

  search: (user, q) => {
    const viewer = viewerOf(db, user)
    const num = parseReference(q)
    const text = q.toLowerCase()
    const hits: SearchHit[] = db.trainingRequests
      .where(
        (r) =>
          (num !== null
            ? r.number === num
            : `${r.topic} ${r.provider}`.toLowerCase().includes(text)) &&
          requestVisible(db, viewer, r),
      )
      .sort((a, b) => b.startsOn.localeCompare(a.startsOn))
      .slice(0, 5)
      .map((r) => ({
        module: 'training',
        type: 'training_request',
        id: r.id,
        reference: reference(r.number),
        title: r.topic,
        subtitle: `${r.provider} · ${fmtRange(r.startsOn, r.endsOn)}`,
        link: `/training/requests/${r.id}`,
      }))
    if (hits.length < 5 && num === null) {
      const approvers = [user.id, ...viewer.principals]
      for (const a of db.trainingAttendees.where(
        (row) =>
          row.userId !== user.id &&
          (approvers.includes(row.approverId ?? '') ||
            approvers.includes(row.executiveApproverId ?? '')) &&
          (db.users.find(row.userId)?.displayName ?? '').toLowerCase().includes(text),
      )) {
        if (hits.length >= 5) break
        const request = db.trainingRequests.find(a.requestId)!
        hits.push({
          module: 'training',
          type: 'training_participation',
          id: a.id,
          reference: reference(request.number),
          title: `${db.users.find(a.userId)?.displayName}: ${request.topic}`,
          subtitle: request.provider,
          link: `/training/participations/${a.id}`,
        })
      }
    }
    return hits
  },

  myDay: (user) => {
    const day = today()
    const until = addDays(day, 30)
    const upcoming = db.trainingAttendees
      .where(
        (a) =>
          a.userId === user.id &&
          ['pending_manager_approval', 'pending_executive_approval', 'to_book', 'booked'].includes(
            a.status,
          ),
      )
      .map((a) => ({ a, request: db.trainingRequests.find(a.requestId)! }))
      .filter(({ request }) => request.startsOn >= day && request.startsOn <= until)
      .sort((x, y) => x.request.startsOn.localeCompare(y.request.startsOn))
      .slice(0, 8)
      .map(({ a, request }) => ({
        module: 'training',
        entityId: a.id,
        kind: 'training',
        title: request.topic,
        subtitle:
          a.status === 'booked' && a.bookingReference
            ? `${request.provider} · Booked · ${a.bookingReference}`
            : request.provider,
        startsAt: startOfDayIso(request.startsOn),
        endsAt: startOfDayIso(request.endsOn),
        status: a.status,
        link: `/training/participations/${a.id}`,
      }))
    return { upcoming }
  },

  counts: (user, { now }): Record<string, unknown> => {
    const viewer = viewerOf(db, user)
    const day = viewer.today
    const horizon = addDays(day, TRAINING_CONFIG.goalsReminderDaysBefore)
    const attendees = db.trainingAttendees.all()
    const requestOf = (id: string) => db.trainingRequests.find(id)!
    const overdueBefore = now.getTime() - TRAINING_CONFIG.overdueDays * DAY_MS
    const counts: TrainingCounts = {
      mine: {
        active: attendees.filter((a) => a.userId === user.id && ACTIVE.includes(a.status)).length,
        ratingsDue: db.trainingRatings.count(
          (r) =>
            r.raterId === user.id &&
            !r.submittedAt &&
            new Date(r.dueAt) <= now &&
            rateable(r, db.trainingAttendees.find(r.attendeeId)!),
        ),
        goalsMissing: attendees.filter((a) => {
          const startsOn = requestOf(a.requestId).startsOn
          return (
            a.userId === user.id &&
            a.status === 'booked' &&
            !a.goal1 &&
            !a.goal2 &&
            startsOn > day &&
            startsOn <= horizon
          )
        }).length,
      },
      approvals: {
        manager: attendees.filter((a) => inScope('approvals', viewer, a)).length,
        executive: attendees.filter((a) => inScope('executive', viewer, a)).length,
        deputy: attendees.filter((a) => inScope('deputy', viewer, a)).length,
        team: attendees.filter(
          (a) =>
            viewer.tree.has(a.userId) &&
            a.status === 'pending_manager_approval' &&
            decideRight(db, user, a) === 'manager_chain',
        ).length,
      },
      office: viewer.isBackOffice
        ? {
            toBook: attendees.filter((a) => a.status === 'to_book').length,
            cancellationRequested: attendees.filter((a) => a.status === 'cancellation_requested')
              .length,
            pendingApproval: attendees.filter((a) =>
              ['pending_manager_approval', 'pending_executive_approval'].includes(a.status),
            ).length,
            bookingImpossible: attendees.filter((a) => a.status === 'booking_impossible').length,
            ratingsOverdue: db.trainingRatings.count(
              (r) => !r.submittedAt && new Date(r.dueAt).getTime() < overdueBefore,
            ),
            billingOpen: db.trainingRequests.count(
              (r) =>
                r.billingStatus === 'open' &&
                attendees.some(
                  (a) => a.requestId === r.id && ['booked', 'attended'].includes(a.status),
                ),
            ),
          }
        : null,
    }
    return counts as unknown as Record<string, unknown>
  },

  jobs: [
    {
      name: 'training.rating-reminders',
      description:
        'Reminds raters whose feedback rounds are due, every 7 days up to 4 times (SPEC §8).',
      slice: 'A1',
      cron: '15 7 * * *',
      // SPEC_RESOLUTIONS #10: off in demo mode; "Run now" demonstrates it.
      enabled: false,
      run: ({ now }) => {
        const summary = { loop1: 0, loop2: 0, loop3: 0, skippedMax: 0 }
        const cadenceBefore = now.getTime() - TRAINING_CONFIG.reminderCadenceDays * DAY_MS
        for (const rating of db.trainingRatings.where(
          (r) => !r.submittedAt && new Date(r.dueAt) <= now,
        )) {
          const attendee = db.trainingAttendees.find(rating.attendeeId)!
          if (!rateable(rating, attendee)) continue
          if (rating.reminderCount >= TRAINING_CONFIG.reminderMax) {
            summary.skippedMax++
            continue
          }
          if (rating.lastRemindedAt && new Date(rating.lastRemindedAt).getTime() > cadenceBefore)
            continue
          const count = rating.reminderCount + 1
          db.trainingRatings.update(rating.id, {
            reminderCount: count,
            lastRemindedAt: now.toISOString(),
          })
          const request = db.trainingRequests.find(attendee.requestId)!
          db.notifications.insert({
            userId: rating.raterId,
            templateId: 'training.rating_due',
            module: 'training',
            title:
              rating.loop === 1
                ? `How was ${request.topic}?`
                : rating.loop === 2
                  ? `Putting ${request.topic} into practice`
                  : `Your view on ${db.users.find(attendee.userId)?.displayName}'s progress after ${request.topic}`,
            body: `Feedback round ${rating.loop} of 3 is due. Reminder ${count} of ${TRAINING_CONFIG.reminderMax}.`,
            link: `/training/ratings/${rating.id}`,
            priority: count >= 3 ? 'high' : 'normal',
            readAt: null,
            createdAt: now.toISOString(),
          })
          recordAudit(db, {
            module: 'training',
            entityType: 'training_rating',
            entityId: rating.id,
            entityLabel: `Feedback round ${rating.loop}`,
            action: 'remind',
            actorId: null,
            actingAs: 'system',
            summary: summaryOf('training_rating', 'remind', null, 'system'),
          })
          summary[`loop${rating.loop}` as 'loop1' | 'loop2' | 'loop3']++
        }
        return summary
      },
    },
    {
      name: 'training.goals-reminders',
      description: 'Reminds attendees to set learning goals a week before a booked training.',
      slice: 'A1',
      cron: '20 7 * * *',
      enabled: false,
      run: ({ now }) => {
        const day = today()
        const horizon = addDays(day, TRAINING_CONFIG.goalsReminderDaysBefore)
        let reminded = 0
        for (const a of db.trainingAttendees.where(
          (row) => row.status === 'booked' && !row.goal1 && !row.goal2 && !row.goalsRemindedAt,
        )) {
          const request = db.trainingRequests.find(a.requestId)!
          if (!(request.startsOn > day && request.startsOn <= horizon)) continue
          db.trainingAttendees.update(a.id, { goalsRemindedAt: now.toISOString() })
          db.notifications.insert({
            userId: a.userId,
            templateId: 'training.goals_reminder',
            module: 'training',
            title: `Set your learning goals for ${request.topic}`,
            body: `${request.topic} starts ${fmtRange(request.startsOn, request.endsOn)}. Write down two learning goals before it starts.`,
            link: `/training/participations/${a.id}#goals`,
            priority: 'normal',
            readAt: null,
            createdAt: now.toISOString(),
          })
          reminded++
        }
        return { reminded }
      },
    },
  ],
})
