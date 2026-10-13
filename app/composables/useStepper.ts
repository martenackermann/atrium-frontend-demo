import { canGoTo, clampIndex, stepState, visibleSteps, type StepDef } from '~/lib/stepper'

export interface StepperOptions {
  /** Validate the current step before moving forward (return false to stay). */
  validate?: (stepId: string) => boolean | Promise<boolean>
  /** Start at this step id (e.g. restored from a draft). */
  initial?: string
}

/**
 * Stepper controller for <StepperPage>:
 *
 *   const stepper = useStepper(() => [
 *     { id: 'trip', label: 'Trip' }, { id: 'vehicle', label: 'Vehicle' }, …
 *     { id: 'return', label: 'Return', skip: form.tripType === 'one_way' },
 *   ], { validate: (id) => validateStep(id) })
 */
export function useStepper(
  steps: MaybeRefOrGetter<readonly StepDef[]>,
  options: StepperOptions = {},
) {
  const all = computed(() => toValue(steps))
  const list = computed(() => visibleSteps(all.value))
  const currentId = ref(options.initial ?? list.value[0]?.id ?? '')
  const reachedId = ref(currentId.value)

  const index = computed(() => {
    const found = list.value.findIndex((step) => step.id === currentId.value)
    return found >= 0 ? found : 0
  })
  const reached = computed(() =>
    Math.max(
      list.value.findIndex((step) => step.id === reachedId.value),
      index.value,
    ),
  )
  const current = computed(() => list.value[index.value])
  const isFirst = computed(() => index.value === 0)
  const isLast = computed(() => index.value === list.value.length - 1)
  const nextStep = computed(() => list.value[index.value + 1])
  const previousStep = computed(() => list.value[index.value - 1])
  const validating = ref(false)

  function setIndex(target: number) {
    const step = list.value[clampIndex(target, list.value.length)]
    if (!step) return
    currentId.value = step.id
    if (target > reached.value) reachedId.value = step.id
  }

  async function next(): Promise<boolean> {
    if (isLast.value || !current.value) return false
    validating.value = true
    try {
      const ok = options.validate ? await options.validate(current.value.id) : true
      if (ok) setIndex(index.value + 1)
      return ok
    } finally {
      validating.value = false
    }
  }

  function back() {
    if (!isFirst.value) setIndex(index.value - 1)
  }

  function goTo(id: string) {
    const target = list.value.findIndex((step) => step.id === id)
    if (target >= 0 && canGoTo(target, index.value, reached.value)) setIndex(target)
  }

  function stateOf(id: string) {
    const target = list.value.findIndex((step) => step.id === id)
    return stepState(target, index.value, reached.value)
  }

  return {
    steps: list,
    current,
    currentId,
    index,
    isFirst,
    isLast,
    nextStep,
    previousStep,
    validating,
    next,
    back,
    goTo,
    stateOf,
    canGoTo: (id: string) =>
      canGoTo(
        list.value.findIndex((step) => step.id === id),
        index.value,
        reached.value,
      ),
  }
}

export type StepperController = ReturnType<typeof useStepper>
