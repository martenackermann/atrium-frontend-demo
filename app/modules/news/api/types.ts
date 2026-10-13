/**
 * News + useful-link API types (owned by slice A4) — transcribed from API.md §7.2–7.3. Replace
 * with generated types once the backend exports `/news*` and `/links*` (pnpm api:types).
 */
import type { IsoDateTime, SignedImage, UserRef, Uuid } from '~/types/api'

export type NewsType = 'changelog' | 'update' | 'information'
export type NewsStatus = 'draft' | 'scheduled' | 'published' | 'archived'
export type NewsAction =
  'publish' | 'schedule' | 'unschedule' | 'archive' | 'restore' | 'edit' | 'delete'

export interface NewsPostSummary {
  id: Uuid
  title: string
  type: NewsType
  status: NewsStatus
  summary: string
  coverImage: SignedImage | null
  pinned: boolean
  publishAt: IsoDateTime | null
  expireAt: IsoDateTime | null
  publishedAt: IsoDateTime | null
  author: UserRef
  updatedAt: IsoDateTime
  availableActions: NewsAction[]
}

export interface NewsPostDetail extends NewsPostSummary {
  /** sanitised on write; render through DOMPurify as defence in depth */
  bodyHtml: string
  createdAt: IsoDateTime
  version: number
}

export interface CreateNewsPost {
  title: string
  type: NewsType
  summary: string
  bodyHtml: string
  coverImageId?: Uuid | null
  pinned?: boolean
  expireAt?: IsoDateTime | null
}

export interface UsefulLinkDto {
  id: Uuid
  title: string
  url: string
  description: string | null
  icon: string | null
  category: string | null
  sortOrder: number
  active: boolean
}

export type UsefulLinkInput = Omit<UsefulLinkDto, 'id' | 'sortOrder'> & { sortOrder?: number }
