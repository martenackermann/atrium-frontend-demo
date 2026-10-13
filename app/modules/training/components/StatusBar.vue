<script setup lang="ts">
import { STATUS_MAP } from '~/lib/status'
import type { AttendeeStatus } from '../api/types'

/**
 * Attendee status mini-bar (SCREENS §4.1 / §4.8): one segment per status in its DESIGN tone,
 * with the counts as text ("2 to book · 1 booked") so colour is never the only signal.
 */
const props = defineProps<{ counts: Partial<Record<AttendeeStatus, number>>; total: number }>()
const enums = useEnums()

const FILL: Record<string, string> = {
  neutral: 'bg-st-neutral-line',
  waiting: 'bg-st-waiting-line',
  you: 'bg-st-you-line',
  moving: 'bg-st-moving-line',
  positive: 'bg-st-positive-line',
  negative: 'bg-st-negative-line',
  blocked: 'bg-st-blocked-line',
}

const segments = computed(() =>
  (Object.entries(props.counts) as [AttendeeStatus, number][])
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      status,
      count,
      label: enums.label('attendeeStatus', status),
      fill: FILL[STATUS_MAP.attendeeStatus?.[status]?.tone ?? 'neutral'],
    })),
)
const text = computed(() =>
  segments.value.map((s) => `${s.count} ${s.label.toLowerCase()}`).join(' · '),
)
</script>

<template>
  <span class="inline-grid min-w-[120px] gap-1">
    <span class="flex h-1.5 w-full overflow-hidden rounded-pill bg-well" aria-hidden="true">
      <span
        v-for="segment in segments"
        :key="segment.status"
        :class="segment.fill"
        :style="{ width: `${(segment.count / Math.max(total, 1)) * 100}%` }"
      />
    </span>
    <span class="text-meta text-ink-muted">
      <span class="num font-medium text-ink">{{ total }}</span>
      {{ total === 1 ? 'attendee' : 'attendees' }}<span v-if="text"> · {{ text }}</span>
    </span>
  </span>
</template>
