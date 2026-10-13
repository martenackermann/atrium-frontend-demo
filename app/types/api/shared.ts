/**
 * Shared API types — hand-written from _spec/atrium/API.md §2 (the backend does not export its
 * full OpenAPI document yet; see CONVENTIONS.md "API types"). Keep in sync with API.md.
 */

export type Uuid = string
/** 'YYYY-MM-DD' (calendar date in APP_TIMEZONE). */
export type IsoDate = string
/** 'YYYY-MM-DDTHH:mm:ss.sssZ' (UTC). */
export type IsoDateTime = string

export interface Money {
  amountCents: number
  currency: 'EUR'
}

/** Department, site, cost centre. */
export interface Ref {
  id: Uuid
  code: string
  name: string
}

export interface UserRef {
  id: Uuid
  displayName: string
  email: string
  jobTitle: string | null
  /** 'EE' */
  initials: string
}

export interface UserSummary extends UserRef {
  department: Ref | null
  site: Ref | null
  active: boolean
}

export interface Address {
  street: string
  houseNumber: string
  postalCode: string
  city: string
  /** ISO 3166-1 alpha-2, uppercase. */
  countryCode: string
}

export interface PageMeta {
  page: number
  perPage: number
  total: number
  totalPages: number
}

/** List envelope: `?page=1&perPage=25` → `{ data, meta }`. */
export interface Page<T> {
  data: T[]
  meta: PageMeta
}

export type AttachmentPurpose =
  | 'training_document'
  | 'training_booking_document'
  | 'travel_booking_confirmation'
  | 'news_cover'
  | 'people_document'

export interface AttachmentDto {
  id: Uuid
  originalName: string
  mimeType: string
  sizeBytes: number
  purpose: AttachmentPurpose
  uploadedBy: UserRef
  createdAt: IsoDateTime
}

/** 60-min signed URL for news covers. */
export interface SignedImage {
  attachmentId: Uuid
  url: string
  expiresAt: IsoDateTime
}

/** Masked values are '•••'. */
export interface FieldChange {
  field: string
  label: string
  from: unknown
  to: unknown
}

export type ActingAs =
  | 'self'
  | 'requester'
  | 'approver'
  | 'deputy'
  | 'manager_chain'
  | 'executive'
  | 'back_office'
  | 'admin'
  | 'system'

export interface TimelineEntry {
  id: Uuid
  occurredAt: IsoDateTime
  actor: UserRef | null
  actingAs: ActingAs
  entityType: string
  entityId: Uuid
  /** e.g. 'Emma Employee' for an attendee row. */
  entityLabel: string
  action: string
  fromState: string | null
  toState: string | null
  reason: string | null
  changes: FieldChange[] | null
  /** Server-rendered English sentence, e.g. "Max Manager approved (as deputy for Priya Raman)". */
  summary: string
}

export type ApproverReason =
  | 'direct_manager'
  | 'site_manager_escalation'
  | 'manager_unavailable'
  | 'executive_self'
  | 'fallback'

export type AutoApproval = 'executive_self' | 'requester_is_approver' | 'same_approver'

export interface ApproverCandidate {
  user: UserRef
  /** 1 = direct manager, 2 = their manager … */
  level: number
  isSiteManager: boolean
  isDefault: boolean
  /** false for site managers and inactive users */
  selectable: boolean
  /** set on the default candidate */
  reason: ApproverReason | null
}

export interface Decision {
  at: IsoDateTime
  by: UserRef | null
  actingAs: ActingAs
  autoApproval: AutoApproval | null
  comment: string | null
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> | null : T[K] | null
}

export type RoleName =
  | 'employee'
  | 'manager'
  | 'executive'
  | 'training_office'
  | 'travel_desk'
  | 'asset_admin'
  | 'people_ops'
  | 'news_editor'
  | 'it_admin'

export type AssignableRole = Exclude<RoleName, 'employee' | 'manager'>

export type PersonaKey =
  'emma' | 'max' | 'sofia' | 'clara' | 'tom' | 'tina' | 'arne' | 'paula' | 'ian'

export type ModuleName = 'core' | 'training' | 'travel' | 'assets' | 'people' | 'news'

/**
 * Enum option tone — DESIGN.md's seven tones (SPEC_RESOLUTIONS #8). `you` is reserved for
 * client-side, viewer-relative rendering (StatusBadge), not for enum options.
 */
export type Tone = 'neutral' | 'waiting' | 'you' | 'moving' | 'positive' | 'negative' | 'blocked'

export type NotificationPriority = 'high' | 'normal'

export type ErrorCode =
  | 'validation_failed'
  | 'unauthenticated'
  | 'invalid_credentials'
  | 'forbidden'
  | 'not_found'
  | 'invalid_transition'
  | 'version_conflict'
  | 'conflict'
  | 'serial_taken'
  | 'model_in_use'
  | 'in_use'
  | 'deputy_overlap'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'idempotency_key_reused'
  | 'rate_limited'
  | 'internal_error'

/** RFC 9457 problem details (API.md §2.4). */
export interface Problem {
  /** 'https://atrium.example.com/problems/<code>' */
  type: string
  title: string
  status: number
  detail?: string
  /** request path */
  instance?: string
  code: ErrorCode
  traceId: string
  /** only for 422; keys are dot paths with numeric indices: `attendees.0.userId` */
  errors?: Record<string, string[]>
}

/** Standard list query parameters (API.md §1). Module filters are added per endpoint. */
export interface ListQuery {
  page?: number
  perPage?: number
  /** `field,-field` (`-` = descending) */
  sort?: string
  q?: string
}
