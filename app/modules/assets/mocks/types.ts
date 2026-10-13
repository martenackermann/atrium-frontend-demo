/**
 * Mock records of the assets module (mirror the backend tables, SPEC §4.4). Dates are ISO strings;
 * calendar dates are IsoDate strings.
 */
import type { AssetStatus, ReturnCondition } from '../api/types'

export interface AssetRecord {
  id: string
  /** AST-00001 */
  number: number
  serialNumber: string
  name: string | null
  modelId: string
  platformId: string | null
  status: AssetStatus
  assignedUserId: string | null
  costCenterId: string
  purchaseDate: string | null
  mdmEnrolled: boolean
  notes: string | null
  createdById: string | null
  updatedById: string | null
  deletedAt: string | null
  deletedById: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface AssetAssignmentRecord {
  id: string
  assetId: string
  userId: string
  assignedById: string
  assignedAt: string
  note: string | null
  acceptedAt: string | null
  declinedAt: string | null
  declineReason: string | null
  unassignedAt: string | null
  returnedAt: string | null
  returnCondition: ReturnCondition | null
  returnNote: string | null
  lastRemindedAt: string | null
  reminderCount: number
}

export interface DeviceTypeRecord {
  id: string
  code: string
  name: string
  requiresPlatform: boolean
  sortOrder: number
}

export interface ManufacturerRecord {
  id: string
  name: string
  deviceTypeIds: string[]
  archivedAt: string | null
}

export interface PlatformRecord {
  id: string
  name: string
  deviceTypeIds: string[]
  archivedAt: string | null
}

export interface AssetModelRecord {
  id: string
  name: string
  manufacturerId: string
  deviceTypeId: string
  storageGb: number | null
  color: string | null
  archivedAt: string | null
  createdById: string | null
  createdAt: string
}

declare module '~/mocks/db' {
  interface MockCollections {
    assets: AssetRecord
    assetAssignments: AssetAssignmentRecord
    assetDeviceTypes: DeviceTypeRecord
    assetManufacturers: ManufacturerRecord
    assetPlatforms: PlatformRecord
    assetModels: AssetModelRecord
  }
}
