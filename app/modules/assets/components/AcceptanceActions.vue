<script setup lang="ts">
import { Check } from '@lucide/vue'
import { describeError, isApiError } from '~/lib/api'
import { assetKeys } from '../api'
import type { AssetDto } from '../api/types'

/**
 * Decline… / Accept {device} for the assigned user (SCREENS §6.1/§6.2, SPEC §5.3). Accept asks for
 * the installed platform when the device type requires one; Decline asks for a reason (3–1000).
 * Rendered only when `availableActions` offers them (never derived from roles).
 */
const props = defineProps<{ asset: AssetDto; block?: boolean }>()
const emit = defineEmits<{ done: [action: 'accept' | 'decline', asset: AssetDto] }>()

const noun = computed(() => props.asset.deviceType.name.toLowerCase())
const canAccept = computed(() => props.asset.availableActions.includes('accept'))
const canDecline = computed(() => props.asset.availableActions.includes('decline'))

const { run, isPending, variables } = useWorkflowAction<AssetDto>({
  resourcePath: () => `/assets/${props.asset.id}`,
  invalidate: [assetKeys.module],
  messages: {
    accept: () => `${capitalise(noun.value)} accepted. It is now registered to you.`,
    decline: () => `${capitalise(noun.value)} declined. IT support has your reason.`,
  },
  onSuccess: (detail, action) => emit('done', action as 'accept' | 'decline', detail),
})
const pending = computed(() => (isPending.value ? variables.value?.action : null))

const acceptOpen = ref(false)
const acceptError = ref<string | null>(null)
const declineOpen = ref(false)
const declineError = ref<string | null>(null)

function capitalise(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

async function accept(platformId: string | null) {
  acceptError.value = null
  try {
    await run('accept', { platformId })
    acceptOpen.value = false
  } catch (error) {
    if (isApiError(error) && error.status === 422) {
      acceptError.value = error.fieldError('platformId') ?? describeError(error).detail ?? null
    }
  }
}

function startAccept() {
  if (props.asset.deviceType.requiresPlatform) {
    acceptError.value = null
    acceptOpen.value = true
  } else {
    void accept(null)
  }
}

async function decline(reason: string) {
  declineError.value = null
  try {
    await run('decline', { reason })
    declineOpen.value = false
  } catch (error) {
    if (isApiError(error) && error.status === 422) {
      declineError.value = error.fieldError('reason') ?? describeError(error).detail ?? null
    }
  }
}
</script>

<template>
  <div
    v-if="canAccept || canDecline"
    class="flex flex-wrap items-center gap-2"
    :class="block && 'max-md:grid max-md:grid-cols-[auto_1fr]'"
  >
    <UiButton
      v-if="canDecline"
      variant="secondary"
      :disabled="Boolean(pending)"
      :loading="pending === 'decline'"
      @click="declineOpen = true"
      >Decline…</UiButton
    >
    <UiButton
      v-if="canAccept"
      variant="primary"
      :icon="Check"
      :loading="pending === 'accept' && !acceptOpen"
      :disabled="Boolean(pending)"
      @click="startAccept"
      >Accept {{ noun }}</UiButton
    >
    <AssetsAcceptDialog
      v-model:open="acceptOpen"
      :asset="asset"
      :loading="pending === 'accept'"
      :error="acceptError"
      @submit="accept"
    />
    <ReasonDialog
      v-model:open="declineOpen"
      :title="`Decline this ${noun}?`"
      description="IT support gets your reason and the device goes back to stock."
      label="Why are you declining it?"
      hint="For example: wrong model, damaged on arrival, or you already have one."
      :confirm-label="`Decline ${noun}`"
      destructive
      :loading="pending === 'decline'"
      :error="declineError"
      @submit="decline"
    />
  </div>
</template>
