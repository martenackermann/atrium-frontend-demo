<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Check, Minus } from '@lucide/vue'
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'
import { cn } from '~/lib/cn'

/**
 * Checkbox (DESIGN §9): 18px box radius 5, field border; checked = ink fill + paper tick; label +
 * optional description; `#tag` slot for "Needs approval"; locked = checked + disabled + hint.
 */
const props = defineProps<{
  label?: string
  description?: string
  disabled?: boolean
  id?: string
  class?: HTMLAttributes['class']
}>()
const model = defineModel<boolean | 'indeterminate'>({ default: false })
const generated = useId()
const id = computed(() => props.id ?? `checkbox-${generated}`)
</script>

<template>
  <div :class="cn('flex items-start gap-2.5', props.class)">
    <CheckboxRoot
      :id="id"
      v-model="model"
      :disabled="disabled"
      class="relative mt-px grid size-[18px] flex-none place-items-center rounded-[5px] before:absolute before:-inset-[11px] before:content-[''] border border-field bg-sheet text-primary-ink transition-colors duration-(--dur-1) ease-standard hover:border-ink-muted data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-45"
    >
      <CheckboxIndicator>
        <Minus
          v-if="model === 'indeterminate'"
          class="size-3"
          :stroke-width="3"
          aria-hidden="true"
        />
        <Check v-else class="size-3" :stroke-width="3" aria-hidden="true" />
      </CheckboxIndicator>
    </CheckboxRoot>
    <label
      v-if="label || $slots.default"
      :for="id"
      class="grid cursor-pointer gap-px leading-5"
      :class="disabled && 'cursor-not-allowed'"
    >
      <span class="flex flex-wrap items-center gap-2 font-medium">
        <slot>{{ label }}</slot>
        <slot name="tag" />
      </span>
      <span v-if="description" class="text-sm text-ink-muted">{{ description }}</span>
    </label>
  </div>
</template>
