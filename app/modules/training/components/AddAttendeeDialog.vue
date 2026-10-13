<script setup lang="ts">
import { describeError, isApiError } from '~/lib/api'
import type { Money, UserRef } from '~/types/api'
import { trainingKeys } from '../api'
import type { TrainingAttendeeDto, TrainingRequestDetail } from '../api/types'

/**
 * Add an attendee to a request before it starts (`POST /training/requests/{id}/attendees`):
 * a person from the requester's team (anyone for the training office) and an optional hotel.
 * The new participation is routed like at creation (approver, escalation, auto-approval).
 */
const props = defineProps<{ request: TrainingRequestDetail }>()
const open = defineModel<boolean>('open', { default: false })

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const auth = useAuthStore()
const backOffice = computed(() => auth.can(['training_office', 'it_admin']))

const person = ref<UserRef | null>(null)
const hotel = ref(false)
const checkInOn = ref<string | null>(null)
const checkOutOn = ref<string | null>(null)
const hotelCost = ref<Money | null>(null)
const errors = ref<Record<string, string | undefined>>({})
const formError = ref<string | null>(null)
const saving = ref(false)

watch(open, (value) => {
  if (!value) return
  person.value = null
  hotel.value = false
  checkInOn.value = props.request.startsOn
  checkOutOn.value = props.request.endsOn
  hotelCost.value = null
  errors.value = {}
  formError.value = null
})

async function submit() {
  errors.value = {}
  formError.value = null
  if (!person.value) {
    errors.value = { userId: 'Choose who attends.' }
    return
  }
  saving.value = true
  try {
    const attendee = await api.post<TrainingAttendeeDto>(
      `/training/requests/${props.request.id}/attendees`,
      {
        userId: person.value.id,
        hotel: hotel.value
          ? { checkInOn: checkInOn.value, checkOutOn: checkOutOn.value, cost: hotelCost.value }
          : null,
      },
    )
    await queryClient.invalidateQueries({ queryKey: trainingKeys.module })
    toast.success(
      attendee.status === 'to_book'
        ? `${attendee.user.displayName} is added and approved automatically.`
        : `${attendee.user.displayName} is added. ${attendee.approver?.displayName ?? 'The approver'} decides next.`,
    )
    open.value = false
  } catch (error) {
    if (isApiError(error) && error.isValidationError) {
      errors.value = {
        userId: error.fieldError('userId'),
        checkInOn: error.fieldError('hotel.checkInOn'),
        checkOutOn: error.fieldError('hotel.checkOutOn'),
      }
      return
    }
    formError.value = describeError(error).detail ?? describeError(error).title
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Add an attendee"
    description="The new participation goes to their approver, like the others."
  >
    <form class="grid gap-4" @submit.prevent="submit">
      <UiField label="Who attends" :error="errors.userId">
        <UserPicker
          v-model="person"
          :scope="backOffice ? 'all' : 'team'"
          :exclude="request.attendees.map((a) => a.user.id)"
        />
      </UiField>
      <UiSwitch v-model="hotel" label="Needs a hotel" />
      <div v-if="hotel" class="grid gap-4 sm:grid-cols-3">
        <UiField label="Check-in" :error="errors.checkInOn">
          <UiDatePicker v-model="checkInOn" />
        </UiField>
        <UiField label="Check-out" :error="errors.checkOutOn">
          <UiDatePicker v-model="checkOutOn" :min="checkInOn" />
        </UiField>
        <UiField label="Hotel cost" optional>
          <MoneyInput v-model="hotelCost" />
        </UiField>
      </div>
      <p v-if="formError" role="alert" class="text-sm text-st-negative">{{ formError }}</p>
      <div class="flex justify-end gap-2">
        <UiButton variant="ghost" @click="open = false">Cancel</UiButton>
        <UiButton type="submit" variant="primary" :loading="saving">Add attendee</UiButton>
      </div>
    </form>
  </UiDialog>
</template>
