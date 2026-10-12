import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { filterNavEntries } from '~/lib/navigation'
import type { NavEntry } from '~/types/navigation'

describe('navigation', () => {
  it('filters entries (and children) by role and sorts them', () => {
    const entries: NavEntry[] = [
      { id: 'b', label: 'B', to: '/b', order: 20 },
      { id: 'admin', label: 'Admin', to: '/admin', roles: ['it_admin'] },
      {
        id: 'a',
        label: 'A',
        to: '/a',
        order: 10,
        children: [{ id: 'a.queue', label: 'Queue', to: '/a/queue', roles: ['training_admin'] }],
      },
    ]
    const visible = filterNavEntries(entries, ['employee'])
    expect(visible.map((entry) => entry.id)).toEqual(['a', 'b'])
    expect(visible[0]?.children).toEqual([])
    expect(filterNavEntries(entries, ['it_admin']).map((entry) => entry.id)).toContain('admin')
  })

  it('useNavigation() aggregates the nav.ts of every module (Nuxt runtime)', async () => {
    const Probe = defineComponent({
      setup() {
        const { entries } = useNavigation()
        return () =>
          h(
            'ul',
            entries.value.map((entry) => h('li', entry.id)),
          )
      },
    })
    const wrapper = await mountSuspended(Probe)
    const ids = wrapper.findAll('li').map((item) => item.text())
    expect(ids).toEqual(expect.arrayContaining(['home', 'training', 'travel', 'news']))
    expect(ids[0]).toBe('home')
  })
})
