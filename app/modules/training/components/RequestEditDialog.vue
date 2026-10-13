<script setup lang="ts">
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import type { Money } from '~/types/api'
import { trainingKeys } from '../api'
import type { TrainingRequestDetail, UpdateTrainingRequest } from '../api/types'
import { FORMAT_LABEL, THRESHOLD_CENTS } from '../constants'

/**
 * Edit the request details (SCREENS §4.4: the step-1 fields in a dialog). The server decides
 * the window: the requester only while every attendee awaits the manager; the training office
 * any time, but the cost and the executive approver only until the first manager decision —
 * a 409 is explained in the dialog.
 */
const props = defineProps<{ request: TrainingRequestDetail }>()
const open = defineModel<boolean>('open', { default: false })

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const org = useOrg()
const executives = useQuery({
  queryKey: ['training', 'executives'],
  queryFn: ({ signal }) =>
    api.get<{ data: { id: string; displayName: string }[] }>(
      '/users',
      { role: 'executive', perPage: 50 },
      { signal },
    ),
  enabled: computed(() => open.value),
})

const schema = toTypedSchema(
  z
    .object({
      topic: z.string().trim().min(3, 'Name the training (at least 3 characters).').max(200),
      provider: z.string().trim().min(2, 'Name the provider.').max(120),
      format: z.enum(['in_person', 'online', 'hybrid']),
      location: z.string().max(200).nullable(),
      registrationUrl: z
        .string()
        .max(500)
        .nullable()
        .refine((v) => !v || /^https:\/\/\S+$/i.test(v), 'Use a link that starts with https://'),
      registrationDetails: z.string().max(2000).nullable(),
      startsOn: z.string({ error: 'Pick the start date.' }).min(1, 'Pick the start date.'),
      endsOn: z.string({ error: 'Pick the end date.' }).min(1, 'Pick the end date.'),
      cost: z
        .custom<Money | null>()
        .refine((v) => v !== null && v !== undefined, 'Enter the cost per attendee.'),
      costCenterId: z.string().nullable(),
      executiveApproverId: z.string().nullable(),
      certificateExpected: z.boolean(),
      reimbursementAgreement: z.boolean(),
      requesterComment: z.string().max(2000).nullable(),
    })
    .refine((v) => v.format === 'online' || Boolean(v.location?.trim()), {
      path: ['location'],
      message: 'Add the location (or choose Online).',
    })
    .refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, {
      path: ['endsOn'],
      message: 'The end date is before the start date.',
    }),
)
const { defineField, errors, handleSubmit, isSubmitting, setErrors, resetForm, values } = useForm({
  validationSchema: schema,
})
const [topic] = defineField('topic')
const [provider] = defineField('provider')
const [format] = defineField('format')
const [location] = defineField('location')
const [registrationUrl] = defineField('registrationUrl')
const [registrationDetails] = defineField('registrationDetails')
const [startsOn] = defineField('startsOn')
const [endsOn] = defineField('endsOn')
const [cost] = defineField<'cost', Money | null>('cost')
const [costCenterId] = defineField('costCenterId')
const [executiveApproverId] = defineField('executiveApproverId')
const [certificateExpected] = defineField('certificateExpected')
const [reimbursementAgreement] = defineField('reimbursementAgreement')
const [requesterComment] = defineField('requesterComment')

watch(open, (value) => {
  if (!value) return
  formError.value = null
  const r = props.request
  resetForm({
    values: {
      topic: r.topic,
      provider: r.provider,
      format: r.format,
      location: r.location,
      registrationUrl: r.registrationUrl,
      registrationDetails: r.registrationDetails,
      startsOn: r.startsOn,
      endsOn: r.endsOn,
      cost: r.cost,
      costCenterId: r.costCenter.id,
      executiveApproverId: r.executiveApprover?.id ?? null,
      certificateExpected: r.certificateExpected,
      reimbursementAgreement: r.reimbursementAgreement,
      requesterComment: r.requesterComment,
    },
  })
})

const formatOptions = (['in_person', 'online', 'hybrid'] as const).map((value) => ({
  value,
  label: FORMAT_LABEL[value],
}))
const needsExecutive = computed(() => (values.cost?.amountCents ?? 0) >= THRESHOLD_CENTS)
const formError = ref<string | null>(null)
const submit = handleSubmit(async (v) => {
  formError.value = null
  const body: UpdateTrainingRequest = {
    topic: v.topic,
    provider: v.provider,
    format: v.format,
    location: v.format === 'online' ? v.location?.trim() || null : v.location?.trim() || null,
    registrationUrl: v.registrationUrl?.trim() || null,
    registrationDetails: v.registrationDetails?.trim() || null,
    startsOn: v.startsOn,
    endsOn: v.endsOn,
    cost: v.cost ?? undefined,
    costCenterId: v.costCenterId,
    executiveApproverId: needsExecutive.value ? v.executiveApproverId : null,
    certificateExpected: v.certificateExpected,
    reimbursementAgreement: v.reimbursementAgreement,
    requesterComment: v.requesterComment?.trim() || null,
    version: props.request.version,
  }
  try {
    const detail = await api.patch<TrainingRequestDetail>(
      `/training/requests/${props.request.id}`,
      body,
    )
    queryClient.setQueryData(trainingKeys.requests.detail(detail.id), detail)
    await queryClient.invalidateQueries({ queryKey: trainingKeys.module })
    toast.success('Request updated.')
    open.value = false
  } catch (error) {
    if (isApiError(error) && error.isValidationError) {
      setErrors(error.fieldErrors)
      return
    }
    formError.value =
      isApiError(error) && error.code === 'version_conflict'
        ? 'Someone else changed this request meanwhile. Close the dialog to reload it.'
        : (describeError(error).detail ?? describeError(error).title)
  }
})
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Edit request"
    description="Attendees keep their routing; a new cost can add or remove the executive step."
    size="lg"
  >
    <form class="grid gap-4 md:grid-cols-2" @submit.prevent="submit">
      <UiField label="Topic" :error="errors.topic" class="md:col-span-2">
        <UiInput v-model="topic" />
      </UiField>
      <UiField label="Provider" :error="errors.provider">
        <UiInput v-model="provider" />
      </UiField>
      <UiField label="Format" :error="errors.format">
        <UiSelect v-model="format" :options="formatOptions" />
      </UiField>
      <UiField label="Location" :optional="format === 'online'" :error="errors.location">
        <UiInput v-model="location" />
      </UiField>
      <UiField label="Registration link" optional :error="errors.registrationUrl">
        <UiInput v-model="registrationUrl" type="url" placeholder="https://" />
      </UiField>
      <UiField label="Start date" :error="errors.startsOn">
        <UiDatePicker v-model="startsOn" />
      </UiField>
      <UiField label="End date" :error="errors.endsOn">
        <UiDatePicker v-model="endsOn" :min="startsOn" />
      </UiField>
      <UiField label="Cost per attendee" :error="errors.cost">
        <MoneyInput v-model="cost" />
      </UiField>
      <UiField label="Cost centre" :error="errors.costCenterId">
        <UiSelect v-model="costCenterId" :options="org.costCenterOptions.value" />
      </UiField>
      <UiField
        v-if="needsExecutive"
        label="Executive approver"
        hint="Trainings from €5,000 per attendee also need an executive."
        :error="errors.executiveApproverId"
        class="md:col-span-2"
      >
        <UiSelect
          v-model="executiveApproverId"
          :options="
            (executives.data.value?.data ?? []).map((u) => ({ value: u.id, label: u.displayName }))
          "
        />
      </UiField>
      <UiField
        label="Registration details"
        optional
        :error="errors.registrationDetails"
        class="md:col-span-2"
      >
        <UiTextarea v-model="registrationDetails" :rows="2" :maxlength="2000" />
      </UiField>
      <UiSwitch v-model="certificateExpected" label="Certificate expected" />
      <UiSwitch v-model="reimbursementAgreement" label="Reimbursement agreement needed" />
      <UiField label="Comment" optional :error="errors.requesterComment" class="md:col-span-2">
        <UiTextarea v-model="requesterComment" :rows="2" :maxlength="2000" />
      </UiField>
      <p v-if="formError" role="alert" class="text-sm text-st-negative md:col-span-2">
        {{ formError }}
      </p>
      <div class="flex justify-end gap-2 md:col-span-2">
        <UiButton variant="ghost" @click="open = false">Cancel</UiButton>
        <UiButton type="submit" variant="primary" :loading="isSubmitting">Save changes</UiButton>
      </div>
    </form>
  </UiDialog>
</template>
