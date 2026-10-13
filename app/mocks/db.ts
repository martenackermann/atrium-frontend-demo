/**
 * In-browser mock database for demo mode.
 *
 * - Typed collections: modules add theirs by augmenting MockCollections (see CONVENTIONS.md "Mocks").
 * - Seeded deterministically (fixed faker seed + reference date) by app/mocks/seeding.ts.
 * - Persisted to localStorage under a versioned key; falls back to memory when storage is missing.
 * - resetDemoData() throws everything away and reseeds.
 *
 * Records must be JSON-serialisable (store dates as ISO strings). Reads return copies, so mutate
 * only through insert/update/remove.
 */
import type {
  MockAttachment,
  MockAuditEntry,
  MockCostCenter,
  MockDepartment,
  MockDeputy,
  MockJobRun,
  MockNotification,
  MockSite,
  MockUser,
} from './core/types'
import { registeredSeedIds, runSeeds } from './seeding'

export interface MockRecord {
  id: string
}

/**
 * Collection name -> record type. Modules extend it from their mocks/seed.ts:
 *
 *   declare module '~/mocks/db' {
 *     interface MockCollections { trainingRequests: TrainingRequestRecord }
 *   }
 */
export interface MockCollections {
  users: MockUser
  departments: MockDepartment
  sites: MockSite
  costCenters: MockCostCenter
  deputies: MockDeputy
  notifications: MockNotification
  attachments: MockAttachment
  audit: MockAuditEntry
  jobRuns: MockJobRun
}

export type MockCollectionName = keyof MockCollections & string

export type MockDb = {
  readonly [K in MockCollectionName]: MockCollection<
    MockCollections[K] extends MockRecord ? MockCollections[K] : never
  >
}

/** Bump when the shape of persisted data changes incompatibly (old keys are discarded). */
export const DEMO_DB_VERSION = 2
/** Fixed faker seed: same seed + same reference date => same demo data. */
export const DEMO_DB_SEED = 20261013
export const DEMO_DB_STORAGE_PREFIX = 'atrium.demo-db.v'
export const DEMO_DB_STORAGE_KEY = `${DEMO_DB_STORAGE_PREFIX}${DEMO_DB_VERSION}`

export interface DemoDbSnapshot {
  version: number
  seed: number
  /** ISO timestamp used as faker's reference date. */
  refDate: string
  /** Seed ids that produced this data; a mismatch (module added/removed) triggers a reseed. */
  seeds: string[]
  createdAt: string
  collections: Record<string, MockRecord[]>
}

export interface ResetOptions {
  seed?: number
  /** Defaults to the start of the current local day, so "upcoming" demo data stays upcoming. */
  refDate?: Date
}

type Patch<T> = Partial<Omit<T, 'id'>>
type Insert<T extends MockRecord> = Omit<T, 'id'> & { id?: string }

const clone = <T>(value: T): T => structuredClone(value)

export class MockCollection<T extends MockRecord> {
  constructor(
    readonly name: string,
    private readonly rows: () => T[],
    private readonly changed: () => void,
  ) {}

  all(): T[] {
    return this.rows().map(clone)
  }

  find(id: string): T | undefined {
    const row = this.rows().find((item) => item.id === id)
    return row ? clone(row) : undefined
  }

  where(predicate: (row: T) => boolean): T[] {
    return this.rows().filter(predicate).map(clone)
  }

  first(predicate: (row: T) => boolean): T | undefined {
    const row = this.rows().find(predicate)
    return row ? clone(row) : undefined
  }

  exists(id: string): boolean {
    return this.rows().some((item) => item.id === id)
  }

  count(predicate?: (row: T) => boolean): number {
    return predicate ? this.rows().filter(predicate).length : this.rows().length
  }

  insert(input: Insert<T>): T {
    const row = { ...clone(input), id: input.id ?? crypto.randomUUID() } as T
    if (this.exists(row.id)) throw new Error(`[mock-db] ${this.name}: duplicate id ${row.id}`)
    this.rows().push(row)
    this.changed()
    return clone(row)
  }

  insertMany(inputs: readonly Insert<T>[]): T[] {
    return inputs.map((input) => this.insert(input))
  }

  /** Shallow-merge a patch (or the result of a patch function). Returns undefined if not found. */
  update(id: string, patch: Patch<T> | ((current: T) => Patch<T>)): T | undefined {
    const rows = this.rows()
    const index = rows.findIndex((item) => item.id === id)
    const current = rows[index]
    if (!current) return undefined
    const changes = typeof patch === 'function' ? patch(clone(current)) : patch
    const next = { ...current, ...clone(changes), id: current.id } as T
    rows[index] = next
    this.changed()
    return clone(next)
  }

  /** Insert or fully replace a record by id. */
  upsert(row: T): T {
    const rows = this.rows()
    const index = rows.findIndex((item) => item.id === row.id)
    if (index === -1) rows.push(clone(row))
    else rows[index] = clone(row)
    this.changed()
    return clone(row)
  }

  remove(id: string): boolean {
    return this.removeWhere((row) => row.id === id) > 0
  }

  removeWhere(predicate: (row: T) => boolean): number {
    const rows = this.rows()
    let removed = 0
    for (let index = rows.length - 1; index >= 0; index--) {
      if (predicate(rows[index]!)) {
        rows.splice(index, 1)
        removed++
      }
    }
    if (removed > 0) this.changed()
    return removed
  }

  clear(): void {
    this.rows().length = 0
    this.changed()
  }
}

// ---------------------------------------------------------------------------------------------
// State + persistence
// ---------------------------------------------------------------------------------------------

let state: DemoDbSnapshot | null = null
let saveQueued = false
const collections = new Map<string, MockCollection<MockRecord>>()

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Local start of the day: demo data is relative to "today" (SPEC §10). */
export function startOfLocalDay(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

function sameSeeds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

function readSnapshot(): DemoDbSnapshot | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(DEMO_DB_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DemoDbSnapshot
    if (parsed.version !== DEMO_DB_VERSION || !parsed.collections) return null
    if (!Array.isArray(parsed.seeds) || !sameSeeds(parsed.seeds, registeredSeedIds())) return null
    // "Data resets daily": a snapshot seeded for another day is discarded.
    if (!sameDay(new Date(parsed.refDate), startOfLocalDay())) return null
    return parsed
  } catch {
    return null
  }
}

/** Write the current state to localStorage now (normally batched per microtask). */
export function flushDemoData(): void {
  saveQueued = false
  const store = storage()
  if (!store || !state) return
  try {
    store.setItem(DEMO_DB_STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('[mock-db] could not persist demo data (storage full or blocked)', error)
  }
}

function queueSave(): void {
  if (saveQueued) return
  saveQueued = true
  queueMicrotask(flushDemoData)
}

function discardOldVersions(): void {
  const store = storage()
  if (!store) return
  for (let index = store.length - 1; index >= 0; index--) {
    const key = store.key(index)
    if (key?.startsWith(DEMO_DB_STORAGE_PREFIX) && key !== DEMO_DB_STORAGE_KEY) {
      store.removeItem(key)
    }
  }
}

function rowsOf(name: string): MockRecord[] {
  const current = getState()
  return (current.collections[name] ??= [])
}

function createSnapshot(options: ResetOptions = {}): DemoDbSnapshot {
  const seed = options.seed ?? DEMO_DB_SEED
  const refDate = options.refDate ?? startOfLocalDay()
  state = {
    version: DEMO_DB_VERSION,
    seed,
    refDate: refDate.toISOString(),
    seeds: registeredSeedIds(),
    createdAt: new Date().toISOString(),
    collections: {},
  }
  runSeeds(db, { seed, refDate })
  return state
}

function getState(): DemoDbSnapshot {
  if (state) return state
  const persisted = readSnapshot()
  if (persisted) {
    state = persisted
    return state
  }
  discardOldVersions()
  const fresh = createSnapshot()
  flushDemoData()
  return fresh
}

/** Typed access by name; prefer the `db.<name>` shorthand. */
export function collection<K extends MockCollectionName>(name: K): MockDb[K] {
  let existing = collections.get(name)
  if (!existing) {
    existing = new MockCollection<MockRecord>(name, () => rowsOf(name), queueSave)
    collections.set(name, existing)
  }
  return existing as unknown as MockDb[K]
}

const RESERVED = new Set(['then', 'toJSON', 'constructor', 'valueOf', 'toString'])

/** `db.users.find(id)`, `db.trainingRequests.insert({...})`, ... */
export const db: MockDb = new Proxy({} as MockDb, {
  get(_target, property) {
    if (typeof property !== 'string' || RESERVED.has(property) || property.startsWith('__')) {
      return undefined
    }
    return collection(property as MockCollectionName)
  },
})

/** Drop all demo data (memory + localStorage) and reseed. */
export function resetDemoData(options: ResetOptions = {}): DemoDbSnapshot {
  state = null
  storage()?.removeItem(DEMO_DB_STORAGE_KEY)
  const fresh = createSnapshot(options)
  flushDemoData()
  return clone(fresh)
}

/** Deep copy of the current data (debugging, tests). */
export function exportDemoData(): DemoDbSnapshot {
  return clone(getState())
}

/** Forget the in-memory state so the next access reloads from storage (tests). */
export function unloadDemoData(): void {
  state = null
}
