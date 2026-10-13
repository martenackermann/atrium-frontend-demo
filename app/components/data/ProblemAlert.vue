<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'
import { describeError, isApiError } from '~/lib/api'

/**
 * ProblemAlert (SCREENS §1.6): shows an API problem (title + detail) inside a form or panel.
 * Field errors belong next to their fields (map `error.fieldErrors` with vee-validate's setErrors);
 * pass `unmapped` to list field errors that have no field on screen.
 */
const props = defineProps<{
  error: unknown
  /** Field paths shown on screen; errors for other paths are listed here. */
  mapped?: readonly string[]
  retry?: () => void
}>()

const described = computed(() => (props.error ? describeError(props.error) : null))
const unmapped = computed(() => {
  if (!isApiError(props.error)) return []
  return Object.entries(props.error.fieldErrors)
    .filter(([path]) => !props.mapped?.includes(path))
    .flatMap(([path, messages]) => messages.map((message) => `${path}: ${message}`))
})
</script>

<template>
  <div
    v-if="described"
    role="alert"
    class="flex items-start gap-2.5 rounded-lg border border-st-negative-line bg-st-negative-bg px-4 py-3 text-base"
  >
    <TriangleAlert class="mt-0.5 size-4 text-st-negative" aria-hidden="true" />
    <div class="grid min-w-0 flex-1 gap-0.5">
      <p class="font-semibold text-st-negative">{{ described.title }}</p>
      <p v-if="described.detail" class="text-ink-muted">{{ described.detail }}</p>
      <ul v-if="unmapped.length" class="mt-1 list-disc pl-4 text-sm text-ink-muted">
        <li v-for="line in unmapped" :key="line">{{ line }}</li>
      </ul>
    </div>
    <UiButton v-if="retry" size="sm" variant="secondary" @click="retry()">Try again</UiButton>
  </div>
</template>
