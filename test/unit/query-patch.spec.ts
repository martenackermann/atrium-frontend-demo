import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { patchQuery } from '~/utils/query'

function makeRouter() {
  const component = { template: '<div />' }
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/desk', component },
      { path: '/other', component },
    ],
  })
}

describe('patchQuery', () => {
  it('keeps both patches when a second one starts before the first navigation ends', async () => {
    const router = makeRouter()
    await router.push('/desk?queue=all')
    // A debounced search and SplitInbox's auto-selection in the same tick.
    const search = patchQuery(router, { q: 'TRV-000003', selected: undefined })
    const select = patchQuery(router, { selected: 'abc' })
    await Promise.all([search, select])
    expect(router.currentRoute.value.query).toEqual({
      queue: 'all',
      q: 'TRV-000003',
      selected: 'abc',
    })
  })

  it('removes keys patched to undefined and ignores a pending patch of another path', async () => {
    const router = makeRouter()
    await router.push('/desk?queue=all&q=x')
    await patchQuery(router, { q: undefined })
    expect(router.currentRoute.value.query).toEqual({ queue: 'all' })

    const stale = patchQuery(router, { selected: 'a' })
    await router.push('/other?tab=updates')
    await stale.catch(() => undefined)
    await patchQuery(router, { high: 'true' })
    expect(router.currentRoute.value.fullPath).toBe('/other?tab=updates&high=true')
  })
})
