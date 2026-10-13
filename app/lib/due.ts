import { daysFromToday, formatDate } from '~/utils/format'

/**
 * The due line of a to-do (inbox rows, the Inbox drawer, Home "Needs your attention"), one
 * wording everywhere (DESIGN §2.4 flags): "Overdue since 8 Oct", "Due yesterday" (both negative),
 * "Due today", "Due tomorrow", "Due Thu 15 Oct".
 */
export function dueLabel(
  dueAt: string | null | undefined,
): { text: string; overdue: boolean } | null {
  const days = daysFromToday(dueAt)
  if (days === null || !dueAt) return null
  if (days < -1)
    return { text: `Overdue since ${formatDate(dueAt, { weekday: false })}`, overdue: true }
  if (days === -1) return { text: 'Due yesterday', overdue: true }
  if (days === 0) return { text: 'Due today', overdue: false }
  if (days === 1) return { text: 'Due tomorrow', overdue: false }
  return { text: `Due ${formatDate(dueAt)}`, overdue: false }
}

/** True when a subtitle already names the due date ("15 Oct 2026", "Thu 15 Oct"). */
export function namesDate(subtitle: string | null | undefined, date: string | null | undefined) {
  if (!subtitle || !date) return false
  return (
    subtitle.includes(formatDate(date)) || subtitle.includes(formatDate(date, { weekday: false }))
  )
}
