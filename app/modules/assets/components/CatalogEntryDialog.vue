<script setup lang="ts">
import { describeError, isApiError } from '~/lib/api'
import { assetKeys, useDeviceTypes } from '../api'

/**
 * New / edit manufacturer or platform (SCREENS §6.8): name + the device types it makes / runs on.
 * Removing a device type that models or assets still use is refused by the API (422, shown on the
 * field).
 */
const props = defineProps<{
  kind: 'manufacturers' | 'platforms'
  entry: { id: string; name: string; deviceTypeIds: string[] } | null
}>()
const open = defineModel<boolean>('open', { default: false })

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const deviceTypes = useDeviceTypes()

const noun = computed(() => (props.kind === 'manufacturers' ? 'manufacturer' : 'platform'))
const name = ref('')
const selected = ref<string[]>([])
const errors = ref<Record<string, string | undefined>>({})
const formError = ref<string | null>(null)
const saving = ref(false)

watch(open, (value) => {
  if (!value) return
  name.value = props.entry?.name ?? ''
  selected.value = [...(props.entry?.deviceTypeIds ?? [])]
  errors.value = {}
  formError.value = null
})

function toggle(id: string, on: boolean | 'indeterminate') {
  selected.value =
    on === true ? [...new Set([...selected.value, id])] : selected.value.filter((v) => v !== id)
}

async function save() {
  errors.value = {}
  formError.value = null
  if (!name.value.trim()) {
    errors.value = { name: `Enter the ${noun.value}'s name.` }
    return
  }
  saving.value = true
  const body = { name: name.value.trim(), deviceTypeIds: selected.value }
  try {
    if (props.entry) await api.patch(`/assets/catalog/${props.kind}/${props.entry.id}`, body)
    else await api.post(`/assets/catalog/${props.kind}`, body)
    await queryClient.invalidateQueries({ queryKey: assetKeys.module })
    toast.success(props.entry ? `${body.name} saved.` : `${body.name} added.`)
    open.value = false
  } catch (error) {
    if (isApiError(error) && error.isValidationError) {
      errors.value = {
        name: error.fieldError('name') ?? undefined,
        deviceTypeIds: error.fieldError('deviceTypeIds') ?? undefined,
      }
      return
    }
    formError.value = describeError(error).detail ?? describeError(error).title
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    :title="entry ? `Edit ${entry.name}` : `New ${noun}`"
    :description="
      kind === 'manufacturers'
        ? 'Models can only use the device types their manufacturer makes.'
        : 'Users see the platform when they accept a device of these types.'
    "
    size="sm"
  >
    <form :id="`catalog-${kind}-form`" class="grid gap-4" novalidate @submit.prevent="save">
      <UiField label="Name" :error="errors.name"><UiInput v-model="name" /></UiField>
      <UiField
        :label="kind === 'manufacturers' ? 'Makes' : 'Runs on'"
        group
        :error="errors.deviceTypeIds"
      >
        <div class="grid gap-2 sm:grid-cols-2">
          <UiCheckbox
            v-for="type in deviceTypes.data.value ?? []"
            :key="type.id"
            :label="type.name"
            :model-value="selected.includes(type.id)"
            @update:model-value="(value) => toggle(type.id, value)"
          />
        </div>
      </UiField>
      <p v-if="formError" role="alert" class="text-sm text-st-negative">{{ formError }}</p>
    </form>
    <template #footer>
      <UiButton variant="secondary" @click="open = false">Cancel</UiButton>
      <UiButton type="submit" :form="`catalog-${kind}-form`" variant="primary" :loading="saving">{{
        entry ? `Save ${noun}` : `Add ${noun}`
      }}</UiButton>
    </template>
  </UiDialog>
</template>
