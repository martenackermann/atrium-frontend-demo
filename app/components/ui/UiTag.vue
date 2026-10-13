<script setup lang="ts">
import type { Component, HTMLAttributes } from 'vue'
import { cn } from '~/lib/cn'

/**
 * Small tag (DESIGN §9): "Needs approval" (waiting) before an option is chosen, "Standard"
 * (positive) on the default option, neutral for plain labels.
 */
const props = withDefaults(
  defineProps<{
    tone?: 'waiting' | 'positive' | 'neutral'
    icon?: Component
    class?: HTMLAttributes['class']
  }>(),
  { tone: 'waiting' },
)
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex h-5 items-center gap-1 rounded-xs px-1.5 text-[11.5px] leading-none font-medium whitespace-nowrap',
        tone === 'waiting' && 'bg-st-waiting-bg text-st-waiting',
        tone === 'positive' && 'bg-st-positive-bg text-st-positive',
        tone === 'neutral' && 'bg-st-neutral-bg text-st-neutral',
        props.class,
      )
    "
  >
    <component :is="icon" v-if="icon" class="size-3" :stroke-width="2" aria-hidden="true" />
    <slot />
  </span>
</template>
