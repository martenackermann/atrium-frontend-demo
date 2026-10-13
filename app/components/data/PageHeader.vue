<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/cn'

/**
 * PageHeader (DESIGN §9): serif title · meta line below (type · mono ID · dates — no eyebrows) ·
 * status badge · actions on the right (they wrap under the title on narrow screens).
 *
 *   <PageHeader title="Car rental to Westbay">
 *     <template #meta>Car rental · Riverton → Westbay · <span class="mono">TRV-000031</span></template>
 *     <template #status><StatusBadge enum="travelStatus" :value="…" /></template>
 *     <template #actions><ActionBar … /></template>
 *   </PageHeader>
 */
const props = defineProps<{ title: string; subtitle?: string; class?: HTMLAttributes['class'] }>()
</script>

<template>
  <header :class="cn('flex flex-wrap items-start gap-x-6 gap-y-4', props.class)">
    <div class="min-w-0 flex-[1_1_320px]">
      <h1
        class="font-display text-[26px] leading-8 font-normal tracking-display md:text-display-md"
      >
        {{ title }}
      </h1>
      <p
        v-if="subtitle || $slots.meta"
        class="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[13.5px] text-ink-muted"
      >
        <slot name="meta">{{ subtitle }}</slot>
      </p>
      <div v-if="$slots.status" class="mt-3 flex flex-wrap items-center gap-2.5">
        <slot name="status" />
      </div>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2 pt-0.5">
      <slot name="actions" />
    </div>
  </header>
</template>
