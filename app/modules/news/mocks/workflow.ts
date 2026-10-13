/**
 * The `news_post` state machine for demo mode (SPEC §5.5) and the system transitions of the
 * `news.publish-and-expire` job - the same rules as the backend.
 */
import { z } from 'zod'
import { recordAudit } from '~/mocks/core/audit'
import type { MockUser } from '~/mocks/core/types'
import { db } from '~/mocks/db'
import { validationProblem } from '~/mocks/http'
import { defineMockWorkflow } from '~/mocks/workflow'
import type { ActingAs } from '~/types/api'
import type { NewsPostRecord } from './types'

export const isNewsEditor = (user: Pick<MockUser, 'roles'>) =>
  user.roles.includes('news_editor') || user.roles.includes('it_admin')
const editorActingAs = (user: MockUser): ActingAs | false =>
  user.roles.includes('news_editor')
    ? 'back_office'
    : user.roles.includes('it_admin')
      ? 'admin'
      : false

const SUFFIX: Partial<Record<ActingAs, string>> = {
  back_office: ' (back office)',
  admin: ' (as admin)',
}
const PHRASES: Record<string, string> = {
  create: 'created the post',
  update: 'edited the post',
  delete: 'deleted the post',
  publish: 'published the post',
  schedule: 'scheduled the post',
  unschedule: 'unscheduled the post',
  auto_publish: 'published the post on schedule',
  archive: 'archived the post',
  auto_expire: 'archived the post when it expired',
  restore: 'restored the post as a draft',
}
export const newsSummary = (actor: string, action: string, actingAs: ActingAs) =>
  `${actor} ${PHRASES[action] ?? action}${SUFFIX[actingAs] ?? ''}`

const empty = z.strictObject({})
const schedule = z.strictObject({
  publishAt: z.iso.datetime({ offset: true }),
  expireAt: z.iso.datetime({ offset: true }).nullish(),
})

const now = () => new Date().toISOString()
const bump = (entity: NewsPostRecord, user: MockUser) => ({
  version: entity.version + 1,
  updatedAt: now(),
  updatedById: user.id,
})

export const newsWorkflow = defineMockWorkflow<NewsPostRecord>({
  name: 'news_post',
  label: 'News post',
  module: 'news',
  entityType: 'news_post',
  entityLabel: (row) => row.title,
  initialStates: ['draft'],
  states: {
    draft: { label: 'Draft', tone: 'neutral' },
    scheduled: { label: 'Scheduled', tone: 'moving' },
    published: { label: 'Published', tone: 'positive' },
    archived: { label: 'Archived', tone: 'neutral' },
  },
  transitions: [
    {
      event: 'publish',
      from: ['draft', 'scheduled'],
      to: 'published',
      label: 'Publish now',
      actors: ['News editor'],
      allowed: (_, user) => editorActingAs(user),
      body: empty,
      apply: ({ entity, user }) => {
        if (entity.expireAt && entity.expireAt <= now()) {
          throw validationProblem({
            expireAt: 'The expiry date has passed. Change or clear it first.',
          })
        }
        return { ...bump(entity, user), publishedAt: now(), publishAt: null }
      },
      summary: ({ user, actingAs }) => newsSummary(user.displayName, 'publish', actingAs),
    },
    {
      event: 'schedule',
      from: ['draft'],
      to: 'scheduled',
      label: 'Schedule',
      actors: ['News editor'],
      allowed: (_, user) => editorActingAs(user),
      body: schedule,
      apply: ({ entity, user, body }) => {
        const publishAt = new Date(String(body.publishAt))
        const expireAt =
          body.expireAt === undefined
            ? entity.expireAt
            : body.expireAt
              ? String(body.expireAt)
              : null
        const errors: Record<string, string> = {}
        if (publishAt.getTime() < Date.now() + 5 * 60_000) {
          errors.publishAt = 'Pick a time at least 5 minutes from now.'
        }
        if (expireAt && new Date(expireAt) <= publishAt) {
          errors.expireAt = 'The expiry must be after the publication time.'
        }
        if (Object.keys(errors).length) throw validationProblem(errors)
        return {
          ...bump(entity, user),
          publishAt: publishAt.toISOString(),
          expireAt: expireAt ? new Date(expireAt).toISOString() : null,
        }
      },
      summary: ({ user, actingAs }) => newsSummary(user.displayName, 'schedule', actingAs),
    },
    {
      event: 'unschedule',
      from: ['scheduled'],
      to: 'draft',
      label: 'Unschedule',
      actors: ['News editor'],
      allowed: (_, user) => editorActingAs(user),
      body: empty,
      apply: ({ entity, user }) => ({ ...bump(entity, user), publishAt: null }),
      summary: ({ user, actingAs }) => newsSummary(user.displayName, 'unschedule', actingAs),
    },
    {
      event: 'archive',
      from: ['published'],
      to: 'archived',
      label: 'Archive',
      actors: ['News editor'],
      allowed: (_, user) => editorActingAs(user),
      body: empty,
      apply: ({ entity, user }) => ({ ...bump(entity, user), archivedAt: now() }),
      summary: ({ user, actingAs }) => newsSummary(user.displayName, 'archive', actingAs),
    },
    {
      event: 'restore',
      from: ['archived'],
      to: 'draft',
      label: 'Restore as draft',
      actors: ['News editor'],
      allowed: (_, user) => editorActingAs(user),
      body: empty,
      apply: ({ entity, user }) => ({
        ...bump(entity, user),
        publishAt: null,
        expireAt: null,
        publishedAt: null,
        archivedAt: null,
      }),
      summary: ({ user, actingAs }) => newsSummary(user.displayName, 'restore', actingAs),
    },
  ],
  systemTransitions: [
    {
      from: 'scheduled',
      to: 'published',
      event: 'auto_publish',
      label: 'Publish at the set time',
      actors: ['System'],
    },
    {
      from: 'published',
      to: 'archived',
      event: 'auto_expire',
      label: 'Expire',
      actors: ['System'],
    },
  ],
  capabilities: {
    edit: (entity, user) =>
      isNewsEditor(user) && ['draft', 'scheduled', 'published'].includes(entity.status),
    delete: (entity, user) => isNewsEditor(user) && ['draft', 'archived'].includes(entity.status),
  },
})

/** SPEC §8 `news.publish-and-expire` against the mock database. */
export function publishAndExpire(at: Date = new Date()) {
  const instant = at.toISOString()
  let published = 0
  let expired = 0
  for (const row of db.newsPosts.where(
    (r) => !r.deletedAt && r.status === 'scheduled' && !!r.publishAt && r.publishAt <= instant,
  )) {
    db.newsPosts.update(row.id, {
      status: 'published',
      publishedAt: row.publishAt,
      publishAt: null,
      version: row.version + 1,
      updatedAt: instant,
    })
    recordAudit(db, {
      module: 'news',
      entityType: 'news_post',
      entityId: row.id,
      entityLabel: row.title,
      action: 'auto_publish',
      actorId: null,
      actingAs: 'system',
      fromState: 'scheduled',
      toState: 'published',
      summary: newsSummary('Atrium', 'auto_publish', 'system'),
    })
    published++
  }
  for (const row of db.newsPosts.where(
    (r) => !r.deletedAt && r.status === 'published' && !!r.expireAt && r.expireAt <= instant,
  )) {
    db.newsPosts.update(row.id, {
      status: 'archived',
      archivedAt: instant,
      version: row.version + 1,
      updatedAt: instant,
    })
    recordAudit(db, {
      module: 'news',
      entityType: 'news_post',
      entityId: row.id,
      entityLabel: row.title,
      action: 'auto_expire',
      actorId: null,
      actingAs: 'system',
      fromState: 'published',
      toState: 'archived',
      summary: newsSummary('Atrium', 'auto_expire', 'system'),
    })
    expired++
  }
  return { published, expired }
}
