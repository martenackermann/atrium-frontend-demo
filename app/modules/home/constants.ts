/**
 * Home presentation helpers (owned by slice A4): glyphs per request kind, the compact routing
 * slip of an open request (DESIGN §8.1 "My open requests") and the inline action of an inbox
 * to-do without quick actions.
 */
import {
  CarFront,
  CircleCheck,
  GraduationCap,
  Plane,
  Stamp,
  TrainFront,
  UserPlus,
} from '@lucide/vue'
import type { Component } from 'vue'
import type { InboxItem } from '~/types/api'
import type { RouteStop } from '~/types/ui'
import { daysFromToday, formatDate, formatDateRange } from '~/utils/format'
import type { HomePeopleRequest, UpcomingItem } from './api/types'

export type RequestFilter = 'all' | 'travel' | 'training' | 'people'

export interface OpenRequestRow {
  key: string
  module: Exclude<RequestFilter, 'all'>
  glyph: Component
  title: string
  link: string
  reference: string | null
  meta: string[]
  urgent: string | null
  stops: RouteStop[]
  where: string
  status: { enum: string; value: string; actor?: boolean }
  sortKey: string
}

export const KIND_GLYPH: Record<UpcomingItem['kind'], Component> = {
  training: GraduationCap,
  car: CarFront,
  train: TrainFront,
  flight: Plane,
}

const KIND_LABEL: Record<UpcomingItem['kind'], string> = {
  training: 'Training',
  car: 'Car rental',
  train: 'Train',
  flight: 'Flight',
}

const ME = (initials: string): RouteStop => ({
  step: 'Requested',
  who: 'You',
  initials,
  state: 'done',
})

/** Stage-based route of a training participation or travel request. */
function upcomingStops(
  item: UpcomingItem,
  initials: string,
): { stops: RouteStop[]; where: string } {
  const desk = item.module === 'training' ? 'Training office' : 'Travel desk'
  const deskInitials = item.module === 'training' ? 'TO' : 'TD'
  const pending = item.status.startsWith('pending')
  const toBook = item.status === 'to_book'
  const booked = item.status === 'booked'
  const stops: RouteStop[] = [
    ME(initials),
    {
      step: 'Approval',
      icon: Stamp,
      state: pending ? 'current' : 'done',
      tone: 'waiting',
    },
    {
      step: 'Booking',
      who: desk,
      initials: deskInitials,
      state: toBook ? 'current' : booked ? 'done' : 'future',
      tone: 'moving',
    },
    { step: 'Booked', icon: CircleCheck, state: booked ? 'done' : 'future' },
  ]
  const where = pending
    ? 'Waiting for approval'
    : toBook
      ? `With the ${desk.toLowerCase()}`
      : booked
        ? (item.subtitle ?? 'Booked')
        : (item.subtitle ?? '')
  return { stops, where }
}

export function upcomingRow(item: UpcomingItem, initials: string): OpenRequestRow {
  const { stops, where } = upcomingStops(item, initials)
  const start = formatDate(item.startsAt)
  const range =
    item.endsAt && item.endsAt.slice(0, 10) !== item.startsAt.slice(0, 10)
      ? formatDateRange(item.startsAt, item.endsAt)
      : start
  const days = daysFromToday(item.startsAt)
  return {
    key: `${item.module}:${item.entityId}`,
    module: item.module,
    glyph: KIND_GLYPH[item.kind],
    title: item.kind === 'training' ? item.title : `${KIND_LABEL[item.kind]}, ${item.title}`,
    link: item.link,
    reference: null,
    meta: [range, item.kind === 'training' ? (item.subtitle ?? '') : ''].filter(Boolean),
    urgent:
      days !== null && days >= 0 && days <= 3 && item.status !== 'booked'
        ? days === 0
          ? 'Starts today'
          : days === 1
            ? 'Starts tomorrow'
            : `Starts in ${days} days`
        : null,
    stops,
    where,
    status: {
      enum: item.module === 'training' ? 'attendeeStatus' : 'travelStatus',
      value: item.status,
    },
    sortKey: item.startsAt,
  }
}

const PEOPLE_TYPE: Record<HomePeopleRequest['type'], string> = {
  onboarding: 'Onboarding',
  offboarding: 'Offboarding',
  role_change: 'Role change',
}

export function peopleRow(request: HomePeopleRequest, initials: string): OpenRequestRow {
  const waitingOnMe = request.status === 'waiting_on_requester'
  const ops = request.assignee?.displayName ?? 'People Ops'
  return {
    key: `people:${request.id}`,
    module: 'people',
    glyph: UserPlus,
    title: request.title,
    link: `/people-requests/${request.id}`,
    reference: request.reference,
    meta: [PEOPLE_TYPE[request.type], formatDate(request.effectiveDate)],
    urgent: null,
    stops: [
      {
        step: waitingOnMe ? 'Your reply' : 'Requested',
        who: 'You',
        initials,
        state: waitingOnMe ? 'current' : 'done',
        tone: 'you',
      },
      {
        step: 'People Ops',
        who: ops,
        initials: request.assignee?.initials ?? 'PO',
        state: waitingOnMe ? 'future' : 'current',
        tone:
          request.status === 'open' || request.status === 'waiting_internal' ? 'waiting' : 'moving',
      },
      { step: 'Done', icon: CircleCheck, state: 'future' },
    ],
    where: waitingOnMe
      ? 'People Ops is waiting for your reply'
      : request.status === 'open'
        ? 'Waiting for People Ops'
        : `With ${ops}`,
    status: { enum: 'peopleRequestStatus', value: request.status, actor: waitingOnMe || undefined },
    sortKey: `${request.effectiveDate}T00:00:00.000Z`,
  }
}

/** Inline call to action for a to-do without quick actions (it opens the item). */
export function todoCta(item: InboxItem): string {
  switch (item.type) {
    case 'people.reply_required':
      return 'Reply'
    case 'people.triage_required':
      return 'Pick it up'
    case 'training.rating_due':
      return 'Rate it'
    case 'training.goals_missing':
      return 'Add goals'
    case 'training.booking_required':
    case 'travel.booking_required':
      return 'Book it'
    case 'training.cancellation_review':
    case 'travel.cancellation_review':
      return 'Review'
    case 'assets.acceptance_required':
      return 'Review device'
    default:
      return 'Open'
  }
}

/** Button labels for quick actions (`${actionsPath}/actions/{action}`, SPEC_RESOLUTIONS #4). */
export const QUICK_ACTION_LABELS: Record<string, string> = {
  approve: 'Approve',
  accept: 'Accept',
  decline: 'Decline…',
}

export function greetingFor(date: Date = new Date()): string {
  const hour = date.getHours()
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}
