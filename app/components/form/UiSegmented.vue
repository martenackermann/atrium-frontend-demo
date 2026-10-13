<script setup lang="ts" generic="T extends string | number">
import type { HTMLAttributes } from 'vue'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { cn } from '~/lib/cn'
import { useControlSize } from '~/lib/field'
import { selectFocusedRadio } from '~/lib/radio'

/**
 * Segmented control (DESIGN §9): well track, sheet thumb. For gearbox choices, list filters and
 * the 1–6 grade picker. `stackOnMobile` turns it into stacked radios below 768px. Sizes itself
 * to its options (never stretched by a grid); 36px tall in a FilterBar, 40px segments on phones.
 */
const props = withDefaults(
  defineProps<{
    options: readonly { value: T; label: string; count?: number }[]
    /** Accessible name of the group. */
    label: string
    size?: 'sm' | 'md'
    stackOnMobile?: boolean
    class?: HTMLAttributes['class']
  }>(),
  { size: 'md' },
)
const model = defineModel<T>()
const inFilterBar = useControlSize() === 'filter'

const stringValue = computed({
  get: () => (model.value === undefined ? undefined : String(model.value)),
  set: (value) => {
    const match = props.options.find((option) => String(option.value) === value)
    if (match) model.value = match.value
  },
})
</script>

<template>
  <RadioGroupRoot
    v-model="stringValue"
    :aria-label="label"
    orientation="horizontal"
    @keydown="selectFocusedRadio"
    :class="
      cn(
        'inline-flex max-w-full gap-0.5 justify-self-start rounded-[10px] border border-rule-strong bg-well p-[3px] max-md:p-0.5',
        stackOnMobile && 'max-md:grid max-md:w-full max-md:grid-cols-1',
        props.class,
      )
    "
  >
    <RadioGroupItem
      v-for="option in options"
      :key="String(option.value)"
      :value="String(option.value)"
      :class="
        cn(
          'flex items-center justify-center gap-1.5 rounded-[7px] px-3 font-medium whitespace-nowrap text-ink-muted transition-colors duration-(--dur-1) ease-standard hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
          'data-[state=checked]:bg-sheet data-[state=checked]:font-semibold data-[state=checked]:text-ink data-[state=checked]:shadow-[0_0_0_1px_var(--rule-strong),0_1px_2px_rgb(40_32_20/0.08)]',
          inFilterBar
            ? 'h-7 px-2.5 text-sm'
            : size === 'md'
              ? 'h-[30px] text-base'
              : 'h-[26px] px-2.5 text-sm',
          'max-md:h-10',
        )
      "
    >
      {{ option.label }}
      <span v-if="option.count !== undefined" class="num text-meta text-ink-subtle">{{
        option.count
      }}</span>
    </RadioGroupItem>
  </RadioGroupRoot>
</template>
