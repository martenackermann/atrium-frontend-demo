/**
 * Asset lifecycle for demo mode (SPEC §5.3) — mirrors the backend machine: who may act, bodies,
 * side effects (assignment rows, cost-centre switch, notifications) and the audit sentences.
 */
import { z } from 'zod'
import type { ActingAs } from '~/types/api'
import type { MockUser } from '~/mocks/core/types'
import { db } from '~/mocks/db'
import { userHasRole, validationProblem } from '~/mocks/http'
import { defineMockWorkflow, type TransitionContext } from '~/mocks/workflow'
import { assetSummary, assetTag } from './audit-text'
import { assignmentPendingText, returnedText } from './notify-text'
import {
  ACCEPTANCE_DUE_DAYS,
  defaultCostCenterId,
  isAssetAdmin,
  modelOf,
  openAssignment,
  typeOf,
} from './store'
import type { AssetAssignmentRecord, AssetRecord } from './types'

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null))
const reason = z
  .string({ error: 'Add a reason.' })
  .trim()
  .min(3, 'Add a reason of at least 3 characters.')
  .max(1000, 'Keep the reason under 1000 characters.')

/** Like the backend: notes are stored as the audit reason so the timeline shows them. */
const withNoteAsReason = <T extends { note: string | null }>(body: T) => ({
  ...body,
  reason: body.note,
})

export const assetActionBodies = {
  assign: z
    .strictObject({ userId: z.uuid('Choose a person.'), note: optionalText(1000) })
    .transform(withNoteAsReason),
  accept: z.strictObject({ platformId: z.uuid().nullish() }),
  decline: z.strictObject({ reason }),
  unassign: z.strictObject({ reason: optionalText(1000) }),
  return: z
    .strictObject({
      condition: z.enum(['ok', 'damaged'], { error: 'Choose the condition.' }),
      note: optionalText(1000),
    })
    .transform(withNoteAsReason),
  send_to_repair: z
    .strictObject({
      note: z
        .string({ error: 'Describe the fault.' })
        .trim()
        .min(3, 'Describe the fault in a few words.')
        .max(1000),
    })
    .transform(withNoteAsReason),
  complete_repair: z.strictObject({ note: optionalText(1000) }).transform(withNoteAsReason),
  scrap: z.strictObject({ reason }),
}

const adminActing = (user: MockUser): ActingAs | false =>
  userHasRole(user, 'it_admin') ? 'admin' : isAssetAdmin(user) ? 'back_office' : false
const admin = (asset: AssetRecord, user: MockUser) => (asset.deletedAt ? false : adminActing(user))
const assignee = (asset: AssetRecord, user: MockUser): ActingAs | false =>
  asset.assignedUserId === user.id ? 'self' : false

type Ctx = TransitionContext<AssetRecord> & { to: string }

function updateOpen(assetId: string, patch: Partial<AssetAssignmentRecord>) {
  const open = openAssignment(assetId)
  if (open) db.assetAssignments.update(open.id, patch)
}

/** Clears the holder and puts the asset on the default cost centre (decline, return, scrap…). */
const release = (ctx: Ctx, patch: Partial<AssetAssignmentRecord>) => {
  updateOpen(ctx.entity.id, patch)
  return {
    assignedUserId: null,
    costCenterId: defaultCostCenterId(),
    updatedById: ctx.user.id,
    updatedAt: ctx.now.toISOString(),
    version: ctx.entity.version + 1,
  }
}
const touched = (ctx: Ctx) => ({
  updatedById: ctx.user.id,
  updatedAt: ctx.now.toISOString(),
  version: ctx.entity.version + 1,
})

const summary = (ctx: Ctx, action: string) => {
  const holder =
    action === 'assign' ? db.users.find(String(ctx.body.userId))?.displayName : undefined
  return assetSummary(ctx.user.displayName, action, ctx.actingAs, holder)
}

const label = (asset: AssetRecord) => `${assetTag(asset.number)} · ${modelOf(asset).name}`

export const assetWorkflow = defineMockWorkflow<AssetRecord>({
  name: 'asset',
  label: 'Asset',
  module: 'assets',
  entityType: 'asset',
  entityLabel: label,
  initialStates: ['in_stock'],
  states: {
    in_stock: { label: 'In stock', tone: 'neutral' },
    pending_acceptance: { label: 'Waiting for acceptance', tone: 'waiting' },
    in_use: { label: 'In use', tone: 'positive' },
    in_repair: { label: 'In repair', tone: 'blocked' },
    scrapped: { label: 'Scrapped', tone: 'neutral', terminal: true },
  },
  transitions: [
    {
      event: 'assign',
      from: ['in_stock'],
      to: 'pending_acceptance',
      label: 'Assign',
      actors: ['Asset admin'],
      allowed: admin,
      body: assetActionBodies.assign,
      apply: (ctx) => {
        const target = db.users.find(String(ctx.body.userId))
        if (!target?.active) throw validationProblem({ userId: 'Choose an active user.' })
        db.assetAssignments.insert({
          assetId: ctx.entity.id,
          userId: target.id,
          assignedById: ctx.user.id,
          assignedAt: ctx.now.toISOString(),
          note: (ctx.body.note as string | null) ?? null,
          acceptedAt: null,
          declinedAt: null,
          declineReason: null,
          unassignedAt: null,
          returnedAt: null,
          returnCondition: null,
          returnNote: null,
          lastRemindedAt: null,
          reminderCount: 0,
        })
        return { assignedUserId: target.id, ...touched(ctx) }
      },
      summary: (ctx) => summary(ctx, 'assign'),
      after: ({ updated, user, now }) => {
        const model = modelOf(updated)
        const due = new Date(now)
        due.setDate(due.getDate() + ACCEPTANCE_DUE_DAYS)
        db.notifications.insert({
          userId: updated.assignedUserId!,
          module: 'assets',
          ...assignmentPendingText({
            deviceType: typeOf(model).name.toLowerCase(),
            model: model.name,
            assetTag: assetTag(updated.number),
            serialNumber: updated.serialNumber,
            assignedBy: user.displayName,
            dueDate: due.toISOString().slice(0, 10),
            assetId: updated.id,
          }),
          priority: 'normal',
          readAt: null,
          createdAt: now.toISOString(),
        })
      },
    },
    {
      event: 'accept',
      from: ['pending_acceptance'],
      to: 'in_use',
      label: 'Accept',
      actors: ['Assigned user'],
      allowed: assignee,
      body: assetActionBodies.accept,
      apply: (ctx) => {
        const model = modelOf(ctx.entity)
        const type = typeOf(model)
        const platformId = (ctx.body.platformId as string | null | undefined) ?? null
        if (type.requiresPlatform && !platformId) {
          throw validationProblem({ platformId: 'Choose the platform installed on the device.' })
        }
        if (platformId) {
          const platform = db.assetPlatforms.find(platformId)
          if (!platform || platform.archivedAt || !platform.deviceTypeIds.includes(type.id)) {
            throw validationProblem({
              platformId: 'This platform is not available for this device.',
            })
          }
        }
        updateOpen(ctx.entity.id, { acceptedAt: ctx.now.toISOString() })
        return {
          platformId: platformId ?? ctx.entity.platformId,
          costCenterId: db.users.find(ctx.user.id)!.costCenterId,
          ...touched(ctx),
        }
      },
      summary: (ctx) => summary(ctx, 'accept'),
    },
    {
      event: 'decline',
      from: ['pending_acceptance'],
      to: 'in_stock',
      label: 'Decline',
      actors: ['Assigned user'],
      allowed: assignee,
      body: assetActionBodies.decline,
      apply: (ctx) =>
        release(ctx, {
          declinedAt: ctx.now.toISOString(),
          declineReason: String(ctx.body.reason),
        }),
      summary: (ctx) => summary(ctx, 'decline'),
    },
    {
      event: 'unassign',
      from: ['pending_acceptance'],
      to: 'in_stock',
      label: 'Unassign',
      actors: ['Asset admin'],
      allowed: admin,
      body: assetActionBodies.unassign,
      apply: (ctx) => release(ctx, { unassignedAt: ctx.now.toISOString() }),
      summary: (ctx) => summary(ctx, 'unassign'),
    },
    {
      event: 'return',
      from: ['in_use'],
      to: ['in_stock', 'in_repair'],
      resolveTo: (ctx) => (ctx.body.condition === 'damaged' ? 'in_repair' : 'in_stock'),
      label: 'Return',
      actors: ['Asset admin'],
      allowed: admin,
      body: assetActionBodies.return,
      apply: (ctx) =>
        release(ctx, {
          returnedAt: ctx.now.toISOString(),
          returnCondition: ctx.body.condition as 'ok' | 'damaged',
          returnNote: (ctx.body.note as string | null) ?? null,
        }),
      summary: (ctx) => summary(ctx, 'return'),
      after: ({ entity, body, now }) => {
        if (!entity.assignedUserId) return
        db.notifications.insert({
          userId: entity.assignedUserId,
          module: 'assets',
          ...returnedText({
            model: modelOf(entity).name,
            assetTag: assetTag(entity.number),
            condition: body.condition as 'ok' | 'damaged',
          }),
          priority: 'normal',
          readAt: null,
          createdAt: now.toISOString(),
        })
      },
    },
    {
      event: 'send_to_repair',
      from: ['in_stock', 'in_use'],
      to: 'in_repair',
      label: 'Send to repair',
      actors: ['Asset admin'],
      allowed: admin,
      body: assetActionBodies.send_to_repair,
      apply: touched,
      summary: (ctx) => summary(ctx, 'send_to_repair'),
    },
    {
      event: 'complete_repair',
      from: ['in_repair'],
      to: ['in_use', 'in_stock'],
      resolveTo: (ctx) => (openAssignment(ctx.entity.id)?.acceptedAt ? 'in_use' : 'in_stock'),
      label: 'Complete repair',
      actors: ['Asset admin'],
      allowed: admin,
      body: assetActionBodies.complete_repair,
      apply: touched,
      summary: (ctx) => summary(ctx, 'complete_repair'),
    },
    {
      event: 'scrap',
      from: ['in_stock', 'in_repair'],
      to: 'scrapped',
      label: 'Scrap',
      actors: ['Asset admin'],
      allowed: admin,
      body: assetActionBodies.scrap,
      apply: (ctx) => release(ctx, { returnedAt: ctx.now.toISOString() }),
      summary: (ctx) => summary(ctx, 'scrap'),
    },
  ],
  capabilities: {
    edit: (asset, user) => !asset.deletedAt && asset.status !== 'scrapped' && isAssetAdmin(user),
    delete: (asset, user) =>
      !asset.deletedAt && ['in_stock', 'scrapped'].includes(asset.status) && isAssetAdmin(user),
  },
})
