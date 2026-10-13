/**
 * Training business rules for the mocks (SPEC §5.1, §6, SPEC_RESOLUTIONS #11/#13/#15) — pure
 * functions over the mock database (passed in), shared by the seed, the handlers and the
 * providers. They mirror the backend's TrainingViewer / planEntry / mapper logic.
 */
import type { ActingAs, AutoApproval } from '~/types/api'
import type { MockDb } from '~/mocks/db'
import type { MockUser } from '~/mocks/core/types'
import {
  activeDeputyWindowsFor,
  canDecide,
  isoDay,
  managerChain,
  reportingTree,
  resolveApprover,
  type ResolvedApprover,
} from '~/mocks/core/org'
import type { AttendeeStatus, RatingState } from '../api/types'
import type { TrainingAttendeeRecord, TrainingRatingRecord, TrainingRequestRecord } from './types'

/** SPEC §9 defaults (the mock /meta/config uses the same values). */
export const TRAINING_CONFIG = {
  thresholdCents: 500_000,
  highPriorityDays: 14,
  loop1DelayDays: 1,
  loop2DelayDays: 60,
  loop3DelayDays: 30,
  reminderCadenceDays: 7,
  reminderMax: 4,
  overdueDays: 14,
  goalsReminderDaysBefore: 7,
} as const

const DAY_MS = 86_400_000

export const reference = (num: number) => `TRN-${String(num).padStart(6, '0')}`

export function parseReference(q: string): number | null {
  const match = /^TRN-?0*(\d{1,9})$/i.exec(q.trim())
  return match ? Number(match[1]) : null
}

export const today = () => isoDay(new Date())

/** IsoDate ± days (local calendar). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return isoDay(new Date(y!, m! - 1, d! + days))
}

/** Local midnight of an IsoDate as an ISO instant (API: calendar due dates as 00:00 local). */
export function startOfDayIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!).toISOString()
}

/** Local calendar date of an ISO instant. */
export const localDay = (instant: string) => isoDay(new Date(instant))

export const PENDING: readonly AttendeeStatus[] = [
  'pending_manager_approval',
  'pending_executive_approval',
]
export const ACTIVE: readonly AttendeeStatus[] = [
  ...PENDING,
  'to_book',
  'booked',
  'booking_impossible',
  'cancellation_requested',
]
const HIGH_PRIORITY: readonly AttendeeStatus[] = [...PENDING, 'to_book']
export const GOALS_EDITABLE: readonly AttendeeStatus[] = [...PENDING, 'to_book', 'booked']

/** Pending or to book, starting today or within 14 days (future starts only, #11). */
export function isHighPriority(status: AttendeeStatus, startsOn: string, day = today()): boolean {
  return (
    HIGH_PRIORITY.includes(status) &&
    startsOn >= day &&
    startsOn <= addDays(day, TRAINING_CONFIG.highPriorityDays)
  )
}

export function ratingState(
  rating: Pick<TrainingRatingRecord, 'dueAt' | 'submittedAt'>,
  now = new Date(),
): RatingState {
  if (rating.submittedAt) return 'submitted'
  const due = new Date(rating.dueAt).getTime()
  if (due > now.getTime()) return 'upcoming'
  if (now.getTime() > due + TRAINING_CONFIG.overdueDays * DAY_MS) return 'overdue'
  return 'due'
}

/** Loop 1 needs a booked attendee, loops 2-3 an attended one. */
export function rateable(rating: TrainingRatingRecord, attendee: TrainingAttendeeRecord): boolean {
  return rating.loop === 1 ? attendee.status === 'booked' : attendee.status === 'attended'
}

export const hasRole = (user: MockUser, ...roles: string[]) =>
  roles.some((role) => (user.roles as string[]).includes(role))

/** The viewer's relationships today (backend TrainingViewer). */
export interface TrainingViewer {
  user: MockUser
  today: string
  principals: string[]
  tree: Set<string>
  /** training_office or it_admin */
  isBackOffice: boolean
  /** training_office (queue owner) */
  isTrainingOffice: boolean
}

export function viewerOf(db: MockDb, user: MockUser): TrainingViewer {
  const day = today()
  return {
    user,
    today: day,
    principals: activeDeputyWindowsFor(db, user.id, day).map((row) => row.principalId),
    tree: reportingTree(db, user.id),
    isBackOffice: hasRole(user, 'training_office', 'it_admin'),
    isTrainingOffice: hasRole(user, 'training_office'),
  }
}

export function mayActFor(viewer: TrainingViewer, userId: string): boolean {
  return viewer.isBackOffice || userId === viewer.user.id || viewer.tree.has(userId)
}

/** SPEC §3.1 participation visibility. */
export function attendeeVisible(
  db: MockDb,
  viewer: TrainingViewer,
  attendee: TrainingAttendeeRecord,
  request?: TrainingRequestRecord,
): boolean {
  if (viewer.isBackOffice) return true
  const me = viewer.user.id
  const approvers = [me, ...viewer.principals]
  const req = request ?? db.trainingRequests.find(attendee.requestId)
  return (
    attendee.userId === me ||
    req?.requesterId === me ||
    (attendee.approverId !== null && approvers.includes(attendee.approverId)) ||
    (attendee.executiveApproverId !== null && approvers.includes(attendee.executiveApproverId)) ||
    attendee.managerDecisionById === me ||
    attendee.executiveDecisionById === me ||
    viewer.tree.has(attendee.userId) ||
    db.trainingRatings.count((r) => r.attendeeId === attendee.id && r.raterId === me) > 0
  )
}

export function requestVisible(db: MockDb, viewer: TrainingViewer, request: TrainingRequestRecord) {
  if (viewer.isBackOffice || request.requesterId === viewer.user.id) return true
  return db.trainingAttendees
    .where((a) => a.requestId === request.id)
    .some((a) => attendeeVisible(db, viewer, a, request))
}

export function ratingVisible(db: MockDb, viewer: TrainingViewer, rating: TrainingRatingRecord) {
  if (viewer.isBackOffice || rating.raterId === viewer.user.id) return true
  if (rating.loop === 3) return false
  return db.trainingAttendees.find(rating.attendeeId)?.userId === viewer.user.id
}

/** SPEC §6.2 for the attendee's current pending step: approver | executive | deputy | manager_chain. */
export function decideRight(
  db: MockDb,
  user: MockUser,
  attendee: TrainingAttendeeRecord,
  day = today(),
): ActingAs | false {
  if (!user.active) return false
  if (attendee.status === 'pending_manager_approval') {
    return canDecide(
      db,
      user,
      { approverId: attendee.approverId, kind: 'manager' },
      attendee.userId,
      day,
    )
  }
  if (attendee.status === 'pending_executive_approval') {
    const right = canDecide(
      db,
      user,
      { approverId: attendee.executiveApproverId, kind: 'executive' },
      attendee.userId,
      day,
    )
    return right === 'approver' ? 'executive' : right
  }
  return false
}

export interface EntryPlan {
  resolution: ResolvedApprover
  initialState: 'pending_manager_approval' | 'pending_executive_approval' | 'to_book'
  managerAuto: AutoApproval | null
  executiveAuto: AutoApproval | null
}

/** SPEC §5.1 entry table (+ the executive step completes when the executive is the requester). */
export function planEntry(
  db: MockDb,
  attendee: MockUser,
  requester: MockUser,
  executiveApproverId: string | null,
): EntryPlan {
  const resolution = resolveApprover(db, attendee, requester)
  const exec = executiveApproverId !== null
  if (resolution.reason === 'executive_self') {
    return {
      resolution,
      initialState: 'to_book',
      managerAuto: 'executive_self',
      executiveAuto: exec ? 'executive_self' : null,
    }
  }
  if (resolution.auto === 'requester_is_approver') {
    if (!exec)
      return {
        resolution,
        initialState: 'to_book',
        managerAuto: 'requester_is_approver',
        executiveAuto: null,
      }
    if (executiveApproverId === requester.id) {
      return {
        resolution,
        initialState: 'to_book',
        managerAuto: 'requester_is_approver',
        executiveAuto: 'same_approver',
      }
    }
    return {
      resolution,
      initialState: 'pending_executive_approval',
      managerAuto: 'requester_is_approver',
      executiveAuto: null,
    }
  }
  return {
    resolution,
    initialState: 'pending_manager_approval',
    managerAuto: null,
    executiveAuto: null,
  }
}

/** Participation scopes (API.md §4.1; the viewer's own rows never count as approvals, #13). */
export type Scope = 'mine' | 'approvals' | 'executive' | 'deputy' | 'team' | 'all'

export function inScope(scope: Scope, viewer: TrainingViewer, a: TrainingAttendeeRecord): boolean {
  const me = viewer.user.id
  switch (scope) {
    case 'mine':
      return a.userId === me
    case 'approvals':
      return a.status === 'pending_manager_approval' && a.approverId === me && a.userId !== me
    case 'executive':
      return (
        a.status === 'pending_executive_approval' && a.executiveApproverId === me && a.userId !== me
      )
    case 'deputy':
      return (
        a.userId !== me &&
        ((a.status === 'pending_manager_approval' &&
          viewer.principals.includes(a.approverId ?? '')) ||
          (a.status === 'pending_executive_approval' &&
            viewer.principals.includes(a.executiveApproverId ?? '')))
      )
    case 'team':
      return viewer.tree.has(a.userId)
    case 'all':
      return true
  }
}

/** Loop-3 rater: the attendee's direct manager, if active. */
export function directManager(db: MockDb, userId: string): MockUser | undefined {
  const user = db.users.find(userId)
  const chain = user ? managerChain(db, user) : []
  return chain[0]?.active ? chain[0] : undefined
}

/** Backend timeline phrases (AuditService VERBS + TRAINING_AUDIT_LABELS). */
const PHRASES: Record<string, Record<string, string>> = {
  training_request: {
    create: 'created the request',
    update: 'updated the request',
    update_back_office: 'updated the billing details',
    add_attendee: 'added an attendee',
    add_attachment: 'added documents',
    remove_attachment: 'removed a document',
  },
  training_attendee: {
    create: 'registered the participation',
    auto_approve: 'approved automatically',
    approve: 'approved',
    decline: 'declined',
    withdraw: 'withdrew the participation',
    close: 'closed the request',
    update_goals: 'updated the learning goals',
    remind: 'sent a reminder',
    submit_rating_1: 'submitted feedback round 1',
    request_cancellation: 'requested cancellation',
    confirm_cancellation: 'confirmed the cancellation',
    reject_cancellation: 'rejected the cancellation',
    book: 'booked',
    mark_booking_impossible: 'marked the booking as impossible',
    retry_booking: 'retried the booking',
  },
  training_rating: {
    create: 'opened the feedback round',
    submit: 'submitted the feedback',
    remind: 'sent a reminder',
  },
}

const ACTING_SUFFIX: Partial<Record<ActingAs, string>> = {
  deputy: ' (as deputy)',
  manager_chain: ' (as manager chain)',
  back_office: ' (back office)',
  admin: ' (as admin)',
}

/** "Max Manager approved (as deputy for Priya Raman)" — the backend's timeline sentence. */
export function summaryOf(
  entityType: string,
  action: string,
  actorName: string | null,
  actingAs: ActingAs,
  onBehalfOfName: string | null = null,
) {
  const verb = PHRASES[entityType]?.[action] ?? action.replace(/_/g, ' ')
  const suffix =
    actingAs === 'deputy' && onBehalfOfName
      ? ` (as deputy for ${onBehalfOfName})`
      : (ACTING_SUFFIX[actingAs] ?? '')
  return `${actorName ?? 'Atrium'} ${verb}${suffix}`
}
