<script setup lang="ts">
import { sentenceCase } from '~/lib/status'
import type { TimelineEntry } from '~/types/api'

/**
 * AuditTrail (DESIGN §9): vertical list — hollow dot · sentence · time. Newest first; system
 * actions read "Atrium"; reasons are quoted; field-level diffs expand into an old → new list.
 */
const props = withDefaults(
  defineProps<{
    entries: readonly TimelineEntry[]
    /** Show field-level changes (FieldChange[]). */
    showChanges?: boolean
    /** Keep the given order instead of sorting newest first. */
    keepOrder?: boolean
  }>(),
  { showChanges: false },
)

const sorted = computed(() =>
  props.keepOrder
    ? props.entries
    : [...props.entries].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
)

/** Bold the actor's name when the sentence starts with it. */
function parts(entry: TimelineEntry) {
  const name = entry.actor?.displayName ?? 'Atrium'
  return entry.summary.startsWith(name)
    ? { name, rest: entry.summary.slice(name.length) }
    : { name: '', rest: entry.summary }
}

const enums = useEnums()

/**
 * The quoted reason line. `auto_approve` entries carry an AutoApproval code
 * (`requester_is_approver`, …) as their reason: show its label instead, unquoted.
 */
function reasonLine(entry: TimelineEntry): { text: string; quoted: boolean } | null {
  if (!entry.reason) return null
  if (entry.action === 'auto_approve') {
    const option = enums.options('autoApproval').find((o) => o.value === entry.reason)
    return { text: option?.label ?? sentenceCase(entry.reason), quoted: false }
  }
  return { text: entry.reason, quoted: true }
}

const show = (value: unknown) =>
  value === null || value === undefined || value === ''
    ? '—'
    : Array.isArray(value)
      ? value.join(', ')
      : String(value)
</script>

<template>
  <ol class="m-0 list-none p-0">
    <li
      v-for="entry in sorted"
      :key="entry.id"
      class="relative grid grid-cols-[14px_minmax(0,1fr)_auto] gap-2.5 pb-3 text-[13.5px] leading-5 before:absolute before:top-3.5 before:-bottom-0.5 before:left-1 before:border-l before:border-rule-strong last:before:hidden"
    >
      <span
        class="mt-1.5 size-[9px] rounded-full border-[1.5px] border-ink-muted bg-sheet"
        aria-hidden="true"
      />
      <div class="min-w-0">
        <p>
          <b v-if="parts(entry).name" class="font-semibold">{{ parts(entry).name }}</b
          >{{ parts(entry).rest }}
        </p>
        <p v-if="reasonLine(entry)" class="mt-0.5 text-ink-muted">
          <template v-if="reasonLine(entry)!.quoted">“{{ reasonLine(entry)!.text }}”</template>
          <template v-else>{{ reasonLine(entry)!.text }}</template>
        </p>
        <dl
          v-if="showChanges && entry.changes?.length"
          class="mt-1.5 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm"
        >
          <template v-for="change in entry.changes" :key="change.field">
            <dt class="text-ink-subtle">{{ change.label }}</dt>
            <dd class="m-0">
              <span class="text-ink-muted line-through decoration-rule-strong">{{
                show(change.from)
              }}</span>
              → {{ show(change.to) }}
            </dd>
          </template>
        </dl>
      </div>
      <time
        :datetime="entry.occurredAt"
        class="text-meta whitespace-nowrap text-ink-subtle"
        :title="formatDateTime(entry.occurredAt)"
      >
        {{ formatAge(entry.occurredAt) }}
      </time>
    </li>
  </ol>
</template>
