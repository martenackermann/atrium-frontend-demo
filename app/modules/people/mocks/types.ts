/**
 * People mock records (slice A4), mirroring the backend tables `people_requests`,
 * `people_request_comments` and `job_roles` (SPEC §4.5).
 */
import type {
  PeopleRequestStatus,
  PeopleRequestType,
  PersonalDataDto,
  Priority,
  Salutation,
} from '../api/types'

export interface PeopleRequestRecord {
  id: string
  number: number
  type: PeopleRequestType
  title: string
  priority: Priority
  status: PeopleRequestStatus
  jobRoleId: string | null
  subjectUserId: string | null
  salutation: Salutation | null
  firstName: string
  lastName: string
  /** IsoDate */
  effectiveDate: string
  departmentId: string | null
  siteId: string | null
  managerId: string | null
  managerDeputyId: string | null
  requesterId: string
  assigneeId: string | null
  reason: string | null
  furtherInformation: string | null
  equipmentNotes: string | null
  /** Personal data (requester, manager, people_ops only). */
  personalData: PersonalDataDto
  internalNote: string | null
  statusReason: string | null
  closedAt: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface PeopleCommentRecord {
  id: string
  requestId: string
  authorId: string
  body: string
  internal: boolean
  kind: 'comment' | 'question' | 'status_note'
  createdAt: string
}

export interface JobRoleRecord {
  id: string
  name: string
  category: string | null
  active: boolean
}

declare module '~/mocks/db' {
  interface MockCollections {
    peopleRequests: PeopleRequestRecord
    peopleComments: PeopleCommentRecord
    jobRoles: JobRoleRecord
  }
}
