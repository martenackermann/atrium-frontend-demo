/**
 * Asset seed plan, mirrored from the backend (atrium-backend-demo src/modules/assets/seed/*.plan.ts)
 * so demo mode shows the same SPEC §10.4 story: catalogue (7 device types, 8 manufacturers,
 * 6 platforms, 25 models) and 120 assets as event histories. Keep both copies in sync.
 */

export const SEED_DEVICE_TYPES = [
  { code: 'laptop', name: 'Laptop', requiresPlatform: true, sortOrder: 10 },
  { code: 'desktop', name: 'Desktop', requiresPlatform: true, sortOrder: 20 },
  { code: 'monitor', name: 'Monitor', requiresPlatform: false, sortOrder: 30 },
  { code: 'smartphone', name: 'Smartphone', requiresPlatform: true, sortOrder: 40 },
  { code: 'tablet', name: 'Tablet', requiresPlatform: true, sortOrder: 50 },
  { code: 'headset', name: 'Headset', requiresPlatform: false, sortOrder: 60 },
  { code: 'dock', name: 'Docking station', requiresPlatform: false, sortOrder: 70 },
] as const

export type DeviceTypeCode = (typeof SEED_DEVICE_TYPES)[number]['code']

export const SEED_MANUFACTURERS: { name: string; types: DeviceTypeCode[]; serialPrefix: string }[] =
  [
    { name: 'Vireo Computing', types: ['laptop', 'desktop', 'dock'], serialPrefix: 'VRC' },
    { name: 'Quillon Devices', types: ['laptop', 'tablet'], serialPrefix: 'QLD' },
    { name: 'Marlowe Mobile', types: ['smartphone', 'tablet'], serialPrefix: 'MRL' },
    { name: 'Skylark Displays', types: ['monitor'], serialPrefix: 'SKY' },
    { name: 'Corvane', types: ['monitor', 'dock'], serialPrefix: 'CVN' },
    { name: 'Brightfield Audio', types: ['headset'], serialPrefix: 'BFA' },
    { name: 'Tessaract Systems', types: ['laptop', 'desktop'], serialPrefix: 'TSS' },
    { name: 'Novaline Mobile', types: ['smartphone'], serialPrefix: 'NVL' },
  ]

export const SEED_PLATFORMS: { name: string; types: DeviceTypeCode[]; archived?: boolean }[] = [
  { name: 'Atlas Desktop 11', types: ['laptop', 'desktop'] },
  { name: 'Atlas Desktop 12', types: ['laptop', 'desktop'] },
  { name: 'Strata OS 15', types: ['laptop', 'desktop'] },
  { name: 'Pocket OS 17', types: ['smartphone', 'tablet'], archived: true },
  { name: 'Pocket OS 18', types: ['smartphone', 'tablet'] },
  { name: 'Verdant Mobile 14', types: ['smartphone', 'tablet'] },
]

export interface SeedModel {
  name: string
  manufacturer: string
  type: DeviceTypeCode
  storageGb?: number
  color?: string
  archived?: boolean
  /** Platform the holder installs on accept (devices that require one). */
  platform?: string
}

export const SEED_MODELS: SeedModel[] = [
  // laptops (6, 1 archived)
  {
    name: 'Vireo Pro 14',
    manufacturer: 'Vireo Computing',
    type: 'laptop',
    platform: 'Strata OS 15',
  },
  {
    name: 'Vireo Air 13',
    manufacturer: 'Vireo Computing',
    type: 'laptop',
    platform: 'Strata OS 15',
  },
  {
    name: 'Vireo Pro 13 Classic',
    manufacturer: 'Vireo Computing',
    type: 'laptop',
    archived: true,
    platform: 'Atlas Desktop 11',
  },
  {
    name: 'Quillon Book 14',
    manufacturer: 'Quillon Devices',
    type: 'laptop',
    platform: 'Atlas Desktop 12',
  },
  {
    name: 'Tessaract Workbook 14',
    manufacturer: 'Tessaract Systems',
    type: 'laptop',
    platform: 'Atlas Desktop 12',
  },
  {
    name: 'Tessaract Workbook 16',
    manufacturer: 'Tessaract Systems',
    type: 'laptop',
    platform: 'Atlas Desktop 12',
  },
  // desktops (2)
  {
    name: 'Vireo Tower S',
    manufacturer: 'Vireo Computing',
    type: 'desktop',
    platform: 'Strata OS 15',
  },
  {
    name: 'Tessaract Mini D5',
    manufacturer: 'Tessaract Systems',
    type: 'desktop',
    platform: 'Atlas Desktop 11',
  },
  // monitors (4)
  { name: 'Skylark View 24', manufacturer: 'Skylark Displays', type: 'monitor' },
  { name: 'Skylark View 27', manufacturer: 'Skylark Displays', type: 'monitor' },
  { name: 'Corvane C27 QHD', manufacturer: 'Corvane', type: 'monitor' },
  { name: 'Corvane C34 Ultrawide', manufacturer: 'Corvane', type: 'monitor' },
  // smartphones (6, 1 archived) - storage and colour are part of the name
  {
    name: 'Marlowe X5 128 GB Midnight',
    manufacturer: 'Marlowe Mobile',
    type: 'smartphone',
    storageGb: 128,
    color: 'Midnight',
    platform: 'Pocket OS 18',
  },
  {
    name: 'Marlowe X5 256 GB Silver',
    manufacturer: 'Marlowe Mobile',
    type: 'smartphone',
    storageGb: 256,
    color: 'Silver',
    platform: 'Pocket OS 18',
  },
  {
    name: 'Marlowe X4 64 GB Graphite',
    manufacturer: 'Marlowe Mobile',
    type: 'smartphone',
    storageGb: 64,
    color: 'Graphite',
    archived: true,
    platform: 'Pocket OS 17',
  },
  {
    name: 'Novaline N8 128 GB Black',
    manufacturer: 'Novaline Mobile',
    type: 'smartphone',
    storageGb: 128,
    color: 'Black',
    platform: 'Verdant Mobile 14',
  },
  {
    name: 'Novaline N8 128 GB Ocean',
    manufacturer: 'Novaline Mobile',
    type: 'smartphone',
    storageGb: 128,
    color: 'Ocean',
    platform: 'Verdant Mobile 14',
  },
  {
    name: 'Novaline N9 256 GB Black',
    manufacturer: 'Novaline Mobile',
    type: 'smartphone',
    storageGb: 256,
    color: 'Black',
    platform: 'Verdant Mobile 14',
  },
  // tablets (3)
  {
    name: 'Quillon Slate 11 64 GB Silver',
    manufacturer: 'Quillon Devices',
    type: 'tablet',
    storageGb: 64,
    color: 'Silver',
    platform: 'Verdant Mobile 14',
  },
  {
    name: 'Quillon Slate 13 256 GB Graphite',
    manufacturer: 'Quillon Devices',
    type: 'tablet',
    storageGb: 256,
    color: 'Graphite',
    platform: 'Verdant Mobile 14',
  },
  {
    name: 'Marlowe Tab 10 128 GB Midnight',
    manufacturer: 'Marlowe Mobile',
    type: 'tablet',
    storageGb: 128,
    color: 'Midnight',
    platform: 'Pocket OS 18',
  },
  // headsets (2)
  { name: 'Brightfield Duo', manufacturer: 'Brightfield Audio', type: 'headset' },
  { name: 'Brightfield Solo', manufacturer: 'Brightfield Audio', type: 'headset' },
  // docks (2)
  { name: 'Vireo Dock U4', manufacturer: 'Vireo Computing', type: 'dock' },
  { name: 'Corvane Hub 8', manufacturer: 'Corvane', type: 'dock' },
]

export type SeedEvent =
  | { t: 'create'; day: number; by?: string }
  | { t: 'assign'; day: number; to: string; by?: string; note?: string }
  /** `cc` = the user's cost centre at that time (when it differs from today's, a sync follows). */
  | { t: 'accept'; day: number; cc?: string }
  | { t: 'decline'; day: number; reason: string }
  | { t: 'unassign'; day: number; reason?: string; by?: string }
  | { t: 'return'; day: number; condition: 'ok' | 'damaged'; note?: string; by?: string }
  | { t: 'send_to_repair'; day: number; note: string; by?: string }
  | { t: 'complete_repair'; day: number; note?: string; by?: string }
  | { t: 'scrap'; day: number; reason: string; by?: string }
  | { t: 'delete'; day: number; by?: string }
  | {
      t: 'update'
      day: number
      by?: string
      set: { serialNumber?: 'fix_typo'; notes?: string; name?: string }
    }
  | { t: 'cost_center_sync'; day: number; to: string }
  /** System reminder; the seeder moves it to a weekday (SPEC_RESOLUTIONS #21). */
  | { t: 'remind'; day: number }

export interface SeedAssetSpec {
  /** Story id (S-A1...) for documentation and MSW parity. */
  story?: string
  /** Explicit asset number for story records. */
  number?: number
  model: string
  events: SeedEvent[]
}

/** Persona devices that stay in use: [handle, model, created day offset]. */
type Holding = [string, string, number]

const inUse = (
  to: string,
  model: string,
  created: number,
  extra: SeedEvent[] = [],
  cc?: string,
): SeedAssetSpec => ({
  model,
  events: [
    { t: 'create', day: created },
    { t: 'assign', day: created + 2, to },
    { t: 'accept', day: created + 3, cc },
    ...extra,
  ],
})

/** Builds the 120 asset histories. `pick(min, max)` must be deterministic (seeded faker). */
export function planAssets(pick: (min: number, max: number) => number): SeedAssetSpec[] {
  const assets: SeedAssetSpec[] = []

  // --- Emma: S-A1..S-A4 ---------------------------------------------------------------
  assets.push({
    story: 'S-A1',
    number: 118,
    model: 'Vireo Pro 14',
    events: [
      { t: 'create', day: -6 },
      { t: 'assign', day: -1, to: 'emma', note: 'Pre-installed with the field-service toolkit.' },
    ],
  })
  assets.push({
    story: 'S-A2',
    number: 115,
    model: 'Marlowe X5 128 GB Midnight',
    events: [
      { t: 'create', day: -12 },
      { t: 'assign', day: -4, to: 'emma' },
      { t: 'remind', day: -1 },
    ],
  })
  assets.push({
    story: 'S-A3',
    number: 64,
    ...inUse('emma', 'Skylark View 27', -420, [
      { t: 'update', day: -300, set: { serialNumber: 'fix_typo' } },
    ]),
  })
  assets.push({ story: 'S-A4', number: 71, ...inUse('emma', 'Brightfield Duo', -380) })

  // --- the other personas (2-4 devices each) -------------------------------------------
  const personaHoldings: Holding[] = [
    ['max', 'Skylark View 27', -540],
    ['sofia', 'Quillon Book 14', -480],
    ['sofia', 'Marlowe X5 256 GB Silver', -360],
    ['sofia', 'Quillon Slate 11 64 GB Silver', -250],
    ['clara', 'Vireo Air 13', -200],
    ['clara', 'Marlowe X5 256 GB Silver', -190],
    ['clara', 'Marlowe Tab 10 128 GB Midnight', -160],
    ['clara', 'Corvane C34 Ultrawide', -600],
    ['tom', 'Tessaract Workbook 14', -700],
    ['tom', 'Skylark View 24', -700],
    ['tom', 'Brightfield Solo', -420],
    ['tina', 'Vireo Air 13', -330],
    ['tina', 'Skylark View 24', -650],
    ['arne', 'Vireo Pro 14', -260],
    ['arne', 'Novaline N9 256 GB Black', -140],
    ['arne', 'Corvane C27 QHD', -500],
    ['arne', 'Vireo Dock U4', -260],
    ['paula', 'Quillon Book 14', -410],
    ['paula', 'Skylark View 24', -610],
    ['paula', 'Brightfield Duo', -300],
    ['ian', 'Tessaract Workbook 16', -230],
    ['ian', 'Corvane C34 Ultrawide', -560],
    ['ian', 'Novaline N8 128 GB Ocean', -330],
  ]
  for (const [to, model, created] of personaHoldings) assets.push(inUse(to, model, created))
  assets.push(
    inUse('max', 'Vireo Pro 14', -540, [
      { t: 'update', day: -200, set: { notes: 'Battery replaced under warranty.' } },
    ]),
  )
  // Max's phone is in repair but stays his (it returns to him after the repair).
  assets.push(
    inUse('max', 'Novaline N8 128 GB Black', -300, [
      {
        t: 'send_to_repair',
        day: -5,
        note: 'Cracked screen after a site visit; courier pickup booked.',
      },
    ]),
  )
  assets.push(
    inUse('ian', 'Tessaract Mini D5', -560, [
      { t: 'update', day: -400, by: 'ian', set: { name: 'ITO-ADMIN-01' } },
    ]),
  )

  // --- other pending acceptances ---------------------------------------------------------
  assets.push({
    model: 'Quillon Slate 11 64 GB Silver',
    events: [
      { t: 'create', day: -20 },
      { t: 'assign', day: -10, to: 'hilTech2', note: 'Tablet for the digital job sheets.' },
      { t: 'remind', day: -7 },
      { t: 'remind', day: -4 },
      { t: 'remind', day: -1 },
    ],
  })
  assets.push({
    model: 'Brightfield Solo',
    events: [
      { t: 'create', day: -90 },
      { t: 'assign', day: -2, to: 'sdkAgent5', by: 'ito5' },
    ],
  })

  // --- other in repair -----------------------------------------------------------------------
  assets.push(
    inUse('rivSeniorTech', 'Tessaract Workbook 14', -640, [
      { t: 'send_to_repair', day: -9, note: 'Fan noise and overheating under load.' },
    ]),
  )
  assets.push(
    inUse('hilTech6', 'Vireo Pro 13 Classic', -1100, [
      { t: 'return', day: -15, condition: 'damaged', note: 'Hinge broken.' },
    ]),
  )
  assets.push({
    model: 'Novaline N8 128 GB Black',
    events: [
      { t: 'create', day: -200 },
      { t: 'send_to_repair', day: -25, note: 'Does not charge.' },
    ],
  })
  assets.push(
    inUse('formerHilTech', 'Marlowe Tab 10 128 GB Midnight', -280, [
      {
        t: 'return',
        day: -60,
        condition: 'damaged',
        note: 'Screen cracked. Returned at the end of employment.',
      },
    ]),
  )

  // --- scrapped (2 also soft-deleted) ----------------------------------------------------
  assets.push(
    inUse('formerSdkAgent', 'Vireo Pro 13 Classic', -1300, [
      { t: 'return', day: -400, condition: 'damaged', note: 'Does not power on.' },
      { t: 'scrap', day: -380, reason: 'Mainboard failure; repair not economical.' },
      { t: 'delete', day: -200 },
    ]),
  )
  assets.push(
    inUse('sdkAgent6', 'Vireo Pro 13 Classic', -1250, [
      { t: 'return', day: -500, condition: 'ok' },
      { t: 'scrap', day: -450, reason: 'End of life: battery health below 60 %.' },
    ]),
  )
  assets.push({
    model: 'Tessaract Workbook 14',
    events: [
      { t: 'create', day: -900 },
      { t: 'send_to_repair', day: -300, note: 'Liquid damage.' },
      { t: 'scrap', day: -280, reason: 'Liquid damage; not repairable.' },
    ],
  })
  assets.push({
    model: 'Skylark View 24',
    events: [
      { t: 'create', day: -1200 },
      { t: 'update', day: -700, set: { notes: 'Dead pixels across the lower edge.' } },
      { t: 'scrap', day: -690, reason: 'Dead pixels; out of warranty.' },
      { t: 'delete', day: -600 },
    ],
  })
  assets.push(
    inUse('fin3', 'Corvane C27 QHD', -1000, [
      { t: 'return', day: -350, condition: 'damaged', note: 'Backlight flickers.' },
      { t: 'scrap', day: -340, reason: 'Backlight failure.' },
    ]),
  )
  assets.push(
    inUse('easTech4', 'Marlowe X4 64 GB Graphite', -1000, [
      { t: 'return', day: -420, condition: 'ok' },
      { t: 'scrap', day: -410, reason: 'Pocket OS 17 is no longer supported.' },
    ]),
  )
  assets.push({
    model: 'Brightfield Solo',
    events: [
      { t: 'create', day: -800 },
      { t: 'scrap', day: -150, reason: 'Cable damaged.' },
    ],
  })

  // --- in stock (22; 3 returned, 1 declined, 1 unassigned) -----------------------------------
  const stock = (model: string, created: number): SeedAssetSpec => ({
    model,
    events: [{ t: 'create', day: created }],
  })
  assets.push(
    stock('Vireo Pro 14', -6),
    stock('Vireo Pro 14', -6),
    stock('Tessaract Workbook 16', -30),
  )
  assets.push(stock('Vireo Pro 13 Classic', -1150))
  assets.push(
    inUse('formerSdkAgent', 'Quillon Book 14', -700, [
      { t: 'return', day: -130, condition: 'ok' },
      { t: 'update', day: -129, set: { notes: 'Wiped and re-imaged; ready for re-use.' } },
    ]),
  )
  assets.push({
    model: 'Vireo Air 13',
    events: [
      { t: 'create', day: -45 },
      { t: 'assign', day: -20, to: 'sdkAgent7', by: 'ito5' },
      { t: 'decline', day: -19, reason: 'I work at a fixed desk and asked for a desktop instead.' },
    ],
  })
  assets.push(
    stock('Skylark View 24', -90),
    stock('Skylark View 24', -90),
    stock('Skylark View 24', -90),
  )
  assets.push(stock('Skylark View 27', -90), stock('Skylark View 27', -90))
  assets.push(
    inUse('sdkAgent4', 'Skylark View 27', -500, [{ t: 'return', day: -20, condition: 'ok' }]),
  )
  assets.push(stock('Corvane C27 QHD', -300))
  assets.push({
    model: 'Corvane C34 Ultrawide',
    events: [
      { t: 'create', day: -120 },
      { t: 'assign', day: -50, to: 'fin2' },
      { t: 'unassign', day: -48, reason: 'Assigned by mistake.' },
    ],
  })
  assets.push(stock('Novaline N9 256 GB Black', -40), stock('Marlowe X5 128 GB Midnight', -12))
  assets.push(
    inUse('easTech4', 'Marlowe X5 256 GB Silver', -400, [
      { t: 'return', day: -12, condition: 'ok', note: 'Moved to a desk role.' },
    ]),
  )
  assets.push(stock('Vireo Tower S', -200))
  assets.push(
    stock('Quillon Slate 13 256 GB Graphite', -60),
    stock('Quillon Slate 11 64 GB Silver', -20),
  )
  assets.push(stock('Brightfield Duo', -150), stock('Corvane Hub 8', -200))

  // --- everyone else's devices in use (55) ------------------------------------------------
  const rotation: Record<string, string[]> = {
    laptop: [
      'Vireo Pro 14',
      'Quillon Book 14',
      'Tessaract Workbook 14',
      'Vireo Air 13',
      'Tessaract Workbook 16',
    ],
    desktop: ['Tessaract Mini D5', 'Vireo Tower S'],
    monitor: ['Skylark View 24', 'Skylark View 27', 'Corvane C27 QHD', 'Corvane C34 Ultrawide'],
    smartphone: [
      'Novaline N8 128 GB Black',
      'Marlowe X5 128 GB Midnight',
      'Novaline N8 128 GB Ocean',
      'Marlowe X5 256 GB Silver',
      'Novaline N9 256 GB Black',
    ],
    tablet: ['Quillon Slate 13 256 GB Graphite', 'Marlowe Tab 10 128 GB Midnight'],
    headset: ['Brightfield Duo', 'Brightfield Solo'],
    dock: ['Vireo Dock U4', 'Corvane Hub 8'],
  }
  const holders: Record<string, string[]> = {
    laptop: [
      'priya',
      'victor',
      'helen',
      'grace',
      'exoAssistant',
      'ito1',
      'ito2',
      'ito3',
      'ito4',
      'ito5',
      'sdkLead',
      'easLead',
      'rivDispatcher',
      'ppl1',
      'ppl3',
      'hilTech1',
      'hilTech3',
      'easTech1',
      'easTech2',
      'sdkAgent1',
    ],
    desktop: ['fin1', 'fin2', 'fin3', 'fin4', 'ppl2', 'ppl4'],
    monitor: [
      'priya',
      'victor',
      'helen',
      'grace',
      'exoAssistant',
      'ito1',
      'ito2',
      'fin1',
      'fin2',
      'sdkLead',
      'sdkAgent1',
      'sdkAgent2',
    ],
    smartphone: [
      'priya',
      'victor',
      'helen',
      'grace',
      'easLead',
      'rivDispatcher',
      'rivSeniorTech',
      'hilTech1',
      'hilTech3',
      'easTech1',
      'easTech2',
    ],
    tablet: ['hilTech4', 'easTech3'],
    headset: ['sdkAgent2', 'sdkAgent3'],
    dock: ['ito1', 'ito2'],
  }
  for (const [type, people] of Object.entries(holders)) {
    people.forEach((to, i) => {
      const models = rotation[type] ?? []
      const model = models[i % models.length]!
      const created = -pick(60, 900)
      if (type === 'laptop' && to === 'victor') {
        assets.push(
          inUse(to, model, created, [
            { t: 'update', day: created + 10, set: { serialNumber: 'fix_typo' } },
          ]),
        )
      } else if (type === 'laptop' && to === 'rivDispatcher') {
        // Moved from Eastgate to Riverton: the nightly job synced the device's cost centre.
        assets.push(
          inUse(to, model, -480, [{ t: 'cost_center_sync', day: -120, to: 'CC-2100' }], 'CC-2300'),
        )
      } else if (type === 'laptop' && to === 'ppl3') {
        assets.push(
          inUse(to, model, -260, [{ t: 'cost_center_sync', day: -75, to: 'CC-6100' }], 'CC-5100'),
        )
      } else {
        assets.push(inUse(to, model, created))
      }
    })
  }

  return assets
}
