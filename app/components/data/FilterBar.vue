<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { CONTROL_SIZE } from '~/lib/field'
import { cn } from '~/lib/cn'

/**
 * FilterBar: a list toolbar row (DataTable's toolbar, SplitInbox list tools). Every kit control
 * inside — UiInput, UiSelect (any size), UserPicker, date pickers, small buttons, icon buttons —
 * renders at the same 36px (40px on phones), so filters line up whatever size a page passed.
 *
 *   <FilterBar><UiSelect size="sm" … /><UserPicker aria-label="Assigned to" /></FilterBar>
 */
const props = defineProps<{ class?: HTMLAttributes['class'] }>()
provide(CONTROL_SIZE, 'filter')
</script>

<template>
  <div :class="cn('flex flex-wrap items-end gap-2', props.class)">
    <slot />
  </div>
</template>
