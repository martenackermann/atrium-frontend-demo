/** Record -> API DTO mappers for the people mocks (API.md §7.1). */
import { attachmentsOf } from '~/mocks/core/files'
import { refOf, userRefById } from '~/mocks/core/org'
import type { MockUser } from '~/mocks/core/types'
import { db } from '~/mocks/db'
import type {
  JobRoleDto,
  PeopleAction,
  PeopleCommentDto,
  PeopleRequestDetail,
  PeopleRequestSummary,
} from '../api/types'
import { canSeePersonalData, isBackOffice, peopleReference } from './rules'
import type { JobRoleRecord, PeopleCommentRecord, PeopleRequestRecord } from './types'
import { peopleWorkflow } from './workflow'

const UNKNOWN_USER = {
  id: '00000000-0000-0000-0000-000000000000',
  displayName: 'Former colleague',
  email: 'no-reply@example.com',
  jobTitle: null,
  initials: 'FC',
}

export function toComment(row: PeopleCommentRecord): PeopleCommentDto {
  return {
    id: row.id,
    author: userRefById(db, row.authorId) ?? UNKNOWN_USER,
    body: row.body,
    internal: row.internal,
    kind: row.kind,
    createdAt: row.createdAt,
  }
}

export const toJobRole = (row: JobRoleRecord): JobRoleDto => ({
  id: row.id,
  name: row.name,
  category: row.category,
  active: row.active,
})

export function toSummary(row: PeopleRequestRecord, user: MockUser): PeopleRequestSummary {
  const jobRole = row.jobRoleId ? db.jobRoles.find(row.jobRoleId) : undefined
  return {
    id: row.id,
    reference: peopleReference(row.number),
    type: row.type,
    title: row.title,
    priority: row.priority,
    status: row.status,
    subjectName: `${row.firstName} ${row.lastName}`,
    subjectUser: userRefById(db, row.subjectUserId),
    effectiveDate: row.effectiveDate,
    jobRole: jobRole ? { id: jobRole.id, name: jobRole.name } : null,
    requester: userRefById(db, row.requesterId) ?? UNKNOWN_USER,
    manager: userRefById(db, row.managerId),
    assignee: userRefById(db, row.assigneeId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    availableActions: peopleWorkflow.availableActions(row, user) as PeopleAction[],
  }
}

export function toDetail(row: PeopleRequestRecord, user: MockUser): PeopleRequestDetail {
  const personal = canSeePersonalData(user, row)
  const question =
    row.status === 'waiting_on_requester'
      ? db.peopleComments
          .where((c) => c.requestId === row.id && c.kind === 'question' && !c.internal)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      : undefined
  return {
    ...toSummary(row, user),
    salutation: row.salutation,
    firstName: row.firstName,
    lastName: row.lastName,
    department: refOf(db, 'departments', row.departmentId),
    site: refOf(db, 'sites', row.siteId),
    managerDeputy: userRefById(db, row.managerDeputyId),
    reason: row.reason,
    furtherInformation: row.furtherInformation,
    equipmentNotes: row.equipmentNotes,
    personalData: personal ? row.personalData : null,
    personalDataRedacted: !personal,
    internalNote: isBackOffice(user) ? row.internalNote : null,
    // People documents only for personal-data viewers (SPEC_RESOLUTIONS #25).
    attachments: personal ? attachmentsOf(db, 'people_request', row.id) : [],
    openQuestion: question ? toComment(question) : null,
    statusReason: row.statusReason,
    closedAt: row.closedAt,
    version: row.version,
  }
}
