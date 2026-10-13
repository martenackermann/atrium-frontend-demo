/**
 * Core (foundation) API types — hand-written from _spec/atrium/API.md §3.
 */
import type {
  ActingAs,
  ApprovalExemptionCode,
  ApproverCandidate,
  AssignableRole,
  AttachmentPurpose,
  IsoDate,
  IsoDateTime,
  ModuleName,
  Money,
  NotificationPriority,
  PersonaKey,
  Ref,
  RoleName,
  TimelineEntry,
  Tone,
  UserRef,
  UserSummary,
  Uuid,
} from './index'

// ---------------------------------------------------------------------------------------------
// 3.1 Auth
// ---------------------------------------------------------------------------------------------

export interface LoginRequest {
  email: string
  password: string
}

export interface DemoLoginRequest {
  personaKey: PersonaKey
}

export interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresAt: IsoDateTime
  user: Me
}

export interface Persona {
  key: PersonaKey
  displayName: string
  email: string
  jobTitle: string
  department: string
  roles: RoleName[]
  /** e.g. "Approves for two teams – one escalated past a site manager" */
  tagline: string
  /** 2–4 short bullets */
  highlights: string[]
}

// ---------------------------------------------------------------------------------------------
// 3.2 Me, inbox, notifications, deputies
// ---------------------------------------------------------------------------------------------

export interface ActiveDeputyFor {
  principal: UserRef
  validFrom: IsoDate | null
  validTo: IsoDate | null
}

export interface Me extends UserSummary {
  firstName: string
  lastName: string
  phone: string | null
  /** includes derived 'employee' and (if applicable) 'manager' */
  roles: RoleName[]
  isManager: boolean
  isExecutive: boolean
  isSiteManager: boolean
  manager: UserRef | null
  costCenter: Ref
  activeDeputyFor: ActiveDeputyFor[]
  personaKey: PersonaKey | null
}

export type InboxItemType =
  | 'training.approval_required'
  | 'training.booking_required'
  | 'training.cancellation_review'
  | 'training.rating_due'
  | 'training.goals_missing'
  | 'travel.approval_required'
  | 'travel.booking_required'
  | 'travel.cancellation_review'
  | 'assets.acceptance_required'
  | 'people.reply_required'
  | 'people.triage_required'

export type InboxModule = Exclude<ModuleName, 'core' | 'news'>

export interface InboxItem {
  /** `${type}:${entityId}` — stable */
  id: string
  module: InboxModule
  type: InboxItemType
  reference: string | null
  title: string
  subtitle: string | null
  dueAt: IsoDateTime | null
  priority: NotificationPriority
  /** 'approver' | 'deputy' for approvals */
  actingAs: ActingAs | null
  /** frontend route (API.md §8) */
  link: string
  entityId: Uuid
  createdAt: IsoDateTime
  /** subset of the entity's availableActions safe to run from the drawer: 'approve', 'decline' */
  quickActions: string[]
  /**
   * Resource path for quick actions (SPEC_RESOLUTIONS #4): post to `${actionsPath}/actions/{action}`,
   * e.g. '/training/participations/<id>'.
   */
  actionsPath: string
}

export interface InboxResponse {
  data: InboxItem[]
  meta: {
    total: number
    high: number
    byModule: { training: number; travel: number; assets: number; people: number }
  }
}

export interface InboxCounts {
  total: number
  high: number
  training: number
  travel: number
  assets: number
  people: number
}

export interface NotificationDto {
  id: Uuid
  templateId: string
  module: ModuleName
  title: string
  body: string
  link: string | null
  priority: NotificationPriority
  readAt: IsoDateTime | null
  createdAt: IsoDateTime
}

export interface NotificationPage {
  data: NotificationDto[]
  meta: { page: number; perPage: number; total: number; totalPages: number; unread: number }
}

export interface CreateDeputy {
  deputyId: Uuid
  validFrom?: IsoDate | null
  validTo?: IsoDate | null
  /** ≤ 200 */
  note?: string | null
}

export type UpdateDeputy = Partial<Omit<CreateDeputy, 'deputyId'>>

export interface DeputyDto {
  id: Uuid
  principal: UserRef
  deputy: UserRef
  validFrom: IsoDate | null
  validTo: IsoDate | null
  note: string | null
  isActiveNow: boolean
  state: 'active' | 'upcoming' | 'expired'
  createdAt: IsoDateTime
}

export interface DeputiesResponse {
  asPrincipal: DeputyDto[]
  asDeputy: DeputyDto[]
}

// ---------------------------------------------------------------------------------------------
// 3.3 Users and org
// ---------------------------------------------------------------------------------------------

export interface UsersQuery {
  q?: string
  departmentId?: Uuid
  siteId?: Uuid
  role?: RoleName
  /** team = my reporting tree */
  scope?: 'all' | 'team'
  includeInactive?: boolean
  page?: number
  perPage?: number
  sort?: 'displayName'
}

export interface UserProfile extends UserSummary {
  firstName: string
  lastName: string
  phone: string | null
  manager: UserRef | null
  directReports: UserRef[]
  costCenter: Ref
  roles: RoleName[]
  isSiteManager: boolean
}

export interface ApproverChain {
  subject: UserRef
  /** 'executive_traveller' when the subject is an executive */
  exemption: ApprovalExemptionCode | null
  /** result of SPEC §6.1 (null when exempt) */
  default: ApproverCandidate | null
  /** whole chain upwards, level ascending */
  candidates: ApproverCandidate[]
}

export interface DepartmentDto extends Ref {
  head: UserRef | null
  memberCount: number
}

export interface CostCenterDto extends Ref {
  department: Ref | null
  active: boolean
}

// ---------------------------------------------------------------------------------------------
// 3.4 Attachments
// ---------------------------------------------------------------------------------------------

export interface DownloadUrl {
  url: string
  expiresAt: IsoDateTime
}

// ---------------------------------------------------------------------------------------------
// 3.5 Search
// ---------------------------------------------------------------------------------------------

export interface SearchHit {
  module: Exclude<ModuleName, 'core'>
  type:
    | 'training_request'
    | 'training_participation'
    | 'travel_request'
    | 'asset'
    | 'people_request'
    | 'news_post'
  id: Uuid
  reference: string | null
  title: string
  subtitle: string | null
  link: string
}

// ---------------------------------------------------------------------------------------------
// 3.6 Meta
// ---------------------------------------------------------------------------------------------

export type EnumName =
  | 'role'
  | 'actingAs'
  | 'approverReason'
  | 'autoApproval'
  | 'trainingFormat'
  | 'attendeeStatus'
  | 'billingStatus'
  | 'ratingState'
  | 'likert'
  | 'improvement'
  | 'travelKind'
  | 'travelStatus'
  | 'approvalReason'
  | 'approvalExemption'
  | 'vehicleType'
  | 'handoverMode'
  | 'dropOffMode'
  | 'tripType'
  | 'fareType'
  | 'assetStatus'
  | 'returnCondition'
  | 'peopleRequestType'
  | 'peopleRequestStatus'
  | 'priority'
  | 'salutation'
  | 'newsType'
  | 'newsStatus'

export interface EnumOption {
  value: string | number
  label: string
  tone: Tone | null
  description: string | null
}

export type EnumCatalog = Partial<Record<EnumName, EnumOption[]>>

export interface PublicConfig {
  timezone: string
  demoMode: boolean
  trainingExecutiveThreshold: Money
  trainingHighPriorityDays: number
  travelHighPriorityDays: number
  goalsReminderDaysBefore: number
  ratingDelaysDays: { loop1: number; loop2: number; loop3: number }
  peopleReopenWindowDays: number
  /** SPEC_RESOLUTIONS #17 */
  ratingReminderMax: number
  ratingReminderCadenceDays: number
  ratingOverdueDays: number
  assetAcceptanceDueDays: number
  uploadMaxBytes: number
  allowedMimeTypes: Record<AttachmentPurpose, string[]>
}

export type WorkflowName =
  'training_attendee' | 'travel_request' | 'asset' | 'people_request' | 'news_post'

export interface WorkflowState {
  id: string
  label: string
  tone: Tone
  terminal: boolean
}

export interface WorkflowTransition {
  from: string
  to: string
  event: string
  label: string
  /** display labels, e.g. ['Approver', 'Deputy', 'Manager chain'] */
  actors: string[]
}

export interface WorkflowDefinition {
  name: WorkflowName
  label: string
  /** possible entry states (after transient 'submitted') */
  initialStates: string[]
  states: WorkflowState[]
  transitions: WorkflowTransition[]
}

export interface HealthDto {
  status: 'ok' | 'degraded'
  checks: { database: 'up' | 'down'; queue: 'up' | 'down'; mail: 'up' | 'down' }
}

// ---------------------------------------------------------------------------------------------
// 3.7 Audit and admin
// ---------------------------------------------------------------------------------------------

export interface AuditEntryDto extends TimelineEntry {
  module: ModuleName
  correlationId: string
}

export interface AuditQuery {
  module?: ModuleName
  entityType?: string
  entityId?: Uuid
  actorId?: Uuid
  action?: string
  from?: IsoDate
  to?: IsoDate
  page?: number
  perPage?: number
  sort?: string
}

export interface AdminUserDto extends UserSummary {
  firstName: string
  lastName: string
  employeeNumber: string
  phone: string | null
  manager: UserRef | null
  costCenter: Ref
  roles: AssignableRole[]
  isSiteManager: boolean
  isManager: boolean
  directReportsCount: number
  personaKey: PersonaKey | null
  lastLoginAt: IsoDateTime | null
  createdAt: IsoDateTime
  /** optimistic locking (SPEC_RESOLUTIONS #26) */
  version: number
}

export interface CreateAdminUser {
  email: string
  firstName: string
  lastName: string
  jobTitle?: string | null
  employeeNumber?: string | null
  departmentId?: Uuid | null
  siteId?: Uuid | null
  costCenterId: Uuid
  managerId?: Uuid | null
  isSiteManager?: boolean
  roles?: AssignableRole[]
  /** ≥ 8 */
  initialPassword: string
}

export type UpdateAdminUser = Partial<Omit<CreateAdminUser, 'email' | 'initialPassword'>> & {
  active?: boolean
  version?: number
}

export interface JobRunDto {
  id: Uuid
  jobName: string
  triggeredBy: 'cron' | 'manual'
  triggeredByUser: UserRef | null
  startedAt: IsoDateTime
  finishedAt: IsoDateTime | null
  status: 'running' | 'succeeded' | 'failed'
  summary: Record<string, number | string>
  error: string | null
}

export interface JobDto {
  name: string
  description: string
  slice: 'F' | 'A1' | 'A2' | 'A3' | 'A4'
  cron: string | null
  enabled: boolean
  nextRunAt: IsoDateTime | null
  lastRun: JobRunDto | null
}
