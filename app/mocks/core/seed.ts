/**
 * Core seed (SPEC §2, §10.1): 6 departments, 4 sites, 9 cost centres, the 52 users from
 * users.json (the backend's export with fixed UUIDs, SPEC_RESOLUTIONS #5), deputies S-D1…S-D3 and core.* in-app
 * notifications (#7: slices seed notifications for their own records).
 * Runs before every module seed.
 */
import type { AssignableRole, PersonaKey } from '~/types/api'
import { defineMockSeed, type SeedContext } from '../define'
import { recordAudit } from './audit'
import type { MockUser } from './types'
import usersJson from './users.json'

/** Shape of users.json (copied from the backend export by `pnpm mocks:users`). */
export interface SeedUser {
  id: string
  /** Stable seed handle shared with the backend (`emma`, `hilTech1`, `sdkAgent3`, …). */
  handle: string
  email: string
  firstName: string
  lastName: string
  jobTitle: string | null
  employeeNumber: string
  phone: string | null
  departmentCode: string | null
  siteCode: string | null
  costCenterCode: string
  managerId: string | null
  isSiteManager: boolean
  active: boolean
  roles: string[]
  personaKey: string | null
}

interface SeedOrg {
  sites: Array<{ id: string; code: string; name: string }>
  departments: Array<{ id: string; code: string; name: string; headId: string | null }>
  costCenters: Array<{
    id: string
    code: string
    name: string
    departmentId: string | null
    active: boolean
  }>
  users: SeedUser[]
}

const ORG = usersJson as SeedOrg

/** Sites, departments and cost centres with the backend's ids (users.json). */
export const SITES = ORG.sites
export const DEPARTMENTS = ORG.departments
export const COST_CENTERS = ORG.costCenters
export const SEED_USERS = ORG.users

const NAMED = [
  'emma',
  'max',
  'sofia',
  'clara',
  'tom',
  'tina',
  'arne',
  'paula',
  'ian',
  'priya',
  'victor',
  'helen',
  'grace',
] as const
export type NamedUser = (typeof NAMED)[number]

/** Every seed user's id by handle (`USER_IDS.emma`, `USER_IDS.hilTech1`) — same ids as the backend. */
export const USER_IDS = Object.fromEntries(
  SEED_USERS.map((user) => [user.handle, user.id]),
) as Record<NamedUser, string> & Record<string, string | undefined>

for (const handle of NAMED) {
  if (!USER_IDS[handle]) throw new Error(`users.json is missing the seed user "${handle}"`)
}

/** Default cost centre for assets in stock (SPEC §9 DEFAULT_COST_CENTER_CODE = CC-4900). */
export const DEFAULT_ASSET_COST_CENTER_ID =
  COST_CENTERS.find((row) => row.code === 'CC-4900')?.id ?? COST_CENTERS[0]!.id

export interface PersonaInfo {
  tagline: string
  highlights: string[]
}

/** Login cards (SCREENS §2 /login, API.md Persona). Order as SPEC §2.3. */
export const PERSONAS: Record<PersonaKey, PersonaInfo> = {
  emma: {
    tagline: 'Typical requester with something waiting in every module',
    highlights: [
      'Two new devices to accept',
      'A car rental waiting for approval, with 2 reasons',
      'Two ratings due and learning goals to write',
      'A people request waiting for her reply',
    ],
  },
  max: {
    tagline: 'Approves for two teams – one escalated past a site manager',
    highlights: [
      "Approvals for Emma and for Sofia's Hillford team",
      'Active deputy for Priya Raman',
      'Team tab with manager-chain overrides',
      "Owes a progress rating for Emma's training",
    ],
  },
  sofia: {
    tagline: "Site manager whose team's approvals skip to Max",
    highlights: [
      'Six reports; their approvals escalate past her',
      'High-priority train trip tomorrow',
      "Max's deputy from next week",
      'A €5,600 training waiting for Clara',
    ],
  },
  clara: {
    tagline: 'Chief executive at the top of every chain',
    highlights: [
      'Three executive approvals over €5,000',
      'Approves her department heads',
      'Her own flight skipped approval',
      'Helen Brooks is her permanent deputy',
    ],
  },
  tom: {
    tagline: 'Travel desk with high-priority bookings',
    highlights: [
      'Three high-priority bookings',
      'Cancellations to confirm',
      'Bookings with confirmation PDF and PIN',
      'Car-class catalogue',
    ],
  },
  tina: {
    tagline: 'Training office: booking, billing and feedback',
    highlights: [
      'To-book and cancellation queues',
      'A failed booking to retry',
      'Billing status and actual cost',
      'Ratings overview with overdue reminders',
    ],
  },
  arne: {
    tagline: 'Asset manager for 120 devices',
    highlights: [
      'Dashboard and inventory',
      "Assigns Emma's new devices",
      'Repair and scrap',
      'Field-level change history',
    ],
  },
  paula: {
    tagline: 'People ops partner and news editor',
    highlights: [
      'People-ops queue across all statuses',
      'Personal data and internal notes',
      'Two scheduled news posts',
      'Useful links',
    ],
  },
  ian: {
    tagline: 'IT admin who sees every back office',
    highlights: [
      'User and role administration',
      'Audit log and job runner',
      'Cannot approve requests',
      'Sees personal data redacted',
    ],
  },
}

const byCode = <T extends { id: string; code: string }>(rows: readonly T[], code: string | null) =>
  code ? (rows.find((row) => row.code === code)?.id ?? null) : null

function seedOrg({ db }: SeedContext) {
  for (const row of SITES) db.sites.insert({ ...row })
  for (const row of DEPARTMENTS) db.departments.insert({ ...row })
  for (const row of COST_CENTERS) db.costCenters.insert({ ...row })
}

function seedUsers({ db, at }: SeedContext) {
  const createdAt = at(-400)
  for (const user of SEED_USERS) {
    const record: MockUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: `${user.firstName} ${user.lastName}`,
      jobTitle: user.jobTitle,
      employeeNumber: user.employeeNumber,
      phone: user.phone,
      departmentId: byCode(DEPARTMENTS, user.departmentCode),
      siteId: byCode(SITES, user.siteCode),
      costCenterId: byCode(COST_CENTERS, user.costCenterCode) ?? DEFAULT_ASSET_COST_CENTER_ID,
      managerId: user.managerId,
      isSiteManager: user.isSiteManager,
      active: user.active,
      roles: user.roles as AssignableRole[],
      personaKey: user.personaKey as PersonaKey | null,
      lastLoginAt: user.personaKey ? at(-1, 8, 30) : null,
      createdAt,
      version: 1,
    }
    db.users.insert(record)
  }
}

/** S-D1 Priya → Max (d-2…d+12), S-D2 Max → Sofia (d+7…d+21), S-D3 Clara → Helen (permanent). */
function seedDeputies(context: SeedContext) {
  const { db, d, at } = context
  // Same days, times and texts as the backend core seed (core.deputy_assigned template).
  const rows = [
    {
      principal: 'priya',
      deputy: 'max',
      from: d(-2),
      to: d(12),
      note: 'Annual leave',
      at: [-5, 10],
    },
    {
      principal: 'max',
      deputy: 'sofia',
      from: d(7),
      to: d(21),
      note: 'Conference week',
      at: [-3, 14],
    },
    { principal: 'clara', deputy: 'helen', from: null, to: null, note: null, at: [-200, 9] },
  ] as const
  for (const row of rows) {
    const principal = db.users.find(USER_IDS[row.principal])!
    const deputy = db.users.find(USER_IDS[row.deputy])!
    const createdAt = at(row.at[0], row.at[1])
    const created = db.deputies.insert({
      principalId: principal.id,
      deputyId: deputy.id,
      validFrom: row.from,
      validTo: row.to,
      note: row.note,
      createdById: principal.id,
      createdAt,
    })
    recordAudit(db, {
      module: 'core',
      entityType: 'deputy',
      entityId: created.id,
      entityLabel: `${deputy.displayName} for ${principal.displayName}`,
      action: 'create',
      actorId: principal.id,
      actingAs: 'self',
      summary: `${principal.displayName} named ${deputy.displayName} as deputy`,
      occurredAt: createdAt,
    })
    const window =
      row.from && row.to ? `from ${row.from} to ${row.to}` : 'permanently (no end date)'
    db.notifications.insert({
      userId: deputy.id,
      templateId: 'core.deputy_assigned',
      module: 'core',
      title: `${principal.displayName} named you as deputy`,
      body: `You can approve training and travel requests for ${principal.displayName} ${window}.${row.note ? ` Note: ${row.note}` : ''}`,
      link: '/settings/deputies',
      priority: 'normal',
      // The permanent deputy (S-D3) read it long ago; the two recent ones are unread.
      readAt: row.from ? null : at(row.at[0] + 1, row.at[1]),
      createdAt,
    })
  }
}

function seedJobRuns({ db, at }: SeedContext) {
  db.jobRuns.insert({
    jobName: 'core.purge',
    triggeredBy: 'cron',
    triggeredById: null,
    startedAt: at(0, 3, 10),
    finishedAt: at(0, 3, 10),
    status: 'succeeded',
    summary: { stagedAttachments: 2, idempotencyKeys: 41, sessions: 6 },
    error: null,
  })
}

export default defineMockSeed({
  order: 0,
  run(context) {
    seedOrg(context)
    seedUsers(context)
    seedDeputies(context)
    seedJobRuns(context)
  },
})
