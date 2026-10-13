<script setup lang="ts">
import { RotateCcw } from '@lucide/vue'
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import { assetKeys } from '../api'
import type { AssetDto, UpdateAsset } from '../api/types'

/**
 * Asset details form (SCREENS §6.6 "Details"): every PATCHable field, saved with the `version`
 * from the last GET. 409 version_conflict → "Someone else changed this asset. Reload?". The cost
 * centre is read-only while the asset is assigned (SPEC_RESOLUTIONS #22). Each save is audited
 * with a field diff (see Timeline).
 */
const props = defineProps<{ asset: AssetDto }>()
const emit = defineEmits<{ saved: [asset: AssetDto] }>()

const api = useApi()
const toast = useToast()
const org = useOrg()
const queryClient = useQueryClient()
const formError = ref<string | null>(null)
const conflict = ref(false)

const schema = toTypedSchema(
  z.object({
    deviceTypeId: z.string({ error: 'Choose a device type.' }).min(1, 'Choose a device type.'),
    manufacturerId: z.string({ error: 'Choose a manufacturer.' }).min(1, 'Choose a manufacturer.'),
    modelId: z.string({ error: 'Choose a model.' }).min(1, 'Choose a model.'),
    platformId: z.string().nullable().optional(),
    serialNumber: z
      .string({ error: 'Enter the serial number.' })
      .trim()
      .min(1, 'Enter the serial number.')
      .max(80, 'Keep the serial number under 80 characters.'),
    name: z.string().max(120).nullable().optional(),
    purchaseDate: z.string().nullable().optional(),
    costCenterId: z.string().nullable().optional(),
    mdmEnrolled: z.boolean(),
    notes: z.string().max(2000, 'Keep the notes under 2,000 characters.').nullable().optional(),
  }),
)
const {
  defineField,
  errors,
  handleSubmit,
  isSubmitting,
  setErrors,
  setFieldError,
  resetForm,
  meta,
} = useForm({ validationSchema: schema })
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

function reset(asset: AssetDto) {
  conflict.value = false
  formError.value = null
  resetForm({
    values: {
      deviceTypeId: asset.deviceType.id,
      manufacturerId: asset.manufacturer.id,
      modelId: asset.model.id,
      platformId: asset.platform?.id ?? null,
      serialNumber: asset.serialNumber,
      name: asset.name,
      purchaseDate: asset.purchaseDate,
      costCenterId: asset.costCenter.id,
      mdmEnrolled: asset.mdmEnrolled,
      notes: asset.notes,
    },
  })
}
watch(
  () => [props.asset.id, props.asset.version] as const,
  () => reset(props.asset),
  { immediate: true },
)

const assigned = computed(() => props.asset.assignedUser)
const costCenterOptions = computed(() => {
  const options = org.costCenterOptions.value
  const current = props.asset.costCenter
  return options.some((o) => o.value === current.id)
    ? options
    : [{ value: current.id, label: `${current.code} · ${current.name}` }, ...options]
})

const save = handleSubmit(async (values) => {
  formError.value = null
  const body: UpdateAsset = {
    serialNumber: values.serialNumber,
    name: values.name?.trim() || null,
    modelId: values.modelId,
    platformId: values.platformId ?? null,
    purchaseDate: values.purchaseDate ?? null,
    ...(assigned.value ? {} : { costCenterId: values.costCenterId ?? null }),
    mdmEnrolled: values.mdmEnrolled,
    notes: values.notes?.trim() || null,
    version: props.asset.version,
  }
  try {
    const updated = await api.patch<AssetDto>(`/assets/${props.asset.id}`, body)
    queryClient.setQueryData(assetKeys.assets.detail(updated.id), updated)
    await queryClient.invalidateQueries({ queryKey: assetKeys.module })
    toast.success('Saved. The change is in the timeline.')
    emit('saved', updated)
  } catch (error) {
    if (isApiError(error) && error.code === 'version_conflict') {
      conflict.value = true
      return
    }
    if (isApiError(error) && error.code === 'serial_taken') {
      setFieldError('serialNumber', error.detail ?? 'This serial number is already registered.')
      return
    }
    if (isApiError(error) && error.isValidationError) {
      setErrors(error.fieldErrors)
      return
    }
    formError.value = describeError(error).detail ?? describeError(error).title
  }
})

async function reload() {
  await queryClient.invalidateQueries({ queryKey: assetKeys.module })
  conflict.value = false
}
</script>

<template>
  <form class="grid gap-8" novalidate @submit="save">
    <div
      v-if="conflict"
      role="alert"
      class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-st-negative-line bg-st-negative-bg px-4 py-3 text-base text-st-negative"
    >
      Someone else changed this asset. Reload to see their changes, then edit again.
      <UiButton size="sm" variant="secondary" :icon="RotateCcw" @click="reload">Reload</UiButton>
    </div>

    <section class="grid gap-4" aria-labelledby="edit-device-heading">
      <h3 id="edit-device-heading" class="text-md font-semibold">Device</h3>
      <AssetsDevicePickers
        v-model:device-type-id="deviceTypeId"
        v-model:manufacturer-id="manufacturerId"
        v-model:model-id="modelId"
        v-model:platform-id="platformId"
        :errors="errors"
        :current="{ model: asset.model, platform: asset.platform }"
        platform-hint="Set by the user on accept; correct it here if needed."
      />
      <div class="grid gap-4 md:grid-cols-2">
        <UiField label="Serial number" :error="errors.serialNumber">
          <UiInput v-model="serialNumber" mono autocomplete="off" />
        </UiField>
        <UiField label="Device name" optional :error="errors.name">
          <UiInput v-model="name" mono autocomplete="off" />
        </UiField>
      </div>
    </section>

    <section class="grid gap-4" aria-labelledby="edit-purchase-heading">
      <h3 id="edit-purchase-heading" class="text-md font-semibold">Purchase &amp; accounting</h3>
      <div class="grid gap-4 md:grid-cols-2">
        <UiField label="Purchase date" optional :error="errors.purchaseDate">
          <UiDatePicker v-model="purchaseDate" />
        </UiField>
        <UiField
          label="Cost centre"
          :hint="
            assigned
              ? `Follows ${assigned.displayName} while the device is assigned. It changes back to IT Stock when the device returns.`
              : undefined
          "
          :error="errors.costCenterId"
        >
          <UiSelect
            v-model="costCenterId"
            :options="costCenterOptions"
            :disabled="Boolean(assigned)"
          />
        </UiField>
      </div>
      <UiSwitch v-model="mdmEnrolled" label="Enrolled in device management (MDM)" />
    </section>

    <section class="grid gap-4" aria-labelledby="edit-notes-heading">
      <h3 id="edit-notes-heading" class="text-md font-semibold">Notes</h3>
      <UiField label="Notes" optional hint="Only asset admins see notes." :error="errors.notes">
        <UiTextarea v-model="notes" :maxlength="2000" :rows="3" />
      </UiField>
    </section>

    <p v-if="formError" role="alert" class="text-sm text-st-negative">{{ formError }}</p>

    <div class="flex flex-wrap justify-end gap-2 border-t border-rule pt-4">
      <UiButton variant="secondary" :disabled="!meta.dirty" @click="reset(asset)"
        >Discard changes</UiButton
      >
      <UiButton type="submit" variant="primary" :loading="isSubmitting" :disabled="!meta.dirty"
        >Save changes</UiButton
      >
    </div>
  </form>
</template>
