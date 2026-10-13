<script setup lang="ts">
import { Plane } from '@lucide/vue'
import { z } from 'zod'
import type { UserRef } from '~/types/api'
import type { FactItem } from '~/types/ui'
import { useTravelPreview } from '~/modules/travel/api'
import type { CreateTravelRequest, TravelRequestDetail } from '~/modules/travel/api/types'
import { PLACES } from '~/modules/travel/constants'
import {
  costsBody,
  costsDefaults,
  costsShape,
  refineCosts,
  useMeRef,
  useTravellerContext,
  useCostCenterLabel,
  useTravelSubmit,
} from '~/modules/travel/lib/stepper'

/**
 * Flight stepper (SCREENS §5.3, focus mode): General · Outbound · Return (skipped for one way) ·
 * Costs & approval · Review. Flights always need approval (callout + the approver is always
 * shown). Live slip from `POST /travel/requests/preview`.
 */
definePageMeta({ title: 'Book a flight', layout: 'focus' })

const route = useRoute()
const api = useApi()
const toast = useToast()
const me = useMeRef()

const initialValues = () => ({
  traveller: me.value as UserRef | null,
  tripType: 'return' as 'one_way' | 'return',
  handLuggageOnly: false,
  outboundFrom: '',
  outboundTo: '',
  outboundDepartureAt: null as string | null,
  returnFrom: '',
  returnTo: '',
  returnDepartureAt: null as string | null,
  notes: '',
  ...costsDefaults,
})
type Values = ReturnType<typeof initialValues>

const travellerCostCenter = ref<string | null>(null)
const isDeskRef = ref(false)

const schema = toTypedSchema(
  z
    .object({
      traveller: z.custom<UserRef | null>(),
      tripType: z.enum(['one_way', 'return']),
      handLuggageOnly: z.boolean(),
      outboundFrom: z.string().trim().max(120),
      outboundTo: z.string().trim().max(120),
      outboundDepartureAt: z.string().nullable(),
      returnFrom: z.string().trim().max(120),
      returnTo: z.string().trim().max(120),
      returnDepartureAt: z.string().nullable(),
      notes: z.string().trim().max(2000),
      ...costsShape,
    })
    .superRefine((v, ctx) => {
      const issue = (path: string[], message: string) =>
        ctx.addIssue({ code: 'custom', path, message })
      if (!v.traveller) issue(['traveller'], 'Choose who is travelling.')
      if (!v.outboundFrom.trim())
        issue(['outboundFrom'], 'Where do you fly from? e.g. Riverton Airport.')
      if (!v.outboundTo.trim()) issue(['outboundTo'], 'Where do you fly to?')
      if (!v.outboundDepartureAt)
        issue(['outboundDepartureAt'], 'Choose the departure date and time.')
      else if (!isDeskRef.value && new Date(v.outboundDepartureAt) <= new Date()) {
        issue(['outboundDepartureAt'], 'Pick a departure in the future.')
      }
      if (v.tripType === 'return') {
        if (!v.returnFrom.trim()) issue(['returnFrom'], 'Where does the return flight leave from?')
        if (!v.returnTo.trim()) issue(['returnTo'], 'Where does the return flight go?')
        if (!v.returnDepartureAt) issue(['returnDepartureAt'], 'Choose the return departure.')
        else if (
          v.outboundDepartureAt &&
          new Date(v.returnDepartureAt) <= new Date(v.outboundDepartureAt)
        ) {
          issue(
            ['returnDepartureAt'],
            `The return is before the outbound flight. Pick a time after ${formatDateTime(v.outboundDepartureAt)}.`,
          )
        }
      }
      refineCosts(v, ctx, travellerCostCenter.value)
    }),
)

const {
  values: formValues,
  setValues,
  setFieldValue,
  setErrors,
  validateField,
  validate: validateForm,
  errors,
  defineField,
} = useForm({
  validationSchema: schema,
  initialValues: initialValues(),
  // Steps unmount their fields (costs step): keep the values for submit.
  keepValuesOnUnmount: true,
})
const v = formValues as unknown as Values

const [traveller] = defineField<'traveller', UserRef | null>('traveller')
const [tripType] = defineField('tripType')
const [handLuggageOnly] = defineField('handLuggageOnly')
const [outboundFrom] = defineField('outboundFrom')
const [outboundTo] = defineField('outboundTo')
const [outboundDepartureAt] = defineField('outboundDepartureAt')
const [returnFrom] = defineField('returnFrom')
const [returnTo] = defineField('returnTo')
const [returnDepartureAt] = defineField('returnDepartureAt')
const [notes] = defineField('notes')

const context = useTravellerContext(() => v.traveller ?? null)
watchEffect(() => {
  travellerCostCenter.value = context.costCenterId.value
  isDeskRef.value = context.isDesk.value
})

// The return leg mirrors the outbound leg until edited.
watch(
  () => [v.outboundFrom, v.outboundTo] as const,
  ([from, to], [prevFrom, prevTo]) => {
    if (!v.returnFrom || v.returnFrom === prevTo) setFieldValue('returnFrom', to)
    if (!v.returnTo || v.returnTo === prevFrom) setFieldValue('returnTo', from)
  },
)

const STEP_FIELDS: Record<string, string[]> = {
  general: ['traveller', 'tripType', 'handLuggageOnly'],
  outbound: ['outboundFrom', 'outboundTo', 'outboundDepartureAt'],
  return: ['returnFrom', 'returnTo', 'returnDepartureAt'],
  costs: [
    'costCenterId',
    'costCenterReason',
    'rechargeCustomer',
    'rechargeProjectNumber',
    'approverId',
    'comment',
    'notes',
  ],
  review: [],
}
const stepper = useStepper(
  () => [
    { id: 'general', label: 'General' },
    { id: 'outbound', label: 'Outbound' },
    { id: 'return', label: 'Return', skip: v.tripType === 'one_way' },
    { id: 'costs', label: 'Costs & approval' },
    { id: 'review', label: 'Review' },
  ],
  {
    validate: async (id) =>
      (
        await Promise.all((STEP_FIELDS[id] ?? []).map((field) => validateField(field as never)))
      ).every((result) => result.valid),
  },
)
const stepOf = (field: string) =>
  Object.entries(STEP_FIELDS).find(([, fields]) => fields.includes(field))?.[0]

const previewBody = computed(() =>
  v.traveller
    ? {
        kind: 'flight' as const,
        travellerId: v.traveller.id,
        approverId: v.approverId,
        flight: { outboundDepartureAt: v.outboundDepartureAt },
      }
    : null,
)
const preview = useTravelPreview(previewBody)
const previewData = computed(() => preview.data.value)

const facts = computed<FactItem[]>(() => [
  {
    label: 'Traveller',
    value: v.traveller?.displayName ?? '—',
    detail: v.traveller?.jobTitle ?? null,
  },
  {
    label: 'Outbound',
    value: v.outboundDepartureAt ? formatDateTime(v.outboundDepartureAt) : 'Pick a date',
    detail: v.outboundFrom && v.outboundTo ? `${v.outboundFrom} → ${v.outboundTo}` : null,
  },
  {
    label: 'Return',
    value:
      v.tripType === 'one_way'
        ? 'One way'
        : v.returnDepartureAt
          ? formatDateTime(v.returnDepartureAt)
          : 'Pick a date',
    detail:
      v.tripType === 'return' && v.returnFrom && v.returnTo
        ? `${v.returnFrom} → ${v.returnTo}`
        : null,
  },
  { label: 'Luggage', value: v.handLuggageOnly ? 'Hand luggage only' : 'Checked baggage allowed' },
])
const strip = computed(() =>
  previewData.value?.exemption
    ? {
        title: 'No approval needed',
        detail: previewData.value.exemption.label,
        tone: 'positive' as const,
      }
    : {
        title: 'Needs approval · 1 reason',
        detail: 'Flights always need approval',
        tone: 'waiting' as const,
      },
)

// --- draft, duplicate, submit ----------------------------------------------------------------------
const draft = useStepperDraft('travel-flight', v, { version: 1 })
onMounted(async () => {
  const from = typeof route.query.from === 'string' ? route.query.from : null
  if (from) {
    try {
      const source = await api.get<TravelRequestDetail>(`/travel/requests/${from}`)
      const f = source.flight
      if (f) {
        setValues({
          traveller: source.traveller,
          tripType: f.tripType,
          handLuggageOnly: f.handLuggageOnly,
          outboundFrom: f.outboundFrom,
          outboundTo: f.outboundTo,
          outboundDepartureAt: f.outboundDepartureAt,
          returnFrom: f.returnFrom ?? '',
          returnTo: f.returnTo ?? '',
          returnDepartureAt: f.returnDepartureAt,
          notes: f.notes ?? '',
          costCenterId: source.costCenter.id,
          costCenterReason: source.costCenterReason ?? '',
          recharge: Boolean(source.recharge),
          rechargeCustomer: source.recharge?.customer ?? '',
          rechargeProjectNumber: source.recharge?.projectNumber ?? '',
          comment: source.comment ?? '',
        } as never)
        toast.info(`Copied from ${source.reference}. Check the dates before you submit.`)
      }
    } catch {
      // not visible: start empty
    }
    return
  }
  const saved = draft.restore()
  if (saved) setValues({ ...initialValues(), ...saved } as never)
})

const { submit, submitting, formError } = useTravelSubmit({
  kind: 'flight',
  setErrors: (e) => setErrors(e as never),
  stepOf,
  goTo: (id) => stepper.goTo(id),
  onSuccess: (detail) => {
    draft.clear()
    toast.success(
      detail.status === 'pending_approval'
        ? `Submitted. ${detail.approver?.displayName ?? 'Your approver'} decides next.`
        : 'Submitted. The travel desk books it next.',
    )
    void navigateTo(`/travel/requests/${detail.id}`)
  },
})

async function onSubmit() {
  // Whole-form validation: fields of unmounted steps (costs) are validated by the schema too.
  const result = await validateForm()
  if (!result.valid) {
    const step = Object.keys(result.errors)
      .map(stepOf)
      .find((id): id is string => Boolean(id))
    if (step) stepper.goTo(step)
    return
  }
  const isReturn = v.tripType === 'return'
  const body: CreateTravelRequest = {
    kind: 'flight',
    travellerId: v.traveller!.id,
    ...costsBody(v, previewData.value?.defaultApproverId ?? null),
    flight: {
      tripType: v.tripType,
      outboundDepartureAt: v.outboundDepartureAt!,
      outboundFrom: v.outboundFrom.trim(),
      outboundTo: v.outboundTo.trim(),
      returnDepartureAt: isReturn ? v.returnDepartureAt : null,
      returnFrom: isReturn ? v.returnFrom.trim() : null,
      returnTo: isReturn ? v.returnTo.trim() : null,
      handLuggageOnly: v.handLuggageOnly,
      notes: v.notes.trim() || null,
    },
  }
  await submit(body)
}

const minDay = computed(() => new Date().toISOString().slice(0, 10))
const costCenterLabel = useCostCenterLabel()
const reviewFacts = computed(() => ({
  general: [
    { label: 'Traveller', value: v.traveller?.displayName ?? '—' },
    { label: 'Trip', value: v.tripType === 'return' ? 'Return' : 'One way' },
    {
      label: 'Luggage',
      value: v.handLuggageOnly ? 'Hand luggage only' : 'Checked baggage allowed',
    },
  ],
  outbound: [
    { label: 'Route', value: `${v.outboundFrom} → ${v.outboundTo}` },
    {
      label: 'Departure',
      value: v.outboundDepartureAt ? formatDateTime(v.outboundDepartureAt) : '—',
    },
  ],
  return: [
    { label: 'Route', value: `${v.returnFrom} → ${v.returnTo}` },
    { label: 'Departure', value: v.returnDepartureAt ? formatDateTime(v.returnDepartureAt) : '—' },
  ],
  costs: [
    {
      label: 'Cost centre',
      value: costCenterLabel(v.costCenterId),
      detail: v.costCenterReason || null,
    },
    {
      label: 'Recharge',
      value: v.recharge ? v.rechargeCustomer : 'No',
      detail: v.recharge ? `Project ${v.rechargeProjectNumber}` : null,
    },
    {
      label: 'Approval',
      value: previewData.value?.exemption
        ? 'Not needed (executive)'
        : (previewData.value?.approverCandidates.find(
            (c) => c.user.id === (v.approverId ?? previewData.value?.defaultApproverId),
          )?.user.displayName ?? 'Your manager'),
    },
  ],
}))
</script>

<template>
  <StepperPage
    title="New flight"
    :stepper="stepper"
    close-to="/travel"
    :saved-at="draft.savedAt.value"
    :submitting="submitting"
    :strip="strip"
    @submit="onSubmit"
    @discard="
      () => {
        draft.clear()
        navigateTo('/travel')
      }
    "
  >
    <datalist id="travel-airports">
      <option v-for="place in PLACES" :key="place" :value="`${place} Airport`" />
    </datalist>

    <StepperStep
      v-if="stepper.current.value?.id === 'general'"
      question="Who flies, and how?"
      lede="Tell us who travels and whether it is a return trip."
    >
      <div
        class="flex items-start gap-3 rounded-lg border border-rule-strong bg-well p-4 text-sm"
        role="note"
      >
        <Plane class="mt-0.5 size-4 flex-none text-st-waiting" aria-hidden="true" />
        <p>
          <b class="font-semibold">Flights always need approval.</b>
          Your manager approves before the travel desk books. Executives approve their own trips.
        </p>
      </div>
      <TravelTravellerField
        v-model="traveller"
        :me="me"
        :can-pick-others="context.canPickOthers.value"
        :is-desk="context.isDesk.value"
        :error="errors.traveller"
      />
      <UiField label="Trip" group>
        <UiSegmented
          v-model="tripType"
          label="Trip"
          :options="[
            { value: 'return', label: 'Return' },
            { value: 'one_way', label: 'One way' },
          ]"
        />
      </UiField>
      <UiSwitch
        v-model="handLuggageOnly"
        label="Hand luggage only"
        description="Cheaper fares without checked baggage."
      />
    </StepperStep>

    <StepperStep
      v-else-if="stepper.current.value?.id === 'outbound'"
      question="Where do you fly to?"
      lede="Give the airports and the preferred departure. The desk books the best matching flight."
    >
      <div class="grid gap-5 sm:grid-cols-2">
        <UiField id="outboundFrom" label="From" :error="errors.outboundFrom">
          <UiInput
            v-model="outboundFrom"
            list="travel-airports"
            maxlength="120"
            placeholder="Riverton Airport"
          />
        </UiField>
        <UiField id="outboundTo" label="To" :error="errors.outboundTo">
          <UiInput v-model="outboundTo" list="travel-airports" maxlength="120" />
        </UiField>
      </div>
      <UiField id="outboundDepartureAt" label="Departure" :error="errors.outboundDepartureAt">
        <UiDatePicker
          v-model="outboundDepartureAt"
          time
          :min="context.isDesk.value ? null : minDay"
        />
      </UiField>
    </StepperStep>

    <StepperStep
      v-else-if="stepper.current.value?.id === 'return'"
      question="And back?"
      lede="We filled in the reverse route. Change it if you return from somewhere else."
    >
      <div class="grid gap-5 sm:grid-cols-2">
        <UiField id="returnFrom" label="From" :error="errors.returnFrom">
          <UiInput v-model="returnFrom" list="travel-airports" maxlength="120" />
        </UiField>
        <UiField id="returnTo" label="To" :error="errors.returnTo">
          <UiInput v-model="returnTo" list="travel-airports" maxlength="120" />
        </UiField>
      </div>
      <UiField id="returnDepartureAt" label="Departure" :error="errors.returnDepartureAt">
        <UiDatePicker
          v-model="returnDepartureAt"
          time
          :min="outboundDepartureAt?.slice(0, 10) ?? minDay"
        />
      </UiField>
    </StepperStep>

    <StepperStep
      v-else-if="stepper.current.value?.id === 'costs'"
      question="Who pays, and who approves?"
      lede="Flights always need approval. The approver follows the reporting line; you can pick someone else above the traveller."
    >
      <TravelCostsStep
        :preview="previewData"
        :traveller-cost-center-id="context.costCenterId.value"
        always-approval
      />
      <UiField id="notes" label="Notes for the travel desk" optional :error="errors.notes">
        <UiTextarea v-model="notes" :maxlength="2000" :rows="2" />
      </UiField>
    </StepperStep>

    <StepperStep
      v-else
      question="Check and submit"
      lede="Submitting sends the request on its route. You can't edit it afterwards, but you can duplicate it."
    >
      <TravelReviewSection
        title="General"
        :facts="reviewFacts.general"
        @edit="stepper.goTo('general')"
      />
      <TravelReviewSection
        title="Outbound"
        :facts="reviewFacts.outbound"
        @edit="stepper.goTo('outbound')"
      />
      <TravelReviewSection
        v-if="v.tripType === 'return'"
        title="Return"
        :facts="reviewFacts.return"
        @edit="stepper.goTo('return')"
      />
      <TravelReviewSection
        title="Costs & approval"
        :facts="reviewFacts.costs"
        @edit="stepper.goTo('costs')"
      />
      <p v-if="formError" class="text-sm text-st-negative" role="alert">{{ formError }}</p>
    </StepperStep>

    <template #summary>
      <TravelSlip title="Flight" :facts="facts" :preview="previewData" :requester="me" />
    </template>
  </StepperPage>
</template>
