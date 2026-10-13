/** News mock records (slice A4), mirroring `news_posts` and `useful_links` (SPEC §4.6). */
import type { NewsStatus, NewsType } from '../api/types'

export interface NewsPostRecord {
  id: string
  title: string
  type: NewsType
  status: NewsStatus
  summary: string
  /** Sanitised on write (allowlist SPEC §4.6). */
  bodyHtml: string
  coverImageId: string | null
  pinned: boolean
  publishAt: string | null
  expireAt: string | null
  publishedAt: string | null
  archivedAt: string | null
  authorId: string
  updatedById: string | null
  deletedAt: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface UsefulLinkRecord {
  id: string
  title: string
  url: string
  description: string | null
  icon: string | null
  category: string | null
  sortOrder: number
  active: boolean
  createdById: string
  createdAt: string
}

declare module '~/mocks/db' {
  interface MockCollections {
    newsPosts: NewsPostRecord
    usefulLinks: UsefulLinkRecord
  }
}
