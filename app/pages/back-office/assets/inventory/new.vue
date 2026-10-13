<script setup lang="ts">
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import { assetKeys, useDeviceTypes } from '~/modules/assets/api'
import type { AssetDto, CreateAsset } from '~/modules/assets/api/types'
import type { UserRef } from '~/types/api'

/**
 * `/back-office/assets/inventory/new` — New asset (SCREENS §6.5), one page: Device (type →
 * manufacturer → model, platform when the type needs one, serial, device name), Purchase &
 * accounting (date, cost centre defaulting to CC-4900 IT Stock, MDM), Notes and "Assign now".
 */
definePageMeta({ title: 'New asset', access: ['asset_admin', 'it_admin'] })

const api = useApi()
const toast = useToast()
const org = useOrg()
const queryClient = useQueryClient()
const deviceTypes = useDeviceTypes()
const formError = ref<string | null>(null)
const idempotencyKey = crypto.randomUUID()

const schema = toTypedSchema(
  z.object({
    deviceTypeId: z.string({ error: 'Choose a device type.' }).min(1, 'Choose a device type.'),
    manufacturerId: z.string({ error: 'Choose a manufacturer.' }).min(1, 'Choose a manufacturer.'),
    modelId: z.string({ error: 'Choose a model.' }).min(1, 'Choose a model.'),
    platformId: z.string().nullable().optional(),
    serialNumber: z
      .string({ error: 'Enter the serial number from the label on the device.' })
      .trim()
      .min(1, 'Enter the serial number from the label on the device.')
      .max(80, 'Keep the serial number under 80 characters.'),
    name: z.string().max(120, 'Keep the device name under 120 characters.').optional(),
    purchaseDate: z.string().nullable().optional(),
    costCenterId: z.string().nullable().optional(),
    mdmEnrolled: z.boolean(),
    notes: z.string().max(2000, 'Keep the notes under 2,000 characters.').optional(),
    assignTo: z.custom<UserRef | null>().optional(),
  }),
)
const { defineField, errors, handleSubmit, isSubmitting, setErrors, setFieldError } = useForm({
  validationSchema: schema,
  initialValues: { mdmEnrolled: false, platformId: null, assignTo: null, purchaseDate: null },
})
const [deviceTypeId] = defineField('deviceTypeId')
const [manufacturerId] = defineField('manufacturerId')
const [modelId] = defineField('modelId')
const [platformId] = defineField('platformId')
const [serialNumber] = defineField('serialNumber')
const [name] = defineField('name')
const [purchaseDate] = defineField('purchaseDate')
const [costCenterId] = defineField('costCenterId')
const [mdmEnrolled] = defineField('mdmEnrolled')
const [notes] = defineField('notes')
const [assignTo] = defineField<'assignTo', UserRef | null>('assignTo')

// Default cost centre: CC-4900 IT Stock (SPEC §9 DEFAULT_COST_CENTER_CODE).
watch(
  () => org.costCenters.data.value,
  (rows) => {
    if (!costCenterId.value) costCenterId.value = rows?.find((cc) => cc.code === 'CC-4900')?.id
  },
  { immediate: true },
)
// Computers, phones and tablets are usually MDM-enrolled.
watch(deviceTypeId, (id) => {
  mdmEnrolled.value = Boolean(deviceTypes.data.value?.find((t) => t.id === id)?.requiresPlatform)
})

const submit = handleSubmit(async (values) => {
  formError.value = null
  const body: CreateAsset = {
    serialNumber: values.serialNumber,
    name: values.name?.trim() || null,
    modelId: values.modelId,
    platformId: values.platformId ?? null,
    purchaseDate: values.purchaseDate ?? null,
    costCenterId: values.costCenterId ?? null,
    mdmEnrolled: values.mdmEnrolled,
    notes: values.notes?.trim() || null,
    assignToUserId: values.assignTo?.id ?? null,
  }
  try {
    const asset = await api.post<AssetDto>('/assets', body, { idempotencyKey })
    await queryClient.invalidateQueries({ queryKey: assetKeys.module })
    toast.success(
      asset.assignedUser
        ? `${asset.assetTag} added and assigned to ${asset.assignedUser.displayName}.`
        : `${asset.assetTag} added to stock.`,
    )
    await navigateTo(`/back-office/assets/inventory/${asset.id}`)
  } catch (error) {
    if (isApiError(error) && error.code === 'serial_taken') {
      setFieldError('serialNumber', error.detail ?? 'This serial number is already registered.')
      return
    }
    if (isApiError(error) && error.isValidationError) {
      const { assignToUserId, ...rest } = error.fieldErrors
      setErrors({ ...rest, ...(assignToUserId ? { assignTo: assignToUserId } : {}) })
      return
    }
    formError.value = describeError(error).detail ?? describeError(error).title
  }
})
</script>

<template>
  <PageBody>
    <PageHeader
      title="New asset"
      subtitle="Register a device. It starts in stock unless you assign it right away."
    />

    <form class="mt-8 grid max-w-[880px] gap-12" novalidate @submit="submit">
      <section class="grid gap-4" aria-labelledby="device-heading">
        <h2
          id="device-heading"
          class="border-b border-ink pb-2 text-lg font-[650] tracking-heading"
        >
          Device
        </h2>
        <AssetsDevicePickers
          v-model:device-type-id="deviceTypeId"
          v-model:manufacturer-id="manufacturerId"
          v-model:model-id="modelId"
          v-model:platform-id="platformId"
          :errors="errors"
        />
        <div class="grid gap-4 md:grid-cols-2">
          <UiField
            label="Serial number"
            hint="From the label on the device."
            :error="errors.serialNumber"
          >
            <UiInput v-model="serialNumber" mono autocomplete="off" />
          </UiField>
          <UiField
            label="Device name"
            optional
            hint="Host name for computers, e.g. LT-0121."
            :error="errors.name"
          >
            <UiInput v-model="name" mono autocomplete="off" />
          </UiField>
        </div>
      </section>

      <section class="grid gap-4" aria-labelledby="purchase-heading">
        <h2
          id="purchase-heading"
          class="border-b border-ink pb-2 text-lg font-[650] tracking-heading"
        >
          Purchase &amp; accounting
        </h2>
        <div class="grid gap-4 md:grid-cols-2">
          <UiField label="Purchase date" optional :error="errors.purchaseDate">
            <UiDatePicker v-model="purchaseDate" />
          </UiField>
          <UiField
            label="Cost centre"
            hint="While the device is assigned, it follows the user's cost centre."
            :error="errors.costCenterId"
          >
            <UiSelect v-model="costCenterId" :options="org.costCenterOptions.value" />
          </UiField>
        </div>
        <UiSwitch
          v-model="mdmEnrolled"
          label="Enrolled in device management (MDM)"
          description="Laptops, desktops, phones and tablets usually are."
        />
      </section>

      <section class="grid gap-4" aria-labelledby="notes-heading">
        <h2 id="notes-heading" class="border-b border-ink pb-2 text-lg font-[650] tracking-heading">
          Notes
        </h2>
        <UiField
          label="Internal notes"
          optional
          hint="Only asset admins see notes. The person using the device never does."
          :error="errors.notes"
        >
          <UiTextarea v-model="notes" :maxlength="2000" :rows="3" />
        </UiField>
      </section>

      <section class="grid gap-4" aria-labelledby="assign-heading">
        <h2
          id="assign-heading"
          class="border-b border-ink pb-2 text-lg font-[650] tracking-heading"
        >
          Assign now
        </h2>
        <UiField
          label="Person"
          optional
          hint="They get an email and a to-do to accept the device. Leave empty to keep it in stock."
          :error="errors.assignTo"
        >
          <UserPicker v-model="assignTo" placeholder="Search by name or email" />
        </UiField>
      </section>

      <p v-if="formError" role="alert" class="text-sm text-st-negative">{{ formError }}</p>

      <div class="flex flex-wrap justify-end gap-2 border-t border-rule pt-4">
        <UiButton variant="secondary" to="/back-office/assets/inventory">Cancel</UiButton>
        <UiButton type="submit" variant="primary" :loading="isSubmitting">{{
          assignTo ? 'Add and assign' : 'Add to stock'
        }}</UiButton>
      </div>
    </form>
  </PageBody>
</template>
