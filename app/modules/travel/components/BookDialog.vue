<script setup lang="ts">
import { describeError, isApiError } from '~/lib/api'
import type { AttachmentDto } from '~/types/api'
import { useTravelActions } from '../api'
import type { TravelRequestDetail, TravelRequestSummary } from '../api/types'
import { requestTitle } from '../lib/present'

/**
 * Book dialog for the travel desk (SCREENS §5.6, DESIGN §8.3 "Book…"): booking number*, PIN
 * (4–12 letters or digits, stored encrypted, never emailed), comment and 1–5 confirmation PDFs
 * (staged uploads, purpose `travel_booking_confirmation`). Runs `book` and emits `done`.
 */
const props = defineProps<{ request: TravelRequestSummary | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ done: [detail: TravelRequestDetail] }>()

const bookingNumber = ref('')
const pin = ref('')
const comment = ref('')
const files = ref<AttachmentDto[]>([])
const uploading = ref(false)
const errors = ref<Record<string, string | null>>({})
const formError = ref<string | null>(null)

const actions = useTravelActions(() => props.request?.id)

watch(open, (value) => {
  if (!value) return
  bookingNumber.value = ''
  pin.value = ''
  comment.value = ''
  files.value = []
  errors.value = {}
  formError.value = null
})

// An error clears as soon as its field changes (re-checked on the next submit).
watch(bookingNumber, () => (errors.value.bookingNumber = null))
watch(pin, () => (errors.value.pin = null))
watch(files, () => (errors.value.attachmentIds = null), { deep: true })

function validate(): boolean {
  const next: Record<string, string | null> = {}
  if (!bookingNumber.value.trim())
    next.bookingNumber = 'Enter the booking number from the provider.'
  if (pin.value.trim() && !/^[A-Za-z0-9]{4,12}$/.test(pin.value.trim())) {
    next.pin = 'Use 4–12 letters or digits, or leave it empty.'
  }
  if (files.value.length === 0) next.attachmentIds = 'Attach the booking confirmation as a PDF.'
  errors.value = next
  return Object.keys(next).length === 0
}

async function submit() {
  formError.value = null
  if (uploading.value || !validate() || !props.request) return
  try {
    const detail = await actions.run('book', {
      bookingNumber: bookingNumber.value.trim(),
      pin: pin.value.trim() || null,
      comment: comment.value.trim() || null,
      attachmentIds: files.value.map((file) => file.id),
    })
    open.value = false
    emit('done', detail)
  } catch (error) {
    if (isApiError(error) && error.isValidationError) {
      errors.value = {
        bookingNumber: error.fieldError('bookingNumber') ?? null,
        pin: error.fieldError('pin') ?? null,
        attachmentIds:
          error.fieldError('attachmentIds') ??
          Object.entries(error.fieldErrors).find(([key]) =>
            key.startsWith('attachmentIds'),
          )?.[1]?.[0] ??
          null,
      }
      return
    }
    if (!isApiError(error) || error.code !== 'invalid_transition') {
      formError.value = describeError(error).detail ?? describeError(error).title
    }
  }
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Book this trip"
    :description="
      request
        ? `${requestTitle(request)} for ${request.traveller.displayName} · ${request.reference}`
        : undefined
    "
    size="md"
  >
    <form class="grid gap-5" novalidate @submit.prevent="submit">
      <UiField
        label="Booking number"
        hint="As printed on the provider's confirmation."
        :error="errors.bookingNumber"
      >
        <UiInput v-model="bookingNumber" mono autocomplete="off" maxlength="60" />
      </UiField>
      <UiField
        label="PIN"
        optional
        hint="Stored encrypted. Only the traveller, the requester and the travel desk can reveal it; it is never emailed."
        :error="errors.pin"
      >
        <UiInput v-model="pin" mono autocomplete="off" maxlength="12" />
      </UiField>
      <UiField
        label="Confirmations"
        hint="1–5 PDFs. They are attached to the traveller's email."
        :error="errors.attachmentIds"
      >
        <FileDrop
          v-model="files"
          v-model:uploading="uploading"
          purpose="travel_booking_confirmation"
          :max="5"
        />
      </UiField>
      <UiField label="Note for the traveller" optional>
        <UiTextarea v-model="comment" :maxlength="2000" :rows="3" />
      </UiField>
      <p v-if="formError" class="text-sm text-st-negative" role="alert">{{ formError }}</p>
      <div class="flex justify-end gap-2">
        <UiButton variant="secondary" @click="open = false">Cancel</UiButton>
        <UiButton
          type="submit"
          variant="primary"
          :loading="actions.isPending.value"
          :disabled="uploading"
          >Book trip</UiButton
        >
      </div>
    </form>
  </UiDialog>
</template>
