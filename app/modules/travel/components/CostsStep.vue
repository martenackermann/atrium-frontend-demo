<script setup lang="ts">
import type { RadioCardOption } from '~/types/ui'
import type { TravelPreview } from '../api/types'

/**
 * "Costs & approval" step shared by the three steppers (SCREENS §5.3 car step 5): cost centre
 * (default: the traveller's) → reason if changed; "Recharge to a customer" → customer + project;
 * the approver (from the preview's `approverCandidates`, site managers greyed out) when an
 * approval is needed; comment. Fields bind to the parent vee-validate form.
 */
const props = defineProps<{
  preview: TravelPreview | null | undefined
  travellerCostCenterId: string | null
  /** Flights always need approval: show the approver even before the preview arrives. */
  alwaysApproval?: boolean
}>()

const org = useOrg()
const enums = useEnums()
const { value: costCenterId, errorMessage: costCenterError } = useField<string | null>(
  'costCenterId',
)
const { value: costCenterReason, errorMessage: reasonError } = useField<string>('costCenterReason')
const { value: recharge } = useField<boolean>('recharge')
const { value: rechargeCustomer, errorMessage: customerError } =
  useField<string>('rechargeCustomer')
const { value: rechargeProjectNumber, errorMessage: projectError } =
  useField<string>('rechargeProjectNumber')
const { value: approverId, errorMessage: approverError } = useField<string | null>('approverId')
const { value: comment, errorMessage: commentError } = useField<string>('comment')

// Default the cost centre to the traveller's (and follow traveller changes until edited).
watch(
  () => props.travellerCostCenterId,
  (next, previous) => {
    if (next && (!costCenterId.value || costCenterId.value === previous)) costCenterId.value = next
  },
  { immediate: true },
)
const otherCostCenter = computed(
  () =>
    Boolean(costCenterId.value) &&
    Boolean(props.travellerCostCenterId) &&
    costCenterId.value !== props.travellerCostCenterId,
)

const needsApproval = computed(() => props.preview?.needsApproval ?? props.alwaysApproval ?? false)
const candidates = computed(() => props.preview?.approverCandidates ?? [])
const defaultId = computed(() => props.preview?.defaultApproverId ?? null)
const selected = computed({
  get: () => approverId.value ?? defaultId.value ?? undefined,
  set: (value) => {
    approverId.value = value && value !== defaultId.value ? value : null
  },
})
const approverOptions = computed<RadioCardOption[]>(() =>
  candidates.value.map((candidate) => ({
    value: candidate.user.id,
    title: candidate.user.displayName,
    description: candidate.isSiteManager
      ? 'Site manager — approvals for their team skip to their manager'
      : [
          candidate.user.jobTitle,
          candidate.reason
            ? enums.label('approverReason', candidate.reason).toLowerCase()
            : candidate.level === 1
              ? 'direct manager'
              : `level ${candidate.level} in the chain`,
        ]
          .filter(Boolean)
          .join(' · '),
    tag: candidate.isDefault
      ? { label: 'Default', tone: 'positive' }
      : candidate.isSiteManager
        ? { label: 'Site manager', tone: 'neutral' }
        : undefined,
    disabled: !candidate.selectable,
  })),
)
</script>

<template>
  <div class="grid gap-7">
    <UiField
      id="costCenterId"
      label="Cost centre"
      hint="The traveller's cost centre pays unless you choose another one."
      :error="costCenterError"
    >
      <UiSelect v-model="costCenterId" :options="org.costCenterOptions.value" />
    </UiField>
    <UiField
      v-if="otherCostCenter"
      id="costCenterReason"
      label="Why another cost centre?"
      hint="The approver and the travel desk read this."
      :error="reasonError"
    >
      <UiTextarea v-model="costCenterReason" :maxlength="500" :rows="2" />
    </UiField>

    <div class="grid gap-4">
      <UiSwitch
        v-model="recharge"
        label="Recharge to a customer"
        description="The travel desk adds the costs to the customer's project."
      />
      <div v-if="recharge" class="grid gap-4 sm:grid-cols-2">
        <UiField id="rechargeCustomer" label="Customer" :error="customerError">
          <UiInput v-model="rechargeCustomer" maxlength="120" />
        </UiField>
        <UiField id="rechargeProjectNumber" label="Project number" :error="projectError">
          <UiInput v-model="rechargeProjectNumber" mono maxlength="120" />
        </UiField>
      </div>
    </div>

    <UiField
      v-if="needsApproval && preview?.autoApproval !== 'requester_is_approver'"
      id="approverId"
      label="Approver"
      group
      :hint="
        preview?.exemption
          ? undefined
          : 'The default follows the reporting line. You can pick someone else above the traveller.'
      "
      :error="approverError"
    >
      <UiRadioCards
        v-if="approverOptions.length"
        v-model="selected"
        :options="approverOptions"
        :columns="1"
        aria-label="Approver"
      />
      <p v-else class="text-sm text-ink-muted">Working out who approves…</p>
    </UiField>
    <p
      v-else-if="preview?.autoApproval === 'requester_is_approver'"
      class="rounded-md border border-st-positive-line bg-st-positive-bg px-3.5 py-2.5 text-sm text-st-positive"
    >
      You are the approver for this trip, so it is approved automatically when you submit.
    </p>

    <UiField
      id="comment"
      label="Comment"
      optional
      hint="Anything the approver or the travel desk should know."
      :error="commentError"
    >
      <UiTextarea v-model="comment" :maxlength="2000" :rows="3" />
    </UiField>
  </div>
</template>
