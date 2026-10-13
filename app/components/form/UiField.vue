<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { TriangleAlert } from '@lucide/vue'
import { FIELD_CONTEXT, firstError } from '~/lib/field'
import { cn } from '~/lib/cn'

/**
 * Field (DESIGN §9): label (13.5/600) → hint (read first, above the control) → control → error
 * (negative + triangle-alert). Optional fields say "optional" (never asterisks). The control gets
 * id / aria-describedby / aria-invalid through injection (UiInput, UiTextarea, UiSelect…).
 *
 *   <UiField label="Reason" hint="Max Manager reads this next to your request." :error="errors.reason">
 *     <UiTextarea v-model="reason" v-bind="reasonAttrs" />
 *   </UiField>
 */
const props = defineProps<{
  label?: string
  hint?: string
  error?: string | readonly string[] | null
  optional?: boolean
  /** Render as <fieldset> with a <legend> (radio cards, checkbox groups). */
  group?: boolean
  id?: string
  class?: HTMLAttributes['class']
}>()

const generated = useId()
const id = computed(() => props.id ?? `field-${generated}`)
const message = computed(() => firstError(props.error))
const hintId = computed(() => `${id.value}-hint`)
const errorId = computed(() => `${id.value}-error`)

const describedBy = computed(
  () =>
    [props.hint ? hintId.value : null, message.value ? errorId.value : null]
      .filter(Boolean)
      .join(' ') || undefined,
)

provide(FIELD_CONTEXT, {
  id: id.value,
  invalid: computed(() => Boolean(message.value)),
  describedBy,
})
</script>

<template>
  <!-- A group (radio cards, checkbox lists) carries the hint and error on the fieldset itself. -->
  <component
    :is="group ? 'fieldset' : 'div'"
    :id="group ? id : undefined"
    :aria-describedby="group ? describedBy : undefined"
    :class="cn('grid min-w-0 gap-1.5 border-0 p-0', props.class)"
  >
    <component
      :is="group ? 'legend' : 'label'"
      v-if="label || $slots.label"
      :for="group ? undefined : id"
      class="mb-0.5 flex items-center gap-2 p-0 text-[13.5px] leading-[18px] font-semibold"
    >
      <slot name="label">{{ label }}</slot>
      <span v-if="optional" class="font-normal text-ink-subtle">optional</span>
      <slot name="label-extra" />
    </component>
    <p v-if="hint" :id="hintId" class="text-sm text-ink-muted">{{ hint }}</p>
    <slot :id="id" :invalid="Boolean(message)" />
    <p
      v-if="message"
      :id="errorId"
      class="flex items-start gap-1.5 text-sm text-st-negative"
      role="alert"
    >
      <TriangleAlert class="mt-px size-3.5" aria-hidden="true" />
      <span>{{ message }}</span>
    </p>
  </component>
</template>
