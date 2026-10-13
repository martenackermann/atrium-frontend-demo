/**
 * Timeline sentences for asset audit entries — the same phrases as the backend's audit labels
 * (src/modules/assets/assets.enums.ts), so demo timelines read like the real API. Pure helpers.
 */
import type { ActingAs } from '~/types/api'

export const ASSET_PHRASES: Record<string, string> = {
  create: 'added the asset',
  update: 'edited the details',
  delete: 'deleted the asset',
  assign: 'assigned the device',
  accept: 'accepted the device',
  decline: 'declined the device',
  unassign: 'withdrew the assignment',
  return: 'recorded the return',
  send_to_repair: 'sent the device to repair',
  complete_repair: 'completed the repair',
  scrap: 'scrapped the device',
  remind: 'sent an acceptance reminder',
  cost_center_sync: 'synced the cost centre',
  archive: 'archived',
  restore: 'restored',
}

export const ASSET_FIELD_LABELS: Record<string, string> = {
  serialNumber: 'Serial number',
  name: 'Device name',
  model: 'Model',
  platform: 'Platform',
  purchaseDate: 'Purchase date',
  costCenter: 'Cost centre',
  mdmEnrolled: 'MDM enrolled',
  notes: 'Notes',
}

const SUFFIX: Partial<Record<ActingAs, string>> = {
  back_office: ' (back office)',
  admin: ' (as admin)',
}

/** "Arne Assets assigned the device to Emma Employee (back office)". */
export function assetSummary(
  actorName: string | null,
  action: string,
  actingAs: ActingAs,
  assigneeName?: string | null,
): string {
  const phrase = ASSET_PHRASES[action] ?? action.replace(/_/g, ' ')
  const target = action === 'assign' && assigneeName ? ` to ${assigneeName}` : ''
  return `${actorName ?? 'Atrium'} ${phrase}${target}${SUFFIX[actingAs] ?? ''}`
}

export const assetTag = (number: number) => `AST-${String(number).padStart(5, '0')}`
