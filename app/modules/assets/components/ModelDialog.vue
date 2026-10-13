<script setup lang="ts">
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import { assetKeys, useDeviceTypes, useManufacturers } from '../api'
import type { AssetModelDto } from '../api/types'
import { STORAGE_COLOUR_TYPES } from '../constants'

/**
 * New / edit model (SCREENS §6.7). The manufacturer list follows the device type (a model's type
 * must be one its manufacturer makes, SPEC §4.4). Phones and tablets are named from base name,
 * storage and colour: "Marlowe X5" + 128 + "Midnight" → "Marlowe X5 128 GB Midnight".
 * A model in use keeps its manufacturer and device type.
 */
const props = defineProps<{ model: AssetModelDto | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [model: AssetModelDto] }>()

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const deviceTypes = useDeviceTypes()
const formError = ref<string | null>(null)

const schema = toTypedSchema(
  z.object({
    deviceTypeId: z.string({ error: 'Choose a device type.' }).min(1, 'Choose a device type.'),
    manufacturerId: z.string({ error: 'Choose a manufacturer.' }).min(1, 'Choose a manufacturer.'),
    name: z
      .string({ error: 'Enter the model name.' })
      .trim()
      .min(1, 'Enter the model name.')
      .max(120),
    storageGb: z.number().int().min(1, 'Use a whole number of GB.').nullable().optional(),
    color: z.string().max(40).nullable().optional(),
  }),
)
const { defineField, errors, handleSubmit, isSubmitting, resetForm, setErrors } = useForm({
  validationSchema: schema,
})
const [deviceTypeId] = defineField('deviceTypeId')
const [manufacturerId] = defineField('manufacturerId')
const [name] = defineField('name')
const [storageGb] = defineField('storageGb')
const [color] = defineField('color')

const manufacturers = useManufacturers(() => ({ deviceTypeId: deviceTypeId.value || undefined }))
const typeCode = computed(
  () => deviceTypes.data.value?.find((t) => t.id === deviceTypeId.value)?.code ?? null,
)
const named = computed(() => STORAGE_COLOUR_TYPES.includes(typeCode.value ?? ''))
const locked = computed(() => (props.model?.assetCount ?? 0) > 0)

/** "Marlowe X5 128 GB Midnight" → base "Marlowe X5" when the suffix matches storage and colour. */
function baseName(model: AssetModelDto): string {
  const suffix = [model.storageGb ? `${model.storageGb} GB` : null, model.color]
    .filter(Boolean)
    .join(' ')
  return suffix && model.name.endsWith(` ${suffix}`)
    ? model.name.slice(0, -suffix.length - 1)
    : model.name
}
const fullName = computed(() =>
  named.value
    ? [name.value?.trim(), storageGb.value ? `${storageGb.value} GB` : null, color.value?.trim()]
        .filter(Boolean)
        .join(' ')
    : (name.value?.trim() ?? ''),
)

watch(open, (value) => {
  if (!value) return
  formError.value = null
  const model = props.model
  resetForm({
    values: model
      ? {
          deviceTypeId: model.deviceType.id,
          manufacturerId: model.manufacturer.id,
          name: STORAGE_COLOUR_TYPES.includes(model.deviceType.code) ? baseName(model) : model.name,
          storageGb: model.storageGb,
          color: model.color,
        }
      : { storageGb: null, color: null },
  })
})
watch(deviceTypeId, (value, previous) => {
  if (previous && value !== previous && !props.model) manufacturerId.value = undefined
})

const typeOptions = computed(() =>
  (deviceTypes.data.value ?? []).map((t) => ({ value: t.id, label: t.name })),
)
const manufacturerOptions = computed(() =>
  (manufacturers.data.value ?? []).map((m) => ({ value: m.id, label: m.name })),
)

const save = handleSubmit(async (values) => {
  formError.value = null
  const body = {
    name: fullName.value,
    manufacturerId: values.manufacturerId,
    deviceTypeId: values.deviceTypeId,
    storageGb: values.storageGb ?? null,
    color: values.color?.trim() || null,
  }
  try {
    const saved = props.model
      ? await api.patch<AssetModelDto>(`/assets/catalog/models/${props.model.id}`, body)
      : await api.post<AssetModelDto>('/assets/catalog/models', body)
    await queryClient.invalidateQueries({ queryKey: assetKeys.module })
    toast.success(props.model ? `${saved.name} saved.` : `${saved.name} added to the catalogue.`)
    open.value = false
    emit('saved', saved)
  } catch (error) {
    if (isApiError(error) && error.isValidationError) {
      setErrors(error.fieldErrors)
      return
    }
    formError.value = describeError(error).detail ?? describeError(error).title
  }
})
</script>

<template>
  <UiDialog
    v-model:open="open"
    :title="model ? `Edit ${model.name}` : 'New model'"
    :description="
      locked
        ? `In use by ${model?.assetCount} assets: the manufacturer and device type stay as they are.`
        : 'Models appear in the new-asset form for their device type.'
    "
    size="md"
  >
    <form id="model-form" class="grid gap-4 md:grid-cols-2" novalidate @submit="save">
      <UiField label="Device type" :error="errors.deviceTypeId">
        <UiSelect v-model="deviceTypeId" :options="typeOptions" :disabled="locked" />
      </UiField>
      <UiField
        label="Manufacturer"
        :error="errors.manufacturerId"
        :hint="deviceTypeId ? undefined : 'Choose the device type first.'"
      >
        <UiSelect
          v-model="manufacturerId"
          :options="manufacturerOptions"
          :disabled="locked || !deviceTypeId"
        />
      </UiField>
      <UiField
        :label="named ? 'Base name' : 'Name'"
        class="md:col-span-2"
        :hint="named ? 'Without storage and colour, e.g. Marlowe X5.' : undefined"
        :error="errors.name"
      >
        <UiInput v-model="name" autocomplete="off" />
      </UiField>
      <template v-if="named">
        <UiField label="Storage" optional :error="errors.storageGb">
          <UiInput
            :model-value="storageGb ?? ''"
            type="number"
            suffix="GB"
            inputmode="numeric"
            @update:model-value="(v) => (storageGb = v === '' || v === null ? null : Number(v))"
          />
        </UiField>
        <UiField label="Colour" optional :error="errors.color">
          <UiInput v-model="color" autocomplete="off" />
        </UiField>
        <p class="text-sm text-ink-muted md:col-span-2">
          Shown as <span class="font-semibold text-ink">{{ fullName || '…' }}</span>
        </p>
      </template>
      <p v-if="formError" role="alert" class="text-sm text-st-negative md:col-span-2">
        {{ formError }}
      </p>
    </form>
    <template #footer>
      <UiButton variant="secondary" @click="open = false">Cancel</UiButton>
      <UiButton type="submit" form="model-form" variant="primary" :loading="isSubmitting">{{
        model ? 'Save model' : 'Add model'
      }}</UiButton>
    </template>
  </UiDialog>
</template>
