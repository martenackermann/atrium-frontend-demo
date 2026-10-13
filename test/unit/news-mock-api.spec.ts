import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createHttpClient } from '~/lib/api/http'
import { isApiError } from '~/lib/api'
import { db, resetDemoData } from '~/mocks/db'
import { createMockServer, TEST_API_BASE } from '~/mocks/node'
import type { MyDay } from '~/modules/home/api/types'
import type { NewsPostDetail, NewsPostSummary, UsefulLinkDto } from '~/modules/news/api/types'
import { publishAndExpire } from '~/modules/news/mocks/workflow'
import { sanitizeNewsHtml } from '~/modules/news/mocks/sanitize'
import type { LoginResponse, Page, TimelineEntry } from '~/types/api'

/** News, links and Home mocks (slice A4): SPEC §10.6 seed, §5.5 lifecycle, API.md §7.2-§7.4. */
const server = createMockServer(TEST_API_BASE)
let token: string | null = null
const api = createHttpClient({ baseUrl: TEST_API_BASE, getToken: () => token })

async function as(personaKey: string) {
  token = (await api.post<LoginResponse>('/auth/demo-login', { personaKey })).accessToken
}
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (isApiError(error) ? error : null),
  )
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetDemoData({ refDate: new Date(2026, 9, 13) })
  token = null
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('news mock API', () => {
  it('shows employees the published posts, pinned first', async () => {
    await as('emma')
    const page = await api.get<Page<NewsPostSummary>>('/news', { status: 'draft' })
    expect(page.data.map((post) => post.title)).toEqual([
      'Welcome to Atrium',
      'Travel desk hours during the holidays',
      'Atrium update: deputies with validity windows',
      'Hillford site: new parking arrangement',
    ])
    expect(page.data[0]?.coverImage?.url).toContain('/files/')
    const draft = db.newsPosts.first((row) => row.status === 'draft')!
    expect((await failure(api.get(`/news/${draft.id}`)))?.status).toBe(404)
  })

  it('runs the editor lifecycle with guards', async () => {
    await as('paula')
    const all = await api.get<Page<NewsPostSummary>>('/news', { perPage: 50 })
    expect(all.meta.total).toBe(8)
    const post = await api.post<NewsPostDetail>('/news', {
      title: 'Safety week',
      type: 'information',
      summary: '',
      bodyHtml: '<p onclick="x()">Hi <script>alert(1)</script><a href="javascript:x">there</a></p>',
    })
    expect(post).toMatchObject({ status: 'draft', bodyHtml: '<p>Hi there</p>' })
    const guard = await failure(api.action(`/news/${post.id}`, 'publish'))
    expect(guard?.fieldErrors.summary).toBeDefined()
    await api.patch(`/news/${post.id}`, { summary: 'Workshops all week.' })
    const soon = await failure(
      api.action(`/news/${post.id}`, 'schedule', { publishAt: inMinutes(1) }),
    )
    expect(soon?.fieldErrors.publishAt).toBeDefined()
    const scheduled = await api.action<NewsPostDetail>(`/news/${post.id}`, 'schedule', {
      publishAt: inMinutes(30),
    })
    expect(scheduled).toMatchObject({
      status: 'scheduled',
      availableActions: ['publish', 'unschedule', 'edit'],
    })
    expect(publishAndExpire(new Date(Date.now() + 31 * 60_000))).toEqual({
      published: 1,
      expired: 0,
    })
    const live = await api.get<NewsPostDetail>(`/news/${post.id}`)
    expect(live.status).toBe('published')
    expect((await failure(api.delete(`/news/${post.id}`)))?.code).toBe('invalid_transition')
    await api.action(`/news/${post.id}`, 'archive')
    await api.delete(`/news/${post.id}`)
    expect((await failure(api.get(`/news/${post.id}`)))?.status).toBe(404)
    const timeline = await failure(api.get<TimelineEntry[]>(`/news/${post.id}/timeline`))
    expect(timeline?.status).toBe(404)
    await as('emma')
    expect(
      (
        await failure(
          api.post('/news', { title: 'Mine', type: 'update', summary: 'x', bodyHtml: 'x' }),
        )
      )?.status,
    ).toBe(403)
  })

  it('manages links for editors and hides inactive ones', async () => {
    await as('emma')
    expect(await api.get<UsefulLinkDto[]>('/links', { includeInactive: 'true' })).toHaveLength(9)
    await as('paula')
    const all = await api.get<UsefulLinkDto[]>('/links', { includeInactive: 'true' })
    expect(all).toHaveLength(10)
    const bad = await failure(api.post('/links', { title: 'X', url: 'http://x.example.com' }))
    expect(bad?.fieldErrors.url).toBeDefined()
    const reversed = all.map((link) => link.id).reverse()
    const ordered = await api.put<UsefulLinkDto[]>('/links/order', { ids: reversed })
    expect(ordered.map((link) => link.id)).toEqual(reversed)
  })

  it('serves My day with inbox head, news and links', async () => {
    await as('emma')
    const day = await api.get<MyDay>('/home/my-day')
    // All modules contribute (same order as the API): ratings due first, the question last.
    expect(day.inbox.total).toBe(6)
    expect(day.inbox.top).toHaveLength(5)
    expect(day.inbox.top[0]).toMatchObject({ type: 'training.rating_due', reference: 'TRN-000004' })
    expect(day.news.map((post) => post.title)[0]).toBe('Welcome to Atrium')
    expect(day.news).toHaveLength(3)
    expect(day.links).toHaveLength(9)
  })

  it('sanitises to the allowlist', () => {
    expect(
      sanitizeNewsHtml('<h1>A</h1><b>B</b><a href="https://wiki.example.com">w</a><img src=x>'),
    ).toBe(
      '<h2>A</h2><strong>B</strong><a href="https://wiki.example.com" rel="noopener noreferrer" target="_blank">w</a>',
    )
  })
})
