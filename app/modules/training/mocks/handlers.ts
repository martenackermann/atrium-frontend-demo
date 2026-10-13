import { http, HttpResponse } from 'msw'
import type { z } from 'zod'
import type { ActingAs } from '~/types/api'
import { recordAudit, timelineFor } from '~/mocks/core/audit'
import { attachmentsOf, linkAttachments } from '~/mocks/core/files'
import { activeDeputiesOf, toUserRef } from '~/mocks/core/org'
import type { MockUser } from '~/mocks/core/types'
import { db } from '~/mocks/db'
import { defineMockHandlers } from '~/mocks/define'
import {
  conflict,
  created,
  forbidden,
  invalidTransition,
  noContent,
  notFound,
  ok,
  param,
  readJson,
  requireUser,
  validationProblem,
} from '~/mocks/http'
import { csv, listResponse } from '~/mocks/list'
import type { AttendeeStatus, RatingState, TrainingPreview } from '../api/types'
import {
  attendeeDto,
  listItem,
  participationDetail,
  ratingDto,
  requestDetail,
  requestSummary,
} from './dto'
import { notifyEntry } from './notify'
import {
  addDays,
  attendeeVisible,
  decideRight,
  directManager,
  GOALS_EDITABLE,
  isHighPriority,
  localDay,
  mayActFor,
  parseReference,
  planEntry,
  rateable,
  ratingState,
  ratingVisible,
  reference,
  requestVisible,
  startOfDayIso,
  summaryOf,
  today,
  TRAINING_CONFIG,
  inScope,
  type Scope,
  type TrainingViewer,
  viewerOf,
} from './rules'
import { schemas } from './schemas'
import type { TrainingAttendeeRecord, TrainingRatingRecord, TrainingRequestRecord } from './types'
import { checkAction, trainingWorkflow } from './workflow'

/**
 * Training API mocks (API.md §4) for demo mode and tests: same paths, DTOs, scopes, validation
 * (422 dot paths), visibility (404), permissions (403) and transition errors (409) as the backend.
 */

type FieldErrors = Record<string, string[]>
type Change = { field: string; label: string; from: unknown; to: unknown }

const addError = (errors: FieldErrors, key: string, message: string) => {
  ;(errors[key] ??= []).push(message)
}
const nowIso = () => new Date().toISOString()
const requestOf = (attendee: TrainingAttendeeRecord) =>
  db.trainingRequests.find(attendee.requestId)!
const userOf = (id: string) => db.users.find(id)
const officeActing = (viewer: TrainingViewer): ActingAs =>
  viewer.isTrainingOffice ? 'back_office' : 'admin'

function audit(
  entityType: string,
  entityId: string,
  label: string,
  action: string,
  actor: MockUser | null,
  actingAs: ActingAs,
  extra: {
    fromState?: string | null
    toState?: string | null
    reason?: string | null
    changes?: Change[]
  } = {},
) {
  recordAudit(db, {
    module: 'training',
    entityType,
    entityId,
    entityLabel: label,
    action,
    actorId: actor?.id ?? null,
    actingAs,
    ...extra,
    summary: summaryOf(entityType, action, actor?.displayName ?? null, actingAs),
  })
}

function diff(before: object, after: object, labels: Record<string, string>): Change[] {
  const a = before as Record<string, unknown>
  const b = after as Record<string, unknown>
  return Object.keys(labels)
    .filter((field) => JSON.stringify(a[field]) !== JSON.stringify(b[field]))
    .map((field) => ({
      field,
      label: labels[field]!,
      from: a[field] ?? null,
      to: b[field] ?? null,
    }))
}

// --- Visibility -------------------------------------------------------------------------

function visibleAttendee(id: string, viewer: TrainingViewer) {
  const attendee = db.trainingAttendees.find(id)
  if (!attendee || !attendeeVisible(db, viewer, attendee)) throw notFound()
  return attendee
}

function visibleRequest(id: string, viewer: TrainingViewer) {
  const request = db.trainingRequests.find(id)
  if (!request || !requestVisible(db, viewer, request)) throw notFound()
  return request
}

// --- Validation shared by create / edit / add attendee ---------------------------------

function validateRequestFields(
  viewer: TrainingViewer,
  fields: {
    format: string
    location: string | null
    startsOn: string
    endsOn: string
    costCents: number
    costCenterId: string | null
    executiveApproverId: string | null
  },
  checkStart: boolean,
): FieldErrors {
  const errors: FieldErrors = {}
  if (fields.format !== 'online' && !fields.location)
    addError(errors, 'location', 'Add the location (or choose Online).')
  if (checkStart && !viewer.isBackOffice && fields.startsOn < viewer.today)
    addError(errors, 'startsOn', 'The training starts in the past. Pick today or a later date.')
  if (fields.endsOn < fields.startsOn)
    addError(errors, 'endsOn', 'The end date is before the start date.')
  if (fields.costCenterId && !db.costCenters.find(fields.costCenterId)?.active)
    addError(errors, 'costCenterId', 'Pick an active cost centre.')
  if (fields.costCents >= TRAINING_CONFIG.thresholdCents) {
    const exec = fields.executiveApproverId ? userOf(fields.executiveApproverId) : undefined
    if (!fields.executiveApproverId)
      addError(
        errors,
        'executiveApproverId',
        'Trainings from €5,000 per attendee need an executive approver.',
      )
    else if (!exec?.active || !exec.roles.includes('executive'))
      addError(errors, 'executiveApproverId', 'Pick an active executive.')
  } else if (fields.executiveApproverId) {
    addError(
      errors,
      'executiveApproverId',
      'An executive approver is only needed from the threshold. Remove it.',
    )
  }
  return errors
}

type AttendeeInputBody = z.infer<typeof schemas.attendee>

function validateAttendees(
  viewer: TrainingViewer,
  inputs: AttendeeInputBody[],
  dates: { startsOn: string; endsOn: string },
  prefix = 'attendees.',
  indexed = true,
): FieldErrors {
  const errors: FieldErrors = {}
  const minHotel = addDays(dates.startsOn, -2)
  const maxHotel = addDays(dates.endsOn, 2)
  inputs.forEach((input, index) => {
    const key = (field: string) => `${prefix}${indexed ? `${index}.` : ''}${field}`
    const person = userOf(input.userId)
    if (!person) addError(errors, key('userId'), 'This person does not exist.')
    else if (!person.active)
      addError(errors, key('userId'), `${person.displayName} is no longer active.`)
    else if (!mayActFor(viewer, input.userId))
      addError(errors, key('userId'), 'You can only request for yourself or your team')
    if (input.costCenterId && !db.costCenters.find(input.costCenterId)?.active)
      addError(errors, key('costCenterId'), 'Pick an active cost centre.')
    if (input.hotel) {
      const { checkInOn, checkOutOn } = input.hotel
      if (checkOutOn < checkInOn)
        addError(errors, key('hotel.checkOutOn'), 'The check-out is before the check-in.')
      if (checkInOn < minHotel || checkInOn > maxHotel)
        addError(errors, key('hotel.checkInOn'), `Check in between ${minHotel} and ${maxHotel}.`)
      if (checkOutOn < minHotel || checkOutOn > maxHotel)
        addError(errors, key('hotel.checkOutOn'), `Check out between ${minHotel} and ${maxHotel}.`)
    }
  })
  return errors
}

function creatorActingAs(viewer: TrainingViewer, attendeeId: string): ActingAs {
  if (attendeeId === viewer.user.id) return 'self'
  if (viewer.isBackOffice && !viewer.tree.has(attendeeId)) return officeActing(viewer)
  return 'requester'
}

/** Creates one participation with its entry state, audit rows and notifications (SPEC §5.1). */
function createAttendee(
  request: TrainingRequestRecord,
  input: AttendeeInputBody,
  viewer: TrainingViewer,
): TrainingAttendeeRecord {
  const person = userOf(input.userId)!
  const plan = planEntry(db, person, viewer.user, request.executiveApproverId)
  const now = nowIso()
  const managerBy = plan.managerAuto === 'executive_self' ? person.id : plan.resolution.approver.id
  const execBy = plan.executiveAuto === 'executive_self' ? person.id : request.executiveApproverId
  const row = db.trainingAttendees.insert({
    requestId: request.id,
    userId: person.id,
    costCenterId: input.costCenterId ?? person.costCenterId,
    status: plan.initialState,
    statusBeforeCancellation: null,
    approverId: plan.resolution.approver.id,
    approverReason: plan.resolution.reason,
    escalatedFromId: plan.resolution.escalatedFrom?.id ?? null,
    executiveApproverId: request.executiveApproverId,
    hotelNeeded: Boolean(input.hotel),
    hotelCheckInOn: input.hotel?.checkInOn ?? null,
    hotelCheckOutOn: input.hotel?.checkOutOn ?? null,
    hotelCostCents: input.hotel?.cost?.amountCents ?? null,
    goal1: null,
    goal2: null,
    goalsUpdatedAt: null,
    goalsRemindedAt: null,
    bookingReference: null,
    managerDecisionAt: plan.managerAuto ? now : null,
    managerDecisionById: plan.managerAuto ? managerBy : null,
    managerDecisionAs: plan.managerAuto ? 'system' : null,
    managerDecisionComment: null,
    managerAutoApproval: plan.managerAuto,
    executiveDecisionAt: plan.executiveAuto ? now : null,
    executiveDecisionById: plan.executiveAuto ? execBy : null,
    executiveDecisionAs: plan.executiveAuto ? 'system' : null,
    executiveDecisionComment: null,
    executiveAutoApproval: plan.executiveAuto,
    declineReason: null,
    bookingImpossibleReason: null,
    cancellationReason: null,
    bookedAt: null,
    bookedById: null,
    cancellationRequestedAt: null,
    cancelledAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  })
  const label = person.displayName
  audit(
    'training_attendee',
    row.id,
    label,
    'create',
    viewer.user,
    creatorActingAs(viewer, person.id),
    {
      toState: 'pending_manager_approval',
    },
  )
  if (plan.managerAuto)
    audit('training_attendee', row.id, label, 'auto_approve', null, 'system', {
      fromState: 'pending_manager_approval',
      toState: plan.initialState,
      reason: plan.managerAuto,
    })
  if (plan.executiveAuto)
    audit('training_attendee', row.id, label, 'auto_approve', null, 'system', {
      fromState: 'pending_executive_approval',
      toState: 'to_book',
      reason: plan.executiveAuto,
    })
  notifyEntry(row)
  return row
}

// --- Participation scopes (API.md §4.1) -------------------------------------------------

const SCOPES: Scope[] = ['mine', 'approvals', 'executive', 'deputy', 'team', 'all']

interface Joined {
  attendee: TrainingAttendeeRecord
  request: TrainingRequestRecord
  name: string
}

function joined(rows: TrainingAttendeeRecord[]): Joined[] {
  return rows.map((attendee) => ({
    attendee,
    request: requestOf(attendee),
    name: userOf(attendee.userId)?.displayName ?? '',
  }))
}

function participationFilters(params: URLSearchParams, rows: Joined[]): Joined[] {
  const statuses = csv(params, 'status')
  const bad = statuses.filter((s) => !(s in trainingWorkflow.config.states))
  if (bad.length) throw validationProblem({ status: `Unknown value(s): ${bad.join(', ')}.` })
  const from = params.get('from')
  const to = params.get('to')
  const requestId = params.get('requestId')
  const high = params.get('highPriority')
  const q = params.get('q')?.trim()
  const num = q ? parseReference(q) : null
  return rows.filter(({ attendee, request, name }) => {
    if (statuses.length && !statuses.includes(attendee.status)) return false
    if (requestId && attendee.requestId !== requestId) return false
    if (from && request.startsOn < from) return false
    if (to && request.startsOn > to) return false
    if (high === 'true' && !isHighPriority(attendee.status, request.startsOn)) return false
    if (high === 'false' && isHighPriority(attendee.status, request.startsOn)) return false
    if (q) {
      if (num !== null) return request.number === num
      const text = `${request.topic} ${request.provider} ${name}`.toLowerCase()
      if (
        !q
          .toLowerCase()
          .split(/\s+/)
          .every((term) => text.includes(term))
      )
        return false
    }
    return true
  })
}

const PARTICIPATION_SORT = {
  startsOn: (row: Joined) => row.request.startsOn,
  createdAt: (row: Joined) => row.attendee.createdAt,
  status: (row: Joined) => row.attendee.status,
  attendee: (row: Joined) => row.name,
}

function actingAsFor(
  scope: Scope,
  viewer: TrainingViewer,
  attendee: TrainingAttendeeRecord,
): ActingAs | null {
  if (scope === 'approvals') return 'approver'
  if (scope === 'executive') return 'executive'
  if (scope === 'deputy') return 'deputy'
  if (scope === 'team') return decideRight(db, viewer.user, attendee) || null
  return null
}

// --- CSV --------------------------------------------------------------------------------

const csvCell = (value: string) => {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
const euro = (cents: number | null) => (cents === null ? '' : (cents / 100).toFixed(2))
const BOM = '﻿'

// --- Ratings ----------------------------------------------------------------------------

function ratingRows(params: URLSearchParams, viewer: TrainingViewer, scope: 'mine' | 'all') {
  const states = csv(params, 'state') as RatingState[]
  const loops = csv(params, 'loop').map(Number)
  const bad = states.filter((s) => !['upcoming', 'due', 'overdue', 'submitted'].includes(s))
  if (bad.length) throw validationProblem({ state: `Unknown value(s): ${bad.join(', ')}.` })
  const q = params.get('q')?.trim().toLowerCase()
  const num = q ? parseReference(q) : null
  return db.trainingRatings.where((rating) => {
    if (scope === 'mine' && rating.raterId !== viewer.user.id) return false
    if (states.length && !states.includes(ratingState(rating))) return false
    if (loops.length && !loops.includes(rating.loop)) return false
    if (q) {
      const attendee = db.trainingAttendees.find(rating.attendeeId)!
      const request = requestOf(attendee)
      if (num !== null) return request.number === num
      const text =
        `${request.topic} ${request.provider} ${userOf(attendee.userId)?.displayName ?? ''}`.toLowerCase()
      return text.includes(q)
    }
    return true
  })
}

function openNextLoop(
  attendee: TrainingAttendeeRecord,
  loop: 2 | 3,
  raterId: string,
  submittedAt: string,
) {
  const delay = loop === 2 ? TRAINING_CONFIG.loop2DelayDays : TRAINING_CONFIG.loop3DelayDays
  const rating = db.trainingRatings.insert({
    attendeeId: attendee.id,
    loop,
    raterId,
    dueAt: startOfDayIso(addDays(localDay(submittedAt), delay)),
    submittedAt: null,
    lastRemindedAt: null,
    reminderCount: 0,
    participated: null,
    overallGrade: null,
    trainerGrade: null,
    expectationsGrade: null,
    appliesLearned: null,
    supervisorSupported: null,
    worthwhileForOrganization: null,
    improvementObserved: null,
    certificationGained: null,
    certificationComment: null,
    comment: null,
    createdAt: submittedAt,
  })
  audit('training_rating', rating.id, `Feedback round ${loop}`, 'create', null, 'system')
}

function ratingStats(params: URLSearchParams) {
  const from = params.get('from')
  const to = params.get('to')
  const rows = db.trainingRatings.where((rating) => {
    const request = requestOf(db.trainingAttendees.find(rating.attendeeId)!)
    return (!from || request.endsOn >= from) && (!to || request.endsOn <= to)
  })
  const submitted = (loop: number) => rows.filter((r) => r.loop === loop && r.submittedAt)
  const avg = (values: (number | null)[]) => {
    const nums = values.filter((v): v is number => v !== null)
    return nums.length
      ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
      : null
  }
  const l1 = submitted(1)
  const took = l1.filter((r) => r.participated)
  const l2 = submitted(2)
  const likert = (
    field: 'appliesLearned' | 'supervisorSupported' | 'worthwhileForOrganization',
  ) => {
    const dist = { A: 0, B: 0, C: 0, D: 0 }
    for (const r of l2) {
      const value = r[field]
      if (value) dist[value]++
    }
    return dist
  }
  const l3 = submitted(3)
  const improvement: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const r of l3)
    if (r.improvementObserved) improvement[r.improvementObserved as 1 | 2 | 3 | 4]++
  const open = rows.filter((r) => !r.submittedAt)
  return {
    from,
    to,
    loop1: {
      submitted: l1.length,
      participatedRate: l1.length ? Math.round((took.length / l1.length) * 1000) / 1000 : 0,
      avgOverall: avg(took.map((r) => r.overallGrade)),
      avgTrainer: avg(took.map((r) => r.trainerGrade)),
      avgExpectations: avg(took.map((r) => r.expectationsGrade)),
    },
    loop2: {
      submitted: l2.length,
      distribution: {
        appliesLearned: likert('appliesLearned'),
        supervisorSupported: likert('supervisorSupported'),
        worthwhileForOrganization: likert('worthwhileForOrganization'),
      },
    },
    loop3: {
      submitted: l3.length,
      distribution: improvement,
      certificationRate: l3.length
        ? Math.round((l3.filter((r) => r.certificationGained).length / l3.length) * 1000) / 1000
        : null,
    },
    open: {
      due: open.filter((r) => ratingState(r) === 'due').length,
      overdue: open.filter((r) => ratingState(r) === 'overdue').length,
      maxedOut: open.filter((r) => r.reminderCount >= TRAINING_CONFIG.reminderMax).length,
    },
  }
}

const REQUEST_LABELS: Record<string, string> = {
  topic: 'Topic',
  provider: 'Provider',
  format: 'Format',
  location: 'Location',
  registrationUrl: 'Registration link',
  registrationDetails: 'Registration details',
  startsOn: 'Start date',
  endsOn: 'End date',
  costCents: 'Cost per attendee',
  costCenterId: 'Cost centre',
  executiveApproverId: 'Executive approver',
  certificateExpected: 'Certificate expected',
  reimbursementAgreement: 'Reimbursement agreement',
  requesterComment: 'Comment',
}

// --- Handlers ---------------------------------------------------------------------------

export default defineMockHandlers(({ api }) => [
  // Requests — static paths first (SPEC_RESOLUTIONS #30).
  http.get(api('/training/requests'), ({ request }) => {
    const viewer = viewerOf(db, requireUser(request))
    const params = new URL(request.url).searchParams
    const scope = params.get('scope') ?? 'created'
    if (scope === 'all' && !viewer.isBackOffice)
      throw forbidden('Only the training office can list all requests.')
    const billing = csv(params, 'billingStatus')
    const attendeeStatus = csv(params, 'attendeeStatus')
    const from = params.get('from')
    const to = params.get('to')
    const q = params.get('q')?.trim()
    const num = q ? parseReference(q) : null
    const rows = db.trainingRequests.where((r) => {
      if (scope !== 'all' && r.requesterId !== viewer.user.id) return false
      if (billing.length && !billing.includes(r.billingStatus)) return false
      if (from && r.startsOn < from) return false
      if (to && r.startsOn > to) return false
      if (
        attendeeStatus.length &&
        !db.trainingAttendees
          .where((a) => a.requestId === r.id)
          .some((a) => attendeeStatus.includes(a.status))
      )
        return false
      if (q) {
        if (num !== null) return r.number === num
        return `${r.topic} ${r.provider}`.toLowerCase().includes(q.toLowerCase())
      }
      return true
    })
    return listResponse(rows, request, {
      sort: { startsOn: 'startsOn', createdAt: 'createdAt', topic: 'topic', cost: 'costCents' },
      defaultSort: '-createdAt',
      map: (row) => requestSummary(row, viewer),
    })
  }),

  http.post(api('/training/requests/preview'), async ({ request }) => {
    const user = requireUser(request)
    const viewer = viewerOf(db, user)
    const body = await readJson(request, schemas.preview)
    const required = (body.cost?.amountCents ?? 0) >= TRAINING_CONFIG.thresholdCents
    const executives = db.users
      .where((u) => u.active && u.roles.includes('executive'))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
    const errors: FieldErrors = {}
    body.attendees.forEach((a, i) => {
      if (!userOf(a.userId))
        addError(errors, `attendees.${i}.userId`, 'This person does not exist.')
    })
    let exec: string | null = null
    if (required && body.executiveApproverId) {
      if (!executives.some((e) => e.id === body.executiveApproverId))
        addError(errors, 'executiveApproverId', 'Pick an active executive.')
      else exec = body.executiveApproverId
    }
    if (Object.keys(errors).length) throw validationProblem(errors)
    const preview: TrainingPreview = {
      executiveStepRequired: required,
      threshold: { amountCents: TRAINING_CONFIG.thresholdCents, currency: 'EUR' },
      executiveCandidates: executives.map(toUserRef),
      executiveApprover: exec ? toUserRef(userOf(exec)!) : null,
      attendees: body.attendees.map(({ userId }) => {
        const subject = userOf(userId)!
        const plan = planEntry(
          db,
          subject,
          user,
          required ? (exec ?? 'executive-not-chosen') : null,
        )
        const allowed = subject.active && mayActFor(viewer, userId)
        return {
          user: toUserRef(subject),
          approver: toUserRef(plan.resolution.approver),
          approverReason: plan.resolution.reason,
          escalatedFrom: plan.resolution.escalatedFrom
            ? toUserRef(plan.resolution.escalatedFrom)
            : null,
          autoApproval: plan.managerAuto,
          activeDeputies: activeDeputiesOf(db, plan.resolution.approver.id).map(toUserRef),
          allowed,
          notAllowedReason: !subject.active
            ? `${subject.displayName} is no longer active.`
            : allowed
              ? null
              : 'You can only request for yourself or your team',
          initialState: plan.initialState,
          executiveAutoApproval: plan.executiveAuto,
        }
      }),
    }
    return ok(preview as never)
  }),

  http.post(api('/training/requests'), async ({ request }) => {
    const user = requireUser(request)
    const viewer = viewerOf(db, user)
    const body = await readJson(request, schemas.create)
    const errors = {
      ...validateRequestFields(viewer, { ...body, costCents: body.cost.amountCents }, true),
      ...validateAttendees(viewer, body.attendees, body),
    }
    if (Object.keys(errors).length) throw validationProblem(errors)
    const now = nowIso()
    const number = Math.max(0, ...db.trainingRequests.all().map((r) => r.number)) + 1
    const record = db.trainingRequests.insert({
      number,
      topic: body.topic,
      provider: body.provider,
      format: body.format,
      location: body.location,
      registrationUrl: body.registrationUrl,
      registrationDetails: body.registrationDetails,
      startsOn: body.startsOn,
      endsOn: body.endsOn,
      costCents: body.cost.amountCents,
      costCenterId: body.costCenterId ?? user.costCenterId,
      executiveApproverId: body.executiveApproverId,
      certificateExpected: body.certificateExpected,
      reimbursementAgreement: body.reimbursementAgreement,
      requesterComment: body.requesterComment,
      requesterId: user.id,
      backOfficeComment: null,
      billingStatus: 'open',
      actualCostCents: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    audit(
      'training_request',
      record.id,
      reference(number),
      'create',
      user,
      viewer.isBackOffice ? officeActing(viewer) : 'requester',
    )
    linkAttachments(db, body.attachmentIds, {
      entityType: 'training_request',
      entityId: record.id,
      uploaderId: user.id,
      purpose: 'training_document',
    })
    for (const input of body.attendees) createAttendee(record, input, viewer)
    return created(requestDetail(record, viewer) as never, api(`/training/requests/${record.id}`))
  }),

  http.get(api('/training/requests/:id/timeline'), ({ request, params }) => {
    const viewer = viewerOf(db, requireUser(request))
    const record = visibleRequest(param(params.id), viewer)
    const attendees = db.trainingAttendees.where(
      (a) => a.requestId === record.id && attendeeVisible(db, viewer, a, record),
    )
    return ok(
      timelineFor(db, [
        { entityType: 'training_request', entityId: record.id },
        ...attendees.map((a) => ({ entityType: 'training_attendee', entityId: a.id })),
      ]) as never,
    )
  }),

  http.get(api('/training/requests/:id'), ({ request, params }) => {
    const viewer = viewerOf(db, requireUser(request))
    return ok(requestDetail(visibleRequest(param(params.id), viewer), viewer) as never)
  }),

  http.patch(api('/training/requests/:id/back-office'), async ({ request, params }) => {
    const user = requireUser(request)
    const viewer = viewerOf(db, user)
    const record = visibleRequest(param(params.id), viewer)
    if (!viewer.isBackOffice)
      throw forbidden('Only the training office can edit the billing details.')
    const body = await readJson(request, schemas.backOffice)
    if (body.version !== undefined && body.version !== record.version)
      throw conflict('Someone else changed this request. Reload and try again.', 'version_conflict')
    const billingStatus = body.billingStatus ?? record.billingStatus
    let actualCostCents =
      body.actualCost !== undefined
        ? (body.actualCost?.amountCents ?? null)
        : record.actualCostCents
    if (billingStatus === 'free_of_charge') actualCostCents = 0
    const next = {
      billingStatus,
      actualCostCents,
      backOfficeComment:
        body.backOfficeComment !== undefined ? body.backOfficeComment : record.backOfficeComment,
    }
    const changes = diff(record, next, {
      billingStatus: 'Billing status',
      actualCostCents: 'Actual cost',
      backOfficeComment: 'Back-office comment',
    })
    const updated = db.trainingRequests.update(record.id, {
      ...next,
      version: record.version + 1,
      updatedAt: nowIso(),
    })!
    if (changes.length)
      audit(
        'training_request',
        record.id,
        reference(record.number),
        'update_back_office',
        user,
        officeActing(viewer),
        {
          changes,
        },
      )
    return ok(requestDetail(updated, viewer) as never)
  }),

  http.patch(api('/training/requests/:id'), async ({ request, params }) => {
    const user = requireUser(request)
    const viewer = viewerOf(db, user)
    const record = visibleRequest(param(params.id), viewer)
    const requester = record.requesterId === user.id
    if (!requester && !viewer.isBackOffice)
      throw forbidden('Only the requester or the training office can edit this request.')
    const body = await readJson(request, schemas.update)
    if (body.version !== undefined && body.version !== record.version)
      throw conflict('Someone else changed this request. Reload and try again.', 'version_conflict')
    const attendees = db.trainingAttendees.where((a) => a.requestId === record.id)
    if (!viewer.isBackOffice && !attendees.every((a) => a.status === 'pending_manager_approval'))
      throw conflict(
        'The request can no longer be edited: at least one attendee has passed the manager approval.',
      )
    const costCents = body.cost?.amountCents ?? record.costCents
    let executiveApproverId =
      body.executiveApproverId !== undefined
        ? (body.executiveApproverId ?? null)
        : record.executiveApproverId
    if (costCents < TRAINING_CONFIG.thresholdCents && body.executiveApproverId === undefined)
      executiveApproverId = null
    const costChanges =
      costCents !== record.costCents || executiveApproverId !== record.executiveApproverId
    if (costChanges && attendees.some((a) => a.managerDecisionAt))
      throw conflict(
        'The cost and the executive approver can only change until the first attendee passes the manager approval.',
      )
    const next = {
      topic: body.topic ?? record.topic,
      provider: body.provider ?? record.provider,
      format: body.format ?? record.format,
      location: body.location !== undefined ? body.location : record.location,
      registrationUrl:
        body.registrationUrl !== undefined ? body.registrationUrl : record.registrationUrl,
      registrationDetails:
        body.registrationDetails !== undefined
          ? body.registrationDetails
          : record.registrationDetails,
      startsOn: body.startsOn ?? record.startsOn,
      endsOn: body.endsOn ?? record.endsOn,
      costCents,
      costCenterId: body.costCenterId ?? record.costCenterId,
      executiveApproverId,
      certificateExpected: body.certificateExpected ?? record.certificateExpected,
      reimbursementAgreement: body.reimbursementAgreement ?? record.reimbursementAgreement,
      requesterComment:
        body.requesterComment !== undefined ? body.requesterComment : record.requesterComment,
    }
    const errors = validateRequestFields(
      viewer,
      next,
      body.startsOn !== undefined && body.startsOn !== record.startsOn,
    )
    if (Object.keys(errors).length) throw validationProblem(errors)
    const changes = diff(record, next, REQUEST_LABELS)
    const updated = db.trainingRequests.update(record.id, {
      ...next,
      version: record.version + 1,
      updatedAt: nowIso(),
    })!
    if (costChanges)
      for (const a of attendees.filter((x) => x.status === 'pending_manager_approval'))
        db.trainingAttendees.update(a.id, { executiveApproverId, version: a.version + 1 })
    if (changes.length)
      audit(
        'training_request',
        record.id,
        reference(record.number),
        'update',
        user,
        requester ? 'requester' : officeActing(viewer),
        { changes },
      )
    return ok(requestDetail(updated, viewer) as never)
  }),

  http.post(api('/training/requests/:id/attendees'), async ({ request, params }) => {
    const user = requireUser(request)
    const viewer = viewerOf(db, user)
    const record = visibleRequest(param(params.id), viewer)
    if (record.requesterId !== user.id && !viewer.isBackOffice)
      throw forbidden('Only the requester or the training office can add attendees.')
    if (record.startsOn <= viewer.today)
      throw conflict('Attendees can only be added before the training starts.')
    const body = await readJson(request, schemas.attendee)
    if (db.trainingAttendees.first((a) => a.requestId === record.id && a.userId === body.userId))
      throw conflict('This person is already an attendee of the request.')
    const errors = validateAttendees(viewer, [body], record, '', false)
    if (Object.keys(errors).length) throw validationProblem(errors)
    const row = createAttendee(record, body, viewer)
    audit(
      'training_request',
      record.id,
      reference(record.number),
      'add_attendee',
      user,
      record.requesterId === user.id ? 'requester' : officeActing(viewer),
    )
    return created(
      attendeeDto(db.trainingAttendees.find(row.id)!, user) as never,
      api(`/training/participations/${row.id}`),
    )
  }),

  http.post(api('/training/requests/:id/attachments'), async ({ request, params }) => {
    const user = requireUser(request)
    const viewer = viewerOf(db, user)
    const record = visibleRequest(param(params.id), viewer)
    if (record.requesterId !== user.id && !viewer.isBackOffice)
      throw forbidden('Only the requester or the training office can add documents.')
    const body = await readJson(request, schemas.attachments)
    linkAttachments(db, body.attachmentIds, {
      entityType: 'training_request',
      entityId: record.id,
      uploaderId: user.id,
      purpose: 'training_document',
    })
    audit(
      'training_request',
      record.id,
      reference(record.number),
      'add_attachment',
      user,
      record.requesterId === user.id ? 'requester' : officeActing(viewer),
    )
    return ok(attachmentsOf(db, 'training_request', record.id) as never)
  }),

  http.delete(api('/training/requests/:id/attachments/:attachmentId'), ({ request, params }) => {
    const user = requireUser(request)
    const viewer = viewerOf(db, user)
    const record = visibleRequest(param(params.id), viewer)
    const attachment = db.attachments.find(param(params.attachmentId))
    if (
      !attachment ||
      attachment.entityType !== 'training_request' ||
      attachment.entityId !== record.id
    )
      throw notFound()
    if (attachment.uploadedById !== user.id && !viewer.isBackOffice)
      throw forbidden('Only the uploader or the training office can remove this document.')
    db.attachments.remove(attachment.id)
    audit(
      'training_request',
      record.id,
      reference(record.number),
      'remove_attachment',
      user,
      attachment.uploadedById === user.id ? 'requester' : officeActing(viewer),
    )
    return noContent()
  }),

  // Participations — export.csv before /:id.
  http.get(api('/training/participations/export.csv'), ({ request }) => {
    const viewer = viewerOf(db, requireUser(request))
    if (!viewer.isBackOffice) throw forbidden('Only the training office can export participations.')
    const params = new URL(request.url).searchParams
    const rows = participationFilters(params, joined(db.trainingAttendees.all())).sort((a, b) =>
      b.attendee.createdAt.localeCompare(a.attendee.createdAt),
    )
    const header =
      'reference,topic,provider,format,startsOn,endsOn,attendee,attendeeEmail,costCentre,status,approver,costPerAttendee,hotelCheckIn,hotelCheckOut,hotelCost,bookingReference,billingStatus,actualCost'
    const lines = rows.map(({ attendee, request: r, name }) =>
      [
        reference(r.number),
        r.topic,
        r.provider,
        r.format,
        r.startsOn,
        r.endsOn,
        name,
        userOf(attendee.userId)?.email ?? '',
        db.costCenters.find(attendee.costCenterId)?.code ?? '',
        trainingWorkflow.config.states[attendee.status]?.label ?? attendee.status,
        attendee.approverId ? (userOf(attendee.approverId)?.displayName ?? '') : '',
        euro(r.costCents),
        attendee.hotelCheckInOn ?? '',
        attendee.hotelCheckOutOn ?? '',
        euro(attendee.hotelCostCents),
        attendee.bookingReference ?? '',
        r.billingStatus,
        euro(r.actualCostCents),
      ]
        .map(csvCell)
        .join(','),
    )
    return new HttpResponse(`${BOM}${[header, ...lines].join('\r\n')}\r\n`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="training-participations.csv"',
      },
    })
  }),

  http.get(api('/training/participations'), ({ request }) => {
    const user = requireUser(request)
    const viewer = viewerOf(db, user)
    const params = new URL(request.url).searchParams
    const scope = (params.get('scope') ?? 'mine') as Scope
    if (!SCOPES.includes(scope)) throw validationProblem({ scope: 'Unknown scope.' })
    if (scope === 'all' && !viewer.isBackOffice)
      throw forbidden('Only the training office can list all participations.')
    const rows = participationFilters(
      params,
      joined(db.trainingAttendees.where((a) => inScope(scope, viewer, a))),
    )
    const approvalScope = ['approvals', 'executive', 'deputy'].includes(scope)
    return listResponse(rows, request, {
      sort: PARTICIPATION_SORT,
      defaultSort: approvalScope ? 'startsOn' : '-createdAt',
      map: (row) => listItem(row.attendee, user, actingAsFor(scope, viewer, row.attendee)),
    })
  }),

  http.get(api('/training/participations/:id/timeline'), ({ request, params }) => {
    const viewer = viewerOf(db, requireUser(request))
    const attendee = visibleAttendee(param(params.id), viewer)
    const ratings = db.trainingRatings.where(
      (r) =>
        r.attendeeId === attendee.id &&
        (r.loop !== 3 || attendee.userId !== viewer.user.id || viewer.isBackOffice),
    )
    return ok(
      timelineFor(db, [
        { entityType: 'training_attendee', entityId: attendee.id },
        ...ratings.map((r) => ({ entityType: 'training_rating', entityId: r.id })),
      ]) as never,
    )
  }),

  http.get(api('/training/participations/:id'), ({ request, params }) => {
    const viewer = viewerOf(db, requireUser(request))
    return ok(participationDetail(visibleAttendee(param(params.id), viewer), viewer) as never)
  }),

  http.post(api('/training/participations/:id/actions/:action'), async ({ request, params }) => {
    const user = requireUser(request)
    const viewer = viewerOf(db, user)
    const attendee = visibleAttendee(param(params.id), viewer)
    const action = param(params.action)
    const check = checkAction(attendee, action, user)
    if (check.kind === 'unknown') throw notFound(`Unknown action '${action}'.`)
    if (check.kind === 'forbidden') throw forbidden()
    if (check.kind === 'invalid') throw invalidTransition(action, attendee.status)
    const body = check.transition.body
      ? await readJson(request, check.transition.body)
      : await readJson<Record<string, unknown>>(request)
    trainingWorkflow.transition(db.trainingAttendees, attendee, action, user, body ?? {})
    return ok(participationDetail(db.trainingAttendees.find(attendee.id)!, viewer) as never)
  }),

  http.put(api('/training/participations/:id/goals'), async ({ request, params }) => {
    const user = requireUser(request)
    const viewer = viewerOf(db, user)
    const attendee = visibleAttendee(param(params.id), viewer)
    if (attendee.userId !== user.id)
      throw forbidden('Only the attendee can set the learning goals.')
    const body = await readJson(request, schemas.goals)
    if (!GOALS_EDITABLE.includes(attendee.status) || requestOf(attendee).startsOn <= today())
      throw conflict(
        'Learning goals can only be changed until the training starts.',
        'invalid_transition',
      )
    const changes = diff(attendee, body, { goal1: 'Goal 1', goal2: 'Goal 2' })
    db.trainingAttendees.update(attendee.id, {
      goal1: body.goal1,
      goal2: body.goal2,
      goalsUpdatedAt: nowIso(),
      version: attendee.version + 1,
    })
    if (changes.length)
      audit('training_attendee', attendee.id, user.displayName, 'update_goals', user, 'self', {
        changes,
      })
    return ok(participationDetail(db.trainingAttendees.find(attendee.id)!, viewer) as never)
  }),

  // Ratings — stats before /:id.
  http.get(api('/training/ratings/stats'), ({ request }) => {
    const viewer = viewerOf(db, requireUser(request))
    if (!viewer.isBackOffice)
      throw forbidden('Only the training office can see the rating statistics.')
    return ok(ratingStats(new URL(request.url).searchParams) as never)
  }),

  http.get(api('/training/ratings'), ({ request }) => {
    const viewer = viewerOf(db, requireUser(request))
    const params = new URL(request.url).searchParams
    const scope = params.get('scope') === 'all' ? 'all' : 'mine'
    if (scope === 'all' && !viewer.isBackOffice)
      throw forbidden('Only the training office can list all ratings.')
    return listResponse(ratingRows(params, viewer, scope), request, {
      sort: ['dueAt', 'submittedAt'],
      defaultSort: 'dueAt',
      map: (row) => ratingDto(row, viewer),
    })
  }),

  http.get(api('/training/ratings/:id'), ({ request, params }) => {
    const viewer = viewerOf(db, requireUser(request))
    const rating = db.trainingRatings.find(param(params.id))
    if (!rating || !ratingVisible(db, viewer, rating)) throw notFound()
    return ok(ratingDto(rating, viewer) as never)
  }),

  http.post(api('/training/ratings/:id/submit'), async ({ request, params }) => {
    const user = requireUser(request)
    const viewer = viewerOf(db, user)
    const rating = db.trainingRatings.find(param(params.id))
    if (!rating || !ratingVisible(db, viewer, rating)) throw notFound()
    if (rating.raterId !== user.id) throw forbidden('Only the rater can submit this feedback.')
    const body = await readJson(request, schemas.rating)
    if (rating.submittedAt)
      throw conflict('This feedback was already submitted.', 'invalid_transition')
    if (new Date(rating.dueAt).getTime() > Date.now())
      throw conflict('This feedback round is not due yet.', 'invalid_transition')
    if (body.loop !== rating.loop)
      throw validationProblem({ loop: `This is feedback round ${rating.loop}.` })
    const attendee = db.trainingAttendees.find(rating.attendeeId)!
    if (!rateable(rating, attendee))
      throw conflict(
        `Feedback round ${rating.loop} is not open for this participation.`,
        'invalid_transition',
      )
    const submittedAt = nowIso()
    const patch: Partial<TrainingRatingRecord> = { submittedAt, comment: body.comment ?? null }
    if (body.loop === 1)
      Object.assign(patch, {
        participated: body.participated,
        overallGrade: body.participated ? body.overallGrade : null,
        trainerGrade: body.participated ? body.trainerGrade : null,
        expectationsGrade: body.participated ? body.expectationsGrade : null,
      })
    else if (body.loop === 2)
      Object.assign(patch, {
        appliesLearned: body.appliesLearned,
        supervisorSupported: body.supervisorSupported,
        worthwhileForOrganization: body.worthwhileForOrganization,
      })
    else
      Object.assign(patch, {
        improvementObserved: body.improvementObserved,
        certificationGained: body.certificationGained,
        certificationComment: body.certificationComment ?? null,
      })
    db.trainingRatings.update(rating.id, patch)
    const name = userOf(attendee.userId)?.displayName ?? ''
    audit(
      'training_rating',
      rating.id,
      `Feedback round ${rating.loop} · ${name}`,
      'submit',
      user,
      'self',
    )
    if (body.loop === 1) {
      const to: AttendeeStatus = body.participated ? 'attended' : 'not_attended'
      db.trainingAttendees.update(attendee.id, {
        status: to,
        version: attendee.version + 1,
        updatedAt: submittedAt,
      })
      audit('training_attendee', attendee.id, name, 'submit_rating_1', user, 'self', {
        fromState: 'booked',
        toState: to,
      })
      if (body.participated) openNextLoop(attendee, 2, attendee.userId, submittedAt)
    } else if (body.loop === 2) {
      const manager = directManager(db, attendee.userId)
      if (manager) openNextLoop(attendee, 3, manager.id, submittedAt)
    }
    return ok(ratingDto(db.trainingRatings.find(rating.id)!, viewer) as never)
  }),
])
