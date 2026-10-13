<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useFieldContext } from '~/lib/field'
import { cn } from '~/lib/cn'

/** Textarea (DESIGN §9): min 84px, vertical resize; character hint when limited (`maxlength`). */
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    invalid?: boolean
    maxlength?: number
    rows?: number
    id?: string
    autofocus?: boolean
    class?: HTMLAttributes['class']
  }>(),
  // `invalid` stays undefined when absent so the field context decides (Vue casts to false).
  { invalid: undefined },
)
const model = defineModel<string | null | undefined>()
const field = useFieldContext()
const attrs = useAttrs()
const textarea = ref<HTMLTextAreaElement>()
const isInvalid = computed(() => props.invalid ?? field?.invalid.value ?? false)
const length = computed(() => (model.value ?? '').length)

onMounted(() => {
  if (props.autofocus) textarea.value?.focus()
})
defineExpose({ focus: () => textarea.value?.focus() })
</script>

<template>
  <div :class="cn('grid gap-1', props.class)">
    <textarea
      :id="id ?? field?.id"
      ref="textarea"
      v-model="model"
      v-bind="attrs"
      :rows="rows ?? 3"
      :maxlength="maxlength"
      :aria-invalid="isInvalid || undefined"
      :aria-describedby="field?.describedBy.value"
      :class="
        cn(
          'min-h-[84px] w-full resize-y rounded-md border bg-sheet px-3 py-[9px] text-base leading-5 text-ink outline-none placeholder:text-ink-subtle',
          'transition-[border-color,box-shadow] duration-(--dur-1) ease-standard hover:border-ink-muted',
          'focus-visible:border-ink focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--focus)_28%,transparent)]',
          'disabled:bg-well disabled:text-ink-disabled',
          isInvalid ? 'border-st-negative' : 'border-field',
        )
      "
    />
    <p v-if="maxlength" class="justify-self-end text-meta text-ink-subtle">
      <span class="num">{{ length }}</span> / <span class="num">{{ maxlength }}</span>
    </p>
  </div>
</template>
