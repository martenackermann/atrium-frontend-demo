/**
 * Stepper state (DESIGN §9 Stepper): done steps are clickable to go back; the current step carries
 * aria-current; upcoming steps are not clickable until reached. Steps can be skipped dynamically
 * (a one-way flight has no Return step). Pure functions — `useStepper` wraps them reactively.
 */
export interface StepDef {
  id: string
  label: string
  /** Hidden from the track and skipped by next/back (e.g. Return for one-way flights). */
  skip?: boolean
}

export type StepState = 'done' | 'current' | 'upcoming'

export function visibleSteps(steps: readonly StepDef[]): StepDef[] {
  return steps.filter((step) => !step.skip)
}

/** State of the step at `index` given the current step and the furthest step reached. */
export function stepState(index: number, current: number, reached: number): StepState {
  if (index === current) return 'current'
  if (index < current || index <= reached) return 'done'
  return 'upcoming'
}

/** A step is reachable when it has been reached before (done) or is the current one. */
export function canGoTo(index: number, current: number, reached: number): boolean {
  return index === current || index <= Math.max(reached, current)
}

export function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), Math.max(length - 1, 0))
}
