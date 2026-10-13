<script setup lang="ts">
import { AlarmClock } from '@lucide/vue'
import type { AssetDto } from '../api/types'

/**
 * A device waiting for the user's acceptance (SCREENS §6.1 "Waiting for you"): glyph, model,
 * asset tag, serial, who assigned it and when, the note, the confirm-by date and the inline
 * Decline… / Accept actions (DESIGN principle 5: act where you read).
 */
const props = defineProps<{ asset: AssetDto }>()
const config = usePublicConfig()

const assignment = computed(() => props.asset.currentAssignment)
const dueDays = computed(() => config.data.value?.assetAcceptanceDueDays ?? 7)
const dueAt = computed(() => {
  if (!assignment.value) return null
  const assigned = new Date(assignment.value.assignedAt)
  return new Date(assigned.getFullYear(), assigned.getMonth(), assigned.getDate() + dueDays.value)
})
const dueIn = computed(() => (dueAt.value ? daysFromToday(dueAt.value) : null))
</script>

<template>
  <article
    class="grid gap-4 rounded-lg border border-rule bg-sheet p-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start md:p-5"
    :aria-labelledby="`pending-${asset.id}`"
  >
    <AssetsDeviceGlyph :code="asset.deviceType.code" />
    <div class="min-w-0">
      <h3 :id="`pending-${asset.id}`" class="text-md font-semibold">
        <NuxtLink :to="`/assets/${asset.id}`" class="link">{{ asset.model.name }}</NuxtLink>
      </h3>
      <p class="mt-1 flex flex-wrap gap-x-1.5 text-sm text-ink-muted">
        <span>{{ asset.deviceType.name }}</span>
        <span aria-hidden="true">·</span>
        <span class="mono">{{ asset.assetTag }}</span>
        <span aria-hidden="true">·</span>
        <span
          >Serial <span class="mono">{{ asset.serialNumber }}</span></span
        >
      </p>
      <p v-if="assignment" class="mt-1 text-sm text-ink-muted">
        Assigned by {{ assignment.assignedBy.displayName }} on
        <time :datetime="assignment.assignedAt">{{ formatDate(assignment.assignedAt) }}</time>
      </p>
      <blockquote
        v-if="assignment?.note"
        class="mt-3 border-l border-rule-strong pl-3 font-display text-[17px] leading-[25px] text-ink"
      >
        {{ assignment.note }}
      </blockquote>
      <p
        v-if="dueAt"
        class="mt-3 inline-flex items-center gap-1.5 text-sm"
        :class="dueIn !== null && dueIn <= 0 ? 'text-st-negative' : 'text-ink-muted'"
      >
        <AlarmClock class="size-3.5" aria-hidden="true" />
        <span v-if="dueIn !== null && dueIn <= 0">
          Overdue since <time :datetime="dueAt.toISOString()">{{ formatDate(dueAt) }}</time>
        </span>
        <span v-else>
          Confirm by <time :datetime="dueAt.toISOString()">{{ formatDate(dueAt) }}</time>
        </span>
      </p>
    </div>
    <AssetsAcceptanceActions :asset="asset" block class="md:justify-end" />
  </article>
</template>
