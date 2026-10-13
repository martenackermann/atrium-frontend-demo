/**
 * Shared plumbing of the three travel steppers (SCREENS §5.3): the traveller context (cost centre,
 * who may be picked), the costs fields schema, the submit with a stable Idempotency-Key and the
 * mapping of 422 `errors` (API dot paths) onto form fields and steps.
 */
import { z } from 'zod'
import { describeError, isApiError, newIdempotencyKey } from '~/lib/api'
import { coreKeys } from '~/lib/query/core'
import type { UserProfile, UserRef } from '~/types/api'
import type { CreateTravelRequest, TravelKind, TravelRequestDetail } from '../api/types'
import { travelKeys } from '../api'

/** Costs & approval fields (common to car, train and flight). */
export const costsShape = {
  costCenterId: z.string().nullable(),
  costCenterReason: z.string().trim().max(500, 'Keep it under 500 characters.'),
  recharge: z.boolean(),
  rechargeCustomer: z.string().trim().max(120),
  rechargeProjectNumber: z.string().trim().max(120),
  approverId: z.string().nullable(),
  comment: z.string().trim().max(2000, 'Keep it under 2,000 characters.'),
}

export const costsDefaults = {
  costCenterId: null as string | null,
  costCenterReason: '',
  recharge: false,
  rechargeCustomer: '',
  rechargeProjectNumber: '',
  approverId: null as string | null,
  comment: '',
}

export type CostsValues = typeof costsDefaults

/** Conditional rules of the costs step (reason when the cost centre differs; both recharge fields). */
export function refineCosts(
  values: CostsValues,
  ctx: z.RefinementCtx,
  travellerCostCenterId: string | null,
) {
  if (
    values.costCenterId &&
    travellerCostCenterId &&
    values.costCenterId !== travellerCostCenterId &&
    !values.costCenterReason.trim()
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['costCenterReason'],
      message: 'Say why another cost centre pays. The approver reads it.',
    })
  }
  if (values.recharge) {
    if (!values.rechargeCustomer.trim()) {
      ctx.addIssue({ code: 'custom', path: ['rechargeCustomer'], message: 'Name the customer.' })
    }
    if (!values.rechargeProjectNumber.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['rechargeProjectNumber'],
        message: 'Add the project number.',
      })
    }
  }
}

/** The costs part of the API body. */
export function costsBody(values: CostsValues, defaultApproverId: string | null) {
  return {
    costCenterId: values.costCenterId,
    costCenterReason: values.costCenterReason.trim() || null,
    recharge: values.recharge
      ? {
          customer: values.rechargeCustomer.trim(),
          projectNumber: values.rechargeProjectNumber.trim(),
        }
      : null,
    approverId:
      values.approverId && values.approverId !== defaultApproverId ? values.approverId : null,
    comment: values.comment.trim() || null,
  }
}

/** Who travels: profile (cost centre) + whether the viewer may pick other people. */
export function useTravellerContext(traveller: MaybeRefOrGetter<UserRef | null>) {
  const api = useApi()
  const auth = useAuthStore()
  const profile = useQuery({
    queryKey: computed(() => coreKeys.user(toValue(traveller)?.id ?? '')),
    queryFn: ({ signal }) =>
      api.get<UserProfile>(`/users/${toValue(traveller)!.id}`, undefined, { signal }),
    enabled: computed(() => Boolean(toValue(traveller)?.id)),
    staleTime: 5 * 60_000,
  })
  const isDesk = computed(() => auth.can(['travel_desk', 'it_admin']))
  const canPickOthers = computed(() => isDesk.value || auth.can(['manager']))
  return {
    profile,
    costCenterId: computed(() => profile.data.value?.costCenter.id ?? null),
    isDesk,
    canPickOthers,
  }
}

/** Me as a UserRef (default traveller). */
export function useMeRef() {
  const auth = useAuthStore()
  return computed<UserRef | null>(() =>
    auth.me
      ? {
          id: auth.me.id,
          displayName: auth.me.displayName,
          email: auth.me.email,
          jobTitle: auth.me.jobTitle,
          initials: auth.me.initials,
        }
      : null,
  )
}

/** API error path → form path: strips the kind prefix and renames costs/traveller fields. */
export function toFormErrors(fieldErrors: Record<string, string[]>, kind: TravelKind) {
  const result: Record<string, string> = {}
  for (const [path, messages] of Object.entries(fieldErrors)) {
    let key = path.startsWith(`${kind}.`) ? path.slice(kind.length + 1) : path
    if (key === 'travellerId') key = 'traveller'
    if (key === 'recharge.customer' || key === 'recharge') key = 'rechargeCustomer'
    if (key === 'recharge.projectNumber') key = 'rechargeProjectNumber'
    if (key.startsWith('companionIds')) key = 'companions'
    if (key.startsWith('equipment.')) key = 'gearbox'
    if (messages[0] && !result[key]) result[key] = messages[0]
  }
  return result
}

/**
 * Submit with a stable Idempotency-Key per payload (a retried submit replays, D16); maps 422 errors
 * to the form and jumps to the first step that has one.
 */
export function useTravelSubmit(options: {
  kind: TravelKind
  setErrors: (errors: Record<string, string>) => void
  stepOf: (field: string) => string | undefined
  goTo: (stepId: string) => void
  onSuccess: (detail: TravelRequestDetail) => void
}) {
  const api = useApi()
  const queryClient = useQueryClient()
  const formError = ref<string | null>(null)
  const submitting = ref(false)
  let lastBody = ''
  let key = newIdempotencyKey()

  async function submit(body: CreateTravelRequest) {
    formError.value = null
    const serialized = JSON.stringify(body)
    if (serialized !== lastBody) {
      key = newIdempotencyKey()
      lastBody = serialized
    }
    submitting.value = true
    try {
      const detail = await api.post<TravelRequestDetail>('/travel/requests', body, {
        idempotencyKey: key,
      })
      await queryClient.invalidateQueries({ queryKey: travelKeys.requests.module })
      options.onSuccess(detail)
    } catch (error) {
      if (isApiError(error) && error.isValidationError) {
        const errors = toFormErrors(error.fieldErrors, options.kind)
        options.setErrors(errors)
        const step = Object.keys(errors)
          .map(options.stepOf)
          .find((id): id is string => Boolean(id))
        if (step) options.goTo(step)
        formError.value = 'Some fields need your attention.'
      } else {
        const described = describeError(error)
        formError.value = described.detail ?? described.title
      }
    } finally {
      submitting.value = false
    }
  }

  return { submit, submitting, formError }
}

/** Focus the field behind a reason chip (DESIGN §8.2: clicking a reason focuses its field). */
export function focusField(id: string) {
  void nextTick(() => {
    // Group fields render the id on no element; they carry `data-field` on their wrapper.
    const element =
      document.getElementById(id) ?? document.querySelector<HTMLElement>(`[data-field="${id}"]`)
    if (!element) return
    element.scrollIntoView({ block: 'center', behavior: 'smooth' })
    // Group fields (radio cards, segmented, switches) carry the id on a wrapper that can't take
    // focus: focus the chosen option, else the first control inside.
    const target = element.matches(FOCUSABLE)
      ? element
      : (element.querySelector<HTMLElement>(
          '[role="radio"][aria-checked="true"], [role="radio"][data-state="checked"]',
        ) ?? element.querySelector<HTMLElement>(FOCUSABLE))
    target?.focus({ preventScroll: true })
  })
}
const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), select, textarea, button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** "CC-2100 · Field Services Riverton" for a cost-centre id (review steps). */
export function useCostCenterLabel() {
  const org = useOrg()
  return (id: string | null) =>
    org.costCenterOptions.value.find((option) => option.value === id)?.label ?? 'The traveller’s'
}
