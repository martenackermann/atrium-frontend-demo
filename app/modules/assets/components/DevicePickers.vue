<script setup lang="ts">
import { useDeviceTypes, useManufacturers, useModels, usePlatforms } from '../api'

/**
 * Device type → manufacturer (filtered by type) → model (filtered by both) → platform (when the
 * type requires one) — the "Device" section of the asset forms (SCREENS §6.5/§6.6). Changing a
 * parent clears its children. Archived models/platforms stay selectable only when already set.
 */
const props = defineProps<{
  errors?: Partial<Record<'deviceTypeId' | 'manufacturerId' | 'modelId' | 'platformId', string>>
  /** The asset's current model/platform (edit mode), shown even if archived. */
  current?: { model?: { id: string; name: string }; platform?: { id: string; name: string } | null }
  platformHint?: string
  disabled?: boolean
}>()
const deviceTypeId = defineModel<string | null | undefined>('deviceTypeId')
const manufacturerId = defineModel<string | null | undefined>('manufacturerId')
const modelId = defineModel<string | null | undefined>('modelId')
const platformId = defineModel<string | null | undefined>('platformId')

const deviceTypes = useDeviceTypes()
const manufacturers = useManufacturers(() => ({ deviceTypeId: deviceTypeId.value || undefined }))
const models = useModels(() => ({
  perPage: 100,
  ...(deviceTypeId.value ? { deviceTypeId: deviceTypeId.value } : {}),
  ...(manufacturerId.value ? { manufacturerId: manufacturerId.value } : {}),
}))
const platforms = usePlatforms(() => ({ deviceTypeId: deviceTypeId.value || undefined }))

const type = computed(() => deviceTypes.data.value?.find((t) => t.id === deviceTypeId.value))
const NONE = 'none'

const typeOptions = computed(() =>
  (deviceTypes.data.value ?? []).map((t) => ({ value: t.id, label: t.name })),
)
const manufacturerOptions = computed(() =>
  (manufacturers.data.value ?? []).map((m) => ({ value: m.id, label: m.name })),
)
const modelOptions = computed(() => {
  const rows = (models.data.value?.data ?? []).map((m) => ({ value: m.id, label: m.name }))
  const currentModel = props.current?.model
  if (
    currentModel &&
    !rows.some((r) => r.value === currentModel.id) &&
    modelId.value === currentModel.id
  ) {
    // Plain name while loading: the select keeps the text it first rendered.
    const settled = models.isSuccess.value && !models.isFetching.value
    rows.unshift({
      value: currentModel.id,
      label: settled ? `${currentModel.name} (archived)` : currentModel.name,
    })
  }
  return rows
})
const platformOptions = computed(() => {
  const rows = (platforms.data.value ?? []).map((p) => ({ value: p.id, label: p.name }))
  const currentPlatform = props.current?.platform
  if (
    currentPlatform &&
    !rows.some((r) => r.value === currentPlatform.id) &&
    platformId.value === currentPlatform.id
  ) {
    const settled = platforms.isSuccess.value && !platforms.isFetching.value
    rows.unshift({
      value: currentPlatform.id,
      label: settled ? `${currentPlatform.name} (archived)` : currentPlatform.name,
    })
  }
  return [{ value: NONE, label: 'Not set yet' }, ...rows]
})

const platformModel = computed<string>({
  get: () => platformId.value ?? NONE,
  set: (value) => {
    platformId.value = value === NONE ? null : value
  },
})

function setType(value: string | null | undefined) {
  if (value === deviceTypeId.value) return
  deviceTypeId.value = value
  manufacturerId.value = null
  modelId.value = null
  platformId.value = null
}
function setManufacturer(value: string | null | undefined) {
  if (value === manufacturerId.value) return
  manufacturerId.value = value
  modelId.value = null
}
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2 md:items-end">
    <UiField label="Device type" :error="errors?.deviceTypeId">
      <UiSelect
        :model-value="deviceTypeId"
        :options="typeOptions"
        :disabled="disabled"
        placeholder="Choose a device type…"
        @update:model-value="setType"
      />
    </UiField>
    <UiField label="Manufacturer" :error="errors?.manufacturerId">
      <UiSelect
        :model-value="manufacturerId"
        :options="manufacturerOptions"
        :disabled="disabled || !deviceTypeId"
        :placeholder="deviceTypeId ? 'Choose a manufacturer…' : 'Choose the device type first'"
        @update:model-value="setManufacturer"
      />
    </UiField>
    <UiField label="Model" :error="errors?.modelId">
      <UiSelect
        v-model="modelId"
        :options="modelOptions"
        :disabled="disabled || !manufacturerId"
        :placeholder="manufacturerId ? 'Choose a model…' : 'Choose the manufacturer first'"
      />
    </UiField>
    <UiField
      v-if="type?.requiresPlatform"
      label="Platform"
      optional
      :hint="platformHint ?? 'The user confirms the installed platform when they accept.'"
      :error="errors?.platformId"
    >
      <UiSelect v-model="platformModel" :options="platformOptions" :disabled="disabled" />
    </UiField>
  </div>
</template>
