<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/cn'

/** Keyboard key (DESIGN §9 Kbd): mono 11px, 2px bottom border; inherits ink colours in primary buttons. */
const props = defineProps<{ inverse?: boolean; class?: HTMLAttributes['class'] }>()
</script>

<template>
  <kbd
    :class="
      cn(
        'inline-flex h-5 items-center gap-0.5 rounded-xs border border-b-2 px-[5px] font-mono text-[11px] leading-none font-normal',
        inverse
          ? 'border-[color-mix(in_srgb,var(--primary-ink)_35%,transparent)] bg-transparent text-current opacity-85'
          : 'border-rule-strong bg-sheet text-ink-muted',
        props.class,
      )
    "
    ><slot
  /></kbd>
</template>
