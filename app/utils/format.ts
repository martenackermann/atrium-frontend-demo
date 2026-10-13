/**
 * en-GB formatting (DESIGN §10): "Tue 21 Oct" (year only when it differs), "21–23 Oct",
 * "Tue 21 – Thu 23 Oct", "08:41", relative ages "40 min" / "2 h" / "Yesterday" / "3 days",
 * money "€1,890". Auto-imported (app/utils).
 */
import type { Money } from '~/types/api'

type DateInput = string | number | Date | null | undefined

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** IsoDate ('YYYY-MM-DD') is a calendar date → local midnight (never shift a day). */
export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return value
  if (typeof value === 'string' && DATE_ONLY.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year!, month! - 1, day!)
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Newer ICU writes "Sept" for en-GB short months; DESIGN §10 uses three letters ("8 Sep"). */
const shortMonths = (text: string) => text.replace(/Sept/g, 'Sep')

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const dayDiff = (a: Date, b: Date) =>
  Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000)

/** "Tue 21 Oct" · "Tue 21 Oct 2027" · { weekday: false } → "21 Oct" */
export function formatDate(
  value: DateInput,
  options: { weekday?: boolean; year?: 'auto' | 'always' } = {},
): string {
  const date = toDate(value)
  if (!date) return ''
  const withYear = options.year === 'always' || date.getFullYear() !== new Date().getFullYear()
  const formatter = new Intl.DateTimeFormat('en-GB', {
    weekday: options.weekday === false ? undefined : 'short',
    day: 'numeric',
    month: 'short',
    year: withYear ? 'numeric' : undefined,
  })
  return shortMonths(formatter.format(date).replace(',', ''))
}

/** "Tuesday, 13 October" (greetings, headings). */
export function formatLongDate(value: DateInput): string {
  const date = toDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

/** "08:41" (24-hour). */
export function formatTime(value: DateInput): string {
  const date = toDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date)
}

/** "Tue 21 Oct, 08:00" */
export function formatDateTime(value: DateInput): string {
  const date = toDate(value)
  if (!date) return ''
  return `${formatDate(date)}, ${formatTime(date)}`
}

/** "21–23 Oct" · "30 Oct – 2 Nov" · with weekdays: "Tue 21 – Thu 23 Oct". */
export function formatDateRange(
  start: DateInput,
  end: DateInput,
  options: { weekday?: boolean } = {},
): string {
  const from = toDate(start)
  const to = toDate(end)
  if (!from) return ''
  if (!to || dayDiff(to, from) === 0) return formatDate(from, { weekday: options.weekday })
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()
  const fmt = (date: Date, parts: Intl.DateTimeFormatOptions) =>
    shortMonths(new Intl.DateTimeFormat('en-GB', parts).format(date).replace(',', ''))
  const year = to.getFullYear() !== new Date().getFullYear() ? ' ' + to.getFullYear() : ''
  if (options.weekday) {
    const left = fmt(
      from,
      sameMonth
        ? { weekday: 'short', day: 'numeric' }
        : { weekday: 'short', day: 'numeric', month: 'short' },
    )
    return `${left} – ${fmt(to, { weekday: 'short', day: 'numeric', month: 'short' })}${year}`
  }
  if (sameMonth) return `${from.getDate()}–${fmt(to, { day: 'numeric', month: 'short' })}${year}`
  return `${fmt(from, { day: 'numeric', month: 'short' })} – ${fmt(to, { day: 'numeric', month: 'short' })}${year}`
}

/** Age in lists: "Just now", "40 min", "2 h", "Yesterday", "3 days", then "Tue 21 Oct". */
export function formatAge(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value)
  if (!date) return ''
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min`
  const days = dayDiff(now, date)
  if (days === 0) return `${Math.floor(minutes / 60)} h`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days`
  return formatDate(date)
}

/** Relative day for due/start dates: "today", "tomorrow", "yesterday", "in 3 days", "3 days ago". */
export function formatRelativeDay(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value)
  if (!date) return ''
  const days = dayDiff(date, now)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  return days > 0 ? `in ${days} days` : `${-days} days ago`
}

/** Whole days from today (negative = past). */
export function daysFromToday(value: DateInput, now: Date = new Date()): number | null {
  const date = toDate(value)
  return date ? dayDiff(date, now) : null
}

/** "€1,890" · "€12.50" · accepts Money or cents. */
export function formatMoney(value: Money | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const cents = typeof value === 'number' ? value : value.amountCents
  const hasCents = cents % 100 !== 0
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/** "14 MB" · "820 KB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const mb = bytes / (1024 * 1024)
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1).replace(/\.0$/, '')} MB`
}

/** Initials from a display name: "Emma Employee" → "EE". */
export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
