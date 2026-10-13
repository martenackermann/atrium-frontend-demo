<script setup lang="ts">
import { Construction } from '@lucide/vue'

/**
 * Foundation placeholder for a SCREENS.md page that a slice replaces. The route, its access rule
 * (`definePageMeta`) and its place in the navigation already work; the slice swaps the file's
 * content for the real screen.
 */
defineProps<{
  title: string
  /** Owning slice, e.g. "A1 · Training". */
  slice: string
  /** Where the screen is specified, e.g. "SCREENS §4.2". */
  screen: string
  description?: string
}>()
</script>

<template>
  <PageBody data-testid="placeholder-page">
    <PageHeader :title="title">
      <template #meta>
        <span>{{ slice }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ screen }}</span>
      </template>
    </PageHeader>
    <EmptyState
      class="mt-10"
      :icon="Construction"
      tone="waiting"
      title="This page is being built"
      :description="
        description ?? `The ${slice} slice replaces this placeholder with the screen in ${screen}.`
      "
    />
  </PageBody>
</template>
