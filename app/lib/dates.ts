/**
 * Conversions between API strings and @internationalized/date values (Reka date pickers).
 * IsoDate 'YYYY-MM-DD' ↔ CalendarDate; IsoDateTime (UTC) ↔ CalendarDateTime in the local zone.
 */
import {
  type CalendarDate,
  CalendarDateTime,
  fromDate,
  getLocalTimeZone,
  parseDate,
  toCalendarDateTime,
  type DateValue,
} from '@internationalized/date'

export function isoToCalendarDate(value: string | null | undefined): CalendarDate | undefined {
  if (!value) return undefined
  try {
    return parseDate(value.slice(0, 10))
  } catch {
    return undefined
  }
}

export function calendarDateToIso(value: DateValue | null | undefined): string | null {
  if (!value) return null
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`
}

export function isoToCalendarDateTime(
  value: string | null | undefined,
): CalendarDateTime | undefined {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return toCalendarDateTime(fromDate(date, getLocalTimeZone()))
}

export function calendarDateTimeToIso(value: DateValue | null | undefined): string | null {
  if (!value) return null
  const dateTime =
    value instanceof CalendarDateTime
      ? value
      : new CalendarDateTime(value.year, value.month, value.day, 0, 0)
  return dateTime.toDate(getLocalTimeZone()).toISOString()
}
