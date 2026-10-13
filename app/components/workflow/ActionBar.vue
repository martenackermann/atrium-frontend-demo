<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { Ellipsis } from '@lucide/vue'
import { isApiError } from '~/lib/api'
import { NEGATIVE_ACTIONS, PRIMARY_ACTIONS } from '~/lib/status'
import { cn } from '~/lib/cn'
import type { ActionConfig } from '~/types/ui'

/**
 * ActionBar (SCREENS §1.6): renders the record's `availableActions` in canonical (API) order —
 * actions without a config (capability flags like `edit`) are skipped. The first positive action
 * is primary; refusals render as danger. Up to `max` buttons, the rest in a "More actions" menu.
 * Emits `run(action, body)`; reason/confirm steps happen first.
 *
 *   <ActionBar :actions="request.availableActions" :config="TRAVEL_ACTIONS"
 *              :pending="pendingAction" @run="(action, body) => run(action, body)" />
 */
const props = withDefaults(
  defineProps<{
    actions: readonly string[]
    config: Record<string, ActionConfig>
    /** Action currently running (spinner on its button). */
    pending?: string | null
    max?: number
    /** Sticky bottom bar on mobile (pushed detail views). */
    stickyMobile?: boolean
    class?: HTMLAttributes['class']
  }>(),
  { max: 3 },
)
const emit = defineEmits<{ run: [action: string, body: Record<string, unknown>] }>()

const { confirm } = useConfirm()

const visible = computed(() => props.actions.filter((action) => props.config[action]))
const primary = computed(
  () =>
    visible.value.find((action) => props.config[action]?.variant === 'primary') ??
    visible.value.find((action) => (PRIMARY_ACTIONS as readonly string[]).includes(action)),
)
const ordered = computed(() => {
  // Primary last on the right, refusals before it (DESIGN: secondary left of primary).
  const rest = visible.value.filter((action) => action !== primary.value)
  return primary.value ? [...rest, primary.value] : rest
})
// The sticky phone bar holds one row: two buttons, or the primary next to "More actions".
const isMobile = useMediaQuery('(max-width: 767px)')
const limit = computed(() =>
  props.stickyMobile && isMobile.value ? (ordered.value.length <= 2 ? 2 : 1) : props.max,
)
const inline = computed(() => ordered.value.slice(-limit.value))
const overflow = computed(() =>
  ordered.value.slice(0, Math.max(0, ordered.value.length - limit.value)),
)

function variantOf(action: string): 'primary' | 'secondary' | 'danger' {
  const configured = props.config[action]?.variant
  if (configured) return configured
  if (action === primary.value) return 'primary'
  if ((NEGATIVE_ACTIONS as readonly string[]).includes(action)) return 'danger'
  return 'secondary'
}

const reasonFor = ref<string | null>(null)
const reasonOpen = computed({
  get: () => reasonFor.value !== null,
  set: (value) => {
    if (!value) reasonFor.value = null
  },
})
const reasonError = ref<string | null>(null)
const activeReason = computed(() =>
  reasonFor.value ? props.config[reasonFor.value]?.reason : undefined,
)

async function trigger(action: string) {
  const config = props.config[action]
  if (!config) return
  if (config.reason) {
    reasonError.value = null
    reasonFor.value = action
    return
  }
  if (config.confirm) {
    const ok = await confirm({
      ...config.confirm,
      destructive: variantOf(action) === 'danger',
    })
    if (!ok) return
  }
  emit('run', action, {})
}

/** Called by the parent when the action failed with a 422 for the reason field. */
function setReasonError(error: unknown) {
  if (isApiError(error)) {
    const field = activeReason.value?.field ?? 'reason'
    reasonError.value = error.fieldError(field) ?? error.detail ?? error.title
  }
}

function submitReason(reason: string) {
  const action = reasonFor.value
  if (!action) return
  const field = props.config[action]?.reason?.field ?? 'reason'
  emit('run', action, { [field]: reason })
}

/** Close the reason dialog after a successful run (the parent calls it). */
function done() {
  reasonFor.value = null
}

defineExpose({ trigger, setReasonError, done })
</script>

<template>
  <div
    v-if="visible.length"
    :class="
      cn(
        'flex flex-wrap items-center gap-2',
        stickyMobile &&
          'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:grid max-md:grid-cols-[auto_1fr] max-md:border-t max-md:border-rule max-md:bg-sheet max-md:px-4 max-md:pt-2.5 max-md:pb-[calc(10px+env(safe-area-inset-bottom))]',
        props.class,
      )
    "
  >
    <UiButton
      v-for="action in inline"
      :key="action"
      :variant="variantOf(action)"
      :icon="config[action]?.icon"
      :kbd="config[action]?.kbd"
      :loading="pending === action"
      :disabled="Boolean(pending) && pending !== action"
      :class="stickyMobile && 'max-md:h-11'"
      @click="trigger(action)"
      >{{ config[action]?.label
      }}{{ config[action]?.reason || config[action]?.confirm ? '…' : '' }}</UiButton
    >

    <!-- The overflow menu sits after the buttons (DESIGN comps); first in the mobile sticky bar. -->
    <UiMenu v-if="overflow.length">
      <template #trigger>
        <UiIconButton
          :icon="Ellipsis"
          label="More actions"
          :class="stickyMobile && 'max-md:order-first'"
        />
      </template>
      <UiMenuItem
        v-for="action in overflow"
        :key="action"
        :icon="config[action]?.icon"
        :destructive="variantOf(action) === 'danger'"
        @select="trigger(action)"
        >{{ config[action]?.label
        }}{{ config[action]?.reason || config[action]?.confirm ? '…' : '' }}</UiMenuItem
      >
    </UiMenu>

    <ReasonDialog
      v-if="activeReason"
      v-model:open="reasonOpen"
      :title="activeReason.title"
      :description="activeReason.description"
      :label="activeReason.label"
      :hint="activeReason.hint"
      :required="activeReason.required ?? true"
      :confirm-label="activeReason.confirmLabel ?? config[reasonFor!]?.label ?? 'Confirm'"
      :destructive="variantOf(reasonFor!) === 'danger'"
      :loading="pending === reasonFor"
      :error="reasonError"
      @submit="submitReason"
    />
  </div>
</template>
