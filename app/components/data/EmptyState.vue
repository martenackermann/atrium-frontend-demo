<script setup lang="ts">
import { CircleCheck } from '@lucide/vue'
import type { Component, HTMLAttributes } from 'vue'
import { cn } from '~/lib/cn'

/**
 * EmptyState (DESIGN §9, §10): 48px tone circle with icon · serif title · one sentence that
 * teaches · one action. "All caught up. Nothing waits for your approval. …"
 */
const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: Component
    tone?: 'positive' | 'neutral' | 'waiting'
    compact?: boolean
    /** Heading level of the title: `h1` when the empty state is the whole page (error views). */
    as?: 'h1' | 'h2' | 'h3'
    class?: HTMLAttributes['class']
  }>(),
  { tone: 'neutral', as: 'h2' },
)
</script>

<template>
  <div
    :class="
      cn(
        'mx-auto grid max-w-[400px] justify-items-center text-center',
        compact ? 'py-8' : 'py-14',
        props.class,
      )
    "
  >
    <span
      class="mb-4 grid size-12 place-items-center rounded-full"
      :class="{
        'bg-st-positive-bg text-st-positive': tone === 'positive',
        'bg-st-neutral-bg text-st-neutral': tone === 'neutral',
        'bg-st-waiting-bg text-st-waiting': tone === 'waiting',
      }"
      aria-hidden="true"
    >
      <component :is="icon ?? CircleCheck" class="size-5" />
    </span>
    <component :is="as" class="font-display text-display-sm font-normal tracking-display">{{
      title
    }}</component>
    <p v-if="description" class="mt-2 text-base leading-[21px] text-ink-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5 flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
