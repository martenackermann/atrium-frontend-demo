<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { CircleDot } from '@lucide/vue'
import { REASON_ICONS } from '~/lib/reasons'
import { cn } from '~/lib/cn'
import type { ReasonChip } from '~/types/ui'

/**
 * ReasonChips (DESIGN §8.2/§9): the "Needs approval because…" reasons with their SPEC §6.3 labels.
 * - `pill` (wide contexts, inbox reasons box; `inMarker` gives them a marker hairline)
 * - `lines` (inside the stepper slip: plain icon + text lines, DESIGN R2)
 * `interactive` makes each reason a button that emits `select(code)` to focus its field.
 */
const props = withDefaults(
  defineProps<{
    reasons: readonly ReasonChip[]
    variant?: 'pill' | 'lines'
    interactive?: boolean
    inMarker?: boolean
    class?: HTMLAttributes['class']
  }>(),
  { variant: 'pill' },
)
defineEmits<{ select: [code: string] }>()

const iconOf = (reason: ReasonChip) => reason.icon ?? REASON_ICONS[reason.code] ?? CircleDot
</script>

<template>
  <ul
    v-if="reasons.length"
    :class="
      cn(
        'm-0 list-none p-0',
        variant === 'pill' ? 'flex flex-wrap gap-1.5' : 'grid divide-y divide-rule',
        props.class,
      )
    "
  >
    <li
      v-for="reason in reasons"
      :key="reason.code"
      class="animate-[atrium-chip-in_var(--dur-3)_var(--curve-out)]"
    >
      <component
        :is="interactive ? 'button' : 'span'"
        :type="interactive ? 'button' : undefined"
        :class="
          cn(
            'text-left',
            variant === 'pill'
              ? [
                  'inline-flex min-h-7 items-center gap-1.5 rounded-pill border bg-sheet py-[3px] pr-2.5 pl-2 text-sm leading-tight font-medium text-ink',
                  inMarker
                    ? 'border-[color-mix(in_srgb,var(--marker-strong)_45%,transparent)]'
                    : 'border-rule-strong',
                ]
              : 'flex w-full items-start gap-2 py-1.5 text-sm leading-[18px] text-ink',
            interactive &&
              'transition-colors duration-(--dur-1) hover:border-field hover:text-ink focus-visible:outline-2 focus-visible:outline-focus',
          )
        "
        @click="interactive && $emit('select', reason.code)"
      >
        <component
          :is="iconOf(reason)"
          class="mt-px size-3.5 flex-none text-ink-muted"
          aria-hidden="true"
        />
        <span>{{ reason.label }}</span>
      </component>
    </li>
  </ul>
</template>
