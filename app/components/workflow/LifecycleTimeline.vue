<script setup lang="ts">
import { History } from '@lucide/vue'
import type { TimelineEntry } from '~/types/api'

/**
 * LifecycleTimeline (SCREENS §1.6/§1.7 Detail page "Timeline" card): the resource's TimelineEntry
 * list, newest first, with a "Show field changes" toggle. On mobile only the last 3 show until
 * "Show all" (SCREENS §9).
 */
const props = withDefaults(
  defineProps<{
    entries?: readonly TimelineEntry[] | null
    loading?: boolean
    title?: string
    /** Entries shown before "Show all" (0 = all). */
    limit?: number
  }>(),
  { title: 'Timeline', limit: 3 },
)

const showChanges = ref(false)
const expanded = ref(false)
const isMobile = useMediaQuery('(max-width: 767px)')
const hasChanges = computed(() => props.entries?.some((entry) => entry.changes?.length))
const newestFirst = computed(() =>
  [...(props.entries ?? [])].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
)
const visible = computed(() =>
  isMobile.value && !expanded.value && props.limit > 0
    ? newestFirst.value.slice(0, props.limit)
    : newestFirst.value,
)
</script>

<template>
  <section class="grid gap-3.5" :aria-label="title">
    <header class="flex items-center gap-3">
      <h3 class="text-[13.5px] font-[650]">{{ title }}</h3>
      <UiSwitch
        v-if="hasChanges"
        v-model="showChanges"
        label="Show field changes"
        class="ml-auto text-sm"
      />
    </header>
    <div v-if="loading" class="grid gap-3">
      <UiSkeleton v-for="index in 3" :key="index" class="h-5 w-full" />
    </div>
    <p v-else-if="!newestFirst.length" class="flex items-center gap-2 text-sm text-ink-muted">
      <History class="size-4" aria-hidden="true" /> Nothing has happened yet.
    </p>
    <template v-else>
      <AuditTrail :entries="visible" :show-changes="showChanges" keep-order />
      <UiButton
        v-if="isMobile && !expanded && newestFirst.length > limit"
        variant="ghost"
        size="sm"
        class="justify-self-start"
        @click="expanded = true"
        >Show all {{ newestFirst.length }}</UiButton
      >
    </template>
  </section>
</template>
