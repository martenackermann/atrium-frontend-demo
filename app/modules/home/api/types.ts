/**
 * Home ("My day") API types (owned by slice A4) — transcribed from API.md §7.4. Module types are
 * repeated here (not imported) because modules must not import each other.
 */
import type { InboxItem, IsoDate, IsoDateTime, Uuid } from '~/types/api'

export interface UpcomingItem {
  module: 'training' | 'travel'
  entityId: Uuid
  kind: 'training' | 'car' | 'train' | 'flight'
  /** topic, or route */
  title: string
  /** provider, or 'Booked · QX7H2L' */
  subtitle: string | null
  startsAt: IsoDateTime
  endsAt: IsoDateTime | null
  /** AttendeeStatus | TravelStatus */
  status: string
  link: string
}

export interface MyDay {
  date: IsoDate
  /** first 5 in inbox order */
  inbox: { total: number; high: number; top: InboxItem[] }
  /** next 30 days, max 8, startsAt ascending */
  upcoming: UpcomingItem[]
  assets: { active: number; pendingAcceptance: number } | null
  /** NewsPostSummary[] (3 latest published, pinned first) */
  news: unknown[]
  /** UsefulLinkDto[] (active) */
  links: unknown[]
}
