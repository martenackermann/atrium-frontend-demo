/** Record -> API DTO mappers for the news mocks (API.md §7.2-§7.3). */
import { signDownload } from '~/mocks/core/files'
import { userRefById } from '~/mocks/core/org'
import type { MockUser } from '~/mocks/core/types'
import { db } from '~/mocks/db'
import type { NewsAction, NewsPostDetail, NewsPostSummary, UsefulLinkDto } from '../api/types'
import type { NewsPostRecord, UsefulLinkRecord } from './types'
import { newsWorkflow } from './workflow'

/** API base (set by the handlers factory) for signed cover URLs. */
let apiBase = '/api/v1'
export function setNewsApiBase(base: string) {
  apiBase = base.replace(/\/+$/, '')
}

const COVER_TTL_MS = 60 * 60_000

export function toSummary(row: NewsPostRecord, user: MockUser): NewsPostSummary {
  const cover = row.coverImageId
    ? signDownload(row.coverImageId, user.id, 'inline', COVER_TTL_MS)
    : null
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    summary: row.summary,
    coverImage:
      cover && row.coverImageId
        ? {
            attachmentId: row.coverImageId,
            url: `${apiBase}/files/${cover.token}`,
            expiresAt: cover.expiresAt.toISOString(),
          }
        : null,
    pinned: row.pinned,
    publishAt: row.publishAt,
    expireAt: row.expireAt,
    publishedAt: row.publishedAt,
    author: userRefById(db, row.authorId) ?? {
      id: row.authorId,
      displayName: 'Atrium',
      email: 'no-reply@example.com',
      jobTitle: null,
      initials: 'AT',
    },
    updatedAt: row.updatedAt,
    availableActions: newsWorkflow.availableActions(row, user) as NewsAction[],
  }
}

export function toDetail(row: NewsPostRecord, user: MockUser): NewsPostDetail {
  return {
    ...toSummary(row, user),
    bodyHtml: row.bodyHtml,
    createdAt: row.createdAt,
    version: row.version,
  }
}

export const toLink = (row: UsefulLinkRecord): UsefulLinkDto => ({
  id: row.id,
  title: row.title,
  url: row.url,
  description: row.description,
  icon: row.icon,
  category: row.category,
  sortOrder: row.sortOrder,
  active: row.active,
})
