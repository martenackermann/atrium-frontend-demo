<script setup lang="ts">
import { Info } from '@lucide/vue'

/**
 * "Why you're seeing this" (DESIGN §8.3, SCREENS §1.7): one line explaining the viewer's relation
 * — "You're Emma's manager.", "Escalated past Sofia Site-Manager (site manager).",
 * "You're deputy for Priya Raman until 25 Oct." Build the text with `whySeeingText()`.
 */
defineProps<{ text: string }>()
</script>

<template>
  <p class="flex max-w-[80ch] items-start gap-2 text-[13.5px] leading-5 text-ink-muted">
    <Info class="mt-[3px] size-4 text-ink-subtle" aria-hidden="true" />
    <span><b class="font-semibold text-ink">Why you're seeing this:</b> {{ text }}</span>
  </p>
</template>
