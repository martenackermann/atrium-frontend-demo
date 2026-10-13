<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/cn'

/** Skeleton block (DESIGN §9): well block with a 1.2 s sheen, shaped like the content. */
const props = defineProps<{ class?: HTMLAttributes['class']; circle?: boolean }>()
</script>

<template>
  <span
    aria-hidden="true"
    :class="
      cn(
        'block animate-[atrium-sheen_1.2s_linear_infinite] bg-well bg-[linear-gradient(90deg,transparent,var(--hover),transparent)] bg-size-[200%_100%] motion-reduce:animate-none',
        circle ? 'rounded-full' : 'rounded-sm',
        props.class,
      )
    "
  />
</template>
