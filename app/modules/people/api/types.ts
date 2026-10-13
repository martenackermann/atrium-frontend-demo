/**
 * People-request API types (owned by slice A4) — transcribed from API.md §7.1 with
 * SPEC_RESOLUTIONS #19–#20, #24–#25. Replace with generated types once the backend exports
 * `/people/*` (pnpm api:types).
 */
import type { Address, AttachmentDto, IsoDate, IsoDateTime, Ref, UserRef, Uuid } from '~/types/api'

export type PeopleRequestType = 'onboarding' | 'offboarding' | 'role_change'
export type PeopleRequestStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_internal'
  | 'waiting_on_requester'
  | 'reopened'
  | 'completed'
  | 'rejected'
  | 'cancelled'
export type Priority = 'critical' | 'high' | 'normal' | 'low'
export type Salutation = 'mr' | 'ms' | 'mx'
export type PeopleAction =
  | 'start_work'
  | 'wait_internal'
  | 'wait_on_requester'
  | 'resume'
  | 'complete'
  | 'reject'
  | 'cancel'
  | 'reopen'
  | 'edit'
  | 'edit_internal'
  | 'comment'
  | 'comment_internal'

export interface PeopleRequestSummary {
  id: Uuid
  reference: string
  type: PeopleRequestType
  title: string
  priority: Priority
  status: PeopleRequestStatus
  subjectName: string
  subjectUser: UserRef | null
  effectiveDate: IsoDate
  jobRole: { id: Uuid; name: string } | null
  requester: UserRef
  manager: UserRef | null
  assignee: UserRef | null
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
  availableActions: PeopleAction[]
}

export interface PersonalDataDto {
  birthDate: IsoDate | null
  placeOfBirth: string | null
  nationality: string | null
  privateAddress: Address | null
  privatePhone: string | null
  privateEmail: string | null
}

export interface PeopleRequestDetail extends PeopleRequestSummary {
  salutation: Salutation | null
  firstName: string
  lastName: string
  department: Ref | null
  site: Ref | null
  managerDeputy: UserRef | null
  reason: string | null
  furtherInformation: string | null
  equipmentNotes: string | null
  personalData: PersonalDataDto | null
  personalDataRedacted: boolean
  /** null unless people_ops / it_admin */
  internalNote: string | null
  attachments: AttachmentDto[]
  statusReason: string | null
  closedAt: IsoDateTime | null
  /** #19: the open question while waiting on the requester */
  openQuestion: PeopleCommentDto | null
  version: number
}

export interface PeopleCommentDto {
  id: Uuid
  author: UserRef
  body: string
  internal: boolean
  /** #19 */
  kind: 'comment' | 'question' | 'status_note'
  createdAt: IsoDateTime
}

export interface JobRoleDto {
  id: Uuid
  name: string
  category: string | null
  active: boolean
}

export interface PeopleCounts {
  mine: { open: number; waitingOnMe: number }
  ops: {
    open: number
    reopened: number
    inProgress: number
    waiting: number
    unassigned: number
    critical: number
  } | null
}

export interface CreatePeopleRequest {
  type: PeopleRequestType
  title: string
  priority?: Priority
  /** required for onboarding; optional for role_change (#20) */
  jobRoleId?: Uuid | null
  subjectUserId?: Uuid | null
  salutation?: Salutation | null
  firstName?: string | null
  lastName?: string | null
  effectiveDate: IsoDate
  departmentId?: Uuid | null
  siteId?: Uuid | null
  managerId?: Uuid | null
  managerDeputyId?: Uuid | null
  reason?: string | null
  furtherInformation?: string | null
  equipmentNotes?: string | null
  personalData?: Partial<PersonalDataDto> | null
  attachmentIds?: Uuid[]
}

export type UpdatePeopleRequest = Partial<Omit<CreatePeopleRequest, 'type' | 'attachmentIds'>> & {
  assigneeId?: Uuid | null
  internalNote?: string | null
  version?: number
}
