<script setup lang="ts" generic="T extends string">
import type { HTMLAttributes } from 'vue'
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { cn } from '~/lib/cn'
import { useFieldContext } from '~/lib/field'
import { selectFocusedRadio } from '~/lib/radio'
import type { RadioCardOption } from '~/types/ui'

/**
 * RadioCards (DESIGN §9): dot · title (+ mono code) · side tag · description;
 * selected = ink 2px border; focus ring around the card.
 */
const props = withDefaults(
  defineProps<{
    options: readonly RadioCardOption<T>[]
    columns?: 1 | 2 | 3
    ariaLabel?: string
    class?: HTMLAttributes['class']
  }>(),
  { columns: 2 },
)
const model = defineModel<T | undefined>()
// Inside <UiField group>: the fieldset carries hint and error; the group reports invalid.
const field = useFieldContext()
</script>

<template>
  <RadioGroupRoot
    v-model="model"
    :aria-label="ariaLabel"
    :aria-invalid="field?.invalid.value || undefined"
    @keydown="selectFocusedRadio"
    :class="
      cn(
        'grid gap-2.5',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-3',
        props.class,
      )
    "
  >
    <RadioGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :disabled="option.disabled"
      :class="field?.invalid.value ? 'border-st-negative-line' : 'border-rule-strong'"
      class="group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 rounded-lg border bg-sheet p-3.5 text-left transition-[border-color,box-shadow] duration-(--dur-1) ease-standard hover:border-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-disabled:cursor-not-allowed data-disabled:opacity-45 data-[state=checked]:border-ink data-[state=checked]:shadow-[inset_0_0_0_1px_var(--ink)]"
    >
      <span
        class="mt-0.5 grid size-[18px] place-items-center rounded-full border border-field bg-sheet group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary"
      >
        <RadioGroupIndicator class="size-2 rounded-full bg-primary-ink" />
      </span>
      <span class="flex items-baseline gap-2 text-base leading-5 font-semibold">
        {{ option.title }}
        <span v-if="option.code" class="font-mono text-meta font-normal text-ink-subtle">{{
          option.code
        }}</span>
      </span>
      <span class="justify-self-end">
        <UiTag v-if="option.tag" :tone="option.tag.tone">{{ option.tag.label }}</UiTag>
      </span>
      <span v-if="option.description" class="col-start-2 col-end-4 text-sm text-ink-muted">{{
        option.description
      }}</span>
    </RadioGroupItem>
  </RadioGroupRoot>
</template>
