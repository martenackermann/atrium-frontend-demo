/**
 * Organisation helpers for mocks (SPEC §2, §6.1, §6.2). Pure functions: the database is passed in,
 * so seeds may import this file too (no runtime import of ~/mocks/db).
 */
import type {
  ActingAs,
  ApproverCandidate,
  ApproverReason,
  AutoApproval,
  Me,
  Ref,
  RoleName,
  UserProfile,
  UserRef,
  UserSummary,
} from '~/types/api'
import type { MockDb } from '../db'
import type { MockDeputy, MockUser } from './types'

export const FALLBACK_APPROVER_EMAIL = 'clara.ceo@example.com'
const MAX_DEPTH = 10

const pad = (value: number) => String(value).padStart(2, '0')

/** Local calendar date 'YYYY-MM-DD'. */
export function isoDay(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function initialsOf(user: Pick<MockUser, 'firstName' | 'lastName'>): string {
  return `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
}

export function toUserRef(user: MockUser): UserRef {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    jobTitle: user.jobTitle,
    initials: initialsOf(user),
  }
}

export function userRefById(db: MockDb, id: string | null | undefined): UserRef | null {
  const user = id ? db.users.find(id) : undefined
  return user ? toUserRef(user) : null
}

export function refOf(
  db: MockDb,
  kind: 'departments' | 'sites' | 'costCenters',
  id: string | null | undefined,
): Ref | null {
  if (!id) return null
  const row = db[kind].find(id)
  return row ? { id: row.id, code: row.code, name: row.name } : null
}

export function toUserSummary(db: MockDb, user: MockUser): UserSummary {
  return {
    ...toUserRef(user),
    department: refOf(db, 'departments', user.departmentId),
    site: refOf(db, 'sites', user.siteId),
    active: user.active,
  }
}

export function directReports(db: MockDb, userId: string, activeOnly = true): MockUser[] {
  return db.users.where((user) => user.managerId === userId && (!activeOnly || user.active))
}

/** `manager` is derived: the user has ≥ 1 active direct report (SPEC D4). */
export function isManager(db: MockDb, user: MockUser): boolean {
  return directReports(db, user.id).length > 0
}

export function rolesOf(db: MockDb, user: MockUser): RoleName[] {
  const roles: RoleName[] = ['employee']
  if (isManager(db, user)) roles.push('manager')
  return [...roles, ...user.roles]
}

/** Ancestors: manager, manager's manager, … (max depth 10). */
export function managerChain(db: MockDb, user: MockUser, activeOnly = false): MockUser[] {
  const chain: MockUser[] = []
  let current = user.managerId ? db.users.find(user.managerId) : undefined
  while (current && chain.length < MAX_DEPTH) {
    if (!activeOnly || current.active) chain.push(current)
    current = current.managerId ? db.users.find(current.managerId) : undefined
  }
  return chain
}

/** Every user below `managerId` (any depth). */
export function reportingTree(db: MockDb, managerId: string): Set<string> {
  const result = new Set<string>()
  const queue = [managerId]
  while (queue.length) {
    const id = queue.shift()!
    for (const report of db.users.where((user) => user.managerId === id)) {
      if (!result.has(report.id)) {
        result.add(report.id)
        queue.push(report.id)
      }
    }
  }
  return result
}

export function isInReportingTree(db: MockDb, managerId: string, userId: string): boolean {
  return reportingTree(db, managerId).has(userId)
}

/** A deputy is active on `day` when the window covers it and both users are active (SPEC §4.1). */
export function isDeputyActive(db: MockDb, deputy: MockDeputy, day: string = isoDay()): boolean {
  if (deputy.validFrom && deputy.validFrom > day) return false
  if (deputy.validTo && deputy.validTo < day) return false
  return Boolean(
    db.users.find(deputy.principalId)?.active && db.users.find(deputy.deputyId)?.active,
  )
}

export function deputyState(deputy: MockDeputy, day: string = isoDay()) {
  if (deputy.validFrom && deputy.validFrom > day) return 'upcoming' as const
  if (deputy.validTo && deputy.validTo < day) return 'expired' as const
  return 'active' as const
}

/** Users who are an active deputy for `principalId` today. */
export function activeDeputiesOf(db: MockDb, principalId: string, day?: string): MockUser[] {
  return db.deputies
    .where((row) => row.principalId === principalId && isDeputyActive(db, row, day))
    .map((row) => db.users.find(row.deputyId))
    .filter((user): user is MockUser => Boolean(user))
}

/** Deputy windows where `deputyId` acts for someone today. */
export function activeDeputyWindowsFor(db: MockDb, deputyId: string, day?: string): MockDeputy[] {
  return db.deputies.where((row) => row.deputyId === deputyId && isDeputyActive(db, row, day))
}

export function isActiveDeputy(db: MockDb, deputyId: string, principalId: string, day?: string) {
  return activeDeputyWindowsFor(db, deputyId, day).some((row) => row.principalId === principalId)
}

export interface ResolvedApprover {
  approver: MockUser
  reason: ApproverReason
  auto: AutoApproval | null
  /** The skipped site manager, if the step escalated past one. */
  escalatedFrom: MockUser | null
}

/** SPEC §6.1 — the same algorithm for training and travel. */
export function resolveApprover(
  db: MockDb,
  subject: MockUser,
  requester: MockUser,
  fallbackEmail = FALLBACK_APPROVER_EMAIL,
): ResolvedApprover {
  if (subject.roles.includes('executive')) {
    return {
      approver: subject,
      reason: 'executive_self',
      auto: 'executive_self',
      escalatedFrom: null,
    }
  }
  let manager = subject.managerId ? db.users.find(subject.managerId) : undefined
  let reason: ApproverReason = 'direct_manager'
  let escalatedFrom: MockUser | null = null
  let hops = 0
  while (manager && hops < MAX_DEPTH) {
    if (!manager.active) {
      manager = manager.managerId ? db.users.find(manager.managerId) : undefined
      reason = 'manager_unavailable'
      hops++
      continue
    }
    if (manager.isSiteManager && manager.managerId) {
      escalatedFrom ??= manager
      manager = db.users.find(manager.managerId)
      reason = 'site_manager_escalation'
      hops++
      continue
    }
    break
  }
  if (!manager || manager.id === subject.id || manager.isSiteManager) {
    manager = db.users.first((user) => user.email === fallbackEmail && user.active)
    reason = 'fallback'
    escalatedFrom = null
  }
  if (!manager) throw new Error('[mocks] fallback approver missing')
  return {
    approver: manager,
    reason,
    auto: requester.id === manager.id ? 'requester_is_approver' : null,
    escalatedFrom,
  }
}

/**
 * SPEC §6.2 — may `actor` decide this approval step? Returns how they act, or false.
 * The manager-chain override applies to manager steps only.
 */
export function canDecide(
  db: MockDb,
  actor: MockUser,
  step: { approverId: string | null; kind: 'manager' | 'executive' },
  subjectId: string,
  day?: string,
): ActingAs | false {
  if (actor.id === subjectId || !step.approverId) return false
  if (actor.id === step.approverId) return 'approver'
  if (isActiveDeputy(db, actor.id, step.approverId, day)) return 'deputy'
  if (step.kind === 'manager') {
    const approver = db.users.find(step.approverId)
    if (approver && managerChain(db, approver, true).some((user) => user.id === actor.id)) {
      return 'manager_chain'
    }
  }
  return false
}

/** Whole chain upwards with the default marked (API.md ApproverChain). */
export function approverCandidates(
  db: MockDb,
  subject: MockUser,
  requester: MockUser,
): { default: ApproverCandidate | null; candidates: ApproverCandidate[] } {
  if (subject.roles.includes('executive')) return { default: null, candidates: [] }
  const resolved = resolveApprover(db, subject, requester)
  const candidates = managerChain(db, subject).map((user, index): ApproverCandidate => ({
    user: toUserRef(user),
    level: index + 1,
    isSiteManager: user.isSiteManager,
    isDefault: user.id === resolved.approver.id,
    selectable: user.active && !user.isSiteManager,
    reason: user.id === resolved.approver.id ? resolved.reason : null,
  }))
  if (!candidates.some((candidate) => candidate.isDefault)) {
    candidates.push({
      user: toUserRef(resolved.approver),
      level: candidates.length + 1,
      isSiteManager: false,
      isDefault: true,
      selectable: true,
      reason: resolved.reason,
    })
  }
  return { default: candidates.find((candidate) => candidate.isDefault) ?? null, candidates }
}

export function toMe(db: MockDb, user: MockUser, day?: string): Me {
  const roles = rolesOf(db, user)
  const costCenter = refOf(db, 'costCenters', user.costCenterId)!
  return {
    ...toUserSummary(db, user),
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    roles,
    isManager: roles.includes('manager'),
    isExecutive: user.roles.includes('executive'),
    isSiteManager: user.isSiteManager,
    manager: userRefById(db, user.managerId),
    costCenter,
    activeDeputyFor: activeDeputyWindowsFor(db, user.id, day).map((row) => ({
      principal: userRefById(db, row.principalId)!,
      validFrom: row.validFrom,
      validTo: row.validTo,
    })),
    personaKey: user.personaKey,
  }
}

export function toUserProfile(db: MockDb, user: MockUser): UserProfile {
  return {
    ...toUserSummary(db, user),
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    manager: userRefById(db, user.managerId),
    directReports: directReports(db, user.id).map(toUserRef),
    costCenter: refOf(db, 'costCenters', user.costCenterId)!,
    roles: rolesOf(db, user),
    isSiteManager: user.isSiteManager,
  }
}
