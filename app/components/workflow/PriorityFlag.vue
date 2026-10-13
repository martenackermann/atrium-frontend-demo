<script setup lang="ts">
import { AlarmClock, Signal, SignalHigh, SignalLow, SignalMedium } from '@lucide/vue'
import { dueLabel } from '~/lib/due'

/**
 * PriorityFlag (DESIGN §2.4 flags) — never a coloured stripe:
 * - `startsAt` + `high`: negative text + alarm-clock + "Starts in 2 days" (travel/training urgency)
 * - `dueAt`: "Due yesterday" / "Overdue since 8 Oct" in negative when past, muted otherwise
 * - `level`: people-request priority as a signal meter with the word (tooltip on desktop)
 */
const props = defineProps<{
  startsAt?: string | null
  high?: boolean
  dueAt?: string | null
  level?: 'critical' | 'high' | 'normal' | 'low' | null
  /** Show the priority word next to the signal icon. */
  showLabel?: boolean
}>()

const startsLabel = computed(() => {
  const days = daysFromToday(props.startsAt)
  if (days === null) return null
  if (days < 0) return 'Started'
  if (days === 0) return 'Starts today'
  if (days === 1) return 'Starts tomorrow'
  return `Starts in ${days} days`
})

const due = computed(() => dueLabel(props.dueAt))

// Drawn as a meter: a faint full `signal` track with the level's bars inked on top (low = the
// empty track), so a single short bar never reads as a stray comma.
const LEVELS = {
  critical: { icon: SignalHigh, label: 'Critical priority', class: 'text-st-negative' },
  high: { icon: SignalMedium, label: 'High priority', class: 'text-ink' },
  normal: { icon: SignalLow, label: 'Normal priority', class: 'text-ink-muted' },
  low: { icon: null, label: 'Low priority', class: 'text-ink-subtle' },
} as const
const level = computed(() => (props.level ? LEVELS[props.level] : null))
</script>

<template>
  <span
    v-if="high && startsLabel"
    class="inline-flex items-center gap-1 text-sm font-semibold text-st-negative"
  >
    <AlarmClock class="size-3.5" aria-hidden="true" />{{ startsLabel }}
  </span>
  <span
    v-else-if="due"
    class="text-sm"
    :class="due.overdue ? 'font-semibold text-st-negative' : 'text-ink-muted'"
    >{{ due.text }}</span
  >
  <UiTooltip v-else-if="level" :content="level.label" :disabled="showLabel">
    <span class="inline-flex items-center gap-1 text-sm" :class="level.class">
      <span class="relative grid size-4 flex-none" aria-hidden="true">
        <Signal class="col-start-1 row-start-1 size-4 text-rule-strong" />
        <component
          :is="level.icon"
          v-if="level.icon"
          class="col-start-1 row-start-1 size-4"
          :stroke-width="2"
        />
      </span>
      <span :class="showLabel ? '' : 'sr'">{{ level.label }}</span>
    </span>
  </UiTooltip>
</template>
