/**
 * Audit log for mocks (SPEC §4.1 AuditLog): every transition and edit appends an entry; per-resource
 * timelines (`GET …/timeline`) and `/audit` are filtered views. Pure: the database is passed in.
 */
import type { ActingAs, FieldChange, ModuleName, TimelineEntry } from '~/types/api'
import type { MockDb } from '../db'
import type { MockAuditEntry } from './types'
import { userRefById } from './org'

export interface AuditInput {
  module: ModuleName
  entityType: string
  entityId: string
  entityLabel: string
  action: string
  actorId: string | null
  actingAs: ActingAs
  fromState?: string | null
  toState?: string | null
  reason?: string | null
  changes?: FieldChange[] | null
  /** English sentence; defaults to "<actor> <action>". */
  summary?: string
  occurredAt?: string
  correlationId?: string
}

let sequence = 0

export function recordAudit(db: MockDb, input: AuditInput): MockAuditEntry {
  const actor = input.actorId ? db.users.find(input.actorId) : undefined
  const actorName = actor?.displayName ?? 'Atrium'
  return db.audit.insert({
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    actorId: input.actorId,
    actingAs: input.actingAs,
    module: input.module,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    action: input.action,
    fromState: input.fromState ?? null,
    toState: input.toState ?? null,
    reason: input.reason ?? null,
    changes: input.changes ?? null,
    summary: input.summary ?? `${actorName} ${input.action.replace(/_/g, ' ')}`,
    correlationId: input.correlationId ?? `req_${(++sequence).toString(36)}`,
  })
}

export function toTimelineEntry(db: MockDb, entry: MockAuditEntry): TimelineEntry {
  return {
    id: entry.id,
    occurredAt: entry.occurredAt,
    actor: userRefById(db, entry.actorId),
    actingAs: entry.actingAs,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityLabel: entry.entityLabel,
    action: entry.action,
    fromState: entry.fromState,
    toState: entry.toState,
    reason: entry.reason,
    changes: entry.changes,
    summary: entry.summary,
  }
}

/** Ascending timeline for one or more entities (API.md: `…/timeline` is ascending). */
export function timelineFor(
  db: MockDb,
  entities: Array<{ entityType: string; entityId: string }>,
): TimelineEntry[] {
  const keys = new Set(entities.map((entity) => `${entity.entityType}:${entity.entityId}`))
  return db.audit
    .where((entry) => keys.has(`${entry.entityType}:${entry.entityId}`))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .map((entry) => toTimelineEntry(db, entry))
}

/** Field-level diff for PATCH audits (masked fields render as '•••'). */
export function diffFields<T extends object>(
  before: T,
  after: T,
  labels: Partial<Record<keyof T & string, string>>,
  masked: ReadonlyArray<keyof T & string> = [],
): FieldChange[] {
  const changes: FieldChange[] = []
  const a = before as Record<string, unknown>
  const b = after as Record<string, unknown>
  for (const field of Object.keys(labels) as Array<keyof T & string>) {
    if (JSON.stringify(a[field]) === JSON.stringify(b[field])) continue
    const isMasked = masked.includes(field)
    changes.push({
      field,
      label: labels[field] ?? field,
      from: isMasked ? '•••' : (a[field] ?? null),
      to: isMasked ? '•••' : (b[field] ?? null),
    })
  }
  return changes
}
