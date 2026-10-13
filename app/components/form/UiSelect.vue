<script setup lang="ts" generic="T extends string | number">
import type { HTMLAttributes } from 'vue'
import { Check, ChevronDown } from '@lucide/vue'
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'
import { useControlSize, useFieldContext } from '~/lib/field'
import { cn } from '~/lib/cn'
import type { SelectOption } from '~/types/ui'

/**
 * Select (DESIGN §9): trigger like Input + chevron; level-2 content; checked item; typeahead.
 * 38px (md) / 30px (sm); 36px in list toolbars; 40px on phones.
 */
const props = withDefaults(
  defineProps<{
    options: readonly SelectOption<T>[]
    placeholder?: string
    invalid?: boolean
    disabled?: boolean
    size?: 'sm' | 'md'
    id?: string
    class?: HTMLAttributes['class']
    ariaLabel?: string
  }>(),
  // `invalid` stays undefined when absent so the field context decides (Vue casts to false).
  { placeholder: 'Choose…', size: 'md', invalid: undefined },
)
const model = defineModel<T | null | undefined>()
const field = useFieldContext()
// In a list toolbar every filter control is 36px, whatever size the page passed.
const filterSize = useControlSize() === 'filter'
const isInvalid = computed(() => props.invalid ?? field?.invalid.value ?? false)

// Reka's Select works with string values; map numbers through their string form.
const stringValue = computed({
  get: () => (model.value === null || model.value === undefined ? undefined : String(model.value)),
  set: (value) => {
    model.value = props.options.find((option) => String(option.value) === value)?.value
  },
})
</script>

<template>
  <SelectRoot v-model="stringValue" :disabled="disabled">
    <SelectTrigger
      :id="id ?? field?.id"
      :aria-label="ariaLabel"
      :aria-invalid="isInvalid || undefined"
      :aria-describedby="field?.describedBy.value"
      :class="
        cn(
          'flex w-full items-center justify-between gap-2 rounded-md border bg-sheet px-3 text-left text-ink outline-none',
          'transition-[border-color,box-shadow] duration-(--dur-1) ease-standard hover:border-ink-muted',
          'focus-visible:border-ink focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--focus)_28%,transparent)]',
          'data-disabled:bg-well data-disabled:text-ink-disabled data-placeholder:text-ink-subtle',
          filterSize ? 'h-9 text-sm' : size === 'md' ? 'h-[38px] text-base' : 'h-[30px] text-sm',
          'max-md:h-10',
          isInvalid ? 'border-st-negative' : 'border-field',
          props.class,
        )
      "
    >
      <SelectValue :placeholder="placeholder" class="truncate" />
      <ChevronDown class="size-4 text-ink-subtle" aria-hidden="true" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="4"
        class="z-[60] max-h-(--reka-select-content-available-height) min-w-(--reka-select-trigger-width) overflow-hidden rounded-lg border border-rule bg-raised p-1.5 shadow-pop data-[state=open]:animate-[atrium-menu-in_var(--dur-2)_var(--curve-out)]"
      >
        <SelectViewport>
          <SelectItem
            v-for="option in options"
            :key="String(option.value)"
            :value="String(option.value)"
            :disabled="option.disabled"
            class="relative flex min-h-9 cursor-pointer max-md:min-h-11 items-start gap-2 rounded-md py-2 pr-8 pl-2.5 text-base outline-none select-none data-disabled:opacity-45 data-highlighted:bg-hover"
          >
            <div class="grid">
              <SelectItemText>{{ option.label }}</SelectItemText>
              <span v-if="option.description" class="text-sm text-ink-muted">{{
                option.description
              }}</span>
            </div>
            <SelectItemIndicator class="absolute top-2.5 right-2.5">
              <Check class="size-4" aria-hidden="true" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
