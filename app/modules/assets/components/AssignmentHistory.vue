<script setup lang="ts">
import type { AssetAssignmentDto } from '../api/types'

/**
 * Assignment history (SCREENS §6.6 "Assignments"): user, assigned (by, when, note), accepted or
 * declined (reason), unassigned, returned (condition, note) and reminders sent. Newest first.
 */
defineProps<{ rows: readonly AssetAssignmentDto[] | undefined; loading?: boolean }>()

function outcome(row: AssetAssignmentDto): {
  label: string
  tone: 'positive' | 'waiting' | 'neutral'
} {
  if (row.declinedAt) return { label: 'Declined', tone: 'neutral' }
  if (row.unassignedAt) return { label: 'Unassigned', tone: 'neutral' }
  if (row.returnedAt) return { label: 'Returned', tone: 'neutral' }
  if (row.acceptedAt) return { label: 'Holds it', tone: 'positive' }
  return { label: 'Waiting for acceptance', tone: 'waiting' }
}
</script>

<template>
  <div>
    <div v-if="loading" class="grid gap-2" aria-busy="true">
      <UiSkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
    </div>
    <EmptyState
      v-else-if="!rows?.length"
      compact
      title="Never assigned"
      description="When you assign the device, every hand-over shows up here."
    />
    <ol v-else class="m-0 list-none border-t border-ink p-0">
      <li
        v-for="row in rows"
        :key="row.id"
        class="grid gap-x-6 gap-y-2 border-b border-rule py-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]"
      >
        <div class="flex min-w-0 items-center gap-2.5">
          <UiAvatar :initials="row.user.initials" :name="row.user.displayName" />
          <span class="min-w-0">
            <span class="block truncate font-semibold">{{ row.user.displayName }}</span>
            <span class="block truncate text-sm text-ink-muted">{{ row.user.jobTitle }}</span>
          </span>
        </div>
        <dl class="m-0 grid gap-1 text-sm [&_dd]:m-0 [&_dt]:text-ink-subtle">
          <div class="flex flex-wrap gap-x-2">
            <dt>Assigned</dt>
            <dd>
              <time :datetime="row.assignedAt">{{ formatDateTime(row.assignedAt) }}</time> by
              {{ row.assignedBy.displayName }}
            </dd>
          </div>
          <div v-if="row.note" class="flex flex-wrap gap-x-2">
            <dt>Note</dt>
            <dd>{{ row.note }}</dd>
          </div>
          <div v-if="row.acceptedAt" class="flex flex-wrap gap-x-2">
            <dt>Accepted</dt>
            <dd>
              <time :datetime="row.acceptedAt">{{ formatDateTime(row.acceptedAt) }}</time>
            </dd>
          </div>
          <div v-if="row.declinedAt" class="flex flex-wrap gap-x-2">
            <dt>Declined</dt>
            <dd>
              <time :datetime="row.declinedAt">{{ formatDateTime(row.declinedAt) }}</time
              >: “{{ row.declineReason }}”
            </dd>
          </div>
          <div v-if="row.unassignedAt" class="flex flex-wrap gap-x-2">
            <dt>Unassigned</dt>
            <dd>
              <time :datetime="row.unassignedAt">{{ formatDateTime(row.unassignedAt) }}</time>
            </dd>
          </div>
          <div v-if="row.returnedAt" class="flex flex-wrap gap-x-2">
            <dt>Returned</dt>
            <dd>
              <time :datetime="row.returnedAt">{{ formatDateTime(row.returnedAt) }}</time>
              <template v-if="row.returnCondition">
                · {{ row.returnCondition === 'damaged' ? 'damaged' : 'OK' }}</template
              ><template v-if="row.returnNote"> · {{ row.returnNote }}</template>
            </dd>
          </div>
          <div v-if="row.reminderCount" class="flex flex-wrap gap-x-2">
            <dt>Reminders</dt>
            <dd class="num">{{ row.reminderCount }}</dd>
          </div>
        </dl>
        <div class="md:text-right">
          <UiTag :tone="outcome(row).tone">{{ outcome(row).label }}</UiTag>
        </div>
      </li>
    </ol>
  </div>
</template>
