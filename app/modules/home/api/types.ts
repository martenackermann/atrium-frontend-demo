/**
 * Home ("My day") API types (owned by slice A4) — transcribed from API.md §7.4. Module types are
 * repeated here (not imported) because modules must not import each other.
 */
import type { InboxItem, IsoDate, IsoDateTime, SignedImage, UserRef, Uuid } from '~/types/api'

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

/** NewsPostSummary (API.md §7.2), as far as Home shows it. */
export interface HomeNewsPost {
  id: Uuid
  title: string
  type: 'changelog' | 'update' | 'information'
  status: string
  summary: string
  coverImage: SignedImage | null
  pinned: boolean
  publishedAt: IsoDateTime | null
  author: UserRef
}

/** UsefulLinkDto (API.md §7.3). */
export interface HomeLink {
  id: Uuid
  title: string
  url: string
  description: string | null
  icon: string | null
  category: string | null
  sortOrder: number
  active: boolean
}

export interface MyDay {
  date: IsoDate
  /** first 5 in inbox order */
  inbox: { total: number; high: number; top: InboxItem[] }
  /** next 30 days, max 8, startsAt ascending */
  upcoming: UpcomingItem[]
  assets: { active: number; pendingAcceptance: number } | null
  /** 3 latest published (pinned first) */
  news: HomeNewsPost[]
  /** active links */
  links: HomeLink[]
}

/** My open people requests (`GET /people/requests?scope=mine`, API.md §7.1 summary). */
export interface HomePeopleRequest {
  id: Uuid
  reference: string
  type: 'onboarding' | 'offboarding' | 'role_change'
  title: string
  status: string
  subjectName: string
  effectiveDate: IsoDate
  requester: UserRef
  assignee: UserRef | null
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  availableActions: string[]
}

/** Back-office queue counts shown as tiles (API.md: TrainingCounts, TravelCounts, assets, people). */
export interface TrainingOfficeCounts {
  office: { toBook: number; cancellationRequested: number; bookingImpossible: number } | null
}
export interface TravelDeskCounts {
  desk: { toBook: number; toBookHighPriority: number; cancellationRequested: number } | null
}
export interface AssetAdminCounts {
  admin: { pendingAcceptance: number; inRepair: number } | null
}
export interface PeopleOpsCounts {
  ops: { open: number; reopened: number; unassigned: number } | null
}
