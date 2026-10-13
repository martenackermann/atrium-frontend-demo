import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { diffFields, recordAudit, timelineFor, toTimelineEntry } from '~/mocks/core/audit'
import type { MockUser } from '~/mocks/core/types'
import { defineMockHandlers } from '~/mocks/define'
import { db } from '~/mocks/db'
import {
  conflict,
  created,
  forbidden,
  invalidTransition,
  noContent,
  notFound,
  ok,
  param,
  readJson,
  requireUser,
  userHasRole,
  validationProblem,
} from '~/mocks/http'
import { csv, listResponse, listResult } from '~/mocks/list'
import type { AssetAction, AssetDashboard, AssetStatus } from '../api/types'
import { ASSET_FIELD_LABELS, assetSummary, assetTag } from './audit-text'
import {
  defaultCostCenterId,
  isAcceptanceOverdue,
  isAssetAdmin,
  modelOf,
  openAssignment,
  toAssignmentDto,
  toDetail,
  toDeviceTypeDto,
  toListItem,
  toModelDto,
  visibleAsset,
} from './store'
import type { AssetRecord } from './types'
import { assetWorkflow } from './workflow'

/**
 * `/assets/*` for demo mode (API.md §6) with the backend's rules: visibility (404), admin-only
 * endpoints (403), 422 field errors, 409 serial_taken / model_in_use / in_use / version_conflict.
 */
const STATUSES: AssetStatus[] = [
  'in_stock',
  'pending_acceptance',
  'in_use',
  'in_repair',
  'scrapped',
]

const actions = (asset: AssetRecord, user: MockUser) =>
  assetWorkflow.availableActions(asset, user) as AssetAction[]
const detail = (asset: AssetRecord, user: MockUser) => toDetail(asset, user, actions(asset, user))
const item = (asset: AssetRecord, user: MockUser) => toListItem(asset, actions(asset, user))

function requireAdmin(request: Request): MockUser {
  const user = requireUser(request)
  if (!isAssetAdmin(user)) throw forbidden('Only asset admins can do this.')
  return user
}
const actingAs = (user: MockUser) => (userHasRole(user, 'it_admin') ? 'admin' : 'back_office')
const label = (asset: AssetRecord) => `${assetTag(asset.number)} · ${modelOf(asset).name}`
const nowIso = () => new Date().toISOString()

// --- list filters (API.md §6.1) ---------------------------------------------------------------

function filteredAssets(request: Request): AssetRecord[] {
  const params = new URL(request.url).searchParams
  const includeDeleted = params.get('includeDeleted') === 'true'
  const statuses = csv(params, 'status')
  if (statuses.some((s) => !STATUSES.includes(s as AssetStatus))) {
    throw validationProblem({ status: 'Choose a valid status.' })
  }
  const types = csv(params, 'deviceTypeId')
  const manufacturers = csv(params, 'manufacturerId')
  const from = params.get('from')
  const to = params.get('to')
  const q = params.get('q')?.trim().toLowerCase() ?? ''
  const tag = /^ast-(\d{1,9})$/i.exec(q)?.[1]
  return db.assets.where((asset) => {
    if (!includeDeleted && asset.deletedAt) return false
    if (statuses.length && !statuses.includes(asset.status)) return false
    const model = modelOf(asset)
    if (types.length && !types.includes(model.deviceTypeId)) return false
    if (manufacturers.length && !manufacturers.includes(model.manufacturerId)) return false
    if (from && (!asset.purchaseDate || asset.purchaseDate < from)) return false
    if (to && (!asset.purchaseDate || asset.purchaseDate > to)) return false
    if (tag) return asset.number === Number(tag)
    if (q) {
      const holder = asset.assignedUserId ? db.users.find(asset.assignedUserId) : undefined
      const text = [asset.serialNumber, asset.name, holder?.displayName, holder?.email]
        .join(' ')
        .toLowerCase()
      if (!text.includes(q)) return false
    }
    return true
  })
}

const LIST_OPTIONS = {
  filters: {
    modelId: 'modelId' as const,
    platformId: 'platformId' as const,
    assignedUserId: 'assignedUserId' as const,
    costCenterId: 'costCenterId' as const,
  },
  sort: {
    assetTag: (a: AssetRecord) => a.number,
    serialNumber: (a: AssetRecord) => a.serialNumber,
    status: (a: AssetRecord) => STATUSES.indexOf(a.status),
    purchaseDate: (a: AssetRecord) => a.purchaseDate,
    updatedAt: (a: AssetRecord) => a.updatedAt,
    model: (a: AssetRecord) => modelOf(a).name,
  },
  defaultSort: '-updatedAt',
}

const csvCell = (value: string | null | undefined) => {
  if (value === null || value === undefined) return ''
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

// --- bodies -----------------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null))
const createAssetSchema = z.strictObject({
  serialNumber: z.string().trim().min(1, 'Enter the serial number.').max(80),
  name: optionalText(120),
  modelId: z.uuid('Choose a model.'),
  platformId: z.uuid().nullish(),
  purchaseDate: z.iso.date().nullish(),
  costCenterId: z.uuid().nullish(),
  mdmEnrolled: z.boolean().optional(),
  notes: optionalText(2000),
  assignToUserId: z.uuid().nullish(),
})
const updateAssetSchema = z.strictObject({
  serialNumber: z.string().trim().min(1, 'Enter the serial number.').max(80).optional(),
  name: optionalText(120).optional(),
  modelId: z.uuid().optional(),
  platformId: z.uuid().nullish(),
  purchaseDate: z.iso.date().nullish(),
  costCenterId: z.uuid().nullish(),
  mdmEnrolled: z.boolean().optional(),
  notes: optionalText(2000).optional(),
  version: z.number().int().optional(),
})
const deviceTypeSchema = z.strictObject({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, 'Use at least 2 characters.')
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, digits and underscores.'),
  name: z.string().trim().min(1, 'Enter a name.').max(120),
  requiresPlatform: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
})
const namedSchema = z.strictObject({
  name: z.string().trim().min(1, 'Enter a name.').max(120),
  deviceTypeIds: z.array(z.uuid()).max(20),
  archived: z.boolean().optional(),
})
const modelSchema = z.strictObject({
  name: z.string().trim().min(1, 'Enter a name.').max(120),
  manufacturerId: z.uuid('Choose a manufacturer.'),
  deviceTypeId: z.uuid('Choose a device type.'),
  storageGb: z.number().int().min(1).nullish(),
  color: optionalText(40),
  archived: z.boolean().optional(),
})

function serialTaken(serial: string, exceptId?: string) {
  return db.assets.first(
    (a) => a.id !== exceptId && a.serialNumber.toLowerCase() === serial.toLowerCase(),
  )
}
function activeModel(id: string) {
  const model = db.assetModels.find(id)
  if (!model) throw validationProblem({ modelId: 'Choose a model from the catalogue.' })
  if (model.archivedAt) {
    throw validationProblem({ modelId: 'This model is archived. Choose an active model.' })
  }
  return model
}
function applicablePlatform(id: string, deviceTypeId: string, allowArchived = false) {
  const platform = db.assetPlatforms.find(id)
  if (
    !platform ||
    (!allowArchived && platform.archivedAt) ||
    !platform.deviceTypeIds.includes(deviceTypeId)
  ) {
    throw validationProblem({ platformId: 'This platform is not available for this device type.' })
  }
  return platform
}
function activeCostCenter(id: string) {
  const cc = db.costCenters.find(id)
  if (!cc?.active) throw validationProblem({ costCenterId: 'Choose an active cost centre.' })
  return cc
}
const ccLabel = (id: string) => {
  const cc = db.costCenters.find(id)!
  return `${cc.code} ${cc.name}`
}

const CATALOG_VERBS: Record<string, string> = {
  create: 'added',
  update: 'edited',
  delete: 'deleted',
  archive: 'archived',
  restore: 'restored',
}
function catalogAudit(
  user: MockUser,
  entityType: string,
  entityId: string,
  action: string,
  entityLabel: string,
) {
  recordAudit(db, {
    module: 'assets',
    entityType,
    entityId,
    entityLabel,
    action,
    actorId: user.id,
    actingAs: actingAs(user),
    summary: `${user.displayName} ${CATALOG_VERBS[action] ?? action} ${entityLabel}`,
  })
}
const archivePatch = (archived: boolean | undefined, current: string | null) =>
  archived === undefined ? {} : { archivedAt: archived ? (current ?? nowIso()) : null }
const archiveAction = (body: Record<string, unknown>) =>
  Object.keys(body).length === 1 && typeof body.archived === 'boolean'
    ? body.archived
      ? 'archive'
      : 'restore'
    : 'update'

export default defineMockHandlers(({ api }) => [
  // --- catalogue: device types ----------------------------------------------------------------
  http.get(api('/assets/catalog/device-types'), ({ request }) => {
    requireUser(request)
    return ok(
      db.assetDeviceTypes
        .all()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
        .map((t) => toDeviceTypeDto(t.id)),
    )
  }),
  http.post(api('/assets/catalog/device-types'), async ({ request }) => {
    const user = requireAdmin(request)
    const body = await readJson(request, deviceTypeSchema)
    if (db.assetDeviceTypes.first((t) => t.code === body.code)) {
      throw validationProblem({ code: 'A device type with this code already exists.' })
    }
    const row = db.assetDeviceTypes.insert(body)
    catalogAudit(user, 'device_type', row.id, 'create', row.name)
    return created(toDeviceTypeDto(row.id), api(`/assets/catalog/device-types/${row.id}`))
  }),
  http.patch(api('/assets/catalog/device-types/:id'), async ({ request, params }) => {
    const user = requireAdmin(request)
    const row = db.assetDeviceTypes.find(param(params.id))
    if (!row) throw notFound()
    const body = await readJson(request, deviceTypeSchema.partial())
    const duplicate = db.assetDeviceTypes.first((t) => t.id !== row.id && t.code === body.code)
    if (body.code && duplicate) {
      throw validationProblem({ code: 'A device type with this code already exists.' })
    }
    const updated = db.assetDeviceTypes.update(row.id, body)!
    catalogAudit(user, 'device_type', row.id, 'update', updated.name)
    return ok(toDeviceTypeDto(row.id))
  }),
  http.delete(api('/assets/catalog/device-types/:id'), ({ request, params }) => {
    const user = requireAdmin(request)
    const row = db.assetDeviceTypes.find(param(params.id))
    if (!row) throw notFound()
    const models = db.assetModels.count((m) => m.deviceTypeId === row.id)
    if (models > 0) {
      throw conflict(`${row.name} is used by ${models} model(s) and can't be deleted.`, 'in_use')
    }
    db.assetDeviceTypes.remove(row.id)
    for (const m of db.assetManufacturers.where((r) => r.deviceTypeIds.includes(row.id))) {
      db.assetManufacturers.update(m.id, {
        deviceTypeIds: m.deviceTypeIds.filter((id) => id !== row.id),
      })
    }
    for (const p of db.assetPlatforms.where((r) => r.deviceTypeIds.includes(row.id))) {
      db.assetPlatforms.update(p.id, {
        deviceTypeIds: p.deviceTypeIds.filter((id) => id !== row.id),
      })
    }
    catalogAudit(user, 'device_type', row.id, 'delete', row.name)
    return noContent()
  }),

  // --- catalogue: manufacturers and platforms --------------------------------------------------
  ...(['manufacturers', 'platforms'] as const).flatMap((kind) => {
    const collection = kind === 'manufacturers' ? db.assetManufacturers : db.assetPlatforms
    const entityType = kind === 'manufacturers' ? 'manufacturer' : 'platform'
    const toDto = (id: string) => {
      const row = collection.find(id)!
      const base = {
        id: row.id,
        name: row.name,
        deviceTypeIds: row.deviceTypeIds,
        archived: row.archivedAt !== null,
      }
      if (kind === 'platforms') {
        return { ...base, assetCount: db.assets.count((a) => a.platformId === id) }
      }
      const modelIds = new Set(
        db.assetModels.where((m) => m.manufacturerId === id).map((m) => m.id),
      )
      return {
        ...base,
        modelCount: modelIds.size,
        assetCount: db.assets.count((a) => modelIds.has(a.modelId)),
      }
    }
    const assertTypes = (ids: string[]) => {
      if (ids.some((id) => !db.assetDeviceTypes.exists(id))) {
        throw validationProblem({ deviceTypeIds: 'Choose device types from the list.' })
      }
    }
    /** A device type still used by this manufacturer's models / this platform's assets. */
    const blockingType = (id: string, removed: string[]) => {
      if (kind === 'manufacturers') {
        return db.assetModels.first(
          (m) => m.manufacturerId === id && removed.includes(m.deviceTypeId),
        )?.deviceTypeId
      }
      const asset = db.assets.first(
        (a) => a.platformId === id && removed.includes(modelOf(a).deviceTypeId),
      )
      return asset ? modelOf(asset).deviceTypeId : undefined
    }
    return [
      http.get(api(`/assets/catalog/${kind}`), ({ request }) => {
        requireUser(request)
        const params = new URL(request.url).searchParams
        const deviceTypeId = params.get('deviceTypeId')
        const includeArchived = params.get('includeArchived') === 'true'
        return ok(
          collection
            .where(
              (row) =>
                (includeArchived || !row.archivedAt) &&
                (!deviceTypeId || row.deviceTypeIds.includes(deviceTypeId)),
            )
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((row) => toDto(row.id)),
        )
      }),
      http.post(api(`/assets/catalog/${kind}`), async ({ request }) => {
        const user = requireAdmin(request)
        const body = await readJson(request, namedSchema)
        assertTypes(body.deviceTypeIds)
        if (collection.first((row) => row.name.toLowerCase() === body.name.toLowerCase())) {
          throw validationProblem({ name: `This ${entityType} already exists.` })
        }
        const row = collection.insert({
          name: body.name,
          deviceTypeIds: [...new Set(body.deviceTypeIds)],
          archivedAt: body.archived ? nowIso() : null,
        })
        catalogAudit(user, entityType, row.id, 'create', row.name)
        return created(toDto(row.id), api(`/assets/catalog/${kind}/${row.id}`))
      }),
      http.patch(api(`/assets/catalog/${kind}/:id`), async ({ request, params }) => {
        const user = requireAdmin(request)
        const row = collection.find(param(params.id))
        if (!row) throw notFound()
        const body = await readJson(request, namedSchema.partial())
        if (body.deviceTypeIds) {
          assertTypes(body.deviceTypeIds)
          const next = body.deviceTypeIds
          const removed = row.deviceTypeIds.filter((id) => !next.includes(id))
          const blocking = removed.length ? blockingType(row.id, removed) : undefined
          if (blocking) {
            const type = db.assetDeviceTypes.find(blocking)!
            throw validationProblem({
              deviceTypeIds: `${type.name} is still in use with this ${entityType}; keep that device type.`,
            })
          }
        }
        const name = body.name
        if (
          name &&
          collection.first((r) => r.id !== row.id && r.name.toLowerCase() === name.toLowerCase())
        ) {
          throw validationProblem({ name: `This ${entityType} already exists.` })
        }
        const updated = collection.update(row.id, {
          ...(name ? { name } : {}),
          ...(body.deviceTypeIds ? { deviceTypeIds: [...new Set(body.deviceTypeIds)] } : {}),
          ...archivePatch(body.archived, row.archivedAt),
        })!
        catalogAudit(user, entityType, row.id, archiveAction(body), updated.name)
        return ok(toDto(row.id))
      }),
    ]
  }),

  // --- catalogue: models ---------------------------------------------------------------------
  http.get(api('/assets/catalog/models'), ({ request }) => {
    requireUser(request)
    const params = new URL(request.url).searchParams
    const includeArchived = params.get('includeArchived') === 'true'
    const rows = db.assetModels
      .where((m) => includeArchived || !m.archivedAt)
      .map((m) => ({
        ...toModelDto(m),
        manufacturerId: m.manufacturerId,
        deviceTypeId: m.deviceTypeId,
      }))
    return listResponse(rows, request, {
      filters: { deviceTypeId: 'deviceTypeId', manufacturerId: 'manufacturerId' },
      search: (m) => `${m.name} ${m.manufacturer.name}`,
      sort: { name: 'name', assetCount: 'assetCount' },
      defaultSort: 'name',
      map: ({ manufacturerId: _manufacturerId, deviceTypeId: _deviceTypeId, ...dto }) => dto,
    })
  }),
  http.post(api('/assets/catalog/models'), async ({ request }) => {
    const user = requireAdmin(request)
    const body = await readJson(request, modelSchema)
    const manufacturer = db.assetManufacturers.find(body.manufacturerId)
    const type = db.assetDeviceTypes.find(body.deviceTypeId)
    if (!manufacturer) throw validationProblem({ manufacturerId: 'Choose a manufacturer.' })
    if (!type) throw validationProblem({ deviceTypeId: 'Choose a device type.' })
    if (!manufacturer.deviceTypeIds.includes(type.id)) {
      throw validationProblem({
        deviceTypeId: `${manufacturer.name} does not make ${type.name.toLowerCase()}s. Add the device type to the manufacturer first.`,
      })
    }
    if (manufacturer.archivedAt) {
      throw validationProblem({ manufacturerId: 'This manufacturer is archived.' })
    }
    const nameTaken = db.assetModels.first(
      (m) =>
        m.manufacturerId === manufacturer.id && m.name.toLowerCase() === body.name.toLowerCase(),
    )
    if (nameTaken) {
      throw validationProblem({ name: 'This manufacturer already has a model with this name.' })
    }
    const row = db.assetModels.insert({
      name: body.name,
      manufacturerId: manufacturer.id,
      deviceTypeId: type.id,
      storageGb: body.storageGb ?? null,
      color: body.color,
      archivedAt: body.archived ? nowIso() : null,
      createdById: user.id,
      createdAt: nowIso(),
    })
    catalogAudit(user, 'asset_model', row.id, 'create', row.name)
    return created(toModelDto(row), api(`/assets/catalog/models/${row.id}`))
  }),
  http.patch(api('/assets/catalog/models/:id'), async ({ request, params }) => {
    const user = requireAdmin(request)
    const row = db.assetModels.find(param(params.id))
    if (!row) throw notFound()
    const body = await readJson(request, modelSchema.partial())
    const manufacturerId = body.manufacturerId ?? row.manufacturerId
    const deviceTypeId = body.deviceTypeId ?? row.deviceTypeId
    const assetCount = db.assets.count((a) => a.modelId === row.id)
    const pairChanged = manufacturerId !== row.manufacturerId || deviceTypeId !== row.deviceTypeId
    if (pairChanged && assetCount > 0) {
      throw validationProblem({
        [deviceTypeId !== row.deviceTypeId ? 'deviceTypeId' : 'manufacturerId']:
          `This model is used by ${assetCount} asset(s); its manufacturer and device type can't change.`,
      })
    }
    const manufacturer = db.assetManufacturers.find(manufacturerId)
    if (!manufacturer) throw validationProblem({ manufacturerId: 'Choose a manufacturer.' })
    if (!manufacturer.deviceTypeIds.includes(deviceTypeId)) {
      throw validationProblem({
        deviceTypeId: `${manufacturer.name} does not make this device type.`,
      })
    }
    const name = body.name ?? row.name
    const nameTaken = db.assetModels.first(
      (m) =>
        m.id !== row.id &&
        m.manufacturerId === manufacturerId &&
        m.name.toLowerCase() === name.toLowerCase(),
    )
    if (nameTaken) {
      throw validationProblem({ name: 'This manufacturer already has a model with this name.' })
    }
    const updated = db.assetModels.update(row.id, {
      name,
      manufacturerId,
      deviceTypeId,
      ...(body.storageGb !== undefined ? { storageGb: body.storageGb ?? null } : {}),
      ...(body.color !== undefined ? { color: body.color } : {}),
      ...archivePatch(body.archived, row.archivedAt),
    })!
    catalogAudit(user, 'asset_model', row.id, archiveAction(body), updated.name)
    return ok(toModelDto(updated))
  }),
  http.delete(api('/assets/catalog/models/:id'), ({ request, params }) => {
    const user = requireAdmin(request)
    const row = db.assetModels.find(param(params.id))
    if (!row) throw notFound()
    const count = db.assets.count((a) => a.modelId === row.id)
    if (count > 0) {
      throw conflict(
        `${row.name} is in use by ${count} asset(s). Archive it instead.`,
        'model_in_use',
      )
    }
    db.assetModels.remove(row.id)
    catalogAudit(user, 'asset_model', row.id, 'delete', row.name)
    return noContent()
  }),

  // --- static asset paths (before /assets/:id, SPEC_RESOLUTIONS #30) -------------------------
  http.get(api('/assets/mine'), ({ request }) => {
    const user = requireUser(request)
    const views = db.assets
      .where(
        (a) =>
          a.assignedUserId === user.id &&
          !a.deletedAt &&
          ['pending_acceptance', 'in_use', 'in_repair'].includes(a.status),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((a) => detail(a, user))
    return ok({
      pending: views.filter((v) => v.status === 'pending_acceptance'),
      active: views.filter((v) => v.status !== 'pending_acceptance'),
    })
  }),
  http.get(api('/assets/dashboard'), ({ request }) => {
    const user = requireAdmin(request)
    const live = db.assets.where((a) => !a.deletedAt)
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<AssetStatus, number>
    for (const a of live) byStatus[a.status]++
    const pending = live
      .filter((a) => a.status === 'pending_acceptance')
      .map((asset) => ({ asset, open: openAssignment(asset.id) }))
      .sort((x, y) => (x.open?.assignedAt ?? '').localeCompare(y.open?.assignedAt ?? ''))
    const recent = db.audit
      .where((e) => e.entityType === 'asset')
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, 10)
    const body: AssetDashboard = {
      totals: { all: live.length, byStatus },
      byDeviceType: db.assetDeviceTypes
        .all()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((t) => {
          const rows = live.filter((a) => modelOf(a).deviceTypeId === t.id)
          return {
            deviceType: { id: t.id, code: t.code, name: t.name },
            total: rows.length,
            inUse: rows.filter((a) => a.status === 'in_use').length,
            inStock: rows.filter((a) => a.status === 'in_stock').length,
          }
        }),
      byManufacturer: db.assetManufacturers
        .all()
        .map((m) => ({
          manufacturer: { id: m.id, name: m.name },
          total: live.filter((a) => modelOf(a).manufacturerId === m.id).length,
        }))
        .filter((m) => m.total > 0)
        .sort(
          (a, b) => b.total - a.total || a.manufacturer.name.localeCompare(b.manufacturer.name),
        ),
      pendingAcceptance: {
        total: pending.length,
        overdue: pending.filter((p) => p.open && isAcceptanceOverdue(p.open.assignedAt)).length,
        oldest: pending.slice(0, 5).map((p) => item(p.asset, user)),
      },
      recentActivity: recent.flatMap((entry) => {
        const asset = db.assets.find(entry.entityId)
        if (!asset) return []
        const ref = { id: asset.id, assetTag: assetTag(asset.number), model: modelOf(asset).name }
        return [{ ...toTimelineEntry(db, entry), asset: ref }]
      }),
    }
    return ok(body as never)
  }),
  http.get(api('/assets/export.csv'), ({ request }) => {
    requireAdmin(request)
    const rows = listResult(filteredAssets(request), request, {
      ...LIST_OPTIONS,
      defaultPerPage: 10_000,
      maxPerPage: 10_000,
    }).data
    const header = [
      'Asset tag',
      'Serial number',
      'Device name',
      'Device type',
      'Manufacturer',
      'Model',
      'Platform',
      'Status',
      'Assigned user',
      'Assigned user email',
      'Cost centre',
      'Purchase date',
      'MDM enrolled',
      'Deleted at',
      'Updated at',
    ].join(',')
    const lines = rows.map((asset) => {
      const view = toListItem(asset, [])
      return [
        view.assetTag,
        view.serialNumber,
        view.name,
        view.deviceType.name,
        view.manufacturer.name,
        view.model.name,
        view.platform?.name,
        view.status,
        view.assignedUser?.displayName,
        view.assignedUser?.email,
        view.costCenter.code,
        view.purchaseDate,
        view.mdmEnrolled ? 'yes' : 'no',
        view.deletedAt,
        view.updatedAt,
      ]
        .map(csvCell)
        .join(',')
    })
    return new HttpResponse(
      `${String.fromCharCode(0xfeff)}${[header, ...lines].join('\r\n')}\r\n`,
      {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="assets.csv"',
        },
      },
    )
  }),

  // --- collection ------------------------------------------------------------------------------
  http.get(api('/assets'), ({ request }) => {
    const user = requireAdmin(request)
    return listResponse(filteredAssets(request), request, {
      ...LIST_OPTIONS,
      map: (asset) => item(asset, user),
    })
  }),
  http.post(api('/assets'), async ({ request }) => {
    const user = requireAdmin(request)
    const body = await readJson(request, createAssetSchema)
    const model = activeModel(body.modelId)
    if (body.platformId) applicablePlatform(body.platformId, model.deviceTypeId)
    const costCenterId = body.costCenterId
      ? activeCostCenter(body.costCenterId).id
      : defaultCostCenterId()
    if (body.assignToUserId && !db.users.find(body.assignToUserId)?.active) {
      throw validationProblem({ assignToUserId: 'Choose an active user.' })
    }
    if (serialTaken(body.serialNumber)) {
      throw conflict(`Serial number ${body.serialNumber} is already registered.`, 'serial_taken')
    }
    const now = nowIso()
    let asset = db.assets.insert({
      number: Math.max(0, ...db.assets.all().map((a) => a.number)) + 1,
      serialNumber: body.serialNumber,
      name: body.name,
      modelId: model.id,
      platformId: body.platformId ?? null,
      status: 'in_stock',
      assignedUserId: null,
      costCenterId,
      purchaseDate: body.purchaseDate ?? null,
      mdmEnrolled: body.mdmEnrolled ?? false,
      notes: body.notes,
      createdById: user.id,
      updatedById: user.id,
      deletedAt: null,
      deletedById: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    recordAudit(db, {
      module: 'assets',
      entityType: 'asset',
      entityId: asset.id,
      entityLabel: label(asset),
      action: 'create',
      actorId: user.id,
      actingAs: actingAs(user),
      toState: 'in_stock',
      summary: assetSummary(user.displayName, 'create', actingAs(user)),
    })
    if (body.assignToUserId) {
      asset = assetWorkflow.transition(db.assets, asset, 'assign', user, {
        userId: body.assignToUserId,
        note: null,
        reason: null,
      })
    }
    return created(detail(asset, user), api(`/assets/${asset.id}`))
  }),

  // --- one asset ---------------------------------------------------------------------------------
  assetWorkflow.actionsHandler(api('/assets/:id/actions/:action'), {
    collection: db.assets,
    find: visibleAsset,
    toDto: detail,
  }),
  http.get(api('/assets/:id/assignments'), ({ request, params }) => {
    const user = requireUser(request)
    const asset = visibleAsset(param(params.id), user)
    if (!asset) throw notFound()
    if (!isAssetAdmin(user)) throw forbidden('Only asset admins can see the history of a device.')
    return ok(
      db.assetAssignments
        .where((a) => a.assetId === asset.id)
        .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
        .map(toAssignmentDto),
    )
  }),
  http.get(api('/assets/:id/timeline'), ({ request, params }) => {
    const user = requireUser(request)
    const asset = visibleAsset(param(params.id), user)
    if (!asset) throw notFound()
    if (!isAssetAdmin(user)) throw forbidden('Only asset admins can see the history of a device.')
    return ok(timelineFor(db, [{ entityType: 'asset', entityId: asset.id }]))
  }),
  http.get(api('/assets/:id'), ({ request, params }) => {
    const user = requireUser(request)
    const asset = visibleAsset(param(params.id), user)
    if (!asset) throw notFound()
    return ok(detail(asset, user))
  }),
  http.patch(api('/assets/:id'), async ({ request, params }) => {
    const user = requireAdmin(request)
    const asset = db.assets.find(param(params.id))
    if (!asset) throw notFound()
    if (asset.deletedAt || asset.status === 'scrapped') {
      throw invalidTransition('edit', asset.deletedAt ? 'deleted' : asset.status)
    }
    const body = await readJson(request, updateAssetSchema)
    if (body.version !== undefined && body.version !== asset.version) {
      throw conflict(
        'The resource was changed by someone else. Reload and try again.',
        'version_conflict',
      )
    }
    const patch: Partial<AssetRecord> = {}
    if (body.serialNumber !== undefined && body.serialNumber !== asset.serialNumber) {
      if (serialTaken(body.serialNumber, asset.id)) {
        throw conflict(`Serial number ${body.serialNumber} is already registered.`, 'serial_taken')
      }
      patch.serialNumber = body.serialNumber
    }
    if (body.name !== undefined) patch.name = body.name
    let deviceTypeId = modelOf(asset).deviceTypeId
    if (body.modelId !== undefined && body.modelId !== asset.modelId) {
      const model = activeModel(body.modelId)
      patch.modelId = model.id
      deviceTypeId = model.deviceTypeId
    }
    if (body.platformId !== undefined && body.platformId !== asset.platformId) {
      patch.platformId = body.platformId
        ? applicablePlatform(body.platformId, deviceTypeId).id
        : null
    } else if (asset.platformId && deviceTypeId !== modelOf(asset).deviceTypeId) {
      applicablePlatform(asset.platformId, deviceTypeId, true)
    }
    if (body.purchaseDate !== undefined) patch.purchaseDate = body.purchaseDate ?? null
    if (body.costCenterId !== undefined) {
      const target = body.costCenterId ?? defaultCostCenterId()
      if (target !== asset.costCenterId) {
        if (asset.assignedUserId) {
          throw validationProblem({
            costCenterId:
              "The cost centre follows the assigned user and can't be changed while the asset is assigned.",
          })
        }
        patch.costCenterId = activeCostCenter(target).id
      }
    }
    if (body.mdmEnrolled !== undefined) patch.mdmEnrolled = body.mdmEnrolled
    if (body.notes !== undefined) patch.notes = body.notes

    const view = (a: AssetRecord) => ({
      serialNumber: a.serialNumber,
      name: a.name,
      model: modelOf(a).name,
      platform: a.platformId ? (db.assetPlatforms.find(a.platformId)?.name ?? null) : null,
      purchaseDate: a.purchaseDate,
      costCenter: ccLabel(a.costCenterId),
      mdmEnrolled: a.mdmEnrolled,
      notes: a.notes,
    })
    const changes = diffFields(view(asset), view({ ...asset, ...patch }), ASSET_FIELD_LABELS)
    if (changes.length === 0) return ok(detail(asset, user))
    const updated = db.assets.update(asset.id, {
      ...patch,
      updatedById: user.id,
      updatedAt: nowIso(),
      version: asset.version + 1,
    })!
    recordAudit(db, {
      module: 'assets',
      entityType: 'asset',
      entityId: asset.id,
      entityLabel: label(updated),
      action: 'update',
      actorId: user.id,
      actingAs: actingAs(user),
      changes,
      summary: assetSummary(user.displayName, 'update', actingAs(user)),
    })
    return ok(detail(updated, user))
  }),
  http.delete(api('/assets/:id'), ({ request, params }) => {
    const user = requireAdmin(request)
    const asset = db.assets.find(param(params.id))
    if (!asset) throw notFound()
    if (asset.deletedAt || !['in_stock', 'scrapped'].includes(asset.status)) {
      throw invalidTransition('delete', asset.deletedAt ? 'deleted' : asset.status)
    }
    const now = nowIso()
    db.assets.update(asset.id, {
      deletedAt: now,
      deletedById: user.id,
      updatedAt: now,
      version: asset.version + 1,
    })
    recordAudit(db, {
      module: 'assets',
      entityType: 'asset',
      entityId: asset.id,
      entityLabel: label(asset),
      action: 'delete',
      actorId: user.id,
      actingAs: actingAs(user),
      fromState: asset.status,
      toState: asset.status,
      summary: assetSummary(user.displayName, 'delete', actingAs(user)),
    })
    return noContent()
  }),
])
