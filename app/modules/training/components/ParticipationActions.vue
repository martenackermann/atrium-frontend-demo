<script setup lang="ts">
import { isApiError } from '~/lib/api'
import type { AttachmentDto } from '~/types/api'
import { trainingKeys } from '../api'
import type { TrainingAttendeeAction, TrainingParticipationDetail } from '../api/types'
import { ACTION_MESSAGES, TRAINING_ACTIONS } from '../constants'

/**
 * The participation ActionBar (SCREENS §4.3/§4.5/§4.7): renders `availableActions` with the
 * training config, runs transitions via `POST /training/participations/{id}/actions/{action}`
 * and opens the booking dialog (reference, comment, booking documents) for `book`.
 */
const props = withDefaults(
  defineProps<{
    participationId: string
    actions: readonly TrainingAttendeeAction[]
    /** "Book Emma Employee on First Aid…" in the booking dialog. */
    subject?: string
    max?: number
    stickyMobile?: boolean
  }>(),
  { max: 3, subject: undefined },
)
const emit = defineEmits<{ done: [detail: TrainingParticipationDetail, action: string] }>()

const bar = ref<{
  setReasonError: (error: unknown) => void
  done: () => void
  trigger: (action: string) => void
}>()
const pending = ref<string | null>(null)
// Mobile sticky bar (SCREENS §9): two actions stay inline (Decline… / Approve); with more,
// the primary stays and the rest go into "More", so the bar never wraps over the content.
const isMobile = useMediaQuery('(max-width: 767px)')
const barMax = computed(() => {
  const count = props.actions.filter((a) => TRAINING_ACTIONS[a]).length
  return props.stickyMobile && isMobile.value && count > 2 ? 1 : props.max
})
const { run } = useWorkflowAction<TrainingParticipationDetail>({
  resourcePath: () => `/training/participations/${props.participationId}`,
  invalidate: [trainingKeys.module],
  messages: ACTION_MESSAGES,
})

async function execute(action: string, body: Record<string, unknown>) {
  if (action === 'book') {
    openBook()
    return
  }
  pending.value = action
  try {
    const detail = await run(action, body)
    bar.value?.done()
    emit('done', detail, action)
  } catch (error) {
    if (isApiError(error) && error.status === 422) bar.value?.setReasonError(error)
  } finally {
    pending.value = null
  }
}

// Booking dialog --------------------------------------------------------------------------------
const bookOpen = ref(false)
const bookingReference = ref('')
const bookingComment = ref('')
const documents = ref<AttachmentDto[]>([])
const uploading = ref(false)
const bookError = ref<string | null>(null)

function openBook() {
  bookingReference.value = ''
  bookingComment.value = ''
  documents.value = []
  bookError.value = null
  bookOpen.value = true
}

async function submitBook() {
  if (uploading.value) return
  pending.value = 'book'
  bookError.value = null
  try {
    const detail = await run('book', {
      bookingReference: bookingReference.value.trim() || null,
      comment: bookingComment.value.trim() || null,
      attachmentIds: documents.value.map((file) => file.id),
    })
    bookOpen.value = false
    emit('done', detail, 'book')
  } catch (error) {
    if (isApiError(error) && error.status === 422)
      bookError.value = Object.values(error.fieldErrors).flat()[0] ?? error.detail ?? error.title
  } finally {
    pending.value = null
  }
}

defineExpose({ trigger: (action: string) => bar.value?.trigger(action) })
</script>

<template>
  <ActionBar
    ref="bar"
    :actions="actions"
    :config="TRAINING_ACTIONS"
    :pending="pending"
    :max="barMax"
    :sticky-mobile="stickyMobile"
    @run="execute"
  />
  <UiDialog
    v-model:open="bookOpen"
    title="Book this training"
    :description="
      subject
        ? `Book ${subject}. The attendee gets the booking details by email.`
        : 'The attendee gets the booking details by email.'
    "
  >
    <form class="grid gap-4" @submit.prevent="submitBook">
      <UiField label="Booking reference" optional hint="The provider's reference, if any.">
        <UiInput v-model="bookingReference" mono maxlength="100" />
      </UiField>
      <UiField label="Comment for the attendee" optional>
        <UiTextarea v-model="bookingComment" :rows="3" :maxlength="2000" />
      </UiField>
      <UiField
        label="Booking documents"
        optional
        hint="Confirmation, invoice or joining instructions."
      >
        <FileDrop
          v-model="documents"
          v-model:uploading="uploading"
          purpose="training_booking_document"
          :max="10"
        />
      </UiField>
      <p v-if="bookError" role="alert" class="text-sm text-st-negative">{{ bookError }}</p>
      <div class="flex justify-end gap-2">
        <UiButton variant="secondary" @click="bookOpen = false">Cancel</UiButton>
        <UiButton
          type="submit"
          variant="primary"
          :loading="pending === 'book'"
          :disabled="uploading"
          >Book it</UiButton
        >
      </div>
    </form>
  </UiDialog>
</template>
