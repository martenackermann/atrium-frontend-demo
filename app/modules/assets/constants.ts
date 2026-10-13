import {
  Archive,
  Cable,
  CircleCheck,
  Headphones,
  Laptop,
  Monitor,
  Package,
  PcCase,
  Smartphone,
  Tablet,
  Undo2,
  UserMinus,
  UserPlus,
  Wrench,
} from '@lucide/vue'
import type { Component } from 'vue'
import type { ActionConfig } from '~/types/ui'
import type { AssetStatus } from './api/types'

/** Device-type glyphs (DESIGN §6: lucide outline, `laptop` for equipment). */
export const DEVICE_ICONS: Record<string, Component> = {
  laptop: Laptop,
  desktop: PcCase,
  monitor: Monitor,
  smartphone: Smartphone,
  tablet: Tablet,
  headset: Headphones,
  dock: Cable,
}
export const deviceIcon = (code: string | null | undefined): Component =>
  (code && DEVICE_ICONS[code]) || Package

/** Device types whose model names carry storage and colour (`Marlowe X5 128 GB Midnight`). */
export const STORAGE_COLOUR_TYPES = ['smartphone', 'tablet']

/** Lifecycle order (DESIGN §2.5: status distributions are ordered by lifecycle). */
export const ASSET_STATUS_ORDER: AssetStatus[] = [
  'in_stock',
  'pending_acceptance',
  'in_use',
  'in_repair',
  'scrapped',
]

/**
 * ActionBar config for the asset admin detail (SPEC §5.3). `assign` and `return` open their own
 * dialogs (user picker, condition); the others ask for a note or reason first.
 */
export const ASSET_ADMIN_ACTIONS: Record<string, ActionConfig> = {
  assign: { label: 'Assign', icon: UserPlus, variant: 'primary' },
  unassign: {
    label: 'Unassign',
    icon: UserMinus,
    reason: {
      title: 'Withdraw this assignment?',
      description: 'The device goes back to stock and the user no longer sees it.',
      label: 'Reason',
      hint: 'Optional. Shown in the timeline.',
      confirmLabel: 'Unassign',
      required: false,
    },
  },
  return: { label: 'Record return', icon: Undo2 },
  send_to_repair: {
    label: 'Send to repair',
    icon: Wrench,
    reason: {
      title: 'Send this device to repair',
      description: 'An assigned device goes back to the same person after the repair.',
      label: 'What is wrong?',
      hint: 'A few words for the repair log, e.g. "Cracked screen".',
      confirmLabel: 'Send to repair',
      field: 'note',
    },
  },
  complete_repair: {
    label: 'Complete repair',
    icon: CircleCheck,
    variant: 'primary',
    reason: {
      title: 'Complete the repair',
      description: 'The device goes back to its user, or to stock when nobody holds it.',
      label: 'Repair note',
      hint: 'Optional.',
      confirmLabel: 'Complete repair',
      field: 'note',
      required: false,
    },
  },
  scrap: {
    label: 'Scrap',
    icon: Archive,
    variant: 'danger',
    reason: {
      title: 'Scrap this device?',
      description: 'Scrapped devices cannot be assigned or edited again.',
      label: 'Reason',
      hint: 'Shown in the timeline, e.g. "Mainboard failure".',
      confirmLabel: 'Scrap device',
    },
  },
}

/** Toasts mirror the action (DESIGN §10). */
export const ASSET_ACTION_MESSAGES: Record<string, string> = {
  assign: 'Assigned. They get an email to accept the device.',
  unassign: 'Assignment withdrawn. The device is back in stock.',
  return: 'Return recorded.',
  send_to_repair: 'Sent to repair.',
  complete_repair: 'Repair completed.',
  scrap: 'Device scrapped.',
}
