<script setup lang="ts">
import { cn } from '~/lib/cn'
import { deviceIcon } from '../constants'

/** Device-type glyph in a hairline circle (DESIGN §6: 20px task glyphs). */
const props = withDefaults(
  defineProps<{ code: string | null | undefined; size?: 'sm' | 'md'; class?: string }>(),
  { size: 'md', class: undefined },
)
</script>

<template>
  <span
    :class="
      cn(
        'inline-grid flex-none place-items-center rounded-full border border-rule bg-well text-ink-muted',
        size === 'md' ? 'size-10' : 'size-8',
        props.class,
      )
    "
    aria-hidden="true"
  >
    <component :is="deviceIcon(code)" :class="size === 'md' ? 'size-5' : 'size-4'" />
  </span>
</template>
