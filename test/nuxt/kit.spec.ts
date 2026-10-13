import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import StatusBadge from '~/components/workflow/StatusBadge.vue'
import ReasonChips from '~/components/workflow/ReasonChips.vue'
import PagePlaceholder from '~/components/data/PagePlaceholder.vue'
import UiConfirmDialog from '~/components/ui/UiConfirmDialog.vue'
import { useConfirm } from '~/composables/useConfirm'

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

  it('UiConfirmDialog resolves true on confirm and false on cancel', async () => {
    const wrapper = await mountSuspended(UiConfirmDialog, { attachTo: document.body })
    const { confirm } = useConfirm()
    const button = async (testId: string) => {
      await vi.waitFor(() => {
        if (!document.querySelector(`[data-testid="${testId}"]`)) throw new Error('not open')
      })
      return document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!
    }

    const accepted = confirm({ title: 'Publish?', confirmLabel: 'Publish now' })
    ;(await button('confirm-accept')).click()
    expect(await accepted).toBe(true)

    const cancelled = confirm({ title: 'Archive?', confirmLabel: 'Archive post' })
    ;(await button('confirm-cancel')).click()
    expect(await cancelled).toBe(false)
    wrapper.unmount()
  })

  it('PagePlaceholder names the owning slice', async () => {
    const page = await mountSuspended(PagePlaceholder, {
      props: { title: 'My trips', slice: 'A2 · Travel', screen: 'SCREENS §5.1' },
    })
    expect(page.find('h1').text()).toBe('My trips')
    expect(page.text()).toContain('A2 · Travel')
  })
})
