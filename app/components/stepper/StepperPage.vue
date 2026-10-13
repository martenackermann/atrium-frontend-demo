<script setup lang="ts">
import { ArrowLeft, ArrowRight, Check, ChevronUp, Moon, Stamp, Sun, X } from '@lucide/vue'
import type { RouteLocationRaw } from 'vue-router'
import type { StepperController } from '~/composables/useStepper'

/**
 * StepperPage (DESIGN §7 "Focus mode", §8.2; SCREENS §1.7 Stepper). Use with
 * `definePageMeta({ layout: 'focus' })`. The app nav drops away; a slim top bar holds the mark,
 * the request name in serif, "Draft saved in this browser", Discard draft, theme and close (which
 * keeps the draft). One sheet carries the step track, the form column and the sticky summary slip
 * (360px; 320px under 1100px). Under 900px the track becomes "Step 2 of 6 · Vehicle" + a segment
 * bar and the slip becomes a bottom strip ("Needs approval · 2 reasons" + names) that opens as a
 * sheet; actions are a fixed bottom bar.
 *
 * Slots: default (the current step's fields, usually <StepperStep>), #summary (usually
 * <StepperSlip>).
 */
const props = withDefaults(
  defineProps<{
    title: string
    stepper: StepperController
    /** Where close / submit-cancel go. */
    closeTo: RouteLocationRaw
    savedAt?: Date | null
    submitLabel?: string
    submitting?: boolean
    /** Mobile summary strip: headline + the reason names (principle 4 without a tap). */
    strip?: { title: string; detail?: string; tone?: 'waiting' | 'positive' } | null
  }>(),
  { submitLabel: 'Submit request' },
)
const emit = defineEmits<{ submit: []; discard: [] }>()

const theme = useTheme()
const { confirm } = useConfirm()
const sheetOpen = ref(false)

const stepNumber = computed(() => props.stepper.index.value + 1)
const total = computed(() => props.stepper.steps.value.length)
const now = useNow({ scheduler: (callback) => useIntervalFn(callback, 30_000) })
const savedLabel = computed(() => {
  if (!props.savedAt) return null
  const minutes = Math.round((now.value.getTime() - props.savedAt.getTime()) / 60_000)
  return minutes < 1 ? 'Draft saved in this browser' : `Draft saved ${minutes} min ago`
})

/** After a failed step: focus the first field with an error (its message is announced too). */
function focusFirstError() {
  const form = document.getElementById('stepper-form')
  const alert = form?.querySelector<HTMLElement>('[role="alert"]')
  const control = alert?.parentElement?.querySelector<HTMLElement>(
    'input:not([type="hidden"]):not([aria-hidden="true"]),textarea,[role="combobox"],[role="radio"],button[role="checkbox"],[role="switch"]',
  )
  control?.focus()
}

/** After moving on: the new step's question takes focus, so screen readers start there. */
function focusQuestion() {
  const form = document.getElementById('stepper-form')
  form?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  form?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
}

async function onNext() {
  if (props.stepper.isLast.value) {
    emit('submit')
    return
  }
  const ok = await props.stepper.next()
  await nextTick()
  if (ok) focusQuestion()
  else focusFirstError()
}

function onBack() {
  props.stepper.back()
  void nextTick(focusQuestion)
}

async function discard() {
  const ok = await confirm({
    title: 'Discard this draft?',
    description: 'Everything you entered in this request is deleted from this browser.',
    confirmLabel: 'Discard draft',
    cancelLabel: 'Keep draft',
    destructive: true,
  })
  if (ok) emit('discard')
}
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header
      class="sticky top-0 z-20 flex h-[52px] items-center gap-2.5 bg-[color-mix(in_srgb,var(--desk)_90%,transparent)] pr-2 pl-4 backdrop-blur-[8px] md:h-[60px] md:gap-3.5 md:pr-5 md:pl-6"
    >
      <NuxtLink :to="closeTo" aria-label="Atrium, leave and keep the draft"
        ><AppBrandMark class="size-6"
      /></NuxtLink>
      <div class="flex min-w-0 items-baseline gap-3.5 border-l border-rule-strong pl-2.5 md:pl-3.5">
        <h1
          class="truncate font-display text-[19px] leading-[26px] font-normal tracking-[-0.01em] md:text-[21px]"
        >
          {{ title }}
        </h1>
        <span
          v-if="savedLabel"
          class="inline-flex items-center gap-1 text-[12.5px] whitespace-nowrap text-ink-muted max-md:hidden"
        >
          <Check class="size-3.5 text-st-positive" aria-hidden="true" />{{ savedLabel }}
        </span>
      </div>
      <div class="ml-auto flex items-center gap-1">
        <UiButton variant="ghost" size="sm" class="max-md:hidden" @click="discard"
          >Discard draft</UiButton
        >
        <UiIconButton
          :icon="theme.resolved.value === 'dark' ? Moon : Sun"
          label="Switch theme"
          @click="theme.toggle()"
        />
        <UiIconButton :icon="X" label="Close and keep the draft" :to="closeTo" />
      </div>
    </header>

    <main id="main" class="flex-1 min-[901px]:px-6 min-[901px]:pt-1 min-[901px]:pb-10">
      <div
        class="mx-auto max-w-[1180px] bg-sheet min-[901px]:grid min-[901px]:grid-cols-[minmax(0,1fr)_320px] min-[901px]:items-start min-[901px]:rounded-xl min-[901px]:border min-[901px]:border-rule min-[901px]:shadow-sheet min-[1101px]:grid-cols-[minmax(0,1fr)_var(--summary-w)]"
      >
        <!-- Step track -->
        <nav
          aria-label="Steps"
          class="col-span-2 border-b border-rule px-5 py-3 min-[901px]:px-7 min-[901px]:py-[18px]"
        >
          <ol class="m-0 flex list-none p-0 max-[900px]:hidden">
            <li
              v-for="(step, index) in stepper.steps.value"
              :key="step.id"
              class="flex flex-[1_1_auto] items-center last:flex-none after:mx-3 after:min-w-4 after:flex-1 after:border-t-[1.5px] after:border-dashed after:border-rule-strong last:after:hidden"
              :class="stepper.stateOf(step.id) === 'done' && 'after:border-solid after:border-ink'"
            >
              <component
                :is="stepper.stateOf(step.id) === 'done' ? 'button' : 'span'"
                :type="stepper.stateOf(step.id) === 'done' ? 'button' : undefined"
                class="group flex items-center"
                :aria-current="stepper.stateOf(step.id) === 'current' ? 'step' : undefined"
                @click="stepper.stateOf(step.id) === 'done' && stepper.goTo(step.id)"
              >
                <span
                  aria-hidden="true"
                  class="grid size-[26px] flex-none place-items-center rounded-full border-[1.5px] text-meta font-semibold"
                  :class="{
                    'border-ink bg-ink text-sheet': stepper.stateOf(step.id) === 'done',
                    'border-marker-strong bg-marker font-bold text-marker-ink':
                      stepper.stateOf(step.id) === 'current',
                    'border-rule-strong bg-sheet text-ink-subtle':
                      stepper.stateOf(step.id) === 'upcoming',
                  }"
                >
                  <Check
                    v-if="stepper.stateOf(step.id) === 'done'"
                    class="size-3.5"
                    :stroke-width="2.5"
                    aria-hidden="true"
                  />
                  <template v-else>{{ index + 1 }}</template>
                </span>
                <!-- Below 1100px only the current label shows; the others stay for screen readers. -->
                <span
                  class="ml-2.5 text-[13.5px] font-medium whitespace-nowrap"
                  :class="{
                    'text-ink-muted group-hover:text-ink group-hover:underline group-hover:decoration-rule-strong':
                      stepper.stateOf(step.id) === 'done',
                    'font-[650] text-ink': stepper.stateOf(step.id) === 'current',
                    'text-ink-subtle': stepper.stateOf(step.id) === 'upcoming',
                    'max-[1100px]:sr': stepper.stateOf(step.id) !== 'current',
                  }"
                  >{{ step.label
                  }}<span class="sr">{{
                    stepper.stateOf(step.id) === 'done'
                      ? ', done'
                      : stepper.stateOf(step.id) === 'upcoming'
                        ? ', not reached yet'
                        : ''
                  }}</span></span
                >
              </component>
            </li>
          </ol>
          <div class="grid gap-2 text-[13.5px] text-ink-muted min-[901px]:hidden">
            <p>
              Step <span class="num">{{ stepNumber }}</span> of
              <span class="num">{{ total }}</span> ·
              <b class="font-[650] text-ink">{{ stepper.current.value?.label }}</b>
            </p>
            <div
              class="grid gap-1"
              :style="{ gridTemplateColumns: `repeat(${total}, 1fr)` }"
              aria-hidden="true"
            >
              <i
                v-for="index in total"
                :key="index"
                class="h-1 rounded-[2px]"
                :class="
                  index - 1 < stepper.index.value
                    ? 'bg-ink'
                    : index - 1 === stepper.index.value
                      ? 'bg-marker-strong'
                      : 'bg-rule'
                "
              />
            </div>
          </div>
        </nav>

        <!-- Form column -->
        <form
          id="stepper-form"
          class="min-w-0 px-4 pt-6 pb-[164px] min-[768px]:px-5 min-[901px]:px-8 min-[901px]:pt-8 min-[901px]:pb-0 min-[1101px]:px-12 min-[1101px]:pt-10"
          novalidate
          @submit.prevent="onNext"
        >
          <slot :step="stepper.current.value" />

          <div
            class="fixed inset-x-0 bottom-0 z-[14] flex items-center gap-2 border-t border-rule bg-sheet px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] min-[901px]:sticky min-[901px]:-mx-8 min-[901px]:mt-7 min-[901px]:rounded-bl-xl min-[901px]:px-8 min-[901px]:pt-4 min-[901px]:pb-5 min-[901px]:shadow-[0_-8px_16px_-12px_rgb(40_32_20/0.12)] min-[1101px]:-mx-12 min-[1101px]:px-12"
          >
            <UiButton
              v-if="!stepper.isFirst.value"
              variant="ghost"
              :icon="ArrowLeft"
              class="max-md:size-11 max-md:px-0"
              :aria-label="`Back to ${stepper.previousStep.value?.label}`"
              @click="onBack"
            >
              <span class="max-md:hidden">Back to {{ stepper.previousStep.value?.label }}</span>
            </UiButton>
            <span class="flex-1 max-md:hidden" />
            <UiButton
              type="submit"
              variant="primary"
              :icon-right="stepper.isLast.value ? undefined : ArrowRight"
              :loading="stepper.validating.value || submitting"
              class="max-md:h-11 max-md:flex-1"
            >
              {{ stepper.isLast.value ? submitLabel : `Next: ${stepper.nextStep.value?.label}` }}
            </UiButton>
          </div>
        </form>

        <!-- Summary slip (desktop) / bottom strip + sheet (≤ 900px) -->
        <aside
          class="min-[901px]:sticky min-[901px]:top-[72px] min-[901px]:m-7 min-[901px]:ml-0 min-[901px]:max-h-[calc(100dvh-96px)] min-[901px]:overflow-y-auto min-[901px]:rounded-lg min-[901px]:border min-[901px]:border-rule-strong min-[901px]:bg-raised min-[901px]:shadow-pop"
          aria-label="Summary"
        >
          <button
            type="button"
            class="fixed inset-x-0 bottom-[calc(65px+env(safe-area-inset-bottom))] z-[13] flex items-center gap-2.5 rounded-t-[14px] border-t border-rule-strong bg-raised px-4 py-2.5 text-left shadow-[0_-6px_14px_-8px_rgb(40_32_20/0.22)] min-[901px]:hidden"
            :aria-expanded="sheetOpen"
            @click="sheetOpen = true"
          >
            <Stamp
              v-if="strip?.tone !== 'positive'"
              class="size-4 text-st-waiting"
              aria-hidden="true"
            />
            <Check v-else class="size-4 text-st-positive" aria-hidden="true" />
            <span class="grid min-w-0 flex-1 leading-[18px]">
              <b class="text-[13.5px] font-[650]">{{ strip?.title ?? 'Summary' }}</b>
              <span v-if="strip?.detail" class="truncate text-[12.5px] text-ink-muted">{{
                strip.detail
              }}</span>
            </span>
            <ChevronUp class="size-4 text-ink-muted" aria-hidden="true" />
          </button>
          <div class="p-5 max-[900px]:hidden">
            <slot name="summary" />
          </div>
        </aside>
      </div>
    </main>

    <UiDialog v-model:open="sheetOpen" :title="title" class="min-[901px]:hidden">
      <slot name="summary" />
    </UiDialog>
  </div>
</template>
