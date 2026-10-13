/** News + links vocabulary for the UI (owned by slice A4). */
import {
  Archive,
  BedDouble,
  BookOpen,
  Calendar,
  CalendarClock,
  CalendarX,
  Heart,
  Info,
  LifeBuoy,
  Link,
  Network,
  Palette,
  Receipt,
  RefreshCcw,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  Utensils,
} from '@lucide/vue'
import type { Component } from 'vue'
import type { ActionConfig } from '~/types/ui'
import type { NewsType } from './api/types'

export const NEWS_TYPE_META: Record<NewsType, { label: string; icon: Component }> = {
  changelog: { label: 'Changelog', icon: Sparkles },
  update: { label: 'Update', icon: RefreshCcw },
  information: { label: 'Information', icon: Info },
}

export const NEWS_TYPE_OPTIONS = (Object.keys(NEWS_TYPE_META) as NewsType[]).map((value) => ({
  value,
  label: NEWS_TYPE_META[value].label,
}))

/** SPEC §4.6 icon allowlist → lucide icons. */
export const LINK_ICONS: Record<string, { label: string; icon: Component }> = {
  book: { label: 'Book', icon: BookOpen },
  utensils: { label: 'Cutlery', icon: Utensils },
  receipt: { label: 'Receipt', icon: Receipt },
  bed: { label: 'Bed', icon: BedDouble },
  'life-buoy': { label: 'Life buoy', icon: LifeBuoy },
  calendar: { label: 'Calendar', icon: Calendar },
  network: { label: 'Network', icon: Network },
  palette: { label: 'Palette', icon: Palette },
  shield: { label: 'Shield', icon: Shield },
  heart: { label: 'Heart', icon: Heart },
  link: { label: 'Link', icon: Link },
}

export const linkIcon = (icon: string | null | undefined) =>
  LINK_ICONS[icon ?? 'link']?.icon ?? Link

/** ActionBar config for news posts (the schedule dialog is handled by the editor page). */
export const NEWS_ACTIONS: Record<string, ActionConfig> = {
  // No confirm step: the shared confirm dialog resolves "cancel" today (reported); restore and
  // unschedule undo these actions anyway.
  publish: { label: 'Publish now', icon: Send, variant: 'primary' },
  unschedule: { label: 'Unschedule', icon: CalendarX },
  archive: { label: 'Archive', icon: Archive },
  restore: { label: 'Restore as draft', icon: RotateCcw },
}

export const NEWS_ACTION_MESSAGES: Record<string, string> = {
  publish: 'Published.',
  schedule: 'Scheduled.',
  unschedule: 'Unscheduled. The post is a draft again.',
  archive: 'Archived.',
  restore: 'Restored as a draft.',
}

export const SCHEDULE_ICON = CalendarClock

/** DOMPurify / editor allowlist (SPEC §4.6). */
export const NEWS_ALLOWED_TAGS = [
  'p',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'a',
  'blockquote',
  'code',
  'pre',
  'br',
]
