import type { EnumOption, InboxItem, SearchHit } from '~/types/api'
import { recordAudit } from '~/mocks/core/audit'
import type { MockUser } from '~/mocks/core/types'
import { defineMockProviders } from '~/mocks/define'
import { db } from '~/mocks/db'
import { assetTag } from './audit-text'
import { acceptanceReminderText } from './notify-text'
import {
  acceptanceDueAt,
  isAcceptanceOverdue,
  isAssetAdmin,
  modelOf,
  openAssignment,
  REMINDER_DAYS,
  REMINDER_MAX,
  typeOf,
} from './store'
import { assetWorkflow } from './workflow'

/**
 * Asset contributions to foundation endpoints (mirrors the backend providers): workflow diagram,
 * enums, inbox (`assets.acceptance_required`), search, my-day fragment, queue counts and jobs.
 */
const o = (
  value: string,
  label: string,
  tone: EnumOption['tone'] = null,
  description: string | null = null,
): EnumOption => ({ value, label, tone, description })

const STATUS_LABELS: Record<string, string> = {
  in_stock: 'In stock',
  pending_acceptance: 'Waiting for acceptance',
  in_use: 'In use',
  in_repair: 'In repair',
  scrapped: 'Scrapped',
}

/** Calendar days between two instants (local days). */
const daysAgo = (iso: string, now: Date) => {
  const a = new Date(iso)
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((end - start) / 86_400_000)
}

function pendingFor(user: MockUser) {
  return db.assets
    .where((a) => a.assignedUserId === user.id && a.status === 'pending_acceptance' && !a.deletedAt)
    .flatMap((asset) => {
      const open = openAssignment(asset.id)
      return open && !open.acceptedAt ? [{ asset, open }] : []
    })
}

function costCenterSync() {
  let updated = 0
  const candidates = db.assets.where(
    (a) =>
      !a.deletedAt &&
      (a.status === 'in_use' || a.status === 'in_repair') &&
      a.assignedUserId !== null,
  )
  for (const asset of candidates) {
    if (!openAssignment(asset.id)?.acceptedAt) continue
    const holder = db.users.find(asset.assignedUserId!)
    if (!holder || holder.costCenterId === asset.costCenterId) continue
    const from = db.costCenters.find(asset.costCenterId)!
    const to = db.costCenters.find(holder.costCenterId)!
    db.assets.update(asset.id, { costCenterId: to.id, version: asset.version + 1 })
    recordAudit(db, {
      module: 'assets',
      entityType: 'asset',
      entityId: asset.id,
      entityLabel: `${assetTag(asset.number)} · ${modelOf(asset).name}`,
      action: 'cost_center_sync',
      actorId: null,
      actingAs: 'system',
      changes: [
        {
          field: 'costCenter',
          label: 'Cost centre',
          from: `${from.code} ${from.name}`,
          to: `${to.code} ${to.name}`,
        },
      ],
      summary: 'Atrium synced the cost centre',
    })
    updated++
  }
  return { checked: candidates.length, updated }
}

function acceptanceReminders(now: Date) {
  let reminded = 0
  let skippedMax = 0
  for (const asset of db.assets.where((a) => a.status === 'pending_acceptance' && !a.deletedAt)) {
    const open = openAssignment(asset.id)
    if (!open || open.acceptedAt || daysAgo(open.assignedAt, now) < REMINDER_DAYS) continue
    if (open.reminderCount >= REMINDER_MAX) {
      skippedMax++
      continue
    }
    if (open.lastRemindedAt && daysAgo(open.lastRemindedAt, now) < REMINDER_DAYS) continue
    const reminder = open.reminderCount + 1
    db.assetAssignments.update(open.id, {
      reminderCount: reminder,
      lastRemindedAt: now.toISOString(),
    })
    const model = modelOf(asset)
    db.notifications.insert({
      userId: open.userId,
      module: 'assets',
      ...acceptanceReminderText({
        deviceType: typeOf(model).name.toLowerCase(),
        model: model.name,
        assetTag: assetTag(asset.number),
        assignedOn: open.assignedAt.slice(0, 10),
        reminder,
        reminderMax: REMINDER_MAX,
        assetId: asset.id,
      }),
      priority: reminder >= 2 ? 'high' : 'normal',
      readAt: null,
      createdAt: now.toISOString(),
    })
    recordAudit(db, {
      module: 'assets',
      entityType: 'asset',
      entityId: asset.id,
      entityLabel: `${assetTag(asset.number)} · ${model.name}`,
      action: 'remind',
      actorId: null,
      actingAs: 'system',
      summary: 'Atrium sent an acceptance reminder',
    })
    reminded++
  }
  return { reminded, skippedMax }
}

export default defineMockProviders({
  workflows: [assetWorkflow],
  enums: {
    assetStatus: [
      o('in_stock', 'In stock', 'neutral'),
      o('pending_acceptance', 'Waiting for acceptance', 'waiting'),
      o('in_use', 'In use', 'positive'),
      o('in_repair', 'In repair', 'blocked'),
      o('scrapped', 'Scrapped', 'neutral'),
    ],
    returnCondition: [
      o('ok', 'OK', 'positive', 'Back to stock'),
      o('damaged', 'Damaged', 'negative', 'Goes to repair'),
    ],
  },

  inbox: (user): InboxItem[] =>
    pendingFor(user).map(({ asset, open }) => {
      const model = modelOf(asset)
      return {
        id: `assets.acceptance_required:${asset.id}`,
        module: 'assets',
        type: 'assets.acceptance_required',
        reference: assetTag(asset.number),
        title: `Confirm your new ${typeOf(model).name.toLowerCase()}`,
        subtitle: `${model.name} · ${assetTag(asset.number)}`,
        dueAt: acceptanceDueAt(open.assignedAt).toISOString(),
        priority: open.reminderCount >= 2 ? 'high' : 'normal',
        actingAs: null,
        link: `/assets/${asset.id}`,
        actionsPath: `/assets/${asset.id}`,
        entityId: asset.id,
        createdAt: open.assignedAt,
        quickActions: [],
      }
    }),

  search: (user, q): SearchHit[] => {
    const admin = isAssetAdmin(user)
    const term = q.trim().toLowerCase()
    const tag = /^ast-(\d{1,9})$/i.exec(term)?.[1]
    return db.assets
      .where(
        (a) =>
          !a.deletedAt &&
          (admin || a.assignedUserId === user.id) &&
          (tag
            ? a.number === Number(tag)
            : a.serialNumber.toLowerCase().includes(term) ||
              (a.name?.toLowerCase().includes(term) ?? false)),
      )
      .sort((a, b) => a.number - b.number)
      .slice(0, 5)
      .map((a) => {
        const holder = admin && a.assignedUserId ? db.users.find(a.assignedUserId) : undefined
        return {
          module: 'assets',
          type: 'asset',
          id: a.id,
          reference: assetTag(a.number),
          title: modelOf(a).name,
          subtitle: [`Serial ${a.serialNumber}`, STATUS_LABELS[a.status], holder?.displayName]
            .filter(Boolean)
            .join(' · '),
          link: admin ? `/back-office/assets/inventory/${a.id}` : `/assets/${a.id}`,
        }
      })
  },

  myDay: (user) => ({
    assets: {
      active: db.assets.count(
        (a) =>
          a.assignedUserId === user.id &&
          !a.deletedAt &&
          (a.status === 'in_use' || a.status === 'in_repair'),
      ),
      pendingAcceptance: pendingFor(user).length,
    },
  }),

  counts: (user) => {
    const pending = db.assets.where((a) => !a.deletedAt && a.status === 'pending_acceptance')
    return {
      mine: { pending: pendingFor(user).length },
      admin: isAssetAdmin(user)
        ? {
            pendingAcceptance: pending.length,
            acceptanceOverdue: pending.filter((a) => {
              const open = openAssignment(a.id)
              return Boolean(open && !open.acceptedAt && isAcceptanceOverdue(open.assignedAt))
            }).length,
            inRepair: db.assets.count((a) => !a.deletedAt && a.status === 'in_repair'),
            inStock: db.assets.count((a) => !a.deletedAt && a.status === 'in_stock'),
          }
        : null,
    }
  },

  jobs: [
    {
      name: 'assets.cost-center-sync',
      description:
        "Copies the assigned user's cost centre onto accepted devices (in use or in repair) where it differs.",
      slice: 'A3',
      cron: '0 2 * * *',
      run: () => costCenterSync(),
    },
    {
      name: 'assets.acceptance-reminders',
      description:
        'Reminds users to accept devices that have been waiting for acceptance for a few days.',
      slice: 'A3',
      // Reminder crons are off in demo mode (SPEC_RESOLUTIONS #10); "Run now" demonstrates it.
      cron: null,
      enabled: false,
      run: ({ now }) => acceptanceReminders(now),
    },
  ],
})
