<script setup lang="ts">
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import { assetKeys } from '../api'
import type { DeviceTypeDto } from '../api/types'

/** New / edit device type (SCREENS §6.8): code, name, "requires platform", sort order. */
const props = defineProps<{ deviceType: DeviceTypeDto | null }>()
const open = defineModel<boolean>('open', { default: false })

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const formError = ref<string | null>(null)

const schema = toTypedSchema(
  z.object({
    code: z
      .string({ error: 'Enter a code.' })
      .trim()
      .min(2, 'Use at least 2 characters.')
      .max(40)
      .regex(
        /^[a-z][a-z0-9_]*$/,
        'Use lowercase letters, digits and underscores, e.g. docking_station.',
      ),
    name: z.string({ error: 'Enter a name.' }).trim().min(1, 'Enter a name.').max(120),
    requiresPlatform: z.boolean(),
    sortOrder: z.number({ error: 'Enter a number.' }).int().min(0),
  }),
)
const { defineField, errors, handleSubmit, isSubmitting, resetForm, setErrors } = useForm({
  validationSchema: schema,
})
const [code] = defineField('code')
const [name] = defineField('name')
const [requiresPlatform] = defineField('requiresPlatform')
const [sortOrder] = defineField('sortOrder')

watch(open, (value) => {
  if (!value) return
  formError.value = null
  const t = props.deviceType
  resetForm({
    values: t
      ? { code: t.code, name: t.name, requiresPlatform: t.requiresPlatform, sortOrder: t.sortOrder }
      : { requiresPlatform: false, sortOrder: 100 },
  })
})

const save = handleSubmit(async (values) => {
  formError.value = null
  try {
    const saved = props.deviceType
      ? await api.patch<DeviceTypeDto>(
          `/assets/catalog/device-types/${props.deviceType.id}`,
          values,
        )
      : await api.post<DeviceTypeDto>('/assets/catalog/device-types', values)
    await queryClient.invalidateQueries({ queryKey: assetKeys.module })
    toast.success(props.deviceType ? `${saved.name} saved.` : `${saved.name} added.`)
    open.value = false
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
    :title="deviceType ? `Edit ${deviceType.name}` : 'New device type'"
    description="Device types group models and decide whether users pick a platform on accept."
    size="sm"
  >
    <form id="device-type-form" class="grid gap-4" novalidate @submit="save">
      <UiField label="Name" :error="errors.name"><UiInput v-model="name" /></UiField>
      <UiField label="Code" hint="Stable identifier, lowercase." :error="errors.code">
        <UiInput v-model="code" mono autocomplete="off" />
      </UiField>
      <UiField label="Sort order" hint="Lower numbers come first." :error="errors.sortOrder">
        <UiInput
          :model-value="sortOrder ?? ''"
          type="number"
          inputmode="numeric"
          @update:model-value="(v) => (sortOrder = v === '' || v === null ? undefined : Number(v))"
        />
      </UiField>
      <UiSwitch
        v-model="requiresPlatform"
        label="Requires a platform"
        description="The user chooses the installed platform when accepting the device."
      />
      <p v-if="formError" role="alert" class="text-sm text-st-negative">{{ formError }}</p>
    </form>
    <template #footer>
      <UiButton variant="secondary" @click="open = false">Cancel</UiButton>
      <UiButton type="submit" form="device-type-form" variant="primary" :loading="isSubmitting">{{
        deviceType ? 'Save device type' : 'Add device type'
      }}</UiButton>
    </template>
  </UiDialog>
</template>
