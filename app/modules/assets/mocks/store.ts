/**
 * Read model of the asset mocks: visibility (SPEC §3.3, D5), DTO mapping (API.md §6.2) and the
 * acceptance due-date rule (SPEC_RESOLUTIONS #23). Used by handlers, the workflow and providers.
 */
import { refOf, toUserRef, userRefById } from '~/mocks/core/org'
import type { MockUser } from '~/mocks/core/types'
import { db } from '~/mocks/db'
import { userHasRole } from '~/mocks/http'
import type {
  AssetAction,
  AssetAssignmentDto,
  AssetDto,
  AssetListItem,
  AssetModelDto,
  DeviceTypeDto,
} from '../api/types'
import type { AssetAssignmentRecord, AssetModelRecord, AssetRecord } from './types'
import { assetTag } from './audit-text'

export const ACCEPTANCE_DUE_DAYS = 7
export const REMINDER_DAYS = 3
export const REMINDER_MAX = 3

export const isAssetAdmin = (user: MockUser) =>
  userHasRole(user, 'asset_admin') || userHasRole(user, 'it_admin')

export function openAssignment(assetId: string): AssetAssignmentRecord | undefined {
  return db.assetAssignments
    .where((a) => a.assetId === assetId && !a.declinedAt && !a.unassignedAt && !a.returnedAt)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))[0]
}

/** Assets the user may see: admins all (incl. soft-deleted), others their own (404 otherwise). */
export function visibleAsset(id: string, user: MockUser): AssetRecord | undefined {
  const asset = db.assets.find(id)
  if (!asset) return undefined
  if (isAssetAdmin(user)) return asset
  return asset.assignedUserId === user.id && !asset.deletedAt ? asset : undefined
}

export function defaultCostCenterId(): string {
  return db.costCenters.first((cc) => cc.code === 'CC-4900')!.id
}

export const modelOf = (asset: Pick<AssetRecord, 'modelId'>) => db.assetModels.find(asset.modelId)!
export const typeOf = (model: Pick<AssetModelRecord, 'deviceTypeId'>) =>
  db.assetDeviceTypes.find(model.deviceTypeId)!

/** Local calendar day + n → start of that day as an ISO instant. */
function startOfDayPlus(iso: string, days: number): Date {
  const date = new Date(iso)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** SPEC_RESOLUTIONS #23: due at 00:00 of (assignment day + ASSET_ACCEPTANCE_DUE_DAYS). */
export const acceptanceDueAt = (assignedAt: string) =>
  startOfDayPlus(assignedAt, ACCEPTANCE_DUE_DAYS)

export const isAcceptanceOverdue = (assignedAt: string, now = new Date()) =>
  now.getTime() >= acceptanceDueAt(assignedAt).getTime()

export function toAssignmentDto(row: AssetAssignmentRecord): AssetAssignmentDto {
  return {
    id: row.id,
    user: userRefById(db, row.userId)!,
    assignedBy: userRefById(db, row.assignedById)!,
    assignedAt: row.assignedAt,
    note: row.note,
    acceptedAt: row.acceptedAt,
    declinedAt: row.declinedAt,
    declineReason: row.declineReason,
    unassignedAt: row.unassignedAt,
    returnedAt: row.returnedAt,
    returnCondition: row.returnCondition,
    returnNote: row.returnNote,
    reminderCount: row.reminderCount,
  }
}

export function toListItem(asset: AssetRecord, availableActions: AssetAction[]): AssetListItem {
  const model = modelOf(asset)
  const type = typeOf(model)
  const manufacturer = db.assetManufacturers.find(model.manufacturerId)!
  const platform = asset.platformId ? db.assetPlatforms.find(asset.platformId) : undefined
  const holder = asset.assignedUserId ? db.users.find(asset.assignedUserId) : undefined
  return {
    id: asset.id,
    assetTag: assetTag(asset.number),
    serialNumber: asset.serialNumber,
    name: asset.name,
    deviceType: {
      id: type.id,
      code: type.code,
      name: type.name,
      requiresPlatform: type.requiresPlatform,
    },
    manufacturer: { id: manufacturer.id, name: manufacturer.name },
    model: { id: model.id, name: model.name },
    platform: platform ? { id: platform.id, name: platform.name } : null,
    status: asset.status,
    assignedUser: holder ? toUserRef(holder) : null,
    costCenter: refOf(db, 'costCenters', asset.costCenterId)!,
    purchaseDate: asset.purchaseDate,
    mdmEnrolled: asset.mdmEnrolled,
    deletedAt: asset.deletedAt,
    updatedAt: asset.updatedAt,
    availableActions,
  }
}

export function toDetail(
  asset: AssetRecord,
  user: MockUser,
  availableActions: AssetAction[],
): AssetDto {
  const model = modelOf(asset)
  const open = openAssignment(asset.id)
  return {
    ...toListItem(asset, availableActions),
    notes: isAssetAdmin(user) ? asset.notes : null,
    currentAssignment: open ? toAssignmentDto(open) : null,
    applicablePlatforms: db.assetPlatforms
      .where((p) => !p.archivedAt && p.deviceTypeIds.includes(model.deviceTypeId))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => ({ id: p.id, name: p.name })),
    createdBy: userRefById(db, asset.createdById),
    createdAt: asset.createdAt,
    version: asset.version,
  }
}

export function toModelDto(model: AssetModelRecord): AssetModelDto {
  const type = typeOf(model)
  const manufacturer = db.assetManufacturers.find(model.manufacturerId)!
  return {
    id: model.id,
    name: model.name,
    manufacturer: { id: manufacturer.id, name: manufacturer.name },
    deviceType: { id: type.id, code: type.code, name: type.name },
    storageGb: model.storageGb,
    color: model.color,
    archived: model.archivedAt !== null,
    assetCount: db.assets.count((a) => a.modelId === model.id),
    createdAt: model.createdAt,
  }
}

export function toDeviceTypeDto(id: string): DeviceTypeDto {
  const type = db.assetDeviceTypes.find(id)!
  const models = new Set(db.assetModels.where((m) => m.deviceTypeId === id).map((m) => m.id))
  return { ...type, assetCount: db.assets.count((a) => models.has(a.modelId)) }
}
