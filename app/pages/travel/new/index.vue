<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import { KIND_META } from '~/modules/travel/constants'

/**
 * Choose a kind (SCREENS §5.2): three cards that explain the approval rule before you start
 * (DESIGN principle 4 "Explain before you ask").
 */
definePageMeta({ title: 'Book travel' })

const cards = [
  {
    ...KIND_META.car,
    title: 'Rental car or van',
    text: 'Approval depends on the class and the extras. The standard class with a manual gearbox goes straight to the travel desk.',
  },
  {
    ...KIND_META.train,
    title: 'Train',
    text: 'Flex fares go straight to the travel desk. Saver fares and separate tickets need approval.',
  },
  {
    ...KIND_META.flight,
    title: 'Flight',
    text: 'Flights always need approval by your manager before the travel desk books them.',
  },
]
</script>

<template>
  <PageBody>
    <PageHeader
      title="Book travel"
      subtitle="Pick what you need. Your manager approves only what goes beyond the standard."
    />
    <ul class="mt-8 grid list-none gap-4 p-0 md:grid-cols-3">
      <li v-for="card in cards" :key="card.to">
        <NuxtLink
          :to="card.to"
          class="group grid h-full content-start gap-3 rounded-xl border border-rule bg-sheet p-6 text-ink no-underline transition-colors duration-(--dur-1) hover:border-field hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <span
            class="grid size-11 place-items-center rounded-full border border-rule bg-well text-ink"
          >
            <component :is="card.icon" class="size-5" aria-hidden="true" />
          </span>
          <span class="font-display text-[23px] leading-[28px] tracking-display">{{
            card.title
          }}</span>
          <span class="text-sm leading-5 text-ink-muted">{{ card.text }}</span>
          <span class="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold"
            >Start
            <ArrowRight
              class="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
          /></span>
        </NuxtLink>
      </li>
    </ul>
  </PageBody>
</template>
