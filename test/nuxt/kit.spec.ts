import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import StatusBadge from '~/components/workflow/StatusBadge.vue'
import ReasonChips from '~/components/workflow/ReasonChips.vue'
import PagePlaceholder from '~/components/data/PagePlaceholder.vue'

describe('UI kit in the Nuxt runtime', () => {
  it('StatusBadge renders the viewer-relative label and tone', async () => {
    const waiting = await mountSuspended(StatusBadge, {
      props: { enum: 'travelStatus', value: 'pending_approval' },
    })
    expect(waiting.text()).toContain('Awaiting approval')
    expect(waiting.attributes('data-tone')).toBe('waiting')

    const mine = await mountSuspended(StatusBadge, {
      props: {
        enum: 'travelStatus',
        value: 'pending_approval',
        availableActions: ['approve', 'decline'],
      },
    })
    expect(mine.text()).toContain('Needs your approval')
    expect(mine.attributes('data-tone')).toBe('you')
  })

  it('ReasonChips lists every reason', async () => {
    const chips = await mountSuspended(ReasonChips, {
      props: {
        reasons: [
          { code: 'over_budget', label: 'Over €500' },
          { code: 'high_priority', label: 'Starts tomorrow' },
        ],
      },
    })
    expect(chips.text()).toContain('Over €500')
    expect(chips.text()).toContain('Starts tomorrow')
  })

  it('PagePlaceholder names the owning slice', async () => {
    const page = await mountSuspended(PagePlaceholder, {
      props: { title: 'My trips', slice: 'A2 · Travel', screen: 'SCREENS §5.1' },
    })
    expect(page.find('h1').text()).toBe('My trips')
    expect(page.text()).toContain('A2 · Travel')
  })
})
