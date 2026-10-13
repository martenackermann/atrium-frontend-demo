import type {
  ActingAs,
  AssignableRole,
  AttachmentPurpose,
  FieldChange,
  ModuleName,
  NotificationPriority,
  PersonaKey,
} from '~/types/api'

/** Employee (SPEC §4.1 User). `employee` and `manager` roles are derived, never stored. */
export interface MockUser {
  id: string
  email: string
  firstName: string
  lastName: string
  displayName: string
  jobTitle: string | null
  employeeNumber: string
  phone: string | null
  departmentId: string | null
  siteId: string | null
  costCenterId: string
  managerId: string | null
  isSiteManager: boolean
  active: boolean
  roles: AssignableRole[]
  personaKey: PersonaKey | null
  lastLoginAt: string | null
  createdAt: string
  version: number
}

export interface MockDepartment {
  id: string
  code: string
  name: string
  headId: string | null
}

export interface MockSite {
  id: string
  code: string
  name: string
}

export interface MockCostCenter {
  id: string
  code: string
  name: string
  departmentId: string | null
  active: boolean
}

export interface MockDeputy {
  id: string
  principalId: string
  deputyId: string
  /** IsoDate */
  validFrom: string | null
  validTo: string | null
  note: string | null
  createdById: string
  createdAt: string
}

export interface MockNotification {
  id: string
  userId: string
  templateId: string
  module: ModuleName
  title: string
  body: string
  link: string | null
  priority: NotificationPriority
  readAt: string | null
  createdAt: string
}

export interface MockAttachment {
  id: string
  originalName: string
  mimeType: string
  sizeBytes: number
  purpose: AttachmentPurpose
  uploadedById: string
  /** null = staged (not linked yet) */
  entityType: string | null
  entityId: string | null
  createdAt: string
  linkedAt: string | null
}

/** Append-only audit log; per-resource timelines are filtered views of it. */
export interface MockAuditEntry {
  id: string
  occurredAt: string
  actorId: string | null
  actingAs: ActingAs
  module: ModuleName
  entityType: string
  entityId: string
  entityLabel: string
  action: string
  fromState: string | null
  toState: string | null
  reason: string | null
  changes: FieldChange[] | null
  summary: string
  correlationId: string
}

export interface MockJobRun {
  id: string
  jobName: string
  triggeredBy: 'cron' | 'manual'
  triggeredById: string | null
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'succeeded' | 'failed'
  summary: Record<string, number | string>
  error: string | null
}
