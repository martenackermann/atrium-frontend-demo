<script setup lang="ts">
import type { TravelKind } from '../api/types'
import { KIND_META } from '../constants'

/** Request-type glyph (DESIGN §6: car-front, train-front, plane) with an accessible label. */
const props = defineProps<{ kind: TravelKind; labelled?: boolean }>()
const meta = computed(() => KIND_META[props.kind])
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <component
      :is="meta.icon"
      class="size-4 flex-none text-ink-muted"
      :aria-hidden="labelled ? 'true' : undefined"
      :aria-label="labelled ? undefined : meta.label"
      :role="labelled ? undefined : 'img'"
    />
    <span v-if="labelled">{{ meta.label }}</span>
  </span>
</template>
