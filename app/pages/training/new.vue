<script setup lang="ts">
import {
  BadgeEuro,
  Building2,
  CornerUpRight,
  Hotel,
  Stamp,
  Trash2,
  UserPlus,
  Users,
} from '@lucide/vue'
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import type { AttachmentDto, Money, UserRef } from '~/types/api'
import type { FactItem, ReasonChip, RouteStop } from '~/types/ui'
import { trainingKeys, useTrainingPreview } from '~/modules/training/api'
import type {
  CreateTrainingRequest,
  TrainingFormat,
  TrainingPreview,
  TrainingRequestDetail,
} from '~/modules/training/api/types'
import { FORMAT_LABEL, THRESHOLD_CENTS } from '~/modules/training/constants'

/**
 * Request training (SCREENS §4.2, DESIGN §8.2): full-page stepper Details → Attendees → Documents
 * → Review with a live summary slip. Each change refreshes `POST /training/requests/preview`
 * (approver per attendee, escalation, auto-approvals, executive step ≥ €5,000). Drafts are kept
 * in this browser.
 */
definePageMeta({ layout: 'focus', title: 'Request training' })

const api = useApi()
const auth = useAuthStore()
const org = useOrg()
const toast = useToast()
const queryClient = useQueryClient()
const backOffice = computed(() => auth.can(['training_office', 'it_admin']))
const now = new Date()
const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

interface AttendeeRow {
  user: UserRef
  costCenterId: string | null
  hotel: boolean
  checkInOn: string | null
  checkOutOn: string | null
  hotelCost: Money | null
}

const attendeeSchema = z.object({
  user: z.custom<UserRef>(),
  costCenterId: z.string().nullable(),
  hotel: z.boolean(),
  checkInOn: z.string().nullable(),
  checkOutOn: z.string().nullable(),
  hotelCost: z.custom<Money | null>().nullable(),
})
const schema = toTypedSchema(
  z
    .object({
      topic: z
        .string({ error: 'Name the training.' })
        .trim()
        .min(3, 'Name the training (at least 3 characters).')
        .max(200),
      provider: z
        .string({ error: 'Name the provider.' })
        .trim()
        .min(2, 'Name the provider.')
        .max(120),
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
      cost: z.custom<Money | null>().refine((v) => Boolean(v), 'Enter the cost per attendee.'),
      costCenterId: z.string().nullable(),
      executiveApproverId: z.string().nullable(),
      certificateExpected: z.boolean(),
      reimbursementAgreement: z.boolean(),
      requesterComment: z.string().max(2000).nullable(),
      attendees: z.array(attendeeSchema).min(1, 'Add at least one attendee.').max(20),
      attachments: z.array(z.custom<AttachmentDto>()),
    })
    .superRefine((v, ctx) => {
      if (v.format !== 'online' && !v.location?.trim())
        ctx.addIssue({
          code: 'custom',
          path: ['location'],
          message: 'Add the location, or choose Online.',
        })
      if (v.startsOn && v.endsOn && v.endsOn < v.startsOn)
        ctx.addIssue({
          code: 'custom',
          path: ['endsOn'],
          message: 'The end date is before the start date.',
        })
      if ((v.cost?.amountCents ?? 0) >= THRESHOLD_CENTS && !v.executiveApproverId)
        ctx.addIssue({
          code: 'custom',
          path: ['executiveApproverId'],
          message: 'Choose who approves as executive.',
        })
      v.attendees.forEach((a, i) => {
        if (!a.hotel) return
        if (!a.checkInOn)
          ctx.addIssue({
            code: 'custom',
            path: ['attendees', i, 'checkInOn'],
            message: 'Pick the check-in date.',
          })
        if (!a.checkOutOn)
          ctx.addIssue({
            code: 'custom',
            path: ['attendees', i, 'checkOutOn'],
            message: 'Pick the check-out date.',
          })
        if (a.checkInOn && a.checkOutOn && a.checkOutOn < a.checkInOn)
          ctx.addIssue({
            code: 'custom',
            path: ['attendees', i, 'checkOutOn'],
            message: 'The check-out is before the check-in.',
          })
      })
    }),
)

const initialValues = () => ({
  topic: '',
  provider: '',
  format: 'in_person' as TrainingFormat,
  location: null as string | null,
  registrationUrl: null as string | null,
  registrationDetails: null as string | null,
  startsOn: '',
  endsOn: '',
  cost: null as Money | null,
  costCenterId: auth.me?.costCenter.id ?? null,
  executiveApproverId: null as string | null,
  certificateExpected: false,
  reimbursementAgreement: false,
  requesterComment: null as string | null,
  attendees: (auth.me
    ? [
        {
          user: auth.me,
          costCenterId: null,
          hotel: false,
          checkInOn: null,
          checkOutOn: null,
          hotelCost: null,
        },
      ]
    : []) as AttendeeRow[],
  attachments: [] as AttachmentDto[],
})

const {
  values,
  errors,
  defineField,
  validateField,
  setValues,
  setErrors,
  setFieldValue,
  handleSubmit,
  isSubmitting,
} = useForm({ validationSchema: schema, initialValues: initialValues() })
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
const [attachments] = defineField<'attachments', AttachmentDto[]>('attachments')

// Preview (debounced) -------------------------------------------------------------------------
const costValue = computed(() => (values.cost ?? null) as Money | null)
const previewBody = refDebounced(
  computed(() => ({
    cost: costValue.value,
    executiveApproverId: values.executiveApproverId ?? null,
    attendees: (values.attendees ?? []).map((a) => ({ userId: a.user.id })),
  })),
  400,
)
const preview = useTrainingPreview(previewBody)
const p = computed<TrainingPreview | undefined>(() => preview.data.value)
const needsExecutive = computed(() => (costValue.value?.amountCents ?? 0) >= THRESHOLD_CENTS)
const routingOf = (userId: string) => p.value?.attendees.find((a) => a.user.id === userId)
const blocked = computed(() => (p.value?.attendees ?? []).filter((a) => !a.allowed))

// Steps ---------------------------------------------------------------------------------------
const STEP_FIELDS: Record<string, string[]> = {
  details: [
    'topic',
    'provider',
    'format',
    'location',
    'registrationUrl',
    'startsOn',
    'endsOn',
    'cost',
    'executiveApproverId',
  ],
  attendees: ['attendees'],
  documents: [],
  review: [],
}
const stepper = useStepper(
  () => [
    { id: 'details', label: 'Details' },
    { id: 'attendees', label: 'Attendees' },
    { id: 'documents', label: 'Documents' },
    { id: 'review', label: 'Review' },
  ],
  {
    validate: async (id) => {
      const fields = [...STEP_FIELDS[id]!]
      if (id === 'attendees')
        (values.attendees ?? []).forEach((_, i) =>
          fields.push(`attendees[${i}].checkInOn`, `attendees[${i}].checkOutOn`),
        )
      const results = await Promise.all(fields.map((field) => validateField(field as never)))
      if (id === 'attendees' && blocked.value.length) return false
      return results.every((result) => result.valid)
    },
  },
)

const draft = useStepperDraft('training-new', values, { version: 1 })
onMounted(() => {
  const saved = draft.restore()
  if (saved) setValues(saved as never)
})

// Attendees -----------------------------------------------------------------------------------
const picker = ref<UserRef | null>(null)
watch(picker, (user) => {
  if (!user) return
  if (!(values.attendees ?? []).some((a) => a.user.id === user.id)) {
    setFieldValue('attendees', [
      ...(values.attendees ?? []),
      {
        user,
        costCenterId: null,
        hotel: false,
        checkInOn: null,
        checkOutOn: null,
        hotelCost: null,
      },
    ])
  }
  nextTick(() => (picker.value = null))
})
function removeAttendee(index: number) {
  setFieldValue(
    'attendees',
    (values.attendees ?? []).filter((_, i) => i !== index),
  )
}
function patchAttendee(index: number, patch: Partial<AttendeeRow>) {
  const next = [...(values.attendees ?? [])]
  const current = next[index]!
  const merged = { ...current, ...patch }
  if (patch.hotel && !current.hotel) {
    merged.checkInOn = values.startsOn || null
    merged.checkOutOn = values.endsOn || null
  }
  next[index] = merged
  setFieldValue('attendees', next)
}
const addMyself = () => auth.me && (picker.value = auth.me)

// Summary slip --------------------------------------------------------------------------------
const count = computed(() => values.attendees?.length ?? 0)
const hotelTotal = computed(() =>
  (values.attendees ?? []).reduce(
    (sum, a) => sum + (a.hotel ? (a.hotelCost?.amountCents ?? 0) : 0),
    0,
  ),
)
const total = computed(() => (costValue.value?.amountCents ?? 0) * count.value + hotelTotal.value)
const executiveName = computed(
  () =>
    p.value?.executiveCandidates.find((u) => u.id === values.executiveApproverId)?.displayName ??
    null,
)
const facts = computed<FactItem[]>(() => [
  { label: 'Training', value: values.topic || '—', detail: values.provider || null },
  {
    label: 'When',
    value: values.startsOn
      ? formatDateRange(values.startsOn, values.endsOn || values.startsOn, { weekday: true })
      : '—',
    detail: values.startsOn ? `Starts ${formatRelativeDay(values.startsOn)}` : null,
  },
  {
    label: 'Format',
    value: FORMAT_LABEL[values.format ?? 'in_person'],
    detail: values.location || null,
  },
  {
    label: 'Cost',
    value: costValue.value ? `${formatMoney(costValue.value)} × ${count.value}` : '—',
    detail: costValue.value
      ? `${formatMoney(total.value)} in total${hotelTotal.value ? ` incl. ${formatMoney(hotelTotal.value)} hotel` : ''}`
      : null,
  },
])
const allAuto = computed(
  () =>
    Boolean(p.value?.attendees.length) &&
    p.value!.attendees.every((a) => a.initialState === 'to_book'),
)
const reasons = computed<ReasonChip[] | null>(() => {
  if (!p.value || !count.value) return null
  if (allAuto.value) return []
  const list: ReasonChip[] = []
  const approvers = [
    ...new Set(
      p.value.attendees
        .filter((a) => a.initialState === 'pending_manager_approval')
        .map((a) => a.approver?.displayName),
    ),
  ].filter(Boolean)
  if (approvers.length)
    list.push({ code: 'manager', label: `Manager approval: ${approvers.join(', ')}`, icon: Users })
  if (p.value.attendees.some((a) => a.escalatedFrom))
    list.push({ code: 'escalated', label: 'Escalated past a site manager', icon: CornerUpRight })
  if (p.value.executiveStepRequired)
    list.push({
      code: 'executive',
      label: `${formatMoney(THRESHOLD_CENTS)} or more: executive approval${executiveName.value ? ` by ${executiveName.value}` : ''}`,
      icon: BadgeEuro,
    })
  return list
})
const route = computed<RouteStop[]>(() => {
  const me = auth.me
  const stops: RouteStop[] = [
    {
      step: 'You submit',
      who: 'After the Review step',
      initials: me?.initials,
      state: 'current',
      tone: 'you',
    },
  ]
  const pending = (p.value?.attendees ?? []).filter(
    (a) => a.initialState === 'pending_manager_approval',
  )
  for (const approver of [...new Map(pending.map((a) => [a.approver?.id, a.approver])).values()]) {
    if (!approver) continue
    stops.push({
      step: `${approver.displayName} approves`,
      who: 'Manager step',
      initials: approver.initials,
      state: 'future',
    })
  }
  if (
    p.value?.executiveStepRequired &&
    (p.value.attendees ?? []).some((a) => !a.executiveAutoApproval)
  ) {
    const exec = p.value.executiveCandidates.find((u) => u.id === values.executiveApproverId)
    stops.push({
      step: `${exec?.displayName ?? 'An executive'} approves`,
      who: 'Executive step',
      initials: exec?.initials,
      icon: exec ? undefined : Stamp,
      state: 'future',
    })
  }
  stops.push({
    step: 'Training office books',
    who: 'Booking details by email',
    icon: Building2,
    state: 'future',
  })
  return stops
})
const strip = computed(() => ({
  title: allAuto.value
    ? 'Approved automatically'
    : p.value?.executiveStepRequired
      ? 'Manager + executive approval'
      : 'Manager approval',
  detail: costValue.value ? `${formatMoney(costValue.value)} × ${count.value}` : undefined,
  tone: allAuto.value ? ('positive' as const) : ('waiting' as const),
}))
const nextSentence = computed(() =>
  allAuto.value
    ? 'You approve for everyone listed, so it goes straight to the training office.'
    : 'Each attendee is approved on their own; the training office books everyone who is approved.',
)

function pathText(userId: string): string {
  const routing = routingOf(userId)
  const attendee = values.attendees?.find((a) => a.user.id === userId)
  if (!routing || !attendee) return ''
  const parts = [attendee.user.displayName]
  if (routing.autoApproval) parts.push('approved automatically')
  else parts.push(routing.approver?.displayName ?? 'Approver')
  if (p.value?.executiveStepRequired && !routing.executiveAutoApproval)
    parts.push(`${executiveName.value ?? 'Executive'} (executive)`)
  parts.push('Training office')
  return parts.join(' → ')
}

// Submit ---------------------------------------------------------------------------------------
const formError = ref<string | null>(null)
const idempotencyKey = ref(crypto.randomUUID())
const STEP_OF_FIELD = (field: string) =>
  field.startsWith('attendees')
    ? 'attendees'
    : field.startsWith('attachment')
      ? 'documents'
      : 'details'

const submit = handleSubmit(
  async (v) => {
    formError.value = null
    const body: CreateTrainingRequest = {
      topic: v.topic,
      provider: v.provider,
      format: v.format,
      location: v.location?.trim() || null,
      registrationUrl: v.registrationUrl?.trim() || null,
      registrationDetails: v.registrationDetails?.trim() || null,
      startsOn: v.startsOn,
      endsOn: v.endsOn,
      cost: v.cost!,
      costCenterId: v.costCenterId,
      executiveApproverId: needsExecutive.value ? v.executiveApproverId : null,
      certificateExpected: v.certificateExpected,
      reimbursementAgreement: v.reimbursementAgreement,
      requesterComment: v.requesterComment?.trim() || null,
      attendees: v.attendees.map((a) => ({
        userId: a.user.id,
        costCenterId: a.costCenterId,
        hotel: a.hotel
          ? { checkInOn: a.checkInOn!, checkOutOn: a.checkOutOn!, cost: a.hotelCost }
          : null,
      })),
      attachmentIds: v.attachments.map((file) => file.id),
    }
    try {
      const detail = await api.post<TrainingRequestDetail>('/training/requests', body, {
        idempotencyKey: idempotencyKey.value,
      })
      draft.clear()
      await queryClient.invalidateQueries({ queryKey: trainingKeys.module })
      toast.success(
        detail.attendees.every((a) => a.status === 'to_book')
          ? `${detail.reference} is approved. The training office books it next.`
          : `${detail.reference} is submitted. ${detail.attendees[0]?.approver?.displayName ?? 'The approver'} decides next.`,
      )
      await navigateTo(`/training/requests/${detail.id}`)
    } catch (error) {
      idempotencyKey.value = crypto.randomUUID()
      if (isApiError(error) && error.isValidationError) {
        const mapped = Object.fromEntries(
          Object.entries(error.fieldErrors).map(([key, messages]) => [
            key.replace(/\.userId$/, '.user'),
            messages,
          ]),
        )
        setErrors(mapped)
        const first = Object.keys(mapped)[0]
        if (first) stepper.goTo(STEP_OF_FIELD(first))
        formError.value = 'Some answers need another look.'
        return
      }
      formError.value = describeError(error).detail ?? describeError(error).title
    }
  },
  ({ errors: failed }) => {
    const first = Object.keys(failed)[0]
    if (first) stepper.goTo(STEP_OF_FIELD(first))
  },
)

const formatOptions = (['in_person', 'online', 'hybrid'] as const).map((value) => ({
  value,
  label: FORMAT_LABEL[value],
}))
const attendeeError = (index: number, field: string) =>
  (errors.value as Record<string, string | undefined>)[`attendees[${index}].${field}`]
const enums = useEnums()
const reasonLabel = (reason: string) => enums.label('approverReason', reason)
</script>

<template>
  <StepperPage
    title="Request training"
    :stepper="stepper"
    close-to="/training"
    :saved-at="draft.savedAt.value"
    :submitting="isSubmitting"
    submit-label="Submit request"
    :strip="strip"
    @submit="submit"
    @discard="
      () => {
        draft.clear()
        navigateTo('/training')
      }
    "
  >
    <StepperStep
      v-if="stepper.current.value?.id === 'details'"
      question="Which training is it?"
      lede="Tell us what, where and when. The cost is per attendee; from €5,000 an executive approves too."
    >
      <div class="grid gap-5 md:grid-cols-2">
        <UiField label="Topic" :error="errors.topic" class="md:col-span-2">
          <UiInput v-model="topic" placeholder="Customer Communication Masterclass" />
        </UiField>
        <UiField label="Provider" :error="errors.provider">
          <UiInput v-model="provider" placeholder="Brightpath Academy" />
        </UiField>
        <UiField label="Format" group :error="errors.format">
          <UiSegmented v-model="format" :options="formatOptions" label="Format" />
        </UiField>
        <UiField label="Location" :optional="format === 'online'" :error="errors.location">
          <UiInput
            v-model="location"
            :placeholder="format === 'online' ? 'Optional for online trainings' : 'Riverton'"
          />
        </UiField>
        <UiField label="Registration link" optional :error="errors.registrationUrl">
          <UiInput v-model="registrationUrl" type="url" placeholder="https://" />
        </UiField>
        <UiField label="Start date" :error="errors.startsOn">
          <UiDatePicker v-model="startsOn" :min="backOffice ? null : todayIso" />
        </UiField>
        <UiField label="End date" :error="errors.endsOn">
          <UiDatePicker v-model="endsOn" :min="startsOn || null" />
        </UiField>
        <UiField
          label="Cost per attendee"
          hint="Course fee only; hotels come with the attendees."
          :error="errors.cost"
        >
          <MoneyInput v-model="cost" />
        </UiField>
        <UiField label="Cost centre" :error="errors.costCenterId">
          <UiSelect v-model="costCenterId" :options="org.costCenterOptions.value" />
        </UiField>
        <div
          v-if="needsExecutive"
          class="flex items-start gap-2.5 rounded-md border border-st-waiting-line bg-st-waiting-bg px-4 py-3 text-sm text-st-waiting md:col-span-2"
          role="note"
        >
          <BadgeEuro class="mt-0.5 size-4 flex-none" aria-hidden="true" />
          Trainings from {{ formatMoney(THRESHOLD_CENTS) }} per attendee also need executive
          approval.
        </div>
        <UiField
          v-if="needsExecutive"
          label="Executive approver"
          :error="errors.executiveApproverId"
          class="md:col-span-2"
        >
          <UiSelect
            v-model="executiveApproverId"
            placeholder="Choose an executive"
            :options="
              (p?.executiveCandidates ?? []).map((u) => ({
                value: u.id,
                label: u.displayName,
                description: u.jobTitle ?? undefined,
              }))
            "
          />
        </UiField>
        <UiField label="Registration details" optional class="md:col-span-2">
          <UiTextarea v-model="registrationDetails" :rows="2" :maxlength="2000" />
        </UiField>
        <UiSwitch v-model="certificateExpected" label="Certificate expected" />
        <UiSwitch
          v-model="reimbursementAgreement"
          label="Reimbursement agreement needed"
          description="The attendee repays the fee if they leave soon after."
        />
        <UiField
          label="Comment for the approver"
          optional
          class="md:col-span-2"
          hint="One or two sentences on why it helps are enough."
        >
          <UiTextarea v-model="requesterComment" :rows="2" :maxlength="2000" />
        </UiField>
      </div>
    </StepperStep>

    <StepperStep
      v-else-if="stepper.current.value?.id === 'attendees'"
      question="Who attends?"
      :lede="
        backOffice
          ? 'Anyone in the organisation. Each attendee is approved by their own approver.'
          : 'You, or people in your team. Each attendee is approved by their own approver.'
      "
    >
      <div class="grid gap-4">
        <div class="flex flex-wrap items-end gap-3">
          <UiField label="Add an attendee" class="min-w-[260px] flex-1" :error="errors.attendees">
            <UserPicker
              v-model="picker"
              :scope="backOffice ? 'all' : 'team'"
              :exclude="(values.attendees ?? []).map((a) => a.user.id)"
              placeholder="Search your team by name"
            />
          </UiField>
          <UiButton
            v-if="auth.me && !(values.attendees ?? []).some((a) => a.user.id === auth.me!.id)"
            :icon="UserPlus"
            @click="addMyself"
            >Add myself</UiButton
          >
        </div>

        <ul class="grid border-t border-ink" aria-label="Attendees">
          <li
            v-for="(a, index) in values.attendees ?? []"
            :key="a.user.id"
            class="grid gap-3 border-b border-rule py-4"
          >
            <div class="flex flex-wrap items-center gap-3">
              <UiAvatar :initials="a.user.initials" :name="a.user.displayName" />
              <div class="min-w-0 flex-1">
                <p class="font-medium">{{ a.user.displayName }}</p>
                <p class="text-sm text-ink-muted">{{ a.user.jobTitle }}</p>
              </div>
              <UiIconButton
                :icon="Trash2"
                :label="`Remove ${a.user.displayName}`"
                @click="removeAttendee(index)"
              />
            </div>
            <p
              v-if="routingOf(a.user.id) && !routingOf(a.user.id)!.allowed"
              role="alert"
              class="text-sm font-medium text-st-negative"
            >
              {{ routingOf(a.user.id)!.notAllowedReason }}
            </p>
            <p
              v-else-if="attendeeError(index, 'user')"
              role="alert"
              class="text-sm font-medium text-st-negative"
            >
              {{ attendeeError(index, 'user') }}
            </p>
            <div v-else-if="routingOf(a.user.id)" class="flex flex-wrap items-center gap-2 text-sm">
              <template v-if="routingOf(a.user.id)!.autoApproval">
                <UiTag tone="positive">{{
                  enums.label('autoApproval', routingOf(a.user.id)!.autoApproval!)
                }}</UiTag>
              </template>
              <template v-else>
                <span class="text-ink-muted">Approved by</span>
                <strong class="font-medium">{{
                  routingOf(a.user.id)!.approver?.displayName
                }}</strong>
                <UiMiniChip
                  v-if="routingOf(a.user.id)!.escalatedFrom"
                  :icon="CornerUpRight"
                  :label="`Escalated past ${routingOf(a.user.id)!.escalatedFrom!.displayName}`"
                />
                <span v-else class="text-ink-subtle"
                  >· {{ reasonLabel(routingOf(a.user.id)!.approverReason) }}</span
                >
                <span v-if="routingOf(a.user.id)!.activeDeputies.length" class="text-ink-subtle">
                  · deputy
                  {{
                    routingOf(a.user.id)!
                      .activeDeputies.map((d) => d.displayName)
                      .join(', ')
                  }}
                </span>
              </template>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <UiField label="Cost centre" optional>
                <UiSelect
                  :model-value="a.costCenterId ?? 'default'"
                  :options="[
                    { value: 'default', label: 'Their own cost centre' },
                    ...org.costCenterOptions.value,
                  ]"
                  @update:model-value="
                    (value) =>
                      patchAttendee(index, {
                        costCenterId: value === 'default' ? null : String(value),
                      })
                  "
                />
              </UiField>
              <UiSwitch
                :model-value="a.hotel"
                label="Needs a hotel"
                class="self-end"
                @update:model-value="(value) => patchAttendee(index, { hotel: value })"
              />
            </div>
            <div v-if="a.hotel" class="grid gap-3 sm:grid-cols-3">
              <UiField label="Check-in" :error="attendeeError(index, 'checkInOn')">
                <UiDatePicker
                  :model-value="a.checkInOn"
                  @update:model-value="
                    (value) => patchAttendee(index, { checkInOn: value ?? null })
                  "
                />
              </UiField>
              <UiField label="Check-out" :error="attendeeError(index, 'checkOutOn')">
                <UiDatePicker
                  :model-value="a.checkOutOn"
                  :min="a.checkInOn"
                  @update:model-value="
                    (value) => patchAttendee(index, { checkOutOn: value ?? null })
                  "
                />
              </UiField>
              <UiField label="Hotel cost" optional>
                <MoneyInput
                  :model-value="a.hotelCost"
                  @update:model-value="
                    (value) => patchAttendee(index, { hotelCost: value ?? null })
                  "
                />
              </UiField>
            </div>
          </li>
        </ul>
        <EmptyState
          v-if="!(values.attendees ?? []).length"
          compact
          :icon="Users"
          title="No attendees yet"
          description="Add yourself or someone from your team."
        />
      </div>
    </StepperStep>

    <StepperStep
      v-else-if="stepper.current.value?.id === 'documents'"
      question="Anything to attach?"
      lede="An agenda, an offer or the joining instructions help the approver and the training office. Optional."
    >
      <FileDrop v-model="attachments" purpose="training_document" :max="10" />
    </StepperStep>

    <StepperStep
      v-else
      question="Check and submit"
      lede="Each attendee follows their own path. You can still change anything before submitting."
    >
      <div class="grid gap-6">
        <FactGrid
          :columns="2"
          :items="[
            { label: 'Training', value: values.topic, detail: values.provider },
            {
              label: 'Dates',
              value: values.startsOn
                ? formatDateRange(values.startsOn, values.endsOn, { weekday: true })
                : '—',
            },
            {
              label: 'Format',
              value: FORMAT_LABEL[values.format ?? 'in_person'],
              detail: values.location,
            },
            {
              label: 'Cost',
              value: costValue ? formatMoney(costValue) : '—',
              detail: `${count} attendee(s) · ${formatMoney(total)} in total`,
            },
            {
              label: 'Executive approver',
              value: needsExecutive ? (executiveName ?? '—') : 'Not needed',
            },
            { label: 'Documents', value: `${values.attachments?.length ?? 0} file(s)` },
          ]"
        />
        <section aria-labelledby="paths-title">
          <h3 id="paths-title" class="text-sm font-semibold">Approval paths</h3>
          <ul class="mt-2 grid gap-1.5 text-sm">
            <li
              v-for="a in values.attendees ?? []"
              :key="a.user.id"
              class="flex items-center gap-2"
            >
              <Hotel v-if="a.hotel" class="size-3.5 text-ink-muted" aria-label="Hotel" />
              {{ pathText(a.user.id) }}
            </li>
          </ul>
        </section>
        <p v-if="formError" role="alert" class="text-sm font-medium text-st-negative">
          {{ formError }}
        </p>
        <ProblemAlert v-if="preview.error.value" :error="preview.error.value" />
      </div>
    </StepperStep>

    <template #summary>
      <StepperSlip
        title="Training request"
        :facts="facts"
        :reasons="reasons"
        reasons-tip="Once approved, the training office books it."
        clear-title="Approved automatically"
        clear-text="You approve for everyone listed, so it goes straight to the training office."
        :route="route"
      >
        <p class="text-[12.5px] leading-[18px] text-ink-muted">{{ nextSentence }}</p>
        <UiTag v-if="needsExecutive" tone="waiting" :icon="BadgeEuro"
          >Needs executive approval</UiTag
        >
      </StepperSlip>
    </template>
  </StepperPage>
</template>
