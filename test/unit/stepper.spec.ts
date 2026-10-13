import { describe, expect, it } from 'vitest'
import { canGoTo, clampIndex, stepState, visibleSteps, type StepDef } from '~/lib/stepper'

const steps: StepDef[] = [
  { id: 'kind', label: 'Trip' },
  { id: 'outbound', label: 'Outbound' },
  { id: 'return', label: 'Return', skip: true },
  { id: 'review', label: 'Review' },
]

describe('stepper logic', () => {
  it('hides skipped steps (one-way flight has no Return)', () => {
    expect(visibleSteps(steps).map((step) => step.id)).toEqual(['kind', 'outbound', 'review'])
  })

  it('marks done, current and upcoming steps', () => {
    expect([0, 1, 2].map((index) => stepState(index, 1, 1))).toEqual([
      'done',
      'current',
      'upcoming',
    ])
  })

  it('keeps steps reached earlier as done after going back', () => {
    // Reached step 2, went back to step 0: steps 1 and 2 stay clickable.
    expect([0, 1, 2].map((index) => stepState(index, 0, 2))).toEqual(['current', 'done', 'done'])
    expect(canGoTo(2, 0, 2)).toBe(true)
  })

  it('does not allow jumping ahead to steps never reached', () => {
    expect(canGoTo(2, 0, 0)).toBe(false)
    expect(canGoTo(1, 1, 0)).toBe(true)
  })

  it('clamps indexes into range', () => {
    expect(clampIndex(-1, 3)).toBe(0)
    expect(clampIndex(5, 3)).toBe(2)
    expect(clampIndex(0, 0)).toBe(0)
  })
})
