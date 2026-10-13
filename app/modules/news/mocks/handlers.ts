import { http } from 'msw'
import { z } from 'zod'
import { diffFields, recordAudit, timelineFor } from '~/mocks/core/audit'
import { storeBlob } from '~/mocks/core/files'
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
import { listResponse } from '~/mocks/list'
import { WELCOME_COVER_ID, welcomeCoverBlob } from './cover'
import { setNewsApiBase, toDetail, toLink, toSummary } from './dto'
import { hasText, sanitizeNewsHtml } from './sanitize'
import type { NewsPostRecord } from './types'
import { isNewsEditor, newsSummary, newsWorkflow } from './workflow'

/**
 * News + useful-link API mocks (API.md §7.2-§7.3): editors see every post, everyone else the
 * published ones (404 otherwise); bodies are sanitised on write; the lifecycle of SPEC §5.5.
 */

const LINK_ICONS = [
  'book',
  'utensils',
  'receipt',
  'bed',
  'life-buoy',
  'calendar',
  'network',
  'palette',
  'shield',
  'heart',
  'link',
] as const

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null))
const isoDateTime = z.iso.datetime({ offset: true })
const postSchema = z.strictObject({
  title: z.string().trim().min(3).max(140),
  type: z.enum(['changelog', 'update', 'information']),
  summary: z.string().trim().max(280),
  bodyHtml: z.string().max(50_000),
  coverImageId: z.string().uuid().nullish(),
  pinned: z.boolean().optional(),
  expireAt: isoDateTime.nullish(),
})
const patchSchema = postSchema.partial().extend({ version: z.number().int().min(1).optional() })
const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => /^https:\/\/[^\s/]+\.[^\s]+$/.test(value), 'Use an https:// address.')
const linkSchema = z.strictObject({
  title: z.string().trim().min(1).max(80),
  url: httpsUrl,
  description: optText(200).optional(),
  icon: z.enum(LINK_ICONS).nullish(),
  category: optText(60).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

const actingAs = (user: MockUser) =>
  user.roles.includes('news_editor') ? ('back_office' as const) : ('admin' as const)

function visible(id: string, user: MockUser): NewsPostRecord | undefined {
  const row = db.newsPosts.find(id)
  if (!row || row.deletedAt) return undefined
  return isNewsEditor(user) || row.status === 'published' ? row : undefined
}

function checkCover(
  user: MockUser,
  coverImageId: string | null | undefined,
  postId: string | null,
) {
  if (!coverImageId) return
  const attachment = db.attachments.find(coverImageId)
  const linkedHere = attachment?.entityType === 'news_post' && attachment.entityId === postId
  const problem = !attachment
    ? 'Upload the cover image again.'
    : attachment.purpose !== 'news_cover'
      ? 'Upload the image as a news cover.'
      : !linkedHere && attachment.entityId
        ? 'This image is already used elsewhere.'
        : !linkedHere && attachment.uploadedById !== user.id
          ? 'Use an image you uploaded.'
          : null
  if (problem) throw validationProblem({ coverImageId: problem })
}

function linkCover(coverImageId: string, postId: string) {
  db.attachments.update(coverImageId, {
    entityType: 'news_post',
    entityId: postId,
    linkedAt: new Date().toISOString(),
  })
}

const auditView = (row: NewsPostRecord) => ({
  title: row.title,
  type: row.type,
  summary: row.summary,
  body: `${row.bodyHtml.length} characters`,
  coverImage: row.coverImageId ? 'set' : null,
  pinned: row.pinned,
  expireAt: row.expireAt,
})
const AUDIT_LABELS = {
  title: 'Title',
  type: 'Type',
  summary: 'Summary',
  body: 'Body',
  coverImage: 'Cover image',
  pinned: 'Pinned',
  expireAt: 'Expires at',
}

export default defineMockHandlers(({ api }) => {
  setNewsApiBase(api('/').replace(/\/$/, ''))
  // The seeded cover's bytes live in memory only: register them on every start.
  storeBlob(WELCOME_COVER_ID, welcomeCoverBlob())

  return [
    // --- News --------------------------------------------------------------------------------
    http.get(api('/news'), ({ request }) => {
      const user = requireUser(request)
      const params = new URL(request.url).searchParams
      const editor = isNewsEditor(user)
      if (!editor) params.delete('status')
      const rows = db.newsPosts.where(
        (row) => !row.deletedAt && (editor || row.status === 'published'),
      )
      return listResponse(rows, params, {
        filters: { status: 'status', type: 'type' },
        search: ['title', 'summary'],
        sort: {
          publishedAt: 'publishedAt',
          updatedAt: 'updatedAt',
          publishAt: 'publishAt',
          // Default order (not a public sort field): pinned first, then newest.
          pinnedFirst: (row) => (row.pinned ? 0 : 1),
        },
        defaultSort: editor ? '-updatedAt' : 'pinnedFirst,-publishedAt',
        map: (row) => toSummary(row, user),
      })
    }),

    http.post(api('/news'), async ({ request }) => {
      const user = requireUser(request)
      if (!isNewsEditor(user)) throw forbidden('Only news editors can write posts.')
      const body = await readJson(request, postSchema)
      if (body.expireAt && new Date(body.expireAt) <= new Date()) {
        throw validationProblem({ expireAt: 'Pick an expiry in the future.' })
      }
      checkCover(user, body.coverImageId, null)
      const now = new Date().toISOString()
      const row = db.newsPosts.insert({
        title: body.title,
        type: body.type,
        status: 'draft',
        summary: body.summary,
        bodyHtml: sanitizeNewsHtml(body.bodyHtml),
        coverImageId: body.coverImageId ?? null,
        pinned: body.pinned ?? false,
        publishAt: null,
        expireAt: body.expireAt ? new Date(body.expireAt).toISOString() : null,
        publishedAt: null,
        archivedAt: null,
        authorId: user.id,
        updatedById: user.id,
        deletedAt: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      if (body.coverImageId) linkCover(body.coverImageId, row.id)
      recordAudit(db, {
        module: 'news',
        entityType: 'news_post',
        entityId: row.id,
        entityLabel: row.title,
        action: 'create',
        actorId: user.id,
        actingAs: actingAs(user),
        toState: 'draft',
        summary: newsSummary(user.displayName, 'create', actingAs(user)),
      })
      return created(toDetail(row, user) as never, api(`/news/${row.id}`))
    }),

    http.get(api('/news/:id'), ({ request, params }) => {
      const user = requireUser(request)
      const row = visible(param(params.id), user)
      if (!row) throw notFound()
      return ok(toDetail(row, user) as never)
    }),

    http.patch(api('/news/:id'), async ({ request, params }) => {
      const user = requireUser(request)
      const row = visible(param(params.id), user)
      if (!row) throw notFound()
      if (!isNewsEditor(user)) throw forbidden('Only news editors can edit posts.')
      if (!['draft', 'scheduled', 'published'].includes(row.status)) {
        throw invalidTransition('edit', row.status)
      }
      const body = await readJson(request, patchSchema)
      if (body.version !== undefined && body.version !== row.version) {
        throw conflict(
          'The post was changed by someone else. Reload and try again.',
          'version_conflict',
        )
      }
      const errors: Record<string, string> = {}
      const expireAt =
        body.expireAt === undefined
          ? row.expireAt
          : body.expireAt
            ? new Date(body.expireAt).toISOString()
            : null
      if (body.expireAt && new Date(body.expireAt) <= new Date()) {
        errors.expireAt = 'Pick an expiry in the future.'
      }
      const summary = body.summary ?? row.summary
      const bodyHtml = body.bodyHtml !== undefined ? sanitizeNewsHtml(body.bodyHtml) : row.bodyHtml
      if (row.status !== 'draft') {
        if (!summary.trim()) errors.summary = 'A published or scheduled post needs a summary.'
        if (!hasText(bodyHtml)) errors.bodyHtml = 'A published or scheduled post needs a body.'
      }
      if (Object.keys(errors).length) throw validationProblem(errors)
      const coverChanged = body.coverImageId !== undefined && body.coverImageId !== row.coverImageId
      if (coverChanged) checkCover(user, body.coverImageId, row.id)
      const updated = db.newsPosts.update(row.id, {
        title: body.title ?? row.title,
        type: body.type ?? row.type,
        summary,
        bodyHtml,
        pinned: body.pinned ?? row.pinned,
        expireAt,
        coverImageId: coverChanged ? (body.coverImageId ?? null) : row.coverImageId,
        version: row.version + 1,
        updatedAt: new Date().toISOString(),
        updatedById: user.id,
      })!
      if (coverChanged && body.coverImageId) linkCover(body.coverImageId, row.id)
      const changes = diffFields(auditView(row), auditView(updated), AUDIT_LABELS)
      recordAudit(db, {
        module: 'news',
        entityType: 'news_post',
        entityId: row.id,
        entityLabel: updated.title,
        action: 'update',
        actorId: user.id,
        actingAs: actingAs(user),
        changes: changes.length ? changes : null,
        summary: newsSummary(user.displayName, 'update', actingAs(user)),
      })
      return ok(toDetail(updated, user) as never)
    }),

    http.delete(api('/news/:id'), ({ request, params }) => {
      const user = requireUser(request)
      const row = visible(param(params.id), user)
      if (!row) throw notFound()
      if (!isNewsEditor(user)) throw forbidden('Only news editors can delete posts.')
      if (!['draft', 'archived'].includes(row.status)) throw invalidTransition('delete', row.status)
      db.newsPosts.update(row.id, { deletedAt: new Date().toISOString(), version: row.version + 1 })
      recordAudit(db, {
        module: 'news',
        entityType: 'news_post',
        entityId: row.id,
        entityLabel: row.title,
        action: 'delete',
        actorId: user.id,
        actingAs: actingAs(user),
        fromState: row.status,
        summary: newsSummary(user.displayName, 'delete', actingAs(user)),
      })
      return noContent()
    }),

    // publish/schedule without content: 422 with the missing fields (like the backend), else on.
    http.post(api('/news/:id/actions/:action'), ({ request, params }) => {
      const action = param(params.action)
      if (action !== 'publish' && action !== 'schedule') return undefined
      const user = requireUser(request)
      const row = visible(param(params.id), user)
      if (!row || !isNewsEditor(user) || !['draft', 'scheduled'].includes(row.status))
        return undefined
      const errors: Record<string, string> = {}
      if (!row.summary.trim()) errors.summary = 'Add a summary before publishing.'
      if (!hasText(row.bodyHtml)) errors.bodyHtml = 'Write the article before publishing.'
      if (Object.keys(errors).length) throw validationProblem(errors)
      return undefined
    }),

    newsWorkflow.actionsHandler(api('/news/:id/actions/:action'), {
      collection: db.newsPosts,
      find: visible,
      toDto: (row, user) => toDetail(row, user) as never,
    }),

    http.get(api('/news/:id/timeline'), ({ request, params }) => {
      const user = requireUser(request)
      const row = visible(param(params.id), user)
      if (!row) throw notFound()
      if (!isNewsEditor(user)) throw forbidden('Only news editors can see the history of a post.')
      return ok(timelineFor(db, [{ entityType: 'news_post', entityId: row.id }]) as never)
    }),

    // --- Useful links -------------------------------------------------------------------------
    http.get(api('/links'), ({ request }) => {
      const user = requireUser(request)
      const all =
        new URL(request.url).searchParams.get('includeInactive') === 'true' && isNewsEditor(user)
      const rows = db.usefulLinks
        .where((row) => all || row.active)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
      return ok(rows.map(toLink) as never)
    }),

    http.put(api('/links/order'), async ({ request }) => {
      const user = requireUser(request)
      if (!isNewsEditor(user)) throw forbidden()
      const { ids } = await readJson(request, z.strictObject({ ids: z.array(z.string()).min(1) }))
      const known = new Set(db.usefulLinks.all().map((row) => row.id))
      if (
        new Set(ids).size !== ids.length ||
        ids.length !== known.size ||
        ids.some((id) => !known.has(id))
      ) {
        throw validationProblem({ ids: 'List every link exactly once, in the new order.' })
      }
      ids.forEach((id, index) => db.usefulLinks.update(id, { sortOrder: index }))
      const rows = db.usefulLinks.all().sort((a, b) => a.sortOrder - b.sortOrder)
      return ok(rows.map(toLink) as never)
    }),

    http.post(api('/links'), async ({ request }) => {
      const user = requireUser(request)
      if (!isNewsEditor(user)) throw forbidden()
      const body = await readJson(request, linkSchema)
      const last = Math.max(-1, ...db.usefulLinks.all().map((row) => row.sortOrder))
      const row = db.usefulLinks.insert({
        title: body.title,
        url: body.url,
        description: body.description ?? null,
        icon: body.icon ?? null,
        category: body.category ?? null,
        active: body.active ?? true,
        sortOrder: body.sortOrder ?? last + 1,
        createdById: user.id,
        createdAt: new Date().toISOString(),
      })
      return created(toLink(row) as never, api(`/links/${row.id}`))
    }),

    http.patch(api('/links/:id'), async ({ request, params }) => {
      const user = requireUser(request)
      if (!isNewsEditor(user)) throw forbidden()
      const row = db.usefulLinks.find(param(params.id))
      if (!row) throw notFound()
      const body = await readJson(request, linkSchema.partial())
      const updated = db.usefulLinks.update(row.id, {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.url !== undefined ? { url: body.url } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.icon !== undefined ? { icon: body.icon ?? null } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      })!
      return ok(toLink(updated) as never)
    }),

    http.delete(api('/links/:id'), ({ request, params }) => {
      const user = requireUser(request)
      if (!isNewsEditor(user)) throw forbidden()
      if (!db.usefulLinks.remove(param(params.id))) throw notFound()
      return noContent()
    }),
  ]
})
