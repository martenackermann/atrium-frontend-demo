import { http } from 'msw'
import { z } from 'zod'
import { diffFields, recordAudit, timelineFor } from '~/mocks/core/audit'
import { linkAttachments } from '~/mocks/core/files'
import { isInReportingTree } from '~/mocks/core/org'
import type { MockUser } from '~/mocks/core/types'
import { db } from '~/mocks/db'
import { defineMockHandlers } from '~/mocks/define'
import {
  conflict,
  created,
  forbidden,
  invalidTransition,
  notFound,
  ok,
  param,
  readJson,
  requireUser,
  validationProblem,
} from '~/mocks/http'
import { listResponse } from '~/mocks/list'
import type { PeopleRequestType, Priority } from '../api/types'
import { toComment, toDetail, toJobRole, toSummary } from './dto'
import {
  backOfficeActingAs,
  canComment,
  canEdit,
  canSeePersonalData,
  canView,
  isBackOffice,
  isClosedStatus,
  isMine,
  parsePeopleReference,
  peopleReference,
  peopleSummary,
  requestCreatedText,
} from './rules'
import type { PeopleRequestRecord } from './types'
import { addComment, notifyComment, notifyUser, peopleWorkflow, requesterReplied } from './workflow'

/**
 * People API mocks (API.md §7.1) for demo mode: the same payloads, rules and errors as the
 * backend - visibility 404, personal data only for requester/manager/People Ops (#24/#25),
 * requester edits while open, the workflow of SPEC §5.4 and `requester_replied` on a reply.
 */

const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, normal: 2, low: 3 }
const STATUS_RANK = [
  'open',
  'in_progress',
  'waiting_internal',
  'waiting_on_requester',
  'reopened',
  'completed',
  'rejected',
  'cancelled',
]

const uuid = z.string().uuid()
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.')
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null))
const address = z.strictObject({
  street: z.string().trim().min(1).max(120),
  houseNumber: z.string().trim().min(1).max(20),
  postalCode: z.string().trim().min(2).max(12),
  city: z.string().trim().min(1).max(80),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Use an ISO 3166-1 alpha-2 code'),
})
const personalData = z.strictObject({
  birthDate: isoDate.nullish(),
  placeOfBirth: optText(120).optional(),
  nationality: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Use an ISO 3166-1 alpha-2 code, like DE.')
    .nullish(),
  privateAddress: address.nullish(),
  privatePhone: optText(40).optional(),
  privateEmail: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => (v ? v : null))
    .pipe(z.email('Enter a valid email address.').nullable())
    .optional(),
})
const fields = {
  title: z.string().trim().min(3).max(140),
  priority: z.enum(['critical', 'high', 'normal', 'low']).optional(),
  jobRoleId: uuid.nullish(),
  subjectUserId: uuid.nullish(),
  salutation: z.enum(['mr', 'ms', 'mx']).nullish(),
  firstName: optText(100).optional(),
  lastName: optText(100).optional(),
  effectiveDate: isoDate,
  departmentId: uuid.nullish(),
  siteId: uuid.nullish(),
  managerId: uuid.nullish(),
  managerDeputyId: uuid.nullish(),
  reason: optText(2000).optional(),
  furtherInformation: optText(2000).optional(),
  equipmentNotes: optText(2000).optional(),
  personalData: personalData.nullish(),
}
const createSchema = z.strictObject({
  type: z.enum(['onboarding', 'offboarding', 'role_change']),
  ...fields,
  attachmentIds: z.array(uuid).max(10).optional(),
})
const updateSchema = z.strictObject({
  ...fields,
  title: fields.title.optional(),
  effectiveDate: fields.effectiveDate.optional(),
  assigneeId: uuid.nullish(),
  internalNote: optText(4000).optional(),
  version: z.number().int().min(1).optional(),
})
type UpdateBody = z.infer<typeof updateSchema>
const commentSchema = z.strictObject({
  body: z.string().trim().min(1).max(4000),
  internal: z.boolean().optional(),
})
const jobRoleSchema = z.strictObject({
  name: z.string().trim().min(2).max(100),
  category: optText(80).optional(),
  active: z.boolean().optional(),
})

const REQUESTER_FIELDS = Object.keys(fields)
const INTERNAL_FIELDS = ['assigneeId', 'internalNote']

function visible(id: string, user: MockUser): PeopleRequestRecord | undefined {
  const row = db.peopleRequests.find(id)
  return row && canView(user, row) ? row : undefined
}

interface ResolvedFields {
  jobRoleId: string | null
  subjectUserId: string | null
  firstName: string
  lastName: string
  departmentId: string | null
  siteId: string | null
  managerId: string | null
  managerDeputyId: string | null
}

/** Type-specific checks of SPEC §4.5 / API.md §7.1 (422 per field), defaults from the subject. */
function resolveFields(
  user: MockUser,
  type: PeopleRequestType,
  input: {
    jobRoleId: string | null
    subjectUserId: string | null
    firstName: string | null
    lastName: string | null
    departmentId: string | null | undefined
    siteId: string | null | undefined
    managerId: string | null | undefined
    managerDeputyId: string | null
  },
  subjectChanged = true,
): ResolvedFields {
  const errors: Record<string, string> = {}
  if (type === 'onboarding' && !input.jobRoleId) {
    errors.jobRoleId = 'Choose the job role of the new colleague.'
  }
  if (input.jobRoleId && !db.jobRoles.find(input.jobRoleId)?.active) {
    errors.jobRoleId = 'This job role does not exist or is no longer offered.'
  }
  const subject = input.subjectUserId ? db.users.find(input.subjectUserId) : undefined
  let { firstName, lastName } = input
  if (type === 'onboarding') {
    if (input.subjectUserId) {
      errors.subjectUserId = 'Onboarding is for a new colleague; leave the person empty.'
    }
    if (!firstName) errors.firstName = 'Enter the first name.'
    if (!lastName) errors.lastName = 'Enter the last name.'
  } else if (!input.subjectUserId) {
    errors.subjectUserId = 'Choose the person this request is about.'
  } else if (!subject || (!subject.active && subjectChanged)) {
    errors.subjectUserId = 'Choose an active colleague.'
  } else {
    firstName = subject.firstName
    lastName = subject.lastName
    if (
      subjectChanged &&
      !isBackOffice(user) &&
      user.id !== subject.id &&
      !isInReportingTree(db, user.id, subject.id)
    ) {
      errors.subjectUserId = 'You can only request for yourself or your team.'
    }
  }
  let managerId = input.managerId ?? null
  if (!managerId && type !== 'onboarding' && subject && input.managerId === undefined) {
    managerId = subject.managerId
  }
  if (type === 'onboarding' && !managerId) {
    errors.managerId = 'Choose the manager of the new colleague.'
  }
  if (input.managerId && !db.users.find(input.managerId)?.active) {
    errors.managerId = 'Choose an active colleague as manager.'
  }
  if (input.managerDeputyId) {
    if (!db.users.find(input.managerDeputyId)?.active) {
      errors.managerDeputyId = "Choose an active colleague as the manager's deputy."
    } else if (input.managerDeputyId === managerId) {
      errors.managerDeputyId = "The manager's deputy must be someone other than the manager."
    }
  }
  if (input.departmentId && !db.departments.find(input.departmentId)) {
    errors.departmentId = 'This department does not exist.'
  }
  if (input.siteId && !db.sites.find(input.siteId)) errors.siteId = 'This site does not exist.'
  if (Object.keys(errors).length) throw validationProblem(errors)
  return {
    jobRoleId: input.jobRoleId,
    subjectUserId: type === 'onboarding' ? null : input.subjectUserId,
    firstName: firstName!,
    lastName: lastName!,
    departmentId:
      input.departmentId === undefined ? (subject?.departmentId ?? null) : input.departmentId,
    siteId: input.siteId === undefined ? (subject?.siteId ?? null) : input.siteId,
    managerId,
    managerDeputyId: input.managerDeputyId,
  }
}

type PersonalInput = z.infer<typeof personalData>
const EMPTY_PERSONAL: PeopleRequestRecord['personalData'] = {
  birthDate: null,
  placeOfBirth: null,
  nationality: null,
  privateAddress: null,
  privatePhone: null,
  privateEmail: null,
}

function mergePersonal(
  current: PeopleRequestRecord['personalData'],
  input: PersonalInput | null | undefined,
): PeopleRequestRecord['personalData'] {
  if (input === undefined) return current
  if (input === null) return { ...EMPTY_PERSONAL }
  const next: Record<string, unknown> = { ...current }
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) next[key] = value ?? null
  }
  return next as unknown as PeopleRequestRecord['personalData']
}

const AUDIT_LABELS = {
  title: 'Title',
  priority: 'Priority',
  jobRole: 'Job role',
  subject: 'Person',
  effectiveDate: 'Effective date',
  department: 'Department',
  site: 'Site',
  manager: 'Manager',
  managerDeputy: "Manager's deputy",
  reason: 'Reason',
  furtherInformation: 'Further information',
  equipmentNotes: 'Equipment notes',
  personalData: 'Personal data',
  assignee: 'Assignee',
  internalNote: 'Internal note',
}

function auditView(row: PeopleRequestRecord) {
  const name = (id: string | null) => (id ? (db.users.find(id)?.displayName ?? null) : null)
  return {
    title: row.title,
    priority: row.priority,
    jobRole: row.jobRoleId ? (db.jobRoles.find(row.jobRoleId)?.name ?? null) : null,
    subject: name(row.subjectUserId),
    effectiveDate: row.effectiveDate,
    department: row.departmentId ? (db.departments.find(row.departmentId)?.name ?? null) : null,
    site: row.siteId ? (db.sites.find(row.siteId)?.name ?? null) : null,
    manager: name(row.managerId),
    managerDeputy: name(row.managerDeputyId),
    reason: row.reason,
    furtherInformation: row.furtherInformation,
    equipmentNotes: row.equipmentNotes,
    personalData: row.personalData,
    assignee: name(row.assigneeId),
    internalNote: row.internalNote,
  }
}

export default defineMockHandlers(({ api }) => [
  // --- Job roles ------------------------------------------------------------------------------
  http.get(api('/people/job-roles'), ({ request }) => {
    const user = requireUser(request)
    const all =
      new URL(request.url).searchParams.get('includeInactive') === 'true' && isBackOffice(user)
    const rows = db.jobRoles
      .where((row) => all || row.active)
      .sort((a, b) => a.name.localeCompare(b.name))
    return ok(rows.map(toJobRole) as never)
  }),

  http.post(api('/people/job-roles'), async ({ request }) => {
    const user = requireUser(request)
    if (!isBackOffice(user)) throw forbidden()
    const body = await readJson(request, jobRoleSchema)
    const clash = db.jobRoles.first((row) => row.name.toLowerCase() === body.name.toLowerCase())
    if (clash) throw conflict(`A job role named "${clash.name}" already exists.`)
    const row = db.jobRoles.insert({
      name: body.name,
      category: body.category ?? null,
      active: body.active ?? true,
    })
    recordAudit(db, {
      module: 'people',
      entityType: 'job_role',
      entityId: row.id,
      entityLabel: row.name,
      action: 'create',
      actorId: user.id,
      actingAs: backOfficeActingAs(user),
      summary: `${user.displayName} created the job role`,
    })
    return created(toJobRole(row) as never, api(`/people/job-roles/${row.id}`))
  }),

  http.patch(api('/people/job-roles/:id'), async ({ request, params }) => {
    const user = requireUser(request)
    if (!isBackOffice(user)) throw forbidden()
    const row = db.jobRoles.find(param(params.id))
    if (!row) throw notFound()
    const body = await readJson(request, jobRoleSchema.partial())
    const name = body.name
    if (name && name.toLowerCase() !== row.name.toLowerCase()) {
      const clash = db.jobRoles.first(
        (other) => other.id !== row.id && other.name.toLowerCase() === name.toLowerCase(),
      )
      if (clash) throw conflict(`A job role named "${clash.name}" already exists.`)
    }
    const updated = db.jobRoles.update(row.id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    })!
    return ok(toJobRole(updated) as never)
  }),

  // --- Requests -------------------------------------------------------------------------------
  http.get(api('/people/requests'), ({ request }) => {
    const user = requireUser(request)
    const params = new URL(request.url).searchParams
    const scope = params.get('scope') ?? 'mine'
    if (scope === 'all' && !isBackOffice(user)) {
      throw forbidden('Only People Ops can list all requests.')
    }
    let rows = db.peopleRequests.where((row) =>
      scope === 'all' ? canView(user, row) : isMine(user, row),
    )
    const assignee = params.get('assigneeId')
    if (assignee === 'me') rows = rows.filter((row) => row.assigneeId === user.id)
    else if (assignee === 'none') rows = rows.filter((row) => row.assigneeId === null)
    else if (assignee) rows = rows.filter((row) => row.assigneeId === assignee)
    const from = params.get('from')
    const to = params.get('to')
    if (from) rows = rows.filter((row) => row.effectiveDate >= from)
    if (to) rows = rows.filter((row) => row.effectiveDate <= to)
    const q = params.get('q')?.trim()
    const reference = q ? parsePeopleReference(q) : null
    if (reference !== null) {
      rows = rows.filter((row) => row.number === reference)
      params.delete('q')
    }
    return listResponse(rows, params, {
      filters: { status: 'status', type: 'type', priority: 'priority' },
      search: (row) => `${row.title} ${row.firstName} ${row.lastName}`,
      sort: {
        effectiveDate: 'effectiveDate',
        createdAt: 'createdAt',
        priority: (row) => PRIORITY_RANK[row.priority],
        status: (row) => STATUS_RANK.indexOf(row.status),
      },
      defaultSort: '-createdAt',
      map: (row) => toSummary(row, user),
    })
  }),

  http.post(api('/people/requests'), async ({ request }) => {
    const user = requireUser(request)
    const body = await readJson(request, createSchema)
    const resolved = resolveFields(user, body.type, {
      jobRoleId: body.jobRoleId ?? null,
      subjectUserId: body.subjectUserId ?? null,
      firstName: body.firstName ?? null,
      lastName: body.lastName ?? null,
      departmentId: body.departmentId,
      siteId: body.siteId,
      managerId: body.managerId,
      managerDeputyId: body.managerDeputyId ?? null,
    })
    const now = new Date().toISOString()
    const number = Math.max(0, ...db.peopleRequests.all().map((row) => row.number)) + 1
    const row = db.peopleRequests.insert({
      number,
      type: body.type,
      title: body.title,
      priority: body.priority ?? 'normal',
      status: 'open',
      ...resolved,
      salutation: body.salutation ?? null,
      effectiveDate: body.effectiveDate,
      requesterId: user.id,
      assigneeId: null,
      reason: body.reason ?? null,
      furtherInformation: body.furtherInformation ?? null,
      equipmentNotes: body.equipmentNotes ?? null,
      personalData: mergePersonal({ ...EMPTY_PERSONAL }, body.personalData ?? null),
      internalNote: null,
      statusReason: null,
      closedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    linkAttachments(db, body.attachmentIds, {
      entityType: 'people_request',
      entityId: row.id,
      uploaderId: user.id,
      purpose: 'people_document',
    })
    recordAudit(db, {
      module: 'people',
      entityType: 'people_request',
      entityId: row.id,
      entityLabel: `${peopleReference(row.number)} ${row.title}`,
      action: 'create',
      actorId: user.id,
      actingAs: 'requester',
      toState: 'open',
      summary: peopleSummary(user.displayName, 'create', 'requester'),
    })
    const notification = requestCreatedText({
      reference: peopleReference(row.number),
      type: row.type,
      title: row.title,
      effectiveDate: row.effectiveDate,
      priority: row.priority,
      requesterName: user.displayName,
      subjectName: `${row.firstName} ${row.lastName}`,
    })
    notifyUser(row.requesterId, row, notification)
    if (row.managerId && row.managerId !== row.requesterId) {
      notifyUser(row.managerId, row, notification)
    }
    return created(toDetail(row, user) as never, api(`/people/requests/${row.id}`))
  }),

  http.get(api('/people/requests/:id'), ({ request, params }) => {
    const user = requireUser(request)
    const row = visible(param(params.id), user)
    if (!row) throw notFound()
    return ok(toDetail(row, user) as never)
  }),

  http.patch(api('/people/requests/:id'), async ({ request, params }) => {
    const user = requireUser(request)
    const row = visible(param(params.id), user)
    if (!row) throw notFound()
    const body: UpdateBody = await readJson(request, updateSchema)
    const keys = (Object.keys(body) as (keyof UpdateBody)[]).filter(
      (key) => key !== 'version' && body[key] !== undefined,
    )
    const wantsInternal = keys.some((key) => INTERNAL_FIELDS.includes(key))
    const wantsFields = keys.some((key) => REQUESTER_FIELDS.includes(key))
    const backOffice = isBackOffice(user)
    if (wantsInternal && !backOffice) throw forbidden('Only People Ops can change these fields.')
    if (wantsFields) {
      if (backOffice && isClosedStatus(row.status)) throw invalidTransition('edit', row.status)
      if (!canEdit(user, row)) {
        throw forbidden(
          row.requesterId === user.id
            ? 'You can change the request only while it is open. Add a comment instead.'
            : 'You are not allowed to change this request.',
        )
      }
    }
    if (body.personalData !== undefined && !canSeePersonalData(user, row)) {
      throw forbidden('Only the requester, the manager and People Ops can change personal data.')
    }
    if (body.version !== undefined && body.version !== row.version) {
      throw conflict(
        'The request was changed by someone else. Reload and try again.',
        'version_conflict',
      )
    }
    if (keys.length === 0) return ok(toDetail(row, user) as never)

    const subjectUserId = body.subjectUserId !== undefined ? body.subjectUserId : row.subjectUserId
    const resolved = wantsFields
      ? resolveFields(
          user,
          row.type,
          {
            jobRoleId: body.jobRoleId !== undefined ? body.jobRoleId : row.jobRoleId,
            subjectUserId,
            firstName: body.firstName ?? row.firstName,
            lastName: body.lastName ?? row.lastName,
            departmentId: body.departmentId !== undefined ? body.departmentId : row.departmentId,
            siteId: body.siteId !== undefined ? body.siteId : row.siteId,
            managerId: body.managerId !== undefined ? body.managerId : row.managerId,
            managerDeputyId:
              body.managerDeputyId !== undefined ? body.managerDeputyId : row.managerDeputyId,
          },
          subjectUserId !== row.subjectUserId,
        )
      : null
    if (body.assigneeId) {
      const assignee = db.users.find(body.assigneeId)
      if (!assignee?.active || !isBackOffice(assignee)) {
        throw validationProblem({ assigneeId: 'Assign the request to someone in People Ops.' })
      }
    }
    const updated = db.peopleRequests.update(row.id, {
      ...(resolved ?? {}),
      title: body.title ?? row.title,
      priority: body.priority ?? row.priority,
      salutation: body.salutation !== undefined ? body.salutation : row.salutation,
      effectiveDate: body.effectiveDate ?? row.effectiveDate,
      reason: body.reason !== undefined ? body.reason : row.reason,
      furtherInformation:
        body.furtherInformation !== undefined ? body.furtherInformation : row.furtherInformation,
      equipmentNotes: body.equipmentNotes !== undefined ? body.equipmentNotes : row.equipmentNotes,
      personalData: mergePersonal(row.personalData, body.personalData),
      assigneeId: body.assigneeId !== undefined ? body.assigneeId : row.assigneeId,
      internalNote: body.internalNote !== undefined ? body.internalNote : row.internalNote,
      version: row.version + 1,
      updatedAt: new Date().toISOString(),
    })!
    const changes = diffFields(auditView(row), auditView(updated), AUDIT_LABELS, [
      'personalData',
      'internalNote',
    ])
    const actingAs = backOffice ? backOfficeActingAs(user) : 'requester'
    recordAudit(db, {
      module: 'people',
      entityType: 'people_request',
      entityId: row.id,
      entityLabel: `${peopleReference(row.number)} ${updated.title}`,
      action: 'update',
      actorId: user.id,
      actingAs,
      changes: changes.length ? changes : null,
      summary: peopleSummary(user.displayName, 'update', actingAs),
    })
    return ok(toDetail(updated, user) as never)
  }),

  peopleWorkflow.actionsHandler(api('/people/requests/:id/actions/:action'), {
    collection: db.peopleRequests,
    find: visible,
    toDto: (row, user) => toDetail(row, user) as never,
  }),

  http.get(api('/people/requests/:id/comments'), ({ request, params }) => {
    const user = requireUser(request)
    const row = visible(param(params.id), user)
    if (!row) throw notFound()
    const rows = db.peopleComments
      .where((c) => c.requestId === row.id && (isBackOffice(user) || !c.internal))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return ok(rows.map(toComment) as never)
  }),

  http.post(api('/people/requests/:id/comments'), async ({ request, params }) => {
    const user = requireUser(request)
    const row = visible(param(params.id), user)
    if (!row) throw notFound()
    const body = await readJson(request, commentSchema)
    const internal = body.internal ?? false
    if (internal) {
      if (!isBackOffice(user)) throw forbidden('Only People Ops can write internal comments.')
    } else if (!canComment(user, row)) {
      if (isClosedStatus(row.status) && (isBackOffice(user) || row.requesterId === user.id)) {
        throw invalidTransition('comment', row.status)
      }
      throw forbidden('You can read this request but not comment on it.')
    }
    if (!internal && row.requesterId === user.id && row.status === 'waiting_on_requester') {
      return created(toComment(requesterReplied(row, user, body.body)) as never)
    }
    const comment = addComment(row, user, body.body, { internal, kind: 'comment' })
    if (!internal) notifyComment(row, user, body.body)
    return created(toComment(comment) as never)
  }),

  http.get(api('/people/requests/:id/timeline'), ({ request, params }) => {
    const user = requireUser(request)
    const row = visible(param(params.id), user)
    if (!row) throw notFound()
    return ok(timelineFor(db, [{ entityType: 'people_request', entityId: row.id }]) as never)
  }),
])
