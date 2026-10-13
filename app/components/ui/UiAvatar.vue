<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/cn'

/**
 * Avatar (DESIGN §9): initials monogram on well + hairline; `me` is ink. Never coloured per person.
 */
const props = withDefaults(
  defineProps<{
    name?: string | null
    initials?: string | null
    size?: 'sm' | 'md' | 'lg'
    me?: boolean
    class?: HTMLAttributes['class']
  }>(),
  { size: 'md' },
)

const letters = computed(() => props.initials || initialsOf(props.name ?? '') || '?')
</script>

<template>
  <span
    :title="name ?? undefined"
    :class="
      cn(
        'grid flex-none place-items-center rounded-full leading-none font-semibold select-none',
        size === 'sm' && 'size-6 text-[11px]',
        size === 'md' && 'size-7 text-[11px] tracking-[0.02em]',
        size === 'lg' && 'size-9 text-sm',
        me
          ? 'bg-ink text-sheet'
          : 'bg-well text-ink-muted shadow-[inset_0_0_0_1px_var(--rule-strong)]',
        props.class,
      )
    "
    aria-hidden="true"
    >{{ letters }}</span
  >
</template>
