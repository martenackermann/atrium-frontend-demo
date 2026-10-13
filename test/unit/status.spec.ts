import { describe, expect, it } from 'vitest'
import { DESIGN_TONES, STATUS_MAP, resolveStatus, toDesignTone } from '~/lib/status'
import type { EnumOption } from '~/types/api'

describe('StatusBadge tone mapping', () => {
  it('uses only the seven DESIGN tones in the status map', () => {
    for (const states of Object.values(STATUS_MAP)) {
      for (const presentation of Object.values(states)) {
        expect(DESIGN_TONES).toContain(presentation.tone)
      }
    }
  })

  it('maps API states to label and tone', () => {
    expect(resolveStatus('travelStatus', 'pending_approval')).toMatchObject({
      label: 'Awaiting approval',
      tone: 'waiting',
      actor: false,
    })
    expect(resolveStatus('attendeeStatus', 'booked')).toMatchObject({
      label: 'Booked',
      tone: 'positive',
    })
    expect(resolveStatus('attendeeStatus', 'declined').tone).toBe('negative')
    expect(resolveStatus('attendeeStatus', 'booking_impossible').tone).toBe('blocked')
    expect(resolveStatus('travelStatus', 'to_book').tone).toBe('moving')
  })

  it('renders "Needs your approval" in the you tone when availableActions holds a decision', () => {
    expect(
      resolveStatus('travelStatus', 'pending_approval', {
        availableActions: ['approve', 'decline'],
      }),
    ).toMatchObject({ label: 'Needs your approval', tone: 'you', actor: true })
    // A non-decision action (withdraw) does not make the viewer the actor.
    expect(
      resolveStatus('travelStatus', 'pending_approval', { availableActions: ['withdraw'] }).tone,
    ).toBe('waiting')
  })

  it('lets an explicit actor flag win', () => {
    expect(resolveStatus('travelStatus', 'to_book', { actor: true })).toMatchObject({
      label: 'Book it',
      tone: 'you',
    })
    expect(
      resolveStatus('travelStatus', 'pending_approval', {
        actor: false,
        availableActions: ['approve'],
      }).actor,
    ).toBe(false)
  })

  it('prefers enum labels and tones from /meta/enums and tolerates legacy tones', () => {
    // A legacy tone ('success') from an older API build still maps to a DESIGN tone.
    const enumOptions = [
      { value: 'booked', label: 'Booked by desk', tone: 'success', description: null },
    ] as unknown as EnumOption[]
    expect(resolveStatus('travelStatus', 'booked', { enumOptions })).toMatchObject({
      label: 'Booked by desk',
      tone: 'positive',
    })
    expect(toDesignTone('warning')).toBe('moving')
    expect(toDesignTone('nonsense')).toBeNull()
  })

  it('falls back to a sentence-cased label for unknown states', () => {
    expect(resolveStatus('travelStatus', 'on_hold')).toMatchObject({
      label: 'On hold',
      tone: 'neutral',
    })
  })
})
