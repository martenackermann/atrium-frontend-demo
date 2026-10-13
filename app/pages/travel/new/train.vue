<script setup lang="ts">
import { z } from 'zod'
import type { UserRef } from '~/types/api'
import type { FactItem, RadioCardOption } from '~/types/ui'
import { useTravelPreview } from '~/modules/travel/api'
import type { CreateTravelRequest, TravelRequestDetail } from '~/modules/travel/api/types'
import { PLACES } from '~/modules/travel/constants'
import { buildRoute } from '~/modules/travel/lib/rules'
import {
  costsBody,
  costsDefaults,
  costsShape,
  focusField,
  refineCosts,
  useMeRef,
  useTravellerContext,
  useCostCenterLabel,
  useTravelSubmit,
} from '~/modules/travel/lib/stepper'

/**
 * Train journey stepper (SCREENS §5.3, focus mode): Journey · Travellers · Tickets · Costs &
 * approval · Review. Flex fares go straight to the desk; saver fares and separate tickets need
 * approval (tagged before they are chosen). Live slip from `POST /travel/requests/preview`.
 */
definePageMeta({ title: 'Book a train journey', layout: 'focus' })

const route = useRoute()
const api = useApi()
const toast = useToast()
const me = useMeRef()

const initialValues = () => ({
  traveller: me.value as UserRef | null,
  companions: [] as UserRef[],
  tripType: 'return' as 'one_way' | 'return',
  fromStation: '',
  viaStation: '',
  toStation: '',
  outboundAt: null as string | null,
  returnAt: null as string | null,
  fareType: 'flex' as 'flex' | 'saver',
  seatReservations: 1,
  separateTickets: false,
  localTransportTicket: false,
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
      companions: z.array(z.custom<UserRef>()).max(5, 'At most 5 colleagues on one booking.'),
      tripType: z.enum(['one_way', 'return']),
      fromStation: z.string().trim().max(120),
      viaStation: z.string().trim().max(120),
      toStation: z.string().trim().max(120),
      outboundAt: z.string().nullable(),
      returnAt: z.string().nullable(),
      fareType: z.enum(['flex', 'saver']),
      seatReservations: z.number().int().min(0).max(6),
      separateTickets: z.boolean(),
      localTransportTicket: z.boolean(),
      notes: z.string().trim().max(2000),
      ...costsShape,
    })
    .superRefine((v, ctx) => {
      const issue = (path: string[], message: string) =>
        ctx.addIssue({ code: 'custom', path, message })
      if (!v.fromStation.trim())
        issue(['fromStation'], 'Where do you start? e.g. Riverton Central.')
      if (!v.toStation.trim()) issue(['toStation'], 'Where are you going?')
      if (!v.outboundAt) issue(['outboundAt'], 'Choose the departure date and time.')
      else if (!isDeskRef.value && new Date(v.outboundAt) <= new Date()) {
        issue(['outboundAt'], 'Pick a departure in the future.')
      }
      if (v.tripType === 'return') {
        if (!v.returnAt) issue(['returnAt'], 'Choose the return date and time.')
        else if (v.outboundAt && new Date(v.returnAt) <= new Date(v.outboundAt)) {
          issue(
            ['returnAt'],
            `The return is before the outbound journey. Pick a time after ${formatDateTime(v.outboundAt)}.`,
          )
        }
      }
      if (!v.traveller) issue(['traveller'], 'Choose who is travelling.')
      else if (v.companions.some((c) => c.id === v.traveller!.id)) {
        issue(['companions'], 'The traveller is already on the booking.')
      }
      refineCosts(v, ctx, travellerCostCenter.value)
    }),
)

const {
  values: formValues,
  setValues,
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
const [companions] = defineField<'companions', UserRef[]>('companions')
const [tripType] = defineField('tripType')
const [fromStation] = defineField('fromStation')
const [viaStation] = defineField('viaStation')
const [toStation] = defineField('toStation')
const [outboundAt] = defineField('outboundAt')
const [returnAt] = defineField('returnAt')
const [fareType] = defineField('fareType')
const [seatReservations] = defineField('seatReservations')
const [separateTickets] = defineField('separateTickets')
const [localTransportTicket] = defineField('localTransportTicket')
const [notes] = defineField('notes')

const context = useTravellerContext(() => v.traveller ?? null)
watchEffect(() => {
  travellerCostCenter.value = context.costCenterId.value
  isDeskRef.value = context.isDesk.value
})

const STEP_FIELDS: Record<string, string[]> = {
  journey: ['tripType', 'fromStation', 'viaStation', 'toStation', 'outboundAt', 'returnAt'],
  travellers: ['traveller', 'companions'],
  tickets: ['fareType', 'seatReservations', 'separateTickets', 'localTransportTicket', 'notes'],
  costs: [
    'costCenterId',
    'costCenterReason',
    'rechargeCustomer',
    'rechargeProjectNumber',
    'approverId',
    'comment',
  ],
  review: [],
}
const stepper = useStepper(
  [
    { id: 'journey', label: 'Journey' },
    { id: 'travellers', label: 'Travellers' },
    { id: 'tickets', label: 'Tickets' },
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
        kind: 'train' as const,
        travellerId: v.traveller.id,
        approverId: v.approverId,
        train: {
          outboundAt: v.outboundAt,
          fareType: v.fareType,
          separateTickets: v.separateTickets,
        },
      }
    : null,
)
const preview = useTravelPreview(previewBody)
const previewData = computed(() => preview.data.value)
const reasonCount = computed(() => previewData.value?.reasons.length ?? 0)

const routeText = computed(() =>
  buildRoute({
    kind: 'train',
    train: { fromStation: v.fromStation, viaStation: v.viaStation, toStation: v.toStation },
  }),
)
const facts = computed<FactItem[]>(() => [
  {
    label: 'Travellers',
    value: v.traveller?.displayName ?? '—',
    detail: v.companions.length
      ? `+ ${v.companions.map((c) => c.displayName).join(', ')}`
      : (v.traveller?.jobTitle ?? null),
  },
  {
    label: 'When',
    value: v.outboundAt ? formatDateTime(v.outboundAt) : 'Pick a date',
    detail:
      v.tripType === 'return'
        ? v.returnAt
          ? `back ${formatDateTime(v.returnAt)}`
          : 'Return'
        : 'One way',
  },
  { label: 'Journey', value: routeText.value || '—' },
  {
    label: 'Tickets',
    value: v.fareType === 'saver' ? 'Saver fare' : 'Flex fare',
    detail: [
      v.seatReservations
        ? `${v.seatReservations} seat${v.seatReservations === 1 ? '' : 's'} reserved`
        : 'No seats',
      v.separateTickets && 'separate tickets',
      v.localTransportTicket && 'local transport',
    ]
      .filter(Boolean)
      .join(', '),
  },
])
const strip = computed(() =>
  previewData.value
    ? previewData.value.needsApproval
      ? {
          title: `Needs approval · ${reasonCount.value} reason${reasonCount.value === 1 ? '' : 's'}`,
          detail: previewData.value.reasons.map((r) => r.label).join(', '),
          tone: 'waiting' as const,
        }
      : {
          title: 'No approval needed',
          detail: 'Goes straight to the travel desk',
          tone: 'positive' as const,
        }
    : { title: 'Summary', detail: 'Choose the journey to see the approval path' },
)

function selectReason(code: string) {
  if (code === 'train_saver_fare') {
    stepper.goTo('tickets')
    focusField('fareType')
  } else if (code === 'train_separate_tickets') {
    stepper.goTo('tickets')
    focusField('separateTickets')
  }
}

const fareOptions = computed<RadioCardOption[]>(() => [
  {
    value: 'flex',
    title: 'Flex fare',
    description: 'Any train on the day, refundable. Goes straight to the travel desk.',
    tag: { label: 'Standard', tone: 'positive' },
  },
  {
    value: 'saver',
    title: 'Saver fare',
    description: 'Cheaper, fixed train, non-refundable.',
    tag: v.fareType === 'saver' ? undefined : { label: 'Needs approval', tone: 'waiting' },
  },
])
const seatOptions = [0, 1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))

// --- draft, duplicate, submit ----------------------------------------------------------------------
const draft = useStepperDraft('travel-train', v, { version: 1 })
onMounted(async () => {
  const from = typeof route.query.from === 'string' ? route.query.from : null
  if (from) {
    try {
      const source = await api.get<TravelRequestDetail>(`/travel/requests/${from}`)
      const t = source.train
      if (t) {
        setValues({
          traveller: source.traveller,
          companions: t.companions,
          tripType: t.tripType,
          fromStation: t.fromStation,
          viaStation: t.viaStation ?? '',
          toStation: t.toStation,
          outboundAt: t.outboundAt,
          returnAt: t.returnAt,
          fareType: t.fareType,
          seatReservations: t.seatReservations,
          separateTickets: t.separateTickets,
          localTransportTicket: t.localTransportTicket,
          notes: t.notes ?? '',
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
  kind: 'train',
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
  const body: CreateTravelRequest = {
    kind: 'train',
    travellerId: v.traveller!.id,
    ...costsBody(v, previewData.value?.defaultApproverId ?? null),
    train: {
      tripType: v.tripType,
      outboundAt: v.outboundAt!,
      returnAt: v.tripType === 'return' ? v.returnAt : null,
      fromStation: v.fromStation.trim(),
      viaStation: v.viaStation.trim() || null,
      toStation: v.toStation.trim(),
      fareType: v.fareType,
      seatReservations: v.seatReservations,
      separateTickets: v.separateTickets,
      localTransportTicket: v.localTransportTicket,
      companionIds: v.companions.map((c) => c.id),
      notes: v.notes.trim() || null,
    },
  }
  await submit(body)
}

const minDay = computed(() => new Date().toISOString().slice(0, 10))
const costCenterLabel = useCostCenterLabel()
const reviewFacts = computed(() => ({
  journey: [
    { label: 'Journey', value: routeText.value || '—' },
    { label: 'Outbound', value: v.outboundAt ? formatDateTime(v.outboundAt) : '—' },
    {
      label: 'Return',
      value: v.tripType === 'return' && v.returnAt ? formatDateTime(v.returnAt) : 'One way',
    },
  ],
  travellers: [
    { label: 'Traveller', value: v.traveller?.displayName ?? '—' },
    { label: 'Colleagues', value: v.companions.map((c) => c.displayName).join(', ') || 'None' },
  ],
  tickets: [
    { label: 'Fare', value: v.fareType === 'saver' ? 'Saver fare (non-refundable)' : 'Flex fare' },
    { label: 'Seat reservations', value: String(v.seatReservations) },
    { label: 'Separate tickets', value: v.separateTickets ? 'Yes' : 'No' },
    { label: 'Local transport', value: v.localTransportTicket ? 'Yes' : 'No' },
    ...(v.notes ? [{ label: 'Notes', value: v.notes }] : []),
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
      value: previewData.value?.needsApproval
        ? (previewData.value.approverCandidates.find(
            (c) => c.user.id === (v.approverId ?? previewData.value?.defaultApproverId),
          )?.user.displayName ?? 'Your manager')
        : 'Not needed',
    },
  ],
}))
</script>

<template>
  <StepperPage
    title="New train journey"
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
    <datalist id="travel-stations">
      <option v-for="place in PLACES" :key="place" :value="`${place} Central`" />
    </datalist>

    <StepperStep
      v-if="stepper.current.value?.id === 'journey'"
      question="Where does the journey go?"
      lede="Give the stations and times. The travel desk books the best connection."
    >
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
      <div class="grid gap-5 sm:grid-cols-2">
        <UiField id="fromStation" label="From" :error="errors.fromStation">
          <UiInput
            v-model="fromStation"
            list="travel-stations"
            maxlength="120"
            placeholder="Riverton Central"
          />
        </UiField>
        <UiField id="toStation" label="To" :error="errors.toStation">
          <UiInput v-model="toStation" list="travel-stations" maxlength="120" />
        </UiField>
      </div>
      <UiField id="viaStation" label="Via" optional :error="errors.viaStation">
        <UiInput v-model="viaStation" list="travel-stations" maxlength="120" />
      </UiField>
      <div class="grid gap-5 sm:grid-cols-2">
        <UiField id="outboundAt" label="Outbound" :error="errors.outboundAt">
          <UiDatePicker v-model="outboundAt" time :min="context.isDesk.value ? null : minDay" />
        </UiField>
        <UiField
          v-if="v.tripType === 'return'"
          id="returnAt"
          label="Return"
          :error="errors.returnAt"
        >
          <UiDatePicker v-model="returnAt" time :min="outboundAt?.slice(0, 10) ?? minDay" />
        </UiField>
      </div>
    </StepperStep>

    <StepperStep
      v-else-if="stepper.current.value?.id === 'travellers'"
      question="Who travels?"
      lede="Colleagues can travel on the same booking. They get the confirmation too."
    >
      <TravelTravellerField
        v-model="traveller"
        :me="me"
        :can-pick-others="context.canPickOthers.value"
        :is-desk="context.isDesk.value"
        :error="errors.traveller"
      />
      <UiField
        id="companions"
        label="Colleagues travelling with you"
        optional
        hint="Up to 5 people on one booking."
        :error="errors.companions"
      >
        <UserPicker v-model="companions" multiple :exclude="v.traveller ? [v.traveller.id] : []" />
      </UiField>
    </StepperStep>

    <StepperStep
      v-else-if="stepper.current.value?.id === 'tickets'"
      question="Which tickets?"
      lede="Flex fares go straight to the travel desk. Saver fares and separate tickets need approval."
    >
      <UiField id="fareType" label="Fare" group>
        <UiRadioCards v-model="fareType" :options="fareOptions" aria-label="Fare" />
      </UiField>
      <UiField id="seatReservations" label="Seat reservations" hint="0–6 seats, reserved together.">
        <UiSegmented v-model="seatReservations" label="Seat reservations" :options="seatOptions" />
      </UiField>
      <div class="grid gap-4 rounded-lg border border-rule bg-well p-4">
        <UiCheckbox
          id="separateTickets"
          v-model="separateTickets"
          label="Separate tickets per traveller"
          description="Each colleague gets an own ticket."
        >
          <template v-if="!v.separateTickets" #tag>
            <UiTag tone="waiting">Needs approval</UiTag>
          </template>
        </UiCheckbox>
        <UiCheckbox
          v-model="localTransportTicket"
          label="Local transport ticket"
          description="Bus and tram at the destination."
        />
      </div>
      <UiField id="notes" label="Notes for the travel desk" optional :error="errors.notes">
        <UiTextarea v-model="notes" :maxlength="2000" :rows="3" />
      </UiField>
    </StepperStep>

    <StepperStep
      v-else-if="stepper.current.value?.id === 'costs'"
      question="Who pays, and who approves?"
      :lede="
        previewData?.needsApproval
          ? 'Your choices need approval. The approver follows your reporting line; you can pick someone else above you.'
          : 'This journey needs no approval. Check the cost centre and add a comment if the desk should know something.'
      "
    >
      <TravelCostsStep
        :preview="previewData"
        :traveller-cost-center-id="context.costCenterId.value"
      />
    </StepperStep>

    <StepperStep
      v-else
      question="Check and submit"
      lede="Submitting sends the request on its route. You can't edit it afterwards, but you can duplicate it."
    >
      <TravelReviewSection
        title="Journey"
        :facts="reviewFacts.journey"
        @edit="stepper.goTo('journey')"
      />
      <TravelReviewSection
        title="Travellers"
        :facts="reviewFacts.travellers"
        @edit="stepper.goTo('travellers')"
      />
      <TravelReviewSection
        title="Tickets"
        :facts="reviewFacts.tickets"
        @edit="stepper.goTo('tickets')"
      />
      <TravelReviewSection
        title="Costs & approval"
        :facts="reviewFacts.costs"
        @edit="stepper.goTo('costs')"
      />
      <p v-if="formError" class="text-sm text-st-negative" role="alert">{{ formError }}</p>
    </StepperStep>

    <template #summary>
      <TravelSlip
        title="Train journey"
        :facts="facts"
        :preview="previewData"
        :requester="me"
        @select-reason="selectReason"
      />
    </template>
  </StepperPage>
</template>
