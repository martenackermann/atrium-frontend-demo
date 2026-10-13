import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createHttpClient } from '~/lib/api/http'
import { isApiError } from '~/lib/api'
import { USER_IDS } from '~/mocks/core/seed'
import { db, resetDemoData } from '~/mocks/db'
import { createMockServer, TEST_API_BASE } from '~/mocks/node'
import type { InboxResponse, LoginResponse, Page, SearchHit, TimelineEntry } from '~/types/api'
import type {
  AssetCounts,
  AssetDashboard,
  AssetDto,
  AssetListItem,
  AssetModelDto,
  DeviceTypeDto,
  ManufacturerDto,
  MyAssets,
  PlatformDto,
} from '~/modules/assets/api/types'

/** Asset mocks behave like the backend (API.md §6, SPEC §5.3, seed §10.4). */
const server = createMockServer(TEST_API_BASE)
let token: string | null = null
const api = createHttpClient({ baseUrl: TEST_API_BASE, getToken: () => token })

async function signInAs(personaKey: string) {
  const session = await api.post<LoginResponse>('/auth/demo-login', { personaKey })
  token = session.accessToken
}
const failure = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  if (!isApiError(error)) throw new Error(`expected an ApiError, got ${String(error)}`)
  return error
}
const byTag = (tag: string) => db.assets.first((a) => a.number === Number(tag.slice(4)))!

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetDemoData({ refDate: new Date(2026, 9, 13) })
  token = null
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('assets mock API', () => {
  it('seeds the SPEC §10.4 distribution and the story records', () => {
    expect(db.assets.count()).toBe(120)
    expect(db.assetModels.count()).toBe(25)
    const byStatus: Record<string, number> = {}
    for (const a of db.assets.all()) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
    expect(byStatus).toEqual({
      in_use: 82,
      pending_acceptance: 4,
      in_stock: 22,
      in_repair: 5,
      scrapped: 7,
    })
    expect(byTag('AST-00118').assignedUserId).toBe(USER_IDS.emma)
    expect(byTag('AST-00115').status).toBe('pending_acceptance')
  })

  it("lists Emma's devices and lets her accept with a platform", async () => {
    await signInAs('emma')
    const mine = await api.get<MyAssets>('/assets/mine')
    expect(mine.pending.map((a) => a.assetTag).sort()).toEqual(['AST-00115', 'AST-00118'])
    expect(mine.active.map((a) => a.assetTag).sort()).toEqual(['AST-00064', 'AST-00071'])
    const laptop = mine.pending.find((a) => a.assetTag === 'AST-00118')!
    expect(laptop.availableActions).toEqual(['accept', 'decline'])
    expect(laptop.notes).toBeNull()

    const missing = await failure(api.action(`/assets/${laptop.id}`, 'accept', {}))
    expect(missing.status).toBe(422)
    expect(missing.fieldError('platformId')).toBeTruthy()
    const platform = laptop.applicablePlatforms.find((p) => p.name === 'Strata OS 15')!
    const accepted = await api.action<AssetDto>(`/assets/${laptop.id}`, 'accept', {
      platformId: platform.id,
    })
    expect(accepted.status).toBe('in_use')
    expect(accepted.costCenter.code).toBe('CC-2100')
    expect(accepted.platform?.name).toBe('Strata OS 15')
  })

  it('declining puts the device back in stock and out of her inbox', async () => {
    await signInAs('emma')
    const inbox = await api.get<InboxResponse>('/me/inbox', { module: 'assets' })
    expect(inbox.data.map((i) => i.title).sort()).toEqual([
      'Confirm your new laptop',
      'Confirm your new smartphone',
    ])
    const phone = byTag('AST-00115')
    const short = await failure(api.action(`/assets/${phone.id}`, 'decline', { reason: 'no' }))
    expect(short.status).toBe(422)
    const declined = await api.action<AssetDto>(`/assets/${phone.id}`, 'decline', {
      reason: 'I already have a phone.',
    })
    expect(declined).toMatchObject({ status: 'in_stock', assignedUser: null })
    expect((await failure(api.get(`/assets/${phone.id}`))).status).toBe(404)
    const counts = await api.get<AssetCounts>('/assets/queues/counts')
    expect(counts).toEqual({ mine: { pending: 1 }, admin: null })
  })

  it('hides the admin endpoints and other people’s devices', async () => {
    await signInAs('max')
    expect((await failure(api.get('/assets'))).status).toBe(403)
    expect((await failure(api.get(`/assets/${byTag('AST-00118').id}`))).status).toBe(404)
    await signInAs('emma')
    expect((await failure(api.get(`/assets/${byTag('AST-00064').id}/timeline`))).status).toBe(403)
  })

  it('serves the admin inventory, dashboard and counts', async () => {
    await signInAs('arne')
    const page = await api.get<Page<AssetListItem>>('/assets', { perPage: 10, sort: 'assetTag' })
    expect(page.meta.total).toBe(118)
    const tags = page.data.map((a) => a.assetTag)
    expect([...tags].sort()).toEqual(tags)
    const repair = await api.get<Page<AssetListItem>>('/assets', { status: 'in_repair' })
    expect(repair.meta.total).toBe(5)
    const tag = await api.get<Page<AssetListItem>>('/assets', { q: 'ast-00118' })
    expect(tag.data.map((a) => a.assetTag)).toEqual(['AST-00118'])
    const dashboard = await api.get<AssetDashboard>('/assets/dashboard')
    expect(dashboard.totals.all).toBe(118)
    expect(dashboard.pendingAcceptance).toMatchObject({ total: 4, overdue: 1 })
    expect(dashboard.recentActivity).toHaveLength(10)
    // "Waiting since" is the assignment date, not the asset's last change.
    const oldest = dashboard.pendingAcceptance.oldest[0]!
    expect(oldest.model.name).toBe('Quillon Slate 11 64 GB Silver')
    const open = db.assetAssignments.first((a) => a.assetId === oldest.id && !a.acceptedAt)!
    const detail = await api.get<AssetDto>(`/assets/${oldest.id}`)
    await api.patch(`/assets/${oldest.id}`, {
      notes: 'Waits on the shelf.',
      version: detail.version,
    })
    const after = await api.get<AssetDashboard>('/assets/dashboard')
    const row = after.pendingAcceptance.oldest.find((a) => a.id === oldest.id)!
    expect(row.assignedAt).toBe(open.assignedAt)
    expect(row.updatedAt).not.toBe(row.assignedAt)
    const counts = await api.get<AssetCounts>('/assets/queues/counts')
    expect(counts.admin).toEqual({
      pendingAcceptance: 4,
      acceptanceOverdue: 1,
      inRepair: 5,
      inStock: 22,
    })
  })

  it('runs the admin lifecycle with field diffs and the cost-centre rule', async () => {
    await signInAs('arne')
    const stock = db.assets.first((a) => a.status === 'in_stock' && !a.deletedAt)!
    const assigned = await api.action<AssetDto>(`/assets/${stock.id}`, 'assign', {
      userId: USER_IDS.emma,
      note: 'For the new desk',
    })
    expect(assigned.status).toBe('pending_acceptance')
    expect(assigned.availableActions).toEqual(['unassign', 'edit'])
    const cc = db.costCenters.first((c) => c.code === 'CC-4100')!
    const locked = await failure(
      api.patch(`/assets/${stock.id}`, { costCenterId: cc.id, version: assigned.version }),
    )
    expect(locked.status).toBe(422)
    const unassigned = await api.action<AssetDto>(`/assets/${stock.id}`, 'unassign', {})
    expect(unassigned.status).toBe('in_stock')
    const edited = await api.patch<AssetDto>(`/assets/${stock.id}`, {
      notes: 'Spare',
      version: unassigned.version,
    })
    expect(edited.notes).toBe('Spare')
    const stale = await failure(
      api.patch(`/assets/${stock.id}`, { notes: 'x', version: unassigned.version }),
    )
    expect(stale.code).toBe('version_conflict')
    const timeline = await api.get<TimelineEntry[]>(`/assets/${stock.id}/timeline`)
    const assign = timeline.find((e) => e.action === 'assign' && e.reason === 'For the new desk')
    expect(assign?.summary).toBe('Arne Assets assigned the device to Emma Employee (back office)')
    expect(timeline.at(-1)?.changes?.[0]).toMatchObject({ field: 'notes', label: 'Notes' })
  })

  it('keeps the catalogue consistent', async () => {
    await signInAs('arne')
    const types = await api.get<DeviceTypeDto[]>('/assets/catalog/device-types')
    expect(types.map((t) => t.code)).toEqual([
      'laptop',
      'desktop',
      'monitor',
      'smartphone',
      'tablet',
      'headset',
      'dock',
    ])
    const dock = types.find((t) => t.code === 'dock')!
    expect((await failure(api.delete(`/assets/catalog/device-types/${dock.id}`))).code).toBe(
      'in_use',
    )
    const manufacturers = await api.get<ManufacturerDto[]>('/assets/catalog/manufacturers', {
      deviceTypeId: types.find((t) => t.code === 'tablet')!.id,
    })
    expect(manufacturers.map((m) => m.name)).toEqual(['Marlowe Mobile', 'Quillon Devices'])
    const platforms = await api.get<PlatformDto[]>('/assets/catalog/platforms', {
      includeArchived: true,
    })
    expect(platforms.find((p) => p.name === 'Pocket OS 17')?.archived).toBe(true)
    const models = await api.get<Page<AssetModelDto>>('/assets/catalog/models', {
      perPage: 100,
    })
    expect(models.meta.total).toBe(23)
    const used = models.data.find((m) => m.assetCount > 0)!
    expect((await failure(api.delete(`/assets/catalog/models/${used.id}`))).code).toBe(
      'model_in_use',
    )
  })

  it('searches assets by tag (admins) and own serials (users)', async () => {
    await signInAs('arne')
    const hits = await api.get<{ data: SearchHit[] }>('/search', { q: 'AST-00064' })
    expect(hits.data.find((h) => h.module === 'assets')?.link).toMatch(
      /^\/back-office\/assets\/inventory\//,
    )
    await signInAs('emma')
    const none = await api.get<{ data: SearchHit[] }>('/search', { q: 'AST-00072' })
    expect(none.data.filter((h) => h.module === 'assets')).toEqual([])
  })
})
