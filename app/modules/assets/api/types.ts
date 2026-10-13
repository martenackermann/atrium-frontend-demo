/**
 * Assets API types (owned by slice A3) — transcribed from API.md §6 with SPEC_RESOLUTIONS #22–#23.
 * Replace with generated types once the backend exports `/assets/*` (pnpm api:types).
 */
import type { IsoDate, IsoDateTime, Ref, TimelineEntry, UserRef, Uuid } from '~/types/api'

export type AssetStatus = 'in_stock' | 'pending_acceptance' | 'in_use' | 'in_repair' | 'scrapped'
export type ReturnCondition = 'ok' | 'damaged'
export type AssetAction =
  | 'assign'
  | 'accept'
  | 'decline'
  | 'unassign'
  | 'return'
  | 'send_to_repair'
  | 'complete_repair'
  | 'scrap'
  | 'edit'
  | 'delete'

export interface AssetListItem {
  id: Uuid
  assetTag: string
  serialNumber: string
  name: string | null
  deviceType: { id: Uuid; code: string; name: string; requiresPlatform: boolean }
  manufacturer: { id: Uuid; name: string }
  model: { id: Uuid; name: string }
  platform: { id: Uuid; name: string } | null
  status: AssetStatus
  assignedUser: UserRef | null
  costCenter: Ref
  purchaseDate: IsoDate | null
  mdmEnrolled: boolean
  deletedAt: IsoDateTime | null
  updatedAt: IsoDateTime
  availableActions: AssetAction[]
}

export interface AssetAssignmentDto {
  id: Uuid
  user: UserRef
  assignedBy: UserRef
  assignedAt: IsoDateTime
  note: string | null
  acceptedAt: IsoDateTime | null
  declinedAt: IsoDateTime | null
  declineReason: string | null
  unassignedAt: IsoDateTime | null
  returnedAt: IsoDateTime | null
  returnCondition: ReturnCondition | null
  returnNote: string | null
  reminderCount: number
}

export interface AssetDto extends AssetListItem {
  /** always null for non-admins */
  notes: string | null
  currentAssignment: AssetAssignmentDto | null
  applicablePlatforms: { id: Uuid; name: string }[]
  createdBy: UserRef | null
  createdAt: IsoDateTime
  version: number
}

export interface MyAssets {
  pending: AssetDto[]
  active: AssetDto[]
}

/** A device waiting for acceptance; `assignedAt` (open assignment) is the "waiting since" date. */
export interface AssetPendingItem extends AssetListItem {
  assignedAt: IsoDateTime
}

export interface AssetDashboard {
  totals: { all: number; byStatus: Record<AssetStatus, number> }
  byDeviceType: Array<{
    deviceType: { id: Uuid; code: string; name: string }
    total: number
    inUse: number
    inStock: number
  }>
  byManufacturer: Array<{ manufacturer: { id: Uuid; name: string }; total: number }>
  pendingAcceptance: { total: number; overdue: number; oldest: AssetPendingItem[] }
  recentActivity: Array<TimelineEntry & { asset: { id: Uuid; assetTag: string; model: string } }>
}

export interface AssetCounts {
  mine: { pending: number }
  admin: {
    pendingAcceptance: number
    acceptanceOverdue: number
    inRepair: number
    inStock: number
  } | null
}

export interface DeviceTypeDto {
  id: Uuid
  code: string
  name: string
  requiresPlatform: boolean
  sortOrder: number
  assetCount: number
}

export interface ManufacturerDto {
  id: Uuid
  name: string
  deviceTypeIds: Uuid[]
  archived: boolean
  modelCount: number
  assetCount: number
}

export interface PlatformDto {
  id: Uuid
  name: string
  deviceTypeIds: Uuid[]
  archived: boolean
  assetCount: number
}

export interface AssetModelDto {
  id: Uuid
  name: string
  manufacturer: { id: Uuid; name: string }
  deviceType: { id: Uuid; code: string; name: string }
  storageGb: number | null
  color: string | null
  archived: boolean
  assetCount: number
  createdAt: IsoDateTime
}

export interface CreateAsset {
  serialNumber: string
  name?: string | null
  modelId: Uuid
  platformId?: Uuid | null
  purchaseDate?: IsoDate | null
  costCenterId?: Uuid | null
  mdmEnrolled?: boolean
  notes?: string | null
  assignToUserId?: Uuid | null
}

export type UpdateAsset = Partial<Omit<CreateAsset, 'assignToUserId'>> & { version?: number }
