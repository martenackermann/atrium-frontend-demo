/**
 * Core (foundation) API mocks — API.md §3: auth, me, inbox, notifications, deputies, users, org,
 * attachments + files, search, meta, health, audit, admin users and jobs.
 */
import { HttpResponse, http } from 'msw'
import { z } from 'zod'
import type {
  AdminUserDto,
  AssignableRole,
  AuditEntryDto,
  DeputyDto,
  InboxResponse,
  JobDto,
  JobRunDto,
  LoginResponse,
  NotificationDto,
  Persona,
  PersonaKey,
  PublicConfig,
  WorkflowDefinition,
} from '~/types/api'
import { defineMockHandlers, type MockContext } from '../define'
import { db } from '../db'
import {
  accepted,
  conflict,
  created,
  DEMO_PASSWORD,
  findOr404,
  forbidden,
  hasAnyRole,
  issueDemoToken,
  noContent,
  notFound,
  ok,
  param,
  problem,
  readJson,
  requireRole,
  requireUser,
  validationProblem,
} from '../http'
import { csv, listResponse, listResult } from '../list'
import {
  context as providerContext,
  countsFor,
  enumCatalog,
  inboxFor,
  moduleJobs,
  searchFor,
  workflows,
} from '../registry'
import { diffFields, recordAudit, toTimelineEntry } from './audit'
import { COUNT_STUBS } from './counts'
import {
  ALLOWED_MIME_TYPES,
  fileBody,
  signDownload,
  storeBlob,
  toAttachmentDto,
  UPLOAD_MAX_BYTES,
  UPLOAD_ROLES,
  verifyDownload,
} from './files'
import { CORE_JOBS, nextCronRun } from './jobs'
import {
  approverCandidates,
  deputyState,
  isDeputyActive,
  managerChain,
  refOf,
  reportingTree,
  rolesOf,
  toMe,
  toUserProfile,
  toUserRef,
  toUserSummary,
  userRefById,
} from './org'
import { PERSONAS } from './seed'
import type { MockDeputy, MockUser } from './types'

const PERSONA_ORDER: PersonaKey[] = [
  'emma',
  'max',
  'sofia',
  'clara',
  'tom',
  'tina',
  'arne',
  'paula',
  'ian',
]
const ASSIGNABLE_ROLES = [
  'executive',
  'training_office',
  'travel_desk',
  'asset_admin',
  'people_ops',
  'news_editor',
  'it_admin',
] as const
const TOKEN_TTL_MINUTES = 480

const isoDate = z.iso.date({ message: 'Use a date like 2026-10-21.' })
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .transform((value) => value || null)
    .nullish()

function loginResponse(user: MockUser): LoginResponse {
  db.users.update(user.id, { lastLoginAt: new Date().toISOString() })
  return {
    accessToken: issueDemoToken(user),
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000).toISOString(),
    user: toMe(db, user),
  }
}

function toDeputyDto(row: MockDeputy): DeputyDto {
  return {
    id: row.id,
    principal: userRefById(db, row.principalId)!,
    deputy: userRefById(db, row.deputyId)!,
    validFrom: row.validFrom,
    validTo: row.validTo,
    note: row.note,
    isActiveNow: isDeputyActive(db, row),
    state: deputyState(row),
    createdAt: row.createdAt,
  }
}

function toNotificationDto(row: ReturnType<typeof db.notifications.all>[number]): NotificationDto {
  const { userId: _userId, ...rest } = row
  return rest
}

function toAdminUser(user: MockUser): AdminUserDto {
  const roles = rolesOf(db, user)
  return {
    ...toUserSummary(db, user),
    firstName: user.firstName,
    lastName: user.lastName,
    employeeNumber: user.employeeNumber,
    phone: user.phone,
    manager: userRefById(db, user.managerId),
    costCenter: refOf(db, 'costCenters', user.costCenterId)!,
    roles: user.roles,
    isSiteManager: user.isSiteManager,
    isManager: roles.includes('manager'),
    directReportsCount: db.users.count((report) => report.managerId === user.id && report.active),
    personaKey: user.personaKey,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    version: user.version,
  }
}

function windowsOverlap(
  a: Pick<MockDeputy, 'validFrom' | 'validTo'>,
  b: Pick<MockDeputy, 'validFrom' | 'validTo'>,
) {
  const startA = a.validFrom ?? '0000-01-01'
  const endA = a.validTo ?? '9999-12-31'
  const startB = b.validFrom ?? '0000-01-01'
  const endB = b.validTo ?? '9999-12-31'
  return startA <= endB && startB <= endA
}

function jobDto(job: (typeof CORE_JOBS)[number]): JobDto {
  const runs = db.jobRuns
    .where((run) => run.jobName === job.name)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  const enabled = job.enabled ?? true
  return {
    name: job.name,
    description: job.description,
    slice: job.slice,
    cron: job.cron,
    enabled,
    nextRunAt: enabled ? (nextCronRun(job.cron)?.toISOString() ?? null) : null,
    lastRun: runs[0] ? toJobRun(runs[0]) : null,
  }
}

function toJobRun(run: ReturnType<typeof db.jobRuns.all>[number]): JobRunDto {
  const { triggeredById, ...rest } = run
  return { ...rest, triggeredByUser: userRefById(db, triggeredById) }
}

const allJobs = () => [...CORE_JOBS, ...moduleJobs()]

function publicConfig(): PublicConfig {
  return {
    timezone: 'Europe/Berlin',
    demoMode: true,
    trainingExecutiveThreshold: { amountCents: 500_000, currency: 'EUR' },
    trainingHighPriorityDays: 14,
    travelHighPriorityDays: 3,
    goalsReminderDaysBefore: 7,
    ratingDelaysDays: { loop1: 1, loop2: 60, loop3: 30 },
    peopleReopenWindowDays: 30,
    ratingReminderMax: 4,
    ratingReminderCadenceDays: 7,
    ratingOverdueDays: 14,
    assetAcceptanceDueDays: 7,
    uploadMaxBytes: UPLOAD_MAX_BYTES,
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  }
}

export default defineMockHandlers(({ api }: MockContext) => [
  // ------------------------------------------------------------------------------------------
  // 3.1 Auth
  // ------------------------------------------------------------------------------------------
  http.post(api('/auth/login'), async ({ request }) => {
    const credentials = await readJson(
      request,
      z.strictObject({
        email: z.email('Enter your work email, like emma.employee@example.com.'),
        password: z.string().min(1, 'Enter your password.'),
      }),
    )
    const user = db.users.first(
      (candidate) => candidate.email.toLowerCase() === credentials.email.toLowerCase(),
    )
    if (!user || !user.active || credentials.password !== DEMO_PASSWORD) {
      return problem(401, {
        code: 'invalid_credentials',
        title: 'Sign-in failed',
        detail: 'Email or password is incorrect.',
      })
    }
    return ok(loginResponse(user))
  }),

  http.post(api('/auth/demo-login'), async ({ request }) => {
    const { personaKey } = await readJson(
      request,
      z.strictObject({ personaKey: z.enum(PERSONA_ORDER as [PersonaKey, ...PersonaKey[]]) }),
    )
    const user = db.users.first((candidate) => candidate.personaKey === personaKey)
    if (!user) throw notFound()
    return ok(loginResponse(user))
  }),

  http.get(api('/auth/personas'), () => {
    const personas: Persona[] = PERSONA_ORDER.map((key) => {
      const user = db.users.first((candidate) => candidate.personaKey === key)!
      return {
        key,
        displayName: user.displayName,
        email: user.email,
        jobTitle: user.jobTitle ?? '',
        department: refOf(db, 'departments', user.departmentId)?.name ?? '',
        roles: rolesOf(db, user),
        tagline: PERSONAS[key].tagline,
        highlights: PERSONAS[key].highlights,
      }
    })
    return ok(personas)
  }),

  http.post(api('/auth/logout'), () => noContent()),

  // ------------------------------------------------------------------------------------------
  // 3.2 Me, inbox, notifications, deputies
  // ------------------------------------------------------------------------------------------
  http.get(api('/me'), ({ request }) => ok(toMe(db, requireUser(request)))),

  http.get(api('/me/inbox'), ({ request }) => {
    const user = requireUser(request)
    const params = new URL(request.url).searchParams
    const modules = csv(params, 'module')
    const types = csv(params, 'type')
    const items = inboxFor(user).filter(
      (item) =>
        (modules.length === 0 || modules.includes(item.module)) &&
        (types.length === 0 || types.includes(item.type)),
    )
    const count = (module: string) => items.filter((item) => item.module === module).length
    const response: InboxResponse = {
      data: items,
      meta: {
        total: items.length,
        high: items.filter((item) => item.priority === 'high').length,
        byModule: {
          training: count('training'),
          travel: count('travel'),
          assets: count('assets'),
          people: count('people'),
        },
      },
    }
    return ok(response)
  }),

  http.get(api('/me/inbox/counts'), ({ request }) => {
    const items = inboxFor(requireUser(request))
    const count = (module: string) => items.filter((item) => item.module === module).length
    return ok({
      total: items.length,
      high: items.filter((item) => item.priority === 'high').length,
      training: count('training'),
      travel: count('travel'),
      assets: count('assets'),
      people: count('people'),
    })
  }),

  http.get(api('/me/notifications'), ({ request }) => {
    const user = requireUser(request)
    const params = new URL(request.url).searchParams
    const mine = db.notifications
      .where((row) => row.userId === user.id)
      .filter((row) => params.get('unread') !== 'true' || !row.readAt)
    const page = listResult(mine, params, { defaultSort: '-createdAt', sort: ['createdAt'] })
    return ok({
      data: page.data.map(toNotificationDto),
      meta: {
        ...page.meta,
        unread: db.notifications.count((row) => row.userId === user.id && !row.readAt),
      },
    })
  }),

  http.post(api('/me/notifications/read-all'), ({ request }) => {
    const user = requireUser(request)
    const now = new Date().toISOString()
    for (const row of db.notifications.where((item) => item.userId === user.id && !item.readAt)) {
      db.notifications.update(row.id, { readAt: now })
    }
    return noContent()
  }),

  http.post(api('/me/notifications/:id/read'), ({ request, params }) => {
    const user = requireUser(request)
    const row = db.notifications.find(param(params.id))
    if (!row || row.userId !== user.id) throw notFound()
    if (!row.readAt) db.notifications.update(row.id, { readAt: new Date().toISOString() })
    return noContent()
  }),

  http.get(api('/me/deputies'), ({ request }) => {
    const user = requireUser(request)
    const byCreated = (a: MockDeputy, b: MockDeputy) => b.createdAt.localeCompare(a.createdAt)
    return ok({
      asPrincipal: db.deputies
        .where((row) => row.principalId === user.id)
        .sort(byCreated)
        .map(toDeputyDto),
      asDeputy: db.deputies
        .where((row) => row.deputyId === user.id)
        .sort(byCreated)
        .map(toDeputyDto),
    })
  }),

  http.post(api('/me/deputies'), async ({ request }) => {
    const user = requireUser(request)
    if (!hasAnyRole(user, ['manager', 'executive', 'it_admin'])) {
      throw forbidden('Only managers and executives can name deputies.')
    }
    const body = await readJson(
      request,
      z.strictObject({
        deputyId: z.string().min(1, 'Choose a colleague.'),
        validFrom: isoDate.nullish(),
        validTo: isoDate.nullish(),
        note: optionalText(200),
      }),
    )
    const deputy = db.users.find(body.deputyId)
    if (!deputy || !deputy.active)
      throw validationProblem({ deputyId: 'Choose an active colleague.' })
    if (deputy.id === user.id)
      throw validationProblem({ deputyId: "You can't be your own deputy." })
    if (body.validFrom && body.validTo && body.validTo < body.validFrom) {
      throw validationProblem({
        validTo: 'The end is before the start. Pick an end on or after the start.',
      })
    }
    const window = { validFrom: body.validFrom ?? null, validTo: body.validTo ?? null }
    const overlapping = db.deputies.first(
      (row) =>
        row.principalId === user.id && row.deputyId === deputy.id && windowsOverlap(row, window),
    )
    if (overlapping) {
      throw conflict(
        `${deputy.displayName} is already your deputy in that period.`,
        'deputy_overlap',
      )
    }
    const row = db.deputies.insert({
      principalId: user.id,
      deputyId: deputy.id,
      ...window,
      note: body.note ?? null,
      createdById: user.id,
      createdAt: new Date().toISOString(),
    })
    recordAudit(db, {
      module: 'core',
      entityType: 'deputy',
      entityId: row.id,
      entityLabel: `${deputy.displayName} for ${user.displayName}`,
      action: 'create',
      actorId: user.id,
      actingAs: 'self',
      summary: `${user.displayName} named ${deputy.displayName} as deputy`,
    })
    db.notifications.insert({
      userId: deputy.id,
      templateId: 'core.deputy_assigned',
      module: 'core',
      title: `${user.displayName} named you as deputy`,
      body:
        window.validFrom || window.validTo
          ? `From ${window.validFrom ?? 'now'} to ${window.validTo ?? 'further notice'}.`
          : 'Permanent, until removed.',
      link: '/settings/deputies',
      priority: 'normal',
      readAt: null,
      createdAt: new Date().toISOString(),
    })
    return created(toDeputyDto(row) as never, api(`/me/deputies/${row.id}`))
  }),

  http.patch(api('/me/deputies/:id'), async ({ request, params }) => {
    const user = requireUser(request)
    const row = db.deputies.find(param(params.id))
    if (!row || row.principalId !== user.id) throw notFound()
    const body = await readJson(
      request,
      z.strictObject({
        validFrom: isoDate.nullish(),
        validTo: isoDate.nullish(),
        note: optionalText(200),
      }),
    )
    const next = {
      validFrom: body.validFrom === undefined ? row.validFrom : body.validFrom,
      validTo: body.validTo === undefined ? row.validTo : body.validTo,
      note: body.note === undefined ? row.note : body.note,
    }
    if (next.validFrom && next.validTo && next.validTo < next.validFrom) {
      throw validationProblem({
        validTo: 'The end is before the start. Pick an end on or after the start.',
      })
    }
    const overlapping = db.deputies.first(
      (other) =>
        other.id !== row.id &&
        other.principalId === user.id &&
        other.deputyId === row.deputyId &&
        windowsOverlap(other, next),
    )
    if (overlapping)
      throw conflict('That window overlaps another one for the same deputy.', 'deputy_overlap')
    const updated = db.deputies.update(row.id, next)!
    recordAudit(db, {
      module: 'core',
      entityType: 'deputy',
      entityId: row.id,
      entityLabel: `${userRefById(db, row.deputyId)?.displayName} for ${user.displayName}`,
      action: 'update',
      actorId: user.id,
      actingAs: 'self',
      changes: diffFields(row, updated, { validFrom: 'From', validTo: 'To', note: 'Note' }),
      summary: `${user.displayName} changed a deputy window`,
    })
    return ok(toDeputyDto(updated) as never)
  }),

  http.delete(api('/me/deputies/:id'), ({ request, params }) => {
    const user = requireUser(request)
    const row = db.deputies.find(param(params.id))
    if (!row || row.principalId !== user.id) throw notFound()
    db.deputies.remove(row.id)
    recordAudit(db, {
      module: 'core',
      entityType: 'deputy',
      entityId: row.id,
      entityLabel: `${userRefById(db, row.deputyId)?.displayName} for ${user.displayName}`,
      action: 'delete',
      actorId: user.id,
      actingAs: 'self',
      summary: `${user.displayName} removed a deputy`,
    })
    return noContent()
  }),

  // ------------------------------------------------------------------------------------------
  // 3.3 Users and org
  // ------------------------------------------------------------------------------------------
  http.get(api('/users'), ({ request }) => {
    const user = requireUser(request)
    const params = new URL(request.url).searchParams
    const includeInactive =
      params.get('includeInactive') === 'true' && user.roles.includes('it_admin')
    const team = params.get('scope') === 'team' ? reportingTree(db, user.id) : null
    const role = params.get('role')
    const rows = db.users.where(
      (candidate) =>
        (includeInactive || candidate.active) &&
        (!team || team.has(candidate.id)) &&
        (!role || rolesOf(db, candidate).includes(role as never)),
    )
    return listResponse(rows, params, {
      search: (candidate) => `${candidate.displayName} ${candidate.email}`,
      filters: { departmentId: 'departmentId', siteId: 'siteId' },
      sort: ['displayName'],
      defaultSort: 'displayName',
      defaultPerPage: 20,
      map: (candidate) => toUserSummary(db, candidate),
    })
  }),

  http.get(api('/users/:id'), ({ request, params }) => {
    requireUser(request)
    return ok(toUserProfile(db, findOr404(db.users, param(params.id))) as never)
  }),

  http.get(api('/users/:id/approvers'), ({ request, params }) => {
    const requester = requireUser(request)
    const subject = findOr404(db.users, param(params.id))
    const executive = subject.roles.includes('executive')
    const chain = approverCandidates(db, subject, requester)
    return ok({
      subject: toUserRef(subject),
      exemption: executive ? 'executive_traveller' : null,
      default: executive ? null : chain.default,
      candidates: executive
        ? managerChain(db, subject).map((user, index) => ({
            user: toUserRef(user),
            level: index + 1,
            isSiteManager: user.isSiteManager,
            isDefault: false,
            selectable: user.active && !user.isSiteManager,
            reason: null,
          }))
        : chain.candidates,
    } as never)
  }),

  http.get(api('/org/departments'), ({ request }) => {
    requireUser(request)
    return ok(
      db.departments.all().map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        head: userRefById(db, row.headId),
        memberCount: db.users.count((user) => user.departmentId === row.id && user.active),
      })) as never,
    )
  }),

  http.get(api('/org/sites'), ({ request }) => {
    requireUser(request)
    return ok(db.sites.all() as never)
  }),

  http.get(api('/org/cost-centers'), ({ request }) => {
    requireUser(request)
    const activeOnly = new URL(request.url).searchParams.get('active') === 'true'
    return ok(
      db.costCenters
        .where((row) => !activeOnly || row.active)
        .map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          department: refOf(db, 'departments', row.departmentId),
          active: row.active,
        })) as never,
    )
  }),

  // ------------------------------------------------------------------------------------------
  // 3.4 Attachments and files
  // ------------------------------------------------------------------------------------------
  http.post(api('/attachments'), async ({ request }) => {
    const user = requireUser(request)
    const form = await request.formData()
    const file = form.get('file')
    const purpose = String(form.get('purpose') ?? '') as keyof typeof ALLOWED_MIME_TYPES
    if (!(purpose in ALLOWED_MIME_TYPES)) throw validationProblem({ purpose: 'Unknown purpose.' })
    if (!(file instanceof File)) throw validationProblem({ file: 'Choose a file to upload.' })
    const roles = UPLOAD_ROLES[purpose]
    if (roles && !hasAnyRole(user, roles))
      throw forbidden('You may not upload files for this purpose.')
    if (file.size > UPLOAD_MAX_BYTES) {
      return problem(413, {
        detail: `${file.name} is ${Math.ceil(file.size / 1024 / 1024)} MB. The limit is 10 MB.`,
      })
    }
    const mimeType = file.type || 'application/octet-stream'
    if (!ALLOWED_MIME_TYPES[purpose].includes(mimeType)) {
      return problem(415, {
        detail: `${file.name} is not an allowed file type here.`,
      })
    }
    const row = db.attachments.insert({
      originalName: file.name.replace(/[/\\]/g, '_').slice(0, 200),
      mimeType,
      sizeBytes: file.size,
      purpose,
      uploadedById: user.id,
      entityType: null,
      entityId: null,
      createdAt: new Date().toISOString(),
      linkedAt: null,
    })
    storeBlob(row.id, file)
    return created(toAttachmentDto(db, row) as never, api(`/attachments/${row.id}`))
  }),

  http.get(api('/attachments/:id'), ({ request, params }) => {
    const user = requireUser(request)
    const row = findOr404(db.attachments, param(params.id))
    if (!row.entityId && row.uploadedById !== user.id) throw notFound()
    return ok(toAttachmentDto(db, row) as never)
  }),

  http.get(api('/attachments/:id/download-url'), ({ request, params }) => {
    const user = requireUser(request)
    const row = findOr404(db.attachments, param(params.id))
    if (!row.entityId && row.uploadedById !== user.id) throw notFound()
    const disposition =
      new URL(request.url).searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment'
    const signed = signDownload(row.id, user.id, disposition)
    return ok({ url: api(`/files/${signed.token}`), expiresAt: signed.expiresAt.toISOString() })
  }),

  http.delete(api('/attachments/:id'), ({ request, params }) => {
    const user = requireUser(request)
    const row = findOr404(db.attachments, param(params.id))
    if (row.uploadedById !== user.id) throw notFound()
    if (row.entityId) throw conflict('The file is linked. Remove it from its request instead.')
    db.attachments.remove(row.id)
    return noContent()
  }),

  http.get(api('/files/:token'), ({ params }) => {
    const verified = verifyDownload(param(params.token))
    const row = verified ? db.attachments.find(verified.attachmentId) : undefined
    if (!verified || !row) throw notFound()
    const filename = encodeURIComponent(row.originalName)
    return new HttpResponse(fileBody(row), {
      headers: {
        'Content-Type': row.mimeType,
        'Content-Disposition': `${verified.disposition}; filename*=UTF-8''${filename}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }),

  // ------------------------------------------------------------------------------------------
  // 3.5 Search
  // ------------------------------------------------------------------------------------------
  http.get(api('/search'), ({ request }) => {
    const user = requireUser(request)
    const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
    if (q.length < 2) throw validationProblem({ q: 'Type at least 2 characters.' })
    return ok({ data: searchFor(user, q, providerContext()) } as never)
  }),

  // ------------------------------------------------------------------------------------------
  // 3.6 Meta + health
  // ------------------------------------------------------------------------------------------
  http.get(api('/meta/enums'), ({ request }) => {
    requireUser(request)
    return ok(enumCatalog() as never)
  }),

  http.get(api('/meta/config'), ({ request }) => {
    requireUser(request)
    return ok(publicConfig() as never)
  }),

  http.get(api('/meta/workflows'), ({ request }) => {
    requireUser(request)
    return ok(
      workflows().map((workflow) => ({
        name: workflow.definition.name,
        label: workflow.definition.label,
      })),
    )
  }),

  http.get(api('/meta/workflows/:name'), ({ request, params }) => {
    requireUser(request)
    const workflow = workflows().find((item) => item.definition.name === param(params.name))
    if (!workflow) throw notFound()
    return ok(workflow.definition as WorkflowDefinition as never)
  }),

  http.get(api('/health'), () =>
    ok({ status: 'ok', checks: { database: 'up', queue: 'up', mail: 'up' } }),
  ),

  // ------------------------------------------------------------------------------------------
  // 3.7 Audit and admin
  // ------------------------------------------------------------------------------------------
  http.get(api('/audit'), ({ request }) => {
    requireRole(request, 'it_admin')
    const params = new URL(request.url).searchParams
    const from = params.get('from')
    const to = params.get('to')
    const rows = db.audit.where(
      (entry) =>
        (!from || entry.occurredAt.slice(0, 10) >= from) &&
        (!to || entry.occurredAt.slice(0, 10) <= to),
    )
    return listResponse(rows, params, {
      filters: {
        module: 'module',
        entityType: 'entityType',
        entityId: 'entityId',
        actorId: 'actorId',
        action: 'action',
      },
      search: (entry) => `${entry.summary} ${entry.entityLabel}`,
      sort: ['occurredAt'],
      defaultSort: '-occurredAt',
      map: (entry): AuditEntryDto => ({
        ...toTimelineEntry(db, entry),
        module: entry.module,
        correlationId: entry.correlationId,
      }),
    })
  }),

  http.get(api('/admin/users'), ({ request }) => {
    requireRole(request, 'it_admin')
    const params = new URL(request.url).searchParams
    const role = params.get('role')
    const active = params.get('active')
    const rows = db.users.where(
      (user) =>
        (!role || rolesOf(db, user).includes(role as never)) &&
        (active === null || String(user.active) === active),
    )
    return listResponse(rows, params, {
      search: (user) => `${user.displayName} ${user.email} ${user.employeeNumber}`,
      filters: { departmentId: 'departmentId' },
      sort: ['displayName', 'lastLoginAt'],
      defaultSort: 'displayName',
      map: toAdminUser,
    })
  }),

  http.post(api('/admin/users'), async ({ request }) => {
    const admin = requireRole(request, 'it_admin')
    const body = await readJson(
      request,
      z.strictObject({
        email: z.email('Enter a valid email address.'),
        firstName: z.string().trim().min(1, 'Enter a first name.').max(200),
        lastName: z.string().trim().min(1, 'Enter a last name.').max(200),
        jobTitle: optionalText(200),
        employeeNumber: optionalText(40),
        departmentId: z.string().nullish(),
        siteId: z.string().nullish(),
        costCenterId: z.string().min(1, 'Choose a cost centre.'),
        managerId: z.string().nullish(),
        isSiteManager: z.boolean().optional(),
        roles: z.array(z.enum(ASSIGNABLE_ROLES)).optional(),
        initialPassword: z.string().min(8, 'Use at least 8 characters.'),
      }),
    )
    if (db.users.first((user) => user.email.toLowerCase() === body.email.toLowerCase())) {
      throw conflict('A user with this email already exists.')
    }
    const user = db.users.insert({
      email: body.email.toLowerCase(),
      firstName: body.firstName,
      lastName: body.lastName,
      displayName: `${body.firstName} ${body.lastName}`,
      jobTitle: body.jobTitle ?? null,
      employeeNumber: body.employeeNumber ?? `E${10001 + db.users.count()}`,
      phone: null,
      departmentId: body.departmentId ?? null,
      siteId: body.siteId ?? null,
      costCenterId: body.costCenterId,
      managerId: body.managerId ?? null,
      isSiteManager: body.isSiteManager ?? false,
      active: true,
      roles: (body.roles ?? []) as AssignableRole[],
      personaKey: null,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      version: 1,
    })
    recordAudit(db, {
      module: 'core',
      entityType: 'user',
      entityId: user.id,
      entityLabel: user.displayName,
      action: 'create',
      actorId: admin.id,
      actingAs: 'admin',
      summary: `${admin.displayName} created the account of ${user.displayName}`,
    })
    return created(toAdminUser(user) as never, api(`/admin/users/${user.id}`))
  }),

  http.get(api('/admin/users/:id'), ({ request, params }) => {
    requireRole(request, 'it_admin')
    return ok(toAdminUser(findOr404(db.users, param(params.id))) as never)
  }),

  http.patch(api('/admin/users/:id'), async ({ request, params }) => {
    const admin = requireRole(request, 'it_admin')
    const user = findOr404(db.users, param(params.id))
    const body = await readJson(
      request,
      z.strictObject({
        firstName: z.string().trim().min(1).max(200).optional(),
        lastName: z.string().trim().min(1).max(200).optional(),
        jobTitle: optionalText(200),
        employeeNumber: optionalText(40),
        departmentId: z.string().nullish(),
        siteId: z.string().nullish(),
        costCenterId: z.string().optional(),
        managerId: z.string().nullish(),
        isSiteManager: z.boolean().optional(),
        roles: z.array(z.enum(ASSIGNABLE_ROLES)).optional(),
        active: z.boolean().optional(),
        version: z.number().int().optional(),
      }),
    )
    if (body.version !== undefined && body.version !== user.version) {
      throw conflict(
        'Someone else changed this user. Reload to see the latest version.',
        'version_conflict',
      )
    }
    if (body.managerId) {
      const proposed = db.users.find(body.managerId)
      if (!proposed) throw validationProblem({ managerId: 'Choose an existing user.' })
      if (proposed.id === user.id || reportingTree(db, user.id).has(proposed.id)) {
        throw validationProblem({
          managerId: `${proposed.displayName} reports to ${user.displayName}. Choose someone outside their team.`,
        })
      }
    }
    if (admin.id === user.id && body.roles && !body.roles.includes('it_admin')) {
      throw validationProblem({ roles: "You can't remove your own IT admin role." })
    }
    const { version: _version, ...changes } = body
    const patch = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    )
    const next = { ...user, ...patch } as MockUser
    next.displayName = `${next.firstName} ${next.lastName}`
    const updated = db.users.update(user.id, {
      ...patch,
      displayName: next.displayName,
      version: user.version + 1,
    })!
    recordAudit(db, {
      module: 'core',
      entityType: 'user',
      entityId: user.id,
      entityLabel: updated.displayName,
      action: 'update',
      actorId: admin.id,
      actingAs: 'admin',
      changes: diffFields(user as never, updated as never, {
        firstName: 'First name',
        lastName: 'Last name',
        jobTitle: 'Job title',
        departmentId: 'Department',
        siteId: 'Site',
        costCenterId: 'Cost centre',
        managerId: 'Manager',
        isSiteManager: 'Site manager',
        roles: 'Roles',
        active: 'Active',
      }),
      summary: `${admin.displayName} updated ${updated.displayName}`,
    })
    return ok(toAdminUser(updated) as never)
  }),

  http.get(api('/admin/jobs'), ({ request }) => {
    requireRole(request, 'it_admin')
    return ok(allJobs().map(jobDto) as never)
  }),

  http.get(api('/admin/jobs/:name/runs'), ({ request, params }) => {
    requireRole(request, 'it_admin')
    const name = param(params.name)
    if (!allJobs().some((job) => job.name === name)) throw notFound()
    return listResponse(
      db.jobRuns.where((run) => run.jobName === name),
      request,
      { sort: ['startedAt'], defaultSort: '-startedAt', map: toJobRun },
    )
  }),

  http.post(api('/admin/jobs/:name/run'), ({ request, params }) => {
    const admin = requireRole(request, 'it_admin')
    const job = allJobs().find((item) => item.name === param(params.name))
    if (!job) throw notFound()
    if (job.manual === false) throw forbidden('This job runs from the command line only.')
    const startedAt = new Date().toISOString()
    let summary: Record<string, number | string> = {}
    let error: string | null = null
    try {
      summary = job.run(providerContext())
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause)
    }
    const run = db.jobRuns.insert({
      jobName: job.name,
      triggeredBy: 'manual',
      triggeredById: admin.id,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: error ? 'failed' : 'succeeded',
      summary,
      error,
    })
    return accepted({ jobRunId: run.id })
  }),
])

/**
 * Fallbacks registered AFTER module handlers: zero counts for `/<module>/queues/counts` until the
 * module answers it (SPEC_RESOLUTIONS #5) — via its own handler or `counts` in providers.ts.
 */
export const coreFallbackHandlers = defineMockHandlers(({ api }) =>
  Object.keys(COUNT_STUBS).map((module) =>
    http.get(api(`/${module}/queues/counts`), ({ request }) => {
      const user = requireUser(request)
      return ok((countsFor(module, user) ?? COUNT_STUBS[module]!(user)) as never)
    }),
  ),
)
