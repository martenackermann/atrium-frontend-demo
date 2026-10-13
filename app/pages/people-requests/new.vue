<script setup lang="ts">
import { Lock } from '@lucide/vue'
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import { peopleKeys, useJobRoles } from '~/modules/people/api'
import type {
  CreatePeopleRequest,
  PeopleRequestDetail,
  PeopleRequestType,
  Priority,
  Salutation,
} from '~/modules/people/api/types'
import { PRIORITY_OPTIONS, TYPE_META } from '~/modules/people/constants'
import type { AttachmentDto, UserRef } from '~/types/api'
import type { FactItem, RadioCardOption, RouteStop } from '~/types/ui'

/**
 * `/people-requests/new` (SCREENS §7.2, DESIGN §8.2, owned by A4): focus-mode stepper
 * Type · Person · Role & organisation · Details · Review with the live summary slip. Drafts are
 * saved in this browser; the submit sends an Idempotency-Key.
 */
definePageMeta({ title: 'New people request', layout: 'focus' })

const api = useApi()
const auth = useAuthStore()
const toast = useToast()
const org = useOrg()
const queryClient = useQueryClient()
const jobRoles = useJobRoles()

const optional = (max: number) => z.string().max(max, `Keep it under ${max} characters.`).nullable()
const schema = z
  .object({
    type: z.enum(['onboarding', 'offboarding', 'role_change'], { error: 'Choose what you need.' }),
    title: z
      .string({ error: 'Give the request a short title.' })
      .trim()
      .min(3, 'Give the request a short title (at least 3 characters).')
      .max(140),
    priority: z.enum(['critical', 'high', 'normal', 'low']),
    salutation: z.enum(['mr', 'ms', 'mx']).nullable(),
    firstName: z.string().max(100).nullable(),
    lastName: z.string().max(100).nullable(),
    subject: z.custom<UserRef | null>().nullable(),
    effectiveDate: z.string({ error: 'Pick the date.' }).min(1, 'Pick the date.'),
    jobRoleId: z.string().nullable(),
    departmentId: z.string().nullable(),
    siteId: z.string().nullable(),
    manager: z.custom<UserRef | null>().nullable(),
    managerDeputy: z.custom<UserRef | null>().nullable(),
    reason: optional(2000),
    furtherInformation: optional(2000),
    equipmentNotes: optional(2000),
    birthDate: z.string().nullable(),
    placeOfBirth: optional(120),
    nationality: z
      .string()
      .trim()
      .regex(/^([A-Za-z]{2})?$/, 'Use a two-letter country code, like DE.')
      .nullable(),
    street: optional(120),
    houseNumber: optional(20),
    postalCode: optional(12),
    city: optional(80),
    countryCode: z
      .string()
      .trim()
      .regex(/^([A-Za-z]{2})?$/, 'Use a two-letter country code, like DE.')
      .nullable(),
    privatePhone: optional(40),
    privateEmail: z
      .string()
      .trim()
      .max(200)
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email address.')
      .nullable(),
  })
  .superRefine((v, ctx) => {
    const add = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.type === 'onboarding') {
      if (!v.firstName?.trim()) add('firstName', 'Enter the first name.')
      if (!v.lastName?.trim()) add('lastName', 'Enter the last name.')
      if (!v.jobRoleId) add('jobRoleId', 'Choose the job role of the new colleague.')
      if (!v.manager) add('manager', 'Choose the manager of the new colleague.')
    } else if (!v.subject) {
      add('subject', 'Choose the person this request is about.')
    }
    if (v.manager && v.managerDeputy && v.manager.id === v.managerDeputy.id) {
      add('managerDeputy', "The manager's deputy must be someone other than the manager.")
    }
    const address = [v.street, v.houseNumber, v.postalCode, v.city, v.countryCode]
    if (address.some((part) => part?.trim()) && address.some((part) => !part?.trim())) {
      add('street', 'Fill in the whole address, or leave it empty.')
    }
  })

type FormValues = z.infer<typeof schema>

const initialValues: FormValues = {
  type: undefined as unknown as PeopleRequestType,
  title: '',
  priority: 'normal',
  salutation: null,
  firstName: null,
  lastName: null,
  subject: null,
  effectiveDate: '',
  jobRoleId: null,
  departmentId: null,
  siteId: null,
  manager: null,
  managerDeputy: null,
  reason: null,
  furtherInformation: null,
  equipmentNotes: null,
  birthDate: null,
  placeOfBirth: null,
  nationality: null,
  street: null,
  houseNumber: null,
  postalCode: null,
  city: null,
  countryCode: null,
  privatePhone: null,
  privateEmail: null,
}

const {
  values,
  errors,
  defineField,
  validateField,
  setValues,
  setErrors,
  handleSubmit,
  isSubmitting,
} = useForm<FormValues>({ validationSchema: toTypedSchema(schema), initialValues })

const [type] = defineField<'type', PeopleRequestType>('type')
const [title] = defineField('title')
const [priority] = defineField<'priority', Priority>('priority')
const [salutation] = defineField<'salutation', Salutation | null>('salutation')
const [firstName] = defineField('firstName')
const [lastName] = defineField('lastName')
const [subject] = defineField<'subject', UserRef | null>('subject')
const [effectiveDate] = defineField('effectiveDate')
const [jobRoleId] = defineField('jobRoleId')
const [departmentId] = defineField('departmentId')
const [siteId] = defineField('siteId')
const [manager] = defineField<'manager', UserRef | null>('manager')
const [managerDeputy] = defineField<'managerDeputy', UserRef | null>('managerDeputy')
const [reason] = defineField('reason')
const [furtherInformation] = defineField('furtherInformation')
const [equipmentNotes] = defineField('equipmentNotes')
const [birthDate] = defineField('birthDate')
const [placeOfBirth] = defineField('placeOfBirth')
const [nationality] = defineField('nationality')
const [street] = defineField('street')
const [houseNumber] = defineField('houseNumber')
const [postalCode] = defineField('postalCode')
const [city] = defineField('city')
const [countryCode] = defineField('countryCode')
const [privatePhone] = defineField('privatePhone')
const [privateEmail] = defineField('privateEmail')
const attachments = ref<AttachmentDto[]>([])

const STEP_FIELDS: Record<string, (keyof FormValues)[]> = {
  type: ['type', 'title', 'priority'],
  person: ['salutation', 'firstName', 'lastName', 'subject', 'effectiveDate'],
  role: ['jobRoleId', 'departmentId', 'siteId', 'manager', 'managerDeputy'],
  details: [
    'reason',
    'furtherInformation',
    'equipmentNotes',
    'birthDate',
    'placeOfBirth',
    'nationality',
    'street',
    'privatePhone',
    'privateEmail',
  ],
  review: [],
}

const stepper = useStepper(
  () => [
    { id: 'type', label: 'Type' },
    { id: 'person', label: 'Person' },
    { id: 'role', label: 'Role & organisation' },
    { id: 'details', label: 'Details' },
    { id: 'review', label: 'Review' },
  ],
  {
    validate: async (id) =>
      (await Promise.all((STEP_FIELDS[id] ?? []).map((field) => validateField(field)))).every(
        (result) => result.valid,
      ),
  },
)
const draft = useStepperDraft('people-request', values, { version: 1 })
onMounted(() => {
  const saved = draft.restore()
  if (saved) setValues(saved)
})

const meta = computed(() => (values.type ? TYPE_META[values.type] : null))
const typeOptions: RadioCardOption<PeopleRequestType>[] = (
  Object.keys(TYPE_META) as PeopleRequestType[]
).map((value) => ({
  value,
  title: TYPE_META[value].label,
  description: TYPE_META[value].description,
}))
const salutationOptions = [
  { value: 'mr', label: 'Mr' },
  { value: 'ms', label: 'Ms' },
  { value: 'mx', label: 'Mx' },
]
const jobRoleOptions = computed(() =>
  (jobRoles.data.value ?? []).map((role) => ({
    value: role.id,
    label: role.name,
    description: role.category ?? undefined,
  })),
)
const isBackOffice = computed(() => auth.is('people_ops') || auth.is('it_admin'))
const personalOpen = ref(false)
watch(
  () => values.type,
  (value) => {
    personalOpen.value = value === 'onboarding'
  },
  { immediate: true },
)

// When the person changes, prefill the manager from their profile (offboarding / change).
watch(
  () => values.subject?.id,
  async (id) => {
    if (!id || values.type === 'onboarding') return
    try {
      const profile = await api.get<{ manager: UserRef | null }>(`/users/${id}`)
      if (!values.manager && profile.manager) setValues({ manager: profile.manager }, false)
    } catch {
      // the server defaults the manager anyway
    }
  },
)

const personName = computed(() =>
  values.type === 'onboarding'
    ? [values.firstName, values.lastName].filter(Boolean).join(' ') || null
    : (values.subject?.displayName ?? null),
)
const jobRoleName = computed(
  () => jobRoles.data.value?.find((role) => role.id === values.jobRoleId)?.name ?? null,
)
const facts = computed<FactItem[]>(() => [
  { label: 'Type', value: meta.value?.label ?? null },
  { label: 'Person', value: personName.value },
  {
    label: meta.value?.effectiveLabel ?? 'Date',
    value: values.effectiveDate ? formatDate(values.effectiveDate) : null,
  },
  { label: 'Job role', value: jobRoleName.value },
  {
    label: 'Manager',
    value:
      values.manager?.displayName ??
      (values.type === 'onboarding' ? null : 'Their current manager'),
  },
  { label: 'Visible to', value: 'You, the manager and People Ops' },
])
const route = computed<RouteStop[]>(() => [
  {
    step: 'You submit',
    who: auth.me?.displayName,
    initials: auth.me ? initialsOf(auth.me.displayName) : undefined,
    state: 'current',
    tone: 'you',
  },
  { step: 'People Ops picks it up', who: 'People Ops', initials: 'PO', state: 'future' },
  { step: 'Done', who: 'Keeps you posted by email', state: 'future' },
])

const FIELD_MAP: Record<string, keyof FormValues> = {
  subjectUserId: 'subject',
  managerId: 'manager',
  managerDeputyId: 'managerDeputy',
  'personalData.birthDate': 'birthDate',
  'personalData.placeOfBirth': 'placeOfBirth',
  'personalData.nationality': 'nationality',
  'personalData.privatePhone': 'privatePhone',
  'personalData.privateEmail': 'privateEmail',
}
const formError = ref<unknown>(null)
const idempotencyKey = crypto.randomUUID()

function personalDataOf(v: FormValues): CreatePeopleRequest['personalData'] {
  const trim = (value: string | null) => value?.trim() || null
  const hasAddress = Boolean(trim(v.street))
  const data = {
    birthDate: v.birthDate || null,
    placeOfBirth: trim(v.placeOfBirth),
    nationality: trim(v.nationality)?.toUpperCase() ?? null,
    privateAddress: hasAddress
      ? {
          street: trim(v.street)!,
          houseNumber: trim(v.houseNumber)!,
          postalCode: trim(v.postalCode)!,
          city: trim(v.city)!,
          countryCode: trim(v.countryCode)!.toUpperCase(),
        }
      : null,
    privatePhone: trim(v.privatePhone),
    privateEmail: trim(v.privateEmail),
  }
  return Object.values(data).some(Boolean) ? data : null
}

const submit = handleSubmit(
  async (v) => {
    formError.value = null
    const body: CreatePeopleRequest = {
      type: v.type,
      title: v.title.trim(),
      priority: v.priority,
      effectiveDate: v.effectiveDate,
      ...(v.type === 'onboarding'
        ? { salutation: v.salutation, firstName: v.firstName?.trim(), lastName: v.lastName?.trim() }
        : { subjectUserId: v.subject?.id }),
      jobRoleId: v.jobRoleId,
      departmentId: v.departmentId ?? undefined,
      siteId: v.siteId ?? undefined,
      managerId: v.manager?.id ?? undefined,
      managerDeputyId: v.managerDeputy?.id ?? null,
      reason: v.reason?.trim() || null,
      furtherInformation: v.furtherInformation?.trim() || null,
      equipmentNotes: v.equipmentNotes?.trim() || null,
      personalData: personalDataOf(v),
      attachmentIds: attachments.value.map((file) => file.id),
    }
    try {
      const created = await api.post<PeopleRequestDetail>('/people/requests', body, {
        idempotencyKey,
      })
      draft.clear()
      await queryClient.invalidateQueries({ queryKey: peopleKeys.requests.module })
      toast.success(`${created.reference} sent to People Ops.`)
      await navigateTo(`/people-requests/${created.id}`)
    } catch (error) {
      if (isApiError(error) && error.isValidationError) {
        const mapped: Record<string, string> = {}
        for (const [path, messages] of Object.entries(error.fieldErrors)) {
          const field = FIELD_MAP[path] ?? (path in values ? (path as keyof FormValues) : null)
          if (field) mapped[field] = messages[0] ?? ''
        }
        setErrors(mapped)
        if (Object.keys(mapped).length < Object.keys(error.fieldErrors).length)
          formError.value = error
        const first = Object.keys(mapped)[0] as keyof FormValues | undefined
        const step = Object.entries(STEP_FIELDS).find(
          ([, fields]) => first && fields.includes(first),
        )?.[0]
        if (step) stepper.goTo(step)
        return
      }
      formError.value = error
      toast.error(describeError(error))
    }
  },
  ({ errors: invalid }) => {
    const first = Object.keys(invalid)[0] as keyof FormValues | undefined
    const step = Object.entries(STEP_FIELDS).find(
      ([, fields]) => first && fields.includes(first),
    )?.[0]
    if (step) stepper.goTo(step)
  },
)

function discard() {
  draft.clear()
  void navigateTo('/people-requests')
}
</script>

<template>
  <StepperPage
    title="New people request"
    :stepper="stepper"
    close-to="/people-requests"
    :saved-at="draft.savedAt.value"
    :submitting="isSubmitting"
    submit-label="Send to People Ops"
    :strip="{
      title: meta ? meta.label : 'People request',
      detail: personName ?? 'No approval step · People Ops picks it up',
      tone: 'positive',
    }"
    @submit="submit"
    @discard="discard"
  >
    <StepperStep
      v-if="stepper.current.value?.id === 'type'"
      question="What do you need?"
      lede="People Ops handles new colleagues, leavers and changes of role or access."
    >
      <UiField label="Type" group :error="errors.type">
        <UiRadioCards v-model="type" :options="typeOptions" :columns="1" aria-label="Type" />
      </UiField>
      <UiField
        label="Title"
        hint="A short name People Ops recognises, like “Field Technician – Hillford”."
        :error="errors.title"
      >
        <UiInput v-model="title" :maxlength="140" />
      </UiField>
      <UiField
        label="Priority"
        hint="Critical and high requests are flagged in People Ops' inbox."
        :error="errors.priority"
      >
        <UiSelect v-model="priority" :options="PRIORITY_OPTIONS" />
      </UiField>
    </StepperStep>

    <StepperStep
      v-else-if="stepper.current.value?.id === 'person'"
      :question="values.type === 'onboarding' ? 'Who is joining?' : 'Who is it about?'"
      :lede="
        values.type === 'onboarding'
          ? 'Their name as it should appear on accounts and the badge.'
          : 'You can choose yourself or someone in your team.'
      "
    >
      <template v-if="values.type === 'onboarding'">
        <UiField label="Salutation" optional :error="errors.salutation">
          <UiSelect v-model="salutation" :options="salutationOptions" placeholder="Choose…" />
        </UiField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UiField label="First name" :error="errors.firstName">
            <UiInput v-model="firstName" autocomplete="off" />
          </UiField>
          <UiField label="Last name" :error="errors.lastName">
            <UiInput v-model="lastName" autocomplete="off" />
          </UiField>
        </div>
      </template>
      <UiField
        v-else
        label="Person"
        hint="Names, department and site are taken from their profile."
        :error="errors.subject"
      >
        <UserPicker v-model="subject" :scope="isBackOffice ? 'all' : 'team'" />
      </UiField>
      <UiField :label="meta?.effectiveLabel ?? 'Date'" :error="errors.effectiveDate">
        <UiDatePicker v-model="effectiveDate" />
      </UiField>
    </StepperStep>

    <StepperStep
      v-else-if="stepper.current.value?.id === 'role'"
      question="Role and organisation"
      lede="The manager sees the request and its personal data; the deputy sees it without personal data."
    >
      <UiField
        :label="values.type === 'role_change' ? 'New job role' : 'Job role'"
        :optional="values.type !== 'onboarding'"
        :hint="
          values.type === 'role_change' ? 'Leave it empty for an access change only.' : undefined
        "
        :error="errors.jobRoleId"
      >
        <UiSelect v-model="jobRoleId" :options="jobRoleOptions" placeholder="Choose a job role…" />
      </UiField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Department" optional :error="errors.departmentId">
          <UiSelect v-model="departmentId" :options="org.departmentOptions.value" />
        </UiField>
        <UiField label="Site" optional :error="errors.siteId">
          <UiSelect v-model="siteId" :options="org.siteOptions.value" />
        </UiField>
      </div>
      <UiField
        label="Manager"
        :optional="values.type !== 'onboarding'"
        :hint="values.type !== 'onboarding' ? 'Empty = their current manager.' : undefined"
        :error="errors.manager"
      >
        <UserPicker v-model="manager" />
      </UiField>
      <UiField label="Manager's deputy" optional :error="errors.managerDeputy">
        <UserPicker v-model="managerDeputy" :exclude="manager ? [manager.id] : []" />
      </UiField>
    </StepperStep>

    <StepperStep
      v-else-if="stepper.current.value?.id === 'details'"
      question="Anything People Ops should know?"
      lede="Reasons, equipment and documents help People Ops prepare everything in time."
    >
      <UiField label="Reason" optional :error="errors.reason">
        <UiTextarea v-model="reason" :rows="3" :maxlength="2000" />
      </UiField>
      <UiField label="Further information" optional :error="errors.furtherInformation">
        <UiTextarea v-model="furtherInformation" :rows="2" :maxlength="2000" />
      </UiField>
      <UiField
        label="Equipment notes"
        optional
        hint="Laptop, phone, van key, special software…"
        :error="errors.equipmentNotes"
      >
        <UiTextarea v-model="equipmentNotes" :rows="2" :maxlength="2000" />
      </UiField>
      <UiField
        label="Documents"
        optional
        hint="Contracts, forms or certificates. PDF, PNG, JPEG or Word."
      >
        <FileDrop v-model="attachments" purpose="people_document" />
      </UiField>

      <section class="rounded-xl border border-rule bg-well" data-testid="personal-data-panel">
        <button
          type="button"
          class="flex w-full items-center gap-2 px-4 py-3 text-left text-md font-[650]"
          :aria-expanded="personalOpen"
          @click="personalOpen = !personalOpen"
        >
          <Lock class="size-4 text-ink-subtle" aria-hidden="true" />
          Personal data
          <span class="ml-auto text-sm font-normal text-ink-muted">{{
            personalOpen ? 'Hide' : 'Add'
          }}</span>
        </button>
        <div v-if="personalOpen" class="grid gap-4 border-t border-rule px-4 py-4">
          <p class="text-sm text-ink-muted">Visible only to you, the manager and People Ops.</p>
          <div class="grid gap-4 sm:grid-cols-3">
            <UiField label="Birth date" optional :error="errors.birthDate">
              <UiDatePicker v-model="birthDate" />
            </UiField>
            <UiField label="Place of birth" optional :error="errors.placeOfBirth">
              <UiInput v-model="placeOfBirth" />
            </UiField>
            <UiField
              label="Nationality"
              optional
              hint="Country code, like DE"
              :error="errors.nationality"
            >
              <UiInput v-model="nationality" :maxlength="2" mono />
            </UiField>
          </div>
          <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
            <UiField label="Street" optional :error="errors.street">
              <UiInput v-model="street" autocomplete="off" />
            </UiField>
            <UiField label="House number" optional>
              <UiInput v-model="houseNumber" autocomplete="off" />
            </UiField>
          </div>
          <div class="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)_120px]">
            <UiField label="Postal code" optional>
              <UiInput v-model="postalCode" autocomplete="off" />
            </UiField>
            <UiField label="City" optional>
              <UiInput v-model="city" autocomplete="off" />
            </UiField>
            <UiField label="Country" optional hint="Like DE" :error="errors.countryCode">
              <UiInput v-model="countryCode" :maxlength="2" mono />
            </UiField>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <UiField label="Private phone" optional :error="errors.privatePhone">
              <UiInput v-model="privatePhone" type="tel" autocomplete="off" />
            </UiField>
            <UiField label="Private email" optional :error="errors.privateEmail">
              <UiInput v-model="privateEmail" type="email" autocomplete="off" />
            </UiField>
          </div>
        </div>
      </section>
    </StepperStep>

    <StepperStep
      v-else
      question="Check and send"
      lede="People Ops picks it up and keeps you posted by email. You can edit it while it is open."
    >
      <FactGrid :items="facts.slice(0, 5)" :columns="2" />
      <dl class="m-0 grid gap-3">
        <div v-if="values.reason">
          <dt class="text-[12.5px] text-ink-subtle">Reason</dt>
          <dd class="m-0 mt-1 font-display text-[17px] leading-[25px]">{{ values.reason }}</dd>
        </div>
        <div>
          <dt class="text-[12.5px] text-ink-subtle">Documents</dt>
          <dd class="m-0 mt-1 text-base">
            {{
              attachments.length ? attachments.map((file) => file.originalName).join(', ') : 'None'
            }}
          </dd>
        </div>
        <div>
          <dt class="text-[12.5px] text-ink-subtle">Personal data</dt>
          <dd class="m-0 mt-1 text-base">
            {{
              personalDataOf(values) ? 'Added – visible to you, the manager and People Ops' : 'None'
            }}
          </dd>
        </div>
      </dl>
      <ProblemAlert v-if="formError" :error="formError" />
    </StepperStep>

    <template #summary>
      <StepperSlip
        :title="meta ? meta.label : 'People request'"
        :facts="facts"
        :reasons="[]"
        clear-title="No approval needed"
        clear-text="People Ops picks it up and keeps you posted by email."
        :route="route"
      />
    </template>
  </StepperPage>
</template>
