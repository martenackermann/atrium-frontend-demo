<script setup lang="ts">
import { z } from 'zod'
import type { UserRef } from '~/types/api'
import type { FactItem, RadioCardOption } from '~/types/ui'
import { useCarClasses, useTravelPreview } from '~/modules/travel/api'
import type { CreateTravelRequest, TravelRequestDetail } from '~/modules/travel/api/types'
import { COUNTRY_OPTIONS, countryName, EQUIPMENT_OPTIONS, PLACES } from '~/modules/travel/constants'
import {
  buildRoute,
  evaluateApprovalReasons,
  isAdultOn,
  specialEquipmentReasonRequired,
} from '~/modules/travel/lib/rules'
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
 * Car or van rental stepper (SCREENS §5.3, DESIGN §8.2, focus mode): Trip · Vehicle · Handover &
 * return · Driver · Costs & approval · Review, with the live summary slip fed by
 * `POST /travel/requests/preview` and "Needs approval" tags on options before they are chosen.
 */
definePageMeta({ title: 'Rent a car', layout: 'focus' })

const route = useRoute()
const api = useApi()
const toast = useToast()
const me = useMeRef()

const emptyAddress = { street: '', houseNumber: '', postalCode: '', city: '', countryCode: '' }
type Gearbox = 'manual' | 'preferred' | 'required'
const initialValues = () => ({
  traveller: me.value as UserRef | null,
  vehicleType: 'car' as 'car' | 'van',
  pickupAt: null as string | null,
  returnAt: null as string | null,
  destination: '',
  carClassId: null as string | null,
  gearbox: 'manual' as Gearbox,
  equipment: {
    estate: false,
    navigation: false,
    diesel: false,
    winterTyres: false,
    foreignTravel: false,
    childSeat: false,
  },
  foreignCountries: [] as string[],
  expectedKmPerDay: null as number | null,
  minPayloadKg: null as number | null,
  specialEquipmentReason: '',
  handover: { mode: 'branch' as 'branch' | 'delivery', branch: '', address: { ...emptyAddress } },
  dropOff: { mode: 'branch' as 'branch' | 'collection', branch: '', address: { ...emptyAddress } },
  driver: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: null as string | null,
    licenceNumber: '',
    additionalDrivers: '',
  },
  ...costsDefaults,
})
type Values = ReturnType<typeof initialValues>

// Class defaults feed the local rule check (same rules as the server, DESIGN §12).
const classDefaults = ref<Record<string, boolean>>({})
const travellerCostCenter = ref<string | null>(null)
const isDeskRef = ref(false)

const address = z.object({
  street: z.string(),
  houseNumber: z.string(),
  postalCode: z.string(),
  city: z.string(),
  countryCode: z.string(),
})
const schema = toTypedSchema(
  z
    .object({
      traveller: z.custom<UserRef | null>(),
      vehicleType: z.enum(['car', 'van']),
      pickupAt: z.string().nullable(),
      returnAt: z.string().nullable(),
      destination: z.string().trim().max(120, 'Keep it under 120 characters.'),
      carClassId: z.string().nullable(),
      gearbox: z.enum(['manual', 'preferred', 'required']),
      equipment: z.object({
        estate: z.boolean(),
        navigation: z.boolean(),
        diesel: z.boolean(),
        winterTyres: z.boolean(),
        foreignTravel: z.boolean(),
        childSeat: z.boolean(),
      }),
      foreignCountries: z.array(z.string()),
      expectedKmPerDay: z.number().int().min(0).max(5000).nullable(),
      minPayloadKg: z.number().int().min(0).max(20000).nullable(),
      specialEquipmentReason: z.string().trim().max(1000),
      handover: z.object({ mode: z.enum(['branch', 'delivery']), branch: z.string(), address }),
      dropOff: z.object({ mode: z.enum(['branch', 'collection']), branch: z.string(), address }),
      driver: z.object({
        firstName: z.string().trim(),
        lastName: z.string().trim(),
        email: z.string().trim(),
        phone: z.string().trim(),
        birthDate: z.string().nullable(),
        licenceNumber: z.string().trim().max(40),
        additionalDrivers: z.string().trim().max(500),
      }),
      ...costsShape,
    })
    .superRefine((v, ctx) => {
      const issue = (path: (string | number)[], message: string) =>
        ctx.addIssue({ code: 'custom', path, message })
      if (!v.traveller) issue(['traveller'], 'Choose who is travelling.')
      if (!v.pickupAt) issue(['pickupAt'], 'Choose the pick-up date and time.')
      else if (!isDeskRef.value && new Date(v.pickupAt) <= new Date()) {
        issue(['pickupAt'], 'Pick a pick-up time in the future.')
      }
      if (!v.returnAt) issue(['returnAt'], 'Choose the return date and time.')
      else if (v.pickupAt && new Date(v.returnAt) <= new Date(v.pickupAt)) {
        issue(
          ['returnAt'],
          `The return is before the pick-up. Pick a return after ${formatDateTime(v.pickupAt)}.`,
        )
      }
      if (!v.destination.trim()) issue(['destination'], 'Where are you going?')
      if (!v.carClassId) issue(['carClassId'], 'Choose a class.')
      if (v.equipment.foreignTravel && v.foreignCountries.length === 0) {
        issue(['foreignCountries'], 'Choose the countries you drive through.')
      }
      const reasons = localReasons(v)
      if (specialEquipmentReasonRequired(reasons) && v.specialEquipmentReason.trim().length < 10) {
        issue(['specialEquipmentReason'], 'Explain in at least 10 characters why you need this.')
      }
      if (v.handover.mode === 'branch' && !v.handover.branch.trim()) {
        issue(['handover', 'branch'], 'Name the branch where you pick the car up.')
      }
      if (v.handover.mode === 'delivery')
        addressIssues(v.handover.address, ['handover', 'address'], issue)
      if (v.dropOff.mode === 'branch' && !v.dropOff.branch.trim()) {
        issue(['dropOff', 'branch'], 'Name the branch where you return the car.')
      }
      if (v.dropOff.mode === 'collection')
        addressIssues(v.dropOff.address, ['dropOff', 'address'], issue)
      if (!v.driver.firstName) issue(['driver', 'firstName'], 'Add the first name.')
      if (!v.driver.lastName) issue(['driver', 'lastName'], 'Add the last name.')
      if (!z.string().email().safeParse(v.driver.email).success) {
        issue(['driver', 'email'], 'Enter an email address like name@example.com.')
      }
      if (v.driver.phone.length < 3) issue(['driver', 'phone'], 'Add a phone number.')
      if (!v.driver.birthDate) issue(['driver', 'birthDate'], 'Add the birth date.')
      else if (v.pickupAt && !isAdultOn(v.driver.birthDate, v.pickupAt.slice(0, 10))) {
        issue(['driver', 'birthDate'], 'The driver must be at least 18 years old at pick-up.')
      }
      refineCosts(v, ctx, travellerCostCenter.value)
    }),
)

function addressIssues(
  a: z.infer<typeof address>,
  path: string[],
  issue: (path: (string | number)[], message: string) => void,
) {
  if (!a.street.trim()) issue([...path, 'street'], 'Add the street.')
  if (!a.houseNumber.trim()) issue([...path, 'houseNumber'], 'Add the number.')
  if (a.postalCode.trim().length < 2) issue([...path, 'postalCode'], 'Add the postal code.')
  if (!a.city.trim()) issue([...path, 'city'], 'Add the city.')
  if (!/^[A-Za-z]{2}$/.test(a.countryCode.trim()))
    issue([...path, 'countryCode'], 'Two letters, e.g. DE.')
}

function localReasons(
  v: Pick<Values, 'carClassId' | 'gearbox' | 'equipment' | 'handover' | 'dropOff'>,
) {
  return evaluateApprovalReasons({
    kind: 'car',
    car: {
      classIsDefault: v.carClassId ? (classDefaults.value[v.carClassId] ?? null) : null,
      equipment: {
        ...v.equipment,
        automaticPreferred: v.gearbox === 'preferred',
        automaticRequired: v.gearbox === 'required',
      },
      handoverMode: v.handover.mode,
      dropOffMode: v.dropOff.mode,
    },
  })
}

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

/** Typed view of the form values (vee-validate types them as the schema input). */
const v = formValues as unknown as Values

const [traveller] = defineField<'traveller', UserRef | null>('traveller')
const [vehicleType] = defineField('vehicleType')
const [pickupAt] = defineField('pickupAt')
const [returnAt] = defineField('returnAt')
const [destination] = defineField('destination')
const [carClassId] = defineField('carClassId')
const [gearbox] = defineField('gearbox')
const [specialEquipmentReason] = defineField('specialEquipmentReason')
const [handoverMode] = defineField('handover.mode')
const [handoverBranch] = defineField('handover.branch')
const [dropOffMode] = defineField('dropOff.mode')
const [dropOffBranch] = defineField('dropOff.branch')
const [firstName] = defineField('driver.firstName')
const [lastName] = defineField('driver.lastName')
const [email] = defineField('driver.email')
const [phone] = defineField('driver.phone')
const [birthDate] = defineField('driver.birthDate')
const [licenceNumber] = defineField('driver.licenceNumber')
const [additionalDrivers] = defineField('driver.additionalDrivers')

const km = computed({
  get: () => v.expectedKmPerDay ?? '',
  set: (value: string | number | null | undefined) =>
    setFieldValue('expectedKmPerDay', value === '' || value == null ? null : Number(value)),
})
const payload = computed({
  get: () => v.minPayloadKg ?? '',
  set: (value: string | number | null | undefined) =>
    setFieldValue('minPayloadKg', value === '' || value == null ? null : Number(value)),
})

const context = useTravellerContext(() => v.traveller ?? null)
watchEffect(() => {
  travellerCostCenter.value = context.costCenterId.value
  isDeskRef.value = context.isDesk.value
})

// Driver details follow the traveller (SCREENS: "pre-filled from the traveller").
watch(
  () => [v.traveller?.id, context.profile.data.value?.id] as const,
  () => {
    const t = v.traveller
    const profile = context.profile.data.value
    if (!t) return
    setFieldValue('driver.firstName', profile?.firstName ?? t.displayName.split(' ')[0] ?? '')
    setFieldValue(
      'driver.lastName',
      profile?.lastName ?? t.displayName.split(' ').slice(1).join(' '),
    )
    setFieldValue('driver.email', t.email)
    if (profile?.phone) setFieldValue('driver.phone', profile.phone)
  },
)

const classes = useCarClasses(() => ({ vehicleType: v.vehicleType }))
watchEffect(() => {
  for (const cls of classes.data.value ?? []) classDefaults.value[cls.id] = cls.isDefault
})
// Default class per vehicle type; switching car ↔ van resets it.
watch(
  () => [v.vehicleType, classes.data.value] as const,
  () => {
    const list = classes.data.value ?? []
    if (!list.length) return
    if (!v.carClassId || !list.some((cls) => cls.id === v.carClassId)) {
      setFieldValue('carClassId', list.find((cls) => cls.isDefault)?.id ?? list[0]!.id)
    }
  },
  { immediate: true },
)
const classOptions = computed<RadioCardOption[]>(() =>
  (classes.data.value ?? []).map((cls) => ({
    value: cls.id,
    title: cls.name,
    code: cls.code,
    description: [cls.description, cls.exampleModels && `e.g. ${cls.exampleModels}`]
      .filter(Boolean)
      .join(' '),
    tag: cls.isDefault
      ? { label: 'Standard', tone: 'positive' }
      : { label: 'Needs approval', tone: 'waiting' },
  })),
)
const selectedClass = computed(() => classes.data.value?.find((cls) => cls.id === v.carClassId))

// --- stepper -----------------------------------------------------------------------------------
const STEP_FIELDS: Record<string, string[]> = {
  trip: ['traveller', 'vehicleType', 'pickupAt', 'returnAt', 'destination'],
  vehicle: [
    'carClassId',
    'gearbox',
    'foreignCountries',
    'expectedKmPerDay',
    'minPayloadKg',
    'specialEquipmentReason',
  ],
  handover: [
    'handover.branch',
    ...['street', 'houseNumber', 'postalCode', 'city', 'countryCode'].map(
      (f) => `handover.address.${f}`,
    ),
    'dropOff.branch',
    ...['street', 'houseNumber', 'postalCode', 'city', 'countryCode'].map(
      (f) => `dropOff.address.${f}`,
    ),
  ],
  driver: [
    'driver.firstName',
    'driver.lastName',
    'driver.email',
    'driver.phone',
    'driver.birthDate',
  ],
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
    { id: 'trip', label: 'Trip' },
    { id: 'vehicle', label: 'Vehicle' },
    { id: 'handover', label: 'Handover & return' },
    { id: 'driver', label: 'Driver' },
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
  Object.entries(STEP_FIELDS).find(([, fields]) =>
    fields.some((f) => field === f || field.startsWith(`${f}.`) || f.startsWith(`${field}.`)),
  )?.[0] ??
  (field.startsWith('handover') || field.startsWith('dropOff')
    ? 'handover'
    : field.startsWith('driver')
      ? 'driver'
      : field.startsWith('equipment')
        ? 'vehicle'
        : undefined)

// --- preview + slip ----------------------------------------------------------------------------
const previewBody = computed(() =>
  v.traveller
    ? {
        kind: 'car' as const,
        travellerId: v.traveller.id,
        approverId: v.approverId,
        car: {
          vehicleType: v.vehicleType,
          carClassId: v.carClassId,
          pickupAt: v.pickupAt,
          equipment: {
            ...v.equipment,
            automaticPreferred: v.gearbox === 'preferred',
            automaticRequired: v.gearbox === 'required',
          },
          handover: { mode: v.handover.mode },
          dropOff: { mode: v.dropOff.mode },
        },
      }
    : null,
)
const preview = useTravelPreview(previewBody)
const previewData = computed(() => preview.data.value)
const reasonCount = computed(() => previewData.value?.reasons.length ?? 0)

const routeText = computed(() =>
  buildRoute({
    kind: 'car',
    car: {
      handoverMode: v.handover.mode,
      handoverBranch: v.handover.branch,
      handoverCity: v.handover.address.city,
      destination: v.destination,
    },
  }),
)
const gearboxLabel = (g: Gearbox) =>
  g === 'required' ? 'automatic guaranteed' : g === 'preferred' ? 'automatic preferred' : 'manual'
const extras = computed(() =>
  EQUIPMENT_OPTIONS.filter((o) => v.equipment[o.key as keyof Values['equipment']]).map(
    (o) => o.label,
  ),
)
const days = computed(() => {
  if (!v.pickupAt || !v.returnAt) return null
  return Math.max(
    1,
    Math.ceil((new Date(v.returnAt).getTime() - new Date(v.pickupAt).getTime()) / 86_400_000),
  )
})
const facts = computed<FactItem[]>(() => [
  {
    label: 'Traveller',
    value: v.traveller?.displayName ?? '—',
    detail: v.traveller?.jobTitle ?? null,
  },
  {
    label: 'When',
    value: v.pickupAt ? formatDateTime(v.pickupAt) : 'Pick a date',
    detail: v.returnAt
      ? `to ${formatDateTime(v.returnAt)}${days.value ? ` · ${days.value} day${days.value === 1 ? '' : 's'}` : ''}`
      : null,
  },
  {
    label: 'Trip',
    value: routeText.value || '—',
    detail:
      v.equipment.foreignTravel && v.foreignCountries.length
        ? `Abroad: ${v.foreignCountries.map(countryName).join(', ')}`
        : null,
  },
  {
    label: v.vehicleType === 'van' ? 'Van' : 'Vehicle',
    value: selectedClass.value
      ? `${selectedClass.value.name} ${selectedClass.value.code}, ${gearboxLabel(v.gearbox)}`
      : '—',
    detail: extras.value.join(', ') || null,
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
    : { title: 'Summary', detail: 'Choose the trip to see the approval path' },
)

const REASON_FIELD: Record<string, [string, string]> = {
  vehicle_class_upgrade: ['vehicle', 'carClassId'],
  car_estate: ['vehicle', 'equipment-estate'],
  car_automatic_preferred: ['vehicle', 'gearbox'],
  car_automatic_required: ['vehicle', 'gearbox'],
  car_diesel: ['vehicle', 'equipment-diesel'],
  car_foreign_travel: ['vehicle', 'equipment-foreignTravel'],
  car_delivery: ['handover', 'handover-mode'],
  car_collection: ['handover', 'dropoff-mode'],
}
function selectReason(code: string) {
  const target = REASON_FIELD[code]
  if (!target) return
  stepper.goTo(target[0])
  focusField(target[1])
}
const needsReasonText = computed(() => specialEquipmentReasonRequired(localReasons(v)))
const reasonsBefore = (reason: string | null) =>
  Boolean(reason) && !localReasons(v).includes(reason as never)

// --- draft, duplicate, submit ----------------------------------------------------------------------
const draft = useStepperDraft('travel-car', v, { version: 1 })
onMounted(async () => {
  const from = typeof route.query.from === 'string' ? route.query.from : null
  if (from) {
    try {
      const source = await api.get<TravelRequestDetail>(`/travel/requests/${from}`)
      if (source.car) setValues(fromDetail(source))
      toast.info('Copied from ' + source.reference + '. Check the dates before you submit.')
    } catch {
      // Not visible or gone: start empty.
    }
    return
  }
  const saved = draft.restore()
  if (saved) setValues({ ...initialValues(), ...saved })
})

function fromDetail(source: TravelRequestDetail): Partial<Values> {
  const car = source.car!
  return {
    traveller: source.traveller,
    vehicleType: car.vehicleType,
    pickupAt: car.pickupAt,
    returnAt: car.returnAt,
    destination: car.destination,
    carClassId: car.carClass.id,
    gearbox: car.equipment.automaticRequired
      ? 'required'
      : car.equipment.automaticPreferred
        ? 'preferred'
        : 'manual',
    equipment: {
      estate: car.equipment.estate,
      navigation: car.equipment.navigation,
      diesel: car.equipment.diesel,
      winterTyres: car.equipment.winterTyres,
      foreignTravel: car.equipment.foreignTravel,
      childSeat: car.equipment.childSeat,
    },
    foreignCountries: car.foreignCountries,
    expectedKmPerDay: car.expectedKmPerDay,
    minPayloadKg: car.minPayloadKg,
    specialEquipmentReason: car.specialEquipmentReason ?? '',
    handover: {
      mode: car.handover.mode,
      branch: car.handover.branch ?? '',
      address: car.handover.address ?? { ...emptyAddress },
    },
    dropOff: {
      mode: car.dropOff.mode,
      branch: car.dropOff.branch ?? '',
      address: car.dropOff.address ?? { ...emptyAddress },
    },
    costCenterId: source.costCenter.id,
    costCenterReason: source.costCenterReason ?? '',
    recharge: Boolean(source.recharge),
    rechargeCustomer: source.recharge?.customer ?? '',
    rechargeProjectNumber: source.recharge?.projectNumber ?? '',
    comment: source.comment ?? '',
  }
}

const { submit, submitting, formError } = useTravelSubmit({
  kind: 'car',
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
  const addressOrNull = (a: Values['handover']['address'], on: boolean) =>
    on ? { ...a, countryCode: a.countryCode.toUpperCase() } : null
  const body: CreateTravelRequest = {
    kind: 'car',
    travellerId: v.traveller!.id,
    ...costsBody(v, previewData.value?.defaultApproverId ?? null),
    car: {
      vehicleType: v.vehicleType,
      carClassId: v.carClassId!,
      pickupAt: v.pickupAt!,
      returnAt: v.returnAt!,
      destination: v.destination.trim(),
      equipment: {
        ...v.equipment,
        automaticPreferred: v.gearbox === 'preferred',
        automaticRequired: v.gearbox === 'required',
      },
      foreignCountries: v.equipment.foreignTravel ? v.foreignCountries : [],
      expectedKmPerDay: v.expectedKmPerDay,
      minPayloadKg: v.vehicleType === 'van' ? v.minPayloadKg : null,
      handover: {
        mode: v.handover.mode,
        branch: v.handover.mode === 'branch' ? v.handover.branch.trim() : null,
        address: addressOrNull(v.handover.address, v.handover.mode === 'delivery'),
      },
      dropOff: {
        mode: v.dropOff.mode,
        branch: v.dropOff.mode === 'branch' ? v.dropOff.branch.trim() : null,
        address: addressOrNull(v.dropOff.address, v.dropOff.mode === 'collection'),
      },
      driver: {
        firstName: v.driver.firstName,
        lastName: v.driver.lastName,
        email: v.driver.email,
        phone: v.driver.phone,
        birthDate: v.driver.birthDate!,
        licenceNumber: v.driver.licenceNumber || null,
        additionalDrivers: v.driver.additionalDrivers || null,
      },
      specialEquipmentReason: v.specialEquipmentReason.trim() || null,
    },
  }
  await submit(body)
}

// Drop-off defaults to the pick-up branch.
watch(
  () => v.handover.branch,
  (next, previous) => {
    if (!v.dropOff.branch || v.dropOff.branch === previous) setFieldValue('dropOff.branch', next)
  },
)

function toggleCountry(code: string, checked: boolean) {
  setFieldValue(
    'foreignCountries',
    checked ? [...v.foreignCountries, code] : v.foreignCountries.filter((item) => item !== code),
  )
}

const minPickup = computed(() => new Date().toISOString().slice(0, 10))
const costCenterLabel = useCostCenterLabel()
const reviewFacts = computed(() => ({
  trip: [
    { label: 'Traveller', value: v.traveller?.displayName ?? '—' },
    { label: 'Vehicle type', value: v.vehicleType === 'van' ? 'Van' : 'Car' },
    { label: 'Pick-up', value: v.pickupAt ? formatDateTime(v.pickupAt) : '—' },
    { label: 'Return', value: v.returnAt ? formatDateTime(v.returnAt) : '—' },
    { label: 'Destination', value: v.destination || '—' },
  ],
  vehicle: [
    {
      label: 'Class',
      value: selectedClass.value ? `${selectedClass.value.name} ${selectedClass.value.code}` : '—',
    },
    { label: 'Gearbox', value: gearboxLabel(v.gearbox).replace(/^./, (c) => c.toUpperCase()) },
    { label: 'Equipment', value: extras.value.join(', ') || 'None' },
    ...(v.equipment.foreignTravel
      ? [{ label: 'Countries', value: v.foreignCountries.map(countryName).join(', ') }]
      : []),
    ...(v.expectedKmPerDay ? [{ label: 'Distance', value: `${v.expectedKmPerDay} km a day` }] : []),
    ...(v.specialEquipmentReason ? [{ label: 'Why', value: v.specialEquipmentReason }] : []),
  ],
  handover: [
    {
      label: 'Handover',
      value: v.handover.mode === 'branch' ? `${v.handover.branch} branch` : 'Delivered',
      detail:
        v.handover.mode === 'delivery'
          ? `${v.handover.address.street} ${v.handover.address.houseNumber}, ${v.handover.address.city}`
          : null,
    },
    {
      label: 'Drop-off',
      value: v.dropOff.mode === 'branch' ? `${v.dropOff.branch} branch` : 'Collected',
      detail:
        v.dropOff.mode === 'collection'
          ? `${v.dropOff.address.street} ${v.dropOff.address.houseNumber}, ${v.dropOff.address.city}`
          : null,
    },
  ],
  driver: [
    {
      label: 'Driver',
      value: `${v.driver.firstName} ${v.driver.lastName}`,
      detail: v.driver.email,
    },
    { label: 'Phone', value: v.driver.phone || '—' },
    {
      label: 'Born',
      value: v.driver.birthDate
        ? formatDate(v.driver.birthDate, { weekday: false, year: 'always' })
        : '—',
    },
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
    title="New car rental"
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
    <datalist id="travel-places">
      <option v-for="place in PLACES" :key="place" :value="place" />
    </datalist>

    <StepperStep
      v-if="stepper.current.value?.id === 'trip'"
      question="Where and when do you need a car?"
      lede="Tell us who travels and when. A car or van with the standard class and a manual gearbox goes straight to the travel desk."
    >
      <TravelTravellerField
        v-model="traveller"
        :me="me"
        :can-pick-others="context.canPickOthers.value"
        :is-desk="context.isDesk.value"
        :error="errors.traveller"
      />
      <UiField label="Vehicle" group>
        <UiSegmented
          v-model="vehicleType"
          label="Vehicle"
          :options="[
            { value: 'car', label: 'Car' },
            { value: 'van', label: 'Van' },
          ]"
        />
      </UiField>
      <div class="grid gap-5 sm:grid-cols-2">
        <UiField id="pickupAt" label="Pick-up" :error="errors.pickupAt">
          <UiDatePicker v-model="pickupAt" time :min="context.isDesk.value ? null : minPickup" />
        </UiField>
        <UiField id="returnAt" label="Return" :error="errors.returnAt">
          <UiDatePicker v-model="returnAt" time :min="pickupAt?.slice(0, 10) ?? minPickup" />
        </UiField>
      </div>
      <UiField
        id="destination"
        label="Destination"
        hint="Where you drive to, e.g. Westbay."
        :error="errors.destination"
      >
        <UiInput v-model="destination" list="travel-places" maxlength="120" />
      </UiField>
    </StepperStep>

    <StepperStep
      v-else-if="stepper.current.value?.id === 'vehicle'"
      question="Which car do you need?"
      lede="The standard class with a manual gearbox goes straight to the travel desk. Anything more is approved by your manager first."
    >
      <UiField id="carClassId" label="Class" group :error="errors.carClassId">
        <UiRadioCards
          v-if="classOptions.length"
          :model-value="carClassId ?? undefined"
          :options="classOptions"
          aria-label="Class"
          @update:model-value="(value) => (carClassId = value ?? null)"
        />
        <UiSkeleton v-else class="h-24 w-full" />
      </UiField>
      <UiField
        id="gearbox"
        label="Gearbox"
        hint="“Preferred” lets the desk book a manual car if no automatic is free. Both automatic options need approval."
      >
        <UiSegmented
          v-model="gearbox"
          label="Gearbox"
          stack-on-mobile
          :options="[
            { value: 'manual', label: 'Manual' },
            { value: 'preferred', label: 'Automatic preferred' },
            { value: 'required', label: 'Automatic guaranteed' },
          ]"
        />
      </UiField>
      <UiField label="Equipment" optional group>
        <div class="grid gap-4 rounded-lg border border-rule bg-well p-4 sm:grid-cols-2">
          <UiCheckbox
            v-for="option in EQUIPMENT_OPTIONS"
            :id="`equipment-${option.key}`"
            :key="option.key"
            :model-value="v.equipment[option.key as keyof Values['equipment']]"
            :label="option.label"
            :description="'description' in option ? option.description : undefined"
            @update:model-value="
              (checked) =>
                setFieldValue(`equipment.${option.key}` as never, (checked === true) as never)
            "
          >
            <template v-if="option.reason && reasonsBefore(option.reason)" #tag>
              <UiTag tone="waiting">Needs approval</UiTag>
            </template>
          </UiCheckbox>
        </div>
      </UiField>
      <UiField
        v-if="v.equipment.foreignTravel"
        id="foreignCountries"
        label="Countries"
        hint="Every country you drive through, besides the one you start in."
        :error="errors.foreignCountries"
        group
      >
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <UiCheckbox
            v-for="country in COUNTRY_OPTIONS"
            :key="country.value"
            :model-value="v.foreignCountries.includes(country.value)"
            :label="country.label"
            @update:model-value="(checked) => toggleCountry(country.value, checked === true)"
          />
        </div>
      </UiField>
      <div class="grid gap-5 sm:grid-cols-2">
        <UiField
          id="expectedKmPerDay"
          label="Expected distance"
          optional
          :error="errors.expectedKmPerDay"
        >
          <UiInput v-model="km" type="number" min="0" max="5000" suffix="km a day" />
        </UiField>
        <UiField
          v-if="v.vehicleType === 'van'"
          id="minPayloadKg"
          label="Minimum payload"
          optional
          :error="errors.minPayloadKg"
        >
          <UiInput v-model="payload" type="number" min="0" suffix="kg" />
        </UiField>
      </div>
      <UiField
        v-if="needsReasonText"
        id="specialEquipmentReason"
        label="Why do you need this?"
        :hint="`${previewData?.approverCandidates.find((c) => c.isDefault)?.user.displayName ?? 'Your approver'} reads this next to your request. At least 10 characters.`"
        :error="errors.specialEquipmentReason"
      >
        <UiTextarea v-model="specialEquipmentReason" :maxlength="1000" :rows="3" />
      </UiField>
    </StepperStep>

    <StepperStep
      v-else-if="stepper.current.value?.id === 'handover'"
      question="Where do you pick it up and return it?"
      lede="Picking up and returning at a branch needs no approval. Delivery to or collection from an address does."
    >
      <UiField id="handover-mode" label="Handover" group>
        <UiRadioCards
          v-model="handoverMode"
          :columns="2"
          aria-label="Handover"
          :options="[
            {
              value: 'branch',
              title: 'At a branch',
              description: 'You collect the car at the rental branch.',
            },
            {
              value: 'delivery',
              title: 'Delivered to an address',
              description: 'The rental company brings the car.',
              tag:
                v.handover.mode === 'delivery'
                  ? undefined
                  : { label: 'Needs approval', tone: 'waiting' },
            },
          ]"
        />
      </UiField>
      <UiField
        v-if="v.handover.mode === 'branch'"
        id="handover-branch"
        label="Branch"
        hint="The town of the rental branch, e.g. Riverton."
        :error="errors['handover.branch']"
      >
        <UiInput v-model="handoverBranch" list="travel-places" maxlength="120" />
      </UiField>
      <TravelAddressFields v-else prefix="handover.address" id-prefix="handover" />

      <UiField id="dropoff-mode" label="Return" group>
        <UiRadioCards
          v-model="dropOffMode"
          :columns="2"
          aria-label="Return"
          :options="[
            {
              value: 'branch',
              title: 'At a branch',
              description: 'You drop the car off at a branch.',
            },
            {
              value: 'collection',
              title: 'Collected from an address',
              description: 'The rental company picks the car up.',
              tag:
                v.dropOff.mode === 'collection'
                  ? undefined
                  : { label: 'Needs approval', tone: 'waiting' },
            },
          ]"
        />
      </UiField>
      <UiField
        v-if="v.dropOff.mode === 'branch'"
        id="dropoff-branch"
        label="Return branch"
        :error="errors['dropOff.branch']"
      >
        <UiInput v-model="dropOffBranch" list="travel-places" maxlength="120" />
      </UiField>
      <TravelAddressFields v-else prefix="dropOff.address" id-prefix="dropoff" />
    </StepperStep>

    <StepperStep
      v-else-if="stepper.current.value?.id === 'driver'"
      question="Who drives?"
      lede="We filled in the traveller. Driver details are only shared with the traveller, the approver and the travel desk."
    >
      <div class="grid gap-5 sm:grid-cols-2">
        <UiField id="driver-firstName" label="First name" :error="errors['driver.firstName']">
          <UiInput v-model="firstName" autocomplete="given-name" maxlength="80" />
        </UiField>
        <UiField id="driver-lastName" label="Last name" :error="errors['driver.lastName']">
          <UiInput v-model="lastName" autocomplete="family-name" maxlength="80" />
        </UiField>
        <UiField id="driver-email" label="Email" :error="errors['driver.email']">
          <UiInput v-model="email" type="email" autocomplete="email" />
        </UiField>
        <UiField id="driver-phone" label="Phone" :error="errors['driver.phone']">
          <UiInput v-model="phone" type="tel" autocomplete="tel" maxlength="40" />
        </UiField>
        <UiField
          id="driver-birthDate"
          label="Birth date"
          hint="The driver must be 18 or older."
          :error="errors['driver.birthDate']"
        >
          <UiDatePicker v-model="birthDate" />
        </UiField>
        <UiField
          id="driver-licence"
          label="Licence number"
          optional
          :error="errors['driver.licenceNumber']"
        >
          <UiInput v-model="licenceNumber" mono maxlength="40" />
        </UiField>
      </div>
      <UiField
        id="driver-additional"
        label="Additional drivers"
        optional
        hint="Names of colleagues who also drive."
      >
        <UiTextarea v-model="additionalDrivers" :maxlength="500" :rows="2" />
      </UiField>
    </StepperStep>

    <StepperStep
      v-else-if="stepper.current.value?.id === 'costs'"
      question="Who pays, and who approves?"
      :lede="
        previewData?.needsApproval
          ? 'Your choices need approval. The approver follows your reporting line; you can pick someone else above you.'
          : 'This trip needs no approval. Check the cost centre and add a comment if the desk should know something.'
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
      <TravelReviewSection title="Trip" :facts="reviewFacts.trip" @edit="stepper.goTo('trip')" />
      <TravelReviewSection
        title="Vehicle"
        :facts="reviewFacts.vehicle"
        @edit="stepper.goTo('vehicle')"
      />
      <TravelReviewSection
        title="Handover & return"
        :facts="reviewFacts.handover"
        @edit="stepper.goTo('handover')"
      />
      <TravelReviewSection
        title="Driver"
        :facts="reviewFacts.driver"
        @edit="stepper.goTo('driver')"
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
        :title="v.vehicleType === 'van' ? 'Van rental' : 'Car rental'"
        :facts="facts"
        :preview="previewData"
        :requester="me"
        @select-reason="selectReason"
      />
    </template>
  </StepperPage>
</template>
