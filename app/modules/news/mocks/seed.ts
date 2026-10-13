import { defineMockSeed, type SeedContext } from '~/mocks/define'
import { recordAudit } from '~/mocks/core/audit'
import { USER_IDS } from '~/mocks/core/seed'
import { WELCOME_COVER_ID } from './cover'
import { sanitizeNewsHtml } from './sanitize'
import { type At, LINKS_STORY, NEWS_STORY } from './story'
import './types'

/**
 * News demo data (slice A4): posts S-N1..S-N8 (2 scheduled, 1 draft, 1 archived, the pinned
 * welcome post with a generated gradient cover) and the 10 useful links of SPEC §10.6 - the same
 * values as the backend seed, with coherent audit history.
 */

const AUTHORS: Record<string, string> = { paula: 'Paula People-Ops', ian: 'Ian IT-Admin' }
const PHRASES: Record<string, string> = {
  create: 'created the post',
  publish: 'published the post',
  schedule: 'scheduled the post',
  archive: 'archived the post',
}

function seedNews(ctx: SeedContext) {
  const { db } = ctx
  const at = ([day, hour, minute]: At) => ctx.at(day, hour, minute)

  for (const story of NEWS_STORY) {
    const authorId = USER_IDS[story.author]!
    const createdAt = at(story.createdAt)
    const publishedAt = story.publishedAt ? at(story.publishedAt) : null
    const archivedAt = story.archivedAt ? at(story.archivedAt) : null
    const transitions: Array<{ action: string; from: string; to: string; when: string }> = []
    if (story.status === 'scheduled') {
      const when = new Date(new Date(createdAt).getTime() + 600_000).toISOString()
      transitions.push({ action: 'schedule', from: 'draft', to: 'scheduled', when })
    }
    if (publishedAt)
      transitions.push({ action: 'publish', from: 'draft', to: 'published', when: publishedAt })
    if (archivedAt) {
      transitions.push({ action: 'archive', from: 'published', to: 'archived', when: archivedAt })
    }
    const id = ctx.uuid()
    if (story.cover) {
      db.attachments.insert({
        id: WELCOME_COVER_ID,
        originalName: 'welcome-to-atrium.png',
        mimeType: 'image/png',
        sizeBytes: 9_984,
        purpose: 'news_cover',
        uploadedById: authorId,
        entityType: 'news_post',
        entityId: id,
        createdAt,
        linkedAt: createdAt,
      })
    }
    db.newsPosts.insert({
      id,
      title: story.title,
      type: story.type,
      status: story.status,
      summary: story.summary,
      bodyHtml: sanitizeNewsHtml(story.bodyHtml),
      coverImageId: story.cover ? WELCOME_COVER_ID : null,
      pinned: story.pinned ?? false,
      publishAt: story.publishAt ? at(story.publishAt) : null,
      expireAt: story.expireAt ? at(story.expireAt) : null,
      publishedAt,
      archivedAt,
      authorId,
      updatedById: authorId,
      deletedAt: null,
      version: 1 + transitions.length,
      createdAt,
      updatedAt: transitions.at(-1)?.when ?? createdAt,
    })
    const actingAs = story.author === 'ian' ? 'admin' : 'back_office'
    const suffix = actingAs === 'admin' ? ' (as admin)' : ' (back office)'
    for (const entry of [
      { action: 'create', from: null, to: 'draft', when: createdAt },
      ...transitions,
    ]) {
      recordAudit(db, {
        module: 'news',
        entityType: 'news_post',
        entityId: id,
        entityLabel: story.title,
        action: entry.action,
        actorId: authorId,
        actingAs,
        fromState: entry.from,
        toState: entry.to,
        occurredAt: entry.when,
        summary: `${AUTHORS[story.author]} ${PHRASES[entry.action]}${suffix}`,
        correlationId: 'seed',
      })
    }
  }

  LINKS_STORY.forEach((link, index) => {
    db.usefulLinks.insert({
      id: ctx.uuid(),
      ...link,
      sortOrder: index,
      createdById: USER_IDS.paula,
      createdAt: ctx.at(-120, 9, index),
    })
  })
}

export default defineMockSeed({ order: 100, run: seedNews })
