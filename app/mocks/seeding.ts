import { Faker, base, en } from '@faker-js/faker'
import coreSeed from './core/seed'
import type { MockDb } from './db'
import type { MockSeed } from './define'

/** Every app/modules/<module>/mocks/seed.ts (default export = defineMockSeed(...)). */
const moduleSeedFiles = import.meta.glob<{ default: MockSeed }>('~/modules/*/mocks/seed.ts', {
  eager: true,
})

interface RegisteredSeed {
  id: string
  seed: MockSeed
}

function moduleName(path: string): string {
  return /modules\/([^/]+)\/mocks\/seed\.ts$/.exec(path)?.[1] ?? path
}

function registeredSeeds(): RegisteredSeed[] {
  const modules = Object.entries(moduleSeedFiles)
    .filter(([, file]) => file.default)
    .map(([path, file]) => ({ id: moduleName(path), seed: file.default }))
  return [{ id: 'core', seed: { order: 0, ...coreSeed } }, ...modules].sort(
    (a, b) => (a.seed.order ?? 100) - (b.seed.order ?? 100) || a.id.localeCompare(b.id),
  )
}

export function registeredSeedIds(): string[] {
  return registeredSeeds().map((entry) => entry.id)
}

/** FNV-1a: stable 32-bit hash so each seed gets its own deterministic faker stream. */
function hash(value: string): number {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193)
  }
  return result >>> 0
}

export function createSeededFaker(seed: number, refDate: Date): Faker {
  const faker = new Faker({ locale: [en, base] })
  faker.seed(seed)
  faker.setDefaultRefDate(refDate)
  return faker
}

const pad = (value: number) => String(value).padStart(2, '0')

/** refDate ± days (local calendar), optionally at 'HH:mm' local time → ISO timestamp. */
export function offsetDays(refDate: Date, offset: number, time?: string): Date {
  const date = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() + offset)
  if (time) {
    const [hours, minutes] = time.split(':').map(Number)
    date.setHours(hours ?? 0, minutes ?? 0, 0, 0)
  }
  return date
}

/** Saturday → Friday, Sunday → Monday. */
export function onWeekday(date: Date): Date {
  const day = date.getDay()
  if (day === 6) return new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1)
  if (day === 0) return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  return date
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function runSeeds(db: MockDb, options: { seed: number; refDate: Date }): void {
  for (const { id, seed } of registeredSeeds()) {
    const faker = createSeededFaker(hash(`${options.seed}:${id}`), options.refDate)
    seed.run({
      db,
      faker,
      refDate: new Date(options.refDate),
      uuid: () => faker.string.uuid(),
      d: (offset) => toIsoDate(offsetDays(options.refDate, offset)),
      at: (offset, hours = 9, minutes = 0) =>
        offsetDays(options.refDate, offset, `${hours}:${minutes}`).toISOString(),
      weekday: (offset) => toIsoDate(onWeekday(offsetDays(options.refDate, offset))),
    })
  }
}
