<script setup lang="ts">
import { Receipt } from '@lucide/vue'
import { describeError, isApiError } from '~/lib/api'
import type { Money } from '~/types/api'
import { trainingKeys } from '../api'
import type { BillingStatus, TrainingRequestDetail } from '../api/types'

/**
 * Back-office panel of a request (SCREENS §4.4, training office): billing status, actual cost
 * and an internal comment (`PATCH /training/requests/{id}/back-office`). "Free of charge" sets
 * the actual cost to €0.
 */
const props = defineProps<{ request: TrainingRequestDetail }>()

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const enums = useEnums()

const billingStatus = ref<BillingStatus>(props.request.backOffice?.billingStatus ?? 'open')
const actualCost = ref<Money | null>(props.request.backOffice?.actualCost ?? null)
const comment = ref(props.request.backOffice?.comment ?? '')
watch(
  () => props.request.backOffice,
  (value) => {
    billingStatus.value = value?.billingStatus ?? 'open'
    actualCost.value = value?.actualCost ?? null
    comment.value = value?.comment ?? ''
  },
)
watch(billingStatus, (value) => {
  if (value === 'free_of_charge') actualCost.value = { amountCents: 0, currency: 'EUR' }
})

const saving = ref(false)
const error = ref<string | null>(null)
const options = computed(() =>
  (['open', 'invoice_received', 'free_of_charge'] as const).map((value) => ({
    value,
    label: enums.label('billingStatus', value),
  })),
)
const planned = computed(() => props.request.cost.amountCents * props.request.attendeeCount)

async function save() {
  saving.value = true
  error.value = null
  try {
    const detail = await api.patch<TrainingRequestDetail>(
      `/training/requests/${props.request.id}/back-office`,
      {
        billingStatus: billingStatus.value,
        actualCost: actualCost.value,
        backOfficeComment: comment.value.trim() || null,
        version: props.request.version,
      },
    )
    queryClient.setQueryData(trainingKeys.requests.detail(detail.id), detail)
    await queryClient.invalidateQueries({ queryKey: trainingKeys.requests.lists() })
    toast.success('Billing details saved.')
  } catch (err) {
    error.value =
      isApiError(err) && err.code === 'version_conflict'
        ? 'Someone else changed this request. Reload the page and try again.'
        : (describeError(err).detail ?? describeError(err).title)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="rounded-lg border border-rule bg-well p-5" aria-labelledby="bo-title">
    <h2 id="bo-title" class="flex items-center gap-2 font-display text-[20px] leading-7">
      <Receipt class="size-4 text-ink-muted" aria-hidden="true" /> Back office
    </h2>
    <p class="mt-1 text-sm text-ink-muted">
      Only the training office sees this. Planned:
      <span class="num">{{ formatMoney(planned) }}</span> ({{ request.attendeeCount }} ×
      {{ formatMoney(request.cost) }}).
    </p>
    <form class="mt-4 grid gap-4 sm:grid-cols-2" @submit.prevent="save">
      <UiField label="Billing status">
        <UiSelect v-model="billingStatus" :options="options" />
      </UiField>
      <UiField label="Actual cost" optional>
        <MoneyInput v-model="actualCost" :disabled="billingStatus === 'free_of_charge'" />
      </UiField>
      <UiField label="Back-office comment" optional class="sm:col-span-2">
        <UiTextarea v-model="comment" :rows="2" :maxlength="2000" />
      </UiField>
      <p v-if="error" role="alert" class="text-sm text-st-negative sm:col-span-2">{{ error }}</p>
      <div class="sm:col-span-2">
        <UiButton type="submit" variant="primary" :loading="saving">Save billing</UiButton>
      </div>
    </form>
  </section>
</template>
