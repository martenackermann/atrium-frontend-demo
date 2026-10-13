/**
 * Job runner for mocks (SPEC §8, API.md §3.7). Core jobs live here; slices add theirs through
 * `jobs` in mocks/providers.ts. "Run now" executes `run()` against the mock database and records
 * a JobRun (emails are skipped in the offline demo).
 */
import type { MockJob } from '../define'

export const CORE_JOBS: MockJob[] = [
  {
    name: 'core.purge',
    description:
      'Deletes staged uploads older than 24 h, old idempotency keys and expired sessions.',
    slice: 'F',
    cron: '10 3 * * *',
    run: () => ({ stagedAttachments: 0, idempotencyKeys: 0, sessions: 0 }),
  },
  {
    name: 'demo.reset',
    description: 'Resets all data and re-runs the seed relative to the new day.',
    slice: 'F',
    cron: null,
    enabled: false,
    // SPEC_RESOLUTIONS #29: CLI/cron only, never from the jobs UI.
    manual: false,
    run: () => ({}),
  },
]

function parseField(field: string, min: number, max: number): number[] {
  const values = new Set<number>()
  for (const part of field.split(',')) {
    const [range, stepText] = part.split('/')
    const step = Number(stepText ?? 1)
    let start = min
    let end = max
    if (range && range !== '*') {
      const [a, b] = range.split('-').map(Number)
      start = a!
      end = b ?? (stepText ? max : a!)
    }
    for (let value = start; value <= end; value += step) values.add(value)
  }
  return [...values].sort((a, b) => a - b)
}

/**
 * Next run for a 5-field cron (minute hour day-of-month month day-of-week), local time.
 * Supports lists, ranges and steps — enough for the SPEC §8 schedules.
 */
export function nextCronRun(cron: string | null, from: Date = new Date()): Date | null {
  if (!cron) return null
  const fields = cron.trim().split(/\s+/)
  if (fields.length !== 5) return null
  const [minuteField, hourField, domField, monthField, dowField] = fields as [
    string,
    string,
    string,
    string,
    string,
  ]
  const minutes = parseField(minuteField, 0, 59)
  const hours = parseField(hourField, 0, 23)
  const doms = parseField(domField, 1, 31)
  const months = parseField(monthField, 1, 12)
  const dows = parseField(dowField, 0, 6)
  const candidate = new Date(from.getTime())
  candidate.setSeconds(0, 0)
  candidate.setMinutes(candidate.getMinutes() + 1)
  for (let guard = 0; guard < 60 * 24 * 370; guard++) {
    if (
      months.includes(candidate.getMonth() + 1) &&
      doms.includes(candidate.getDate()) &&
      dows.includes(candidate.getDay()) &&
      hours.includes(candidate.getHours()) &&
      minutes.includes(candidate.getMinutes())
    ) {
      return candidate
    }
    candidate.setMinutes(candidate.getMinutes() + 1)
  }
  return null
}
