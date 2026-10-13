<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { resolveStatus, type DesignTone } from '~/lib/status'
import { cn } from '~/lib/cn'

/**
 * StatusBadge (DESIGN §2.4/§9, SPEC_RESOLUTIONS #8): icon (13) + word, 22px, tone fill + line.
 * Perspective-aware: pass the record's `availableActions` (or `actor`) and the viewer who must
 * act sees tone `you` ("Needs your approval"); everyone else sees who it waits for.
 *
 *   <StatusBadge enum="travelStatus" :value="request.status" :available-actions="request.availableActions" />
 */
const props = withDefaults(
  defineProps<{
    /** Enum name as in /meta/enums: attendeeStatus, travelStatus, assetStatus, … */
    enum: string
    value: string | number
    availableActions?: readonly string[]
    /** Force the actor rendering (true) or suppress it (false); unset = from availableActions. */
    actor?: boolean
    /** No fill/border (inline in prose). */
    plain?: boolean
    class?: HTMLAttributes['class']
  }>(),
  // Vue casts absent boolean props to false; keep `actor` undefined so availableActions decides.
  { actor: undefined },
)

const enums = useEnums()
const status = computed(() =>
  resolveStatus(props.enum, props.value, {
    actor: props.actor,
    availableActions: props.availableActions,
    enumOptions: enums.options(props.enum),
  }),
)

const TONE: Record<DesignTone, string> = {
  neutral: 'bg-st-neutral-bg text-st-neutral border-st-neutral-line',
  waiting: 'bg-st-waiting-bg text-st-waiting border-st-waiting-line',
  you: 'bg-st-you-bg text-st-you border-st-you-line font-semibold',
  moving: 'bg-st-moving-bg text-st-moving border-st-moving-line',
  positive: 'bg-st-positive-bg text-st-positive border-st-positive-line',
  negative: 'bg-st-negative-bg text-st-negative border-st-negative-line',
  blocked: 'bg-st-blocked-bg text-st-blocked border-st-blocked-line',
}
const PLAIN: Record<DesignTone, string> = {
  neutral: 'text-st-neutral',
  waiting: 'text-st-waiting',
  you: 'text-marker-text font-semibold',
  moving: 'text-st-moving',
  positive: 'text-st-positive',
  negative: 'text-st-negative',
  blocked: 'text-st-blocked',
}
</script>

<template>
  <span
    :data-tone="status.tone"
    :class="
      cn(
        'inline-flex items-center gap-[5px] align-middle text-meta leading-none font-medium whitespace-nowrap',
        plain ? PLAIN[status.tone] : ['h-[22px] rounded-sm border pr-2 pl-1.5', TONE[status.tone]],
        props.class,
      )
    "
  >
    <component :is="status.icon" class="size-[13px]" :stroke-width="2" aria-hidden="true" />
    {{ status.label }}
  </span>
</template>
