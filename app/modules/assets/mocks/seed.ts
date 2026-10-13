import type { ActingAs, FieldChange } from '~/types/api'
import { defineMockSeed, type SeedContext } from '~/mocks/define'
import { recordAudit } from '~/mocks/core/audit'
import { COST_CENTERS, DEFAULT_ASSET_COST_CENTER_ID, SEED_USERS, USER_IDS } from '~/mocks/core/seed'
import { ASSET_FIELD_LABELS, assetSummary, assetTag } from './audit-text'
import { acceptanceReminderText, assignmentPendingText, returnedText } from './notify-text'
import {
  planAssets,
  SEED_DEVICE_TYPES,
  SEED_MANUFACTURERS,
  SEED_MODELS,
  SEED_PLATFORMS,
  type SeedAssetSpec,
  type SeedEvent,
} from './plan'
import type { AssetAssignmentRecord, AssetRecord } from './types'

/** Local time of day per event type (hh, mm); a per-asset minute jitter is added. */
const TIME_OF_DAY: Record<SeedEvent['t'], [number, number]> = {
  create: [9, 5],
  assign: [10, 15],
  accept: [14, 30],
  decline: [11, 40],
  unassign: [16, 0],
  return: [13, 20],
  send_to_repair: [14, 5],
  complete_repair: [11, 10],
  scrap: [12, 0],
  delete: [12, 30],
  update: [16, 40],
  cost_center_sync: [2, 0],
  remind: [7, 40],
}

const DUE_DAYS = 7
const REMINDER_MAX = 3
const ADMIN = 'arne'

const userId = (handle: string): string => {
  const id = USER_IDS[handle]
  if (!id) throw new Error(`[assets seed] unknown user handle "${handle}"`)
  return id
}
const seedUser = (id: string) => SEED_USERS.find((user) => user.id === id)!
const displayName = (id: string) => {
  const user = seedUser(id)
  return `${user.firstName} ${user.lastName}`
}
const ccId = (code: string) => COST_CENTERS.find((cc) => cc.code === code)!.id
const ccLabel = (id: string) => {
  const cc = COST_CENTERS.find((row) => row.id === id)!
  return `${cc.code} ${cc.name}`
}
const actingAsOf = (id: string): ActingAs => {
  const roles = seedUser(id).roles
  if (roles.includes('it_admin')) return 'admin'
  if (roles.includes('asset_admin')) return 'back_office'
  return 'self'
}
const later = (iso: string, hours: number) =>
  new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString()

/**
 * Assets demo data (SPEC §10.4) — the backend seed replayed in the browser: the catalogue, 120
 * assets with assignments, audit timelines (field diffs, cost-centre syncs, reminders) and the
 * in-app notifications of the story records. S-A1/S-A2 (Emma's pending laptop and phone) and
 * S-A3/S-A4 (her monitor and headset) keep their numbers AST-00118, -00115, -00064, -00071.
 */
export default defineMockSeed({
  order: 100,
  run(ctx) {
    seedCatalogue(ctx)
    seedAssets(ctx)
  },
})

function seedCatalogue(ctx: SeedContext) {
  const { db } = ctx
  const typeId = (code: string) => db.assetDeviceTypes.first((t) => t.code === code)!.id
  for (const t of SEED_DEVICE_TYPES) db.assetDeviceTypes.insert({ id: ctx.uuid(), ...t })
  for (const m of SEED_MANUFACTURERS) {
    db.assetManufacturers.insert({
      id: ctx.uuid(),
      name: m.name,
      deviceTypeIds: m.types.map(typeId),
      archivedAt: null,
    })
  }
  for (const p of SEED_PLATFORMS) {
    db.assetPlatforms.insert({
      id: ctx.uuid(),
      name: p.name,
      deviceTypeIds: p.types.map(typeId),
      archivedAt: p.archived ? ctx.at(-150, 11) : null,
    })
  }
  for (const m of SEED_MODELS) {
    db.assetModels.insert({
      id: ctx.uuid(),
      name: m.name,
      manufacturerId: db.assetManufacturers.first((row) => row.name === m.manufacturer)!.id,
      deviceTypeId: typeId(m.type),
      storageGb: m.storageGb ?? null,
      color: m.color ?? null,
      archivedAt: m.archived ? ctx.at(-200, 11) : null,
      createdById: userId(ADMIN),
      createdAt: ctx.at(-900, 9),
    })
  }
}

function seedAssets(ctx: SeedContext) {
  const { db } = ctx
  const specs = planAssets((min, max) => ctx.faker.number.int({ min, max }))

  // Story records keep their numbers; the rest are numbered by purchase date.
  const reserved = new Set(specs.flatMap((s) => (s.number ? [s.number] : [])))
  const numberOf = new Map<SeedAssetSpec, number>(
    specs.filter((s) => s.number).map((s) => [s, s.number!]),
  )
  let next = 1
  const byAge = specs
    .map((spec, index) => ({ spec, index }))
    .filter(({ spec }) => !spec.number)
    .sort((a, b) => a.spec.events[0]!.day - b.spec.events[0]!.day || a.index - b.index)
  for (const { spec } of byAge) {
    while (reserved.has(next)) next++
    numberOf.set(spec, next++)
  }

  const isWeekend = (offset: number) =>
    [0, 6].includes(new Date(`${ctx.d(offset)}T12:00:00`).getDay())
  /** Reminder jobs run on weekdays only (SPEC_RESOLUTIONS #21). */
  const weekdayOffset = (offset: number) => {
    let o = offset
    while (isWeekend(o)) o++
    if (o > 0) {
      o = offset
      while (isWeekend(o)) o--
    }
    return o
  }

  const serials = new Set<string>()
  specs.forEach((spec, index) => {
    const model = db.assetModels.first((m) => m.name === spec.model)
    if (!model) throw new Error(`[assets seed] unknown model ${spec.model}`)
    const type = db.assetDeviceTypes.find(model.deviceTypeId)!
    const plan = SEED_MODELS.find((m) => m.name === spec.model)!
    const manufacturer = SEED_MANUFACTURERS.find((m) => m.name === plan.manufacturer)!
    const number = numberOf.get(spec)!
    const label = `${assetTag(number)} · ${spec.model}`
    const jitter = (index * 7) % 50
    const when = (e: SeedEvent) => {
      const [hh, mm] = TIME_OF_DAY[e.t]
      if (e.t === 'remind') return ctx.at(weekdayOffset(e.day), hh, mm + (index % 5))
      if (e.t === 'cost_center_sync') return ctx.at(e.day, hh, index % 10)
      return ctx.at(e.day, hh, mm + jitter)
    }

    let serial: string
    do {
      serial = `${manufacturer.serialPrefix}${ctx.faker.string.alphanumeric({ length: 7, casing: 'upper' })}`
    } while (serials.has(serial))
    serials.add(serial)
    const typo = `${serial.slice(0, -2)}${serial.at(-1)}${serial.at(-2)}`
    const fixesTypo = spec.events.some((e) => e.t === 'update' && e.set.serialNumber === 'fix_typo')

    const created = spec.events[0]!
    const createdAt = when(created)
    const creator = userId(('by' in created && created.by) || ADMIN)
    const assetId = ctx.uuid()
    const prefix = type.code === 'laptop' ? 'LT' : type.code === 'desktop' ? 'DT' : null
    const asset: AssetRecord = {
      id: assetId,
      number,
      serialNumber: fixesTypo && typo !== serial ? typo : serial,
      name: prefix ? `${prefix}-${String(number).padStart(4, '0')}` : null,
      modelId: model.id,
      platformId: null,
      status: 'in_stock',
      assignedUserId: null,
      costCenterId: DEFAULT_ASSET_COST_CENTER_ID,
      purchaseDate: ctx.d(created.day),
      mdmEnrolled: type.requiresPlatform,
      notes: null,
      createdById: creator,
      updatedById: creator,
      deletedAt: null,
      deletedById: null,
      version: 1,
      createdAt,
      updatedAt: createdAt,
    }
    let open: AssetAssignmentRecord | null = null
    const assignments: AssetAssignmentRecord[] = []
    const reminders: string[] = []

    const audit = (
      e: SeedEvent,
      at: string,
      actorId: string | null,
      from: string | null,
      extra: { reason?: string | null; changes?: FieldChange[]; assignee?: string } = {},
    ) => {
      const actingAs: ActingAs = actorId ? actingAsOf(actorId) : 'system'
      recordAudit(db, {
        module: 'assets',
        entityType: 'asset',
        entityId: assetId,
        entityLabel: label,
        action: e.t,
        actorId,
        actingAs,
        fromState: from,
        toState: ['update', 'cost_center_sync', 'remind'].includes(e.t) ? null : asset.status,
        reason: extra.reason ?? null,
        changes: extra.changes ?? null,
        summary: assetSummary(actorId ? displayName(actorId) : null, e.t, actingAs, extra.assignee),
        occurredAt: at,
        correlationId: 'seed',
      })
    }
    const close = (patch: Partial<AssetAssignmentRecord>) => {
      if (!open) return
      Object.assign(open, patch)
      open = null
      asset.assignedUserId = null
      asset.costCenterId = DEFAULT_ASSET_COST_CENTER_ID
    }
    const touch = (at: string, actorId: string | null) => {
      asset.updatedAt = at
      if (actorId) asset.updatedById = actorId
      asset.version++
    }

    audit(created, createdAt, creator, null)
    for (const e of spec.events.slice(1)) {
      const at = when(e)
      const from = asset.status
      const admin = userId(('by' in e && e.by) || ADMIN)
      switch (e.t) {
        case 'assign': {
          const holder = userId(e.to)
          open = {
            id: ctx.uuid(),
            assetId,
            userId: holder,
            assignedById: admin,
            assignedAt: at,
            note: e.note ?? null,
            acceptedAt: null,
            declinedAt: null,
            declineReason: null,
            unassignedAt: null,
            returnedAt: null,
            returnCondition: null,
            returnNote: null,
            lastRemindedAt: null,
            reminderCount: 0,
          }
          assignments.push(open)
          asset.status = 'pending_acceptance'
          asset.assignedUserId = holder
          touch(at, admin)
          audit(e, at, admin, from, { reason: e.note ?? null, assignee: displayName(holder) })
          break
        }
        case 'accept': {
          const current = open as AssetAssignmentRecord | null
          if (!current) throw new Error(`[assets seed] ${label}: accept without assignment`)
          const holder = seedUser(current.userId)
          current.acceptedAt = at
          asset.status = 'in_use'
          asset.costCenterId = e.cc ? ccId(e.cc) : ccId(holder.costCenterCode)
          if (type.requiresPlatform && plan.platform) {
            asset.platformId = db.assetPlatforms.first((p) => p.name === plan.platform)!.id
          }
          touch(at, holder.id)
          audit(e, at, holder.id, from)
          break
        }
        case 'decline': {
          const holder = (open as AssetAssignmentRecord | null)?.userId ?? null
          asset.status = 'in_stock'
          close({ declinedAt: at, declineReason: e.reason })
          touch(at, holder)
          audit(e, at, holder, from, { reason: e.reason })
          break
        }
        case 'unassign':
          asset.status = 'in_stock'
          close({ unassignedAt: at })
          touch(at, admin)
          audit(e, at, admin, from, { reason: e.reason ?? null })
          break
        case 'return':
          asset.status = e.condition === 'damaged' ? 'in_repair' : 'in_stock'
          close({ returnedAt: at, returnCondition: e.condition, returnNote: e.note ?? null })
          touch(at, admin)
          audit(e, at, admin, from, { reason: e.note ?? null })
          break
        case 'send_to_repair':
          asset.status = 'in_repair'
          touch(at, admin)
          audit(e, at, admin, from, { reason: e.note })
          break
        case 'complete_repair':
          asset.status = (open as AssetAssignmentRecord | null)?.acceptedAt ? 'in_use' : 'in_stock'
          touch(at, admin)
          audit(e, at, admin, from, { reason: e.note ?? null })
          break
        case 'scrap':
          asset.status = 'scrapped'
          close({ returnedAt: at })
          touch(at, admin)
          audit(e, at, admin, from, { reason: e.reason })
          break
        case 'delete':
          asset.deletedAt = at
          asset.deletedById = admin
          touch(at, admin)
          audit(e, at, admin, from)
          break
        case 'update': {
          const changes: FieldChange[] = []
          if (e.set.serialNumber === 'fix_typo' && asset.serialNumber !== serial) {
            changes.push({
              field: 'serialNumber',
              label: ASSET_FIELD_LABELS.serialNumber!,
              from: asset.serialNumber,
              to: serial,
            })
            asset.serialNumber = serial
          }
          if (e.set.notes !== undefined) {
            changes.push({
              field: 'notes',
              label: ASSET_FIELD_LABELS.notes!,
              from: asset.notes,
              to: e.set.notes,
            })
            asset.notes = e.set.notes
          }
          if (e.set.name !== undefined) {
            changes.push({
              field: 'name',
              label: ASSET_FIELD_LABELS.name!,
              from: asset.name,
              to: e.set.name,
            })
            asset.name = e.set.name
          }
          if (!changes.length) break
          touch(at, admin)
          audit(e, at, admin, null, { changes })
          break
        }
        case 'cost_center_sync': {
          const fromCc = ccLabel(asset.costCenterId)
          asset.costCenterId = ccId(e.to)
          touch(at, null)
          audit(e, at, null, null, {
            changes: [
              {
                field: 'costCenter',
                label: 'Cost centre',
                from: fromCc,
                to: ccLabel(asset.costCenterId),
              },
            ],
          })
          break
        }
        case 'remind': {
          const current = open as AssetAssignmentRecord | null
          if (!current) throw new Error(`[assets seed] ${label}: reminder without assignment`)
          current.reminderCount++
          current.lastRemindedAt = at
          reminders.push(at)
          audit(e, at, null, null)
          break
        }
        case 'create':
          throw new Error(`[assets seed] ${label}: duplicate create`)
      }
    }

    db.assets.insert(asset)
    for (const a of assignments) db.assetAssignments.insert(a)
    seedNotifications(ctx, {
      asset,
      spec,
      deviceType: type.name.toLowerCase(),
      assignments,
      reminders,
    })
  })
}

/** In-app notifications of the story records (SPEC_RESOLUTIONS #7), like the backend seed. */
function seedNotifications(
  ctx: SeedContext,
  input: {
    asset: AssetRecord
    spec: SeedAssetSpec
    deviceType: string
    assignments: AssetAssignmentRecord[]
    reminders: string[]
  },
) {
  const { asset, spec, deviceType, assignments, reminders } = input
  const tag = assetTag(asset.number)
  const pending = asset.status === 'pending_acceptance' ? assignments.at(-1) : undefined
  if (pending) {
    const assignDay = spec.events.find((e) => e.t === 'assign')!.day
    const unread = [userId('emma'), userId('sdkAgent5')].includes(pending.userId) && assignDay >= -2
    ctx.db.notifications.insert({
      id: ctx.uuid(),
      userId: pending.userId,
      module: 'assets',
      ...assignmentPendingText({
        deviceType,
        model: spec.model,
        assetTag: tag,
        serialNumber: asset.serialNumber,
        assignedBy: displayName(pending.assignedById),
        dueDate: ctx.d(assignDay + DUE_DAYS),
        assetId: asset.id,
      }),
      priority: 'normal',
      readAt: unread ? null : later(pending.assignedAt, 5),
      createdAt: pending.assignedAt,
    })
    reminders.forEach((at, i) =>
      ctx.db.notifications.insert({
        id: ctx.uuid(),
        userId: pending.userId,
        module: 'assets',
        ...acceptanceReminderText({
          deviceType,
          model: spec.model,
          assetTag: tag,
          assignedOn: ctx.d(assignDay),
          reminder: i + 1,
          reminderMax: REMINDER_MAX,
          assetId: asset.id,
        }),
        priority: i + 1 >= 2 ? 'high' : 'normal',
        readAt: i === reminders.length - 1 ? null : later(at, 3),
        createdAt: at,
      }),
    )
  }
  for (const a of assignments) {
    if (!a.returnedAt || !a.returnCondition) continue
    const returnedAt = new Date(a.returnedAt).getTime()
    if (returnedAt < new Date(ctx.at(-30, 0)).getTime() || !seedUser(a.userId).active) continue
    ctx.db.notifications.insert({
      id: ctx.uuid(),
      userId: a.userId,
      module: 'assets',
      ...returnedText({ model: spec.model, assetTag: tag, condition: a.returnCondition }),
      priority: 'normal',
      readAt: returnedAt < new Date(ctx.at(-14, 0)).getTime() ? later(a.returnedAt, 20) : null,
      createdAt: a.returnedAt,
    })
  }
}
