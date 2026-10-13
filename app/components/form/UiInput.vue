<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useControlSize, useFieldContext } from '~/lib/field'
import { cn } from '~/lib/cn'

/**
 * Input (DESIGN §9): 38px, field border, radius 8; hover ink-muted; focus ink border + 3px halo;
 * error negative border. Placeholder is an example, never the label. `suffix` renders inside
 * ("km per day"), `mono` for codes and amounts. 36px in list toolbars, 40px on phones.
 */
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    type?: string
    invalid?: boolean
    prefix?: string
    suffix?: string
    mono?: boolean
    id?: string
    class?: HTMLAttributes['class']
  }>(),
  // `invalid` stays undefined when absent so the field context decides (Vue casts to false).
  { type: 'text', invalid: undefined },
)
const model = defineModel<string | number | null | undefined>()
const field = useFieldContext()
const filterSize = useControlSize() === 'filter'
const attrs = useAttrs()
const input = ref<HTMLInputElement>()

const isInvalid = computed(() => props.invalid ?? field?.invalid.value ?? false)

defineExpose({ focus: () => input.value?.focus() })
</script>

<template>
  <div :class="cn('relative', props.class)">
    <span
      v-if="prefix"
      class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-subtle"
      >{{ prefix }}</span
    >
    <input
      :id="id ?? field?.id"
      ref="input"
      v-model="model"
      :type="type"
      v-bind="attrs"
      :aria-invalid="isInvalid || undefined"
      :aria-describedby="field?.describedBy.value"
      :class="
        cn(
          'w-full rounded-md border bg-sheet px-3 text-base text-ink outline-none placeholder:text-ink-subtle max-md:h-10',
          filterSize ? 'h-9' : 'h-[38px]',
          'transition-[border-color,box-shadow] duration-(--dur-1) ease-standard hover:border-ink-muted',
          'focus-visible:border-ink focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--focus)_28%,transparent)]',
          'disabled:cursor-not-allowed disabled:bg-well disabled:text-ink-disabled',
          isInvalid ? 'border-st-negative' : 'border-field',
          mono && 'font-mono text-[13px]',
          prefix && 'pl-8',
          suffix && 'pr-24',
        )
      "
    />
    <span
      v-if="suffix"
      class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-subtle"
      >{{ suffix }}</span
    >
  </div>
</template>
