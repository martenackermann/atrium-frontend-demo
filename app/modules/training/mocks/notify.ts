/**
 * In-app notifications of the training mocks (SPEC §7, D17: one in-app row per user recipient;
 * functional mailboxes get email only, which the offline demo skips). Titles and bodies follow
 * the backend templates.
 */
import { activeDeputiesOf } from '~/mocks/core/org'
import { db } from '~/mocks/db'
import type { TransitionContext } from '~/mocks/workflow'
import { reference, TRAINING_CONFIG } from './rules'
import type { TrainingAttendeeRecord } from './types'

const euros = (cents: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100)

function range(start: string, end: string) {
  const fmt = (iso: string, parts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', parts).format(new Date(`${iso}T12:00:00`)).replace(',', '')
  if (start === end) return fmt(start, { weekday: 'short', day: 'numeric', month: 'short' })
  return `${fmt(start, { day: 'numeric', month: 'short' })} – ${fmt(end, { day: 'numeric', month: 'short' })}`
}

function send(
  userIds: (string | null | undefined)[],
  title: string,
  body: string,
  link: string,
  high = false,
) {
  const now = new Date().toISOString()
  for (const userId of new Set(userIds.filter((id): id is string => Boolean(id)))) {
    if (!db.users.find(userId)?.active) continue
    db.notifications.insert({
      userId,
      templateId: 'training',
      module: 'training',
      title: title.slice(0, 140),
      body: body.slice(0, 500),
      link,
      priority: high ? 'high' : 'normal',
      readAt: null,
      createdAt: now,
    })
  }
}

function facts(attendee: TrainingAttendeeRecord) {
  const request = db.trainingRequests.find(attendee.requestId)!
  return {
    request,
    name: db.users.find(attendee.userId)?.displayName ?? 'Attendee',
    dates: range(request.startsOn, request.endsOn),
    link: `/training/participations/${attendee.id}`,
    both: [attendee.userId, request.requesterId],
  }
}

function approvalRequested(attendee: TrainingAttendeeRecord, executive: boolean) {
  const { request, name, dates } = facts(attendee)
  const approverId = executive ? attendee.executiveApproverId : attendee.approverId
  if (!approverId) return
  const deputies = activeDeputiesOf(db, approverId).map((user) => user.id)
  if (executive) {
    send(
      [approverId, ...deputies],
      `Executive approval needed (≥ ${euros(TRAINING_CONFIG.thresholdCents)}): ${request.topic}`,
      `${name} · ${dates} · ${euros(request.costCents)}.`,
      `/training/approvals?tab=executive&selected=${attendee.id}`,
    )
  } else {
    send(
      [approverId, ...deputies],
      `Approval needed: ${name} – ${request.topic}`,
      `${name} asks to attend ${request.topic} (${dates}, ${euros(request.costCents)}).`,
      `/training/approvals?tab=approvals&selected=${attendee.id}`,
    )
  }
}

/** Entry notifications (create / add attendee), SPEC §5.1. */
export function notifyEntry(attendee: TrainingAttendeeRecord) {
  const { request, dates, link, both } = facts(attendee)
  send(
    both,
    `You're registered for ${request.topic}`,
    `${reference(request.number)} · ${dates} · ${request.provider}.`,
    link,
  )
  if (attendee.status === 'pending_manager_approval') approvalRequested(attendee, false)
  else if (attendee.status === 'pending_executive_approval') approvalRequested(attendee, true)
  else if (attendee.status === 'to_book')
    send(
      both,
      `Approved: ${request.topic}`,
      'Approved automatically. The training office books it next.',
      link,
    )
}

export function notifyTransition(
  ctx: TransitionContext<TrainingAttendeeRecord> & { to: string; updated: TrainingAttendeeRecord },
) {
  const attendee = ctx.updated
  const { request, link, both } = facts(attendee)
  const topic = request.topic
  const reason = typeof ctx.body.reason === 'string' ? ctx.body.reason : null
  switch (`${ctx.from}>${ctx.to}`) {
    case 'pending_manager_approval>pending_executive_approval':
      approvalRequested(attendee, true)
      return
    case 'pending_manager_approval>to_book':
    case 'pending_executive_approval>to_book':
      send(
        both,
        `Approved: ${topic}`,
        `Approved by ${ctx.user.displayName}. The training office books ${topic} next.`,
        link,
      )
      return
  }
  switch (ctx.to) {
    case 'declined':
      send(both, `Declined: ${topic}`, `${ctx.user.displayName} declined: ${reason ?? ''}`, link)
      return
    case 'booked':
      if (ctx.from === 'to_book')
        send(
          both,
          `Booked: ${topic}`,
          `${topic} is booked. Set two learning goals before it starts.`,
          `${link}#goals`,
        )
      else send(both, `Cancellation not possible: ${topic}`, reason ?? '', link)
      return
    case 'to_book':
      if (ctx.from === 'cancellation_requested')
        send(both, `Cancellation not possible: ${topic}`, reason ?? '', link)
      return
    case 'booking_impossible':
      send(
        both,
        `Booking not possible: ${topic}`,
        `The training office could not book ${topic}: ${reason ?? ''}`,
        link,
      )
      return
    case 'cancellation_requested':
      send([attendee.userId], `Cancellation requested: ${topic}`, reason ?? '', link)
      return
    case 'cancelled':
      if (ctx.from === 'pending_manager_approval' || ctx.from === 'pending_executive_approval') {
        const approverId =
          ctx.from === 'pending_executive_approval'
            ? attendee.executiveApproverId
            : attendee.approverId
        send(
          [approverId],
          `Withdrawn: ${db.users.find(attendee.userId)?.displayName ?? ''} – ${topic}`,
          'No decision is needed any more.',
          link,
        )
      } else if (ctx.from !== 'booking_impossible' || ctx.body.reason) {
        send(both, `Cancelled: ${topic}`, `${topic} is cancelled.`, link)
      }
      return
  }
}
