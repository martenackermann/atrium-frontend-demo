<script setup lang="ts">
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import { peopleKeys, requestPath } from '../api'
import type { PeopleRequestDetail, Priority, UpdatePeopleRequest } from '../api/types'
import { PRIORITY_OPTIONS, TYPE_META } from '../constants'

/**
 * Edit a people request (SPEC_RESOLUTIONS #24): the requester while it is open, People Ops until
 * it is closed. Sends `version` for optimistic locking (409 → reload).
 */
const props = defineProps<{ request: PeopleRequestDetail }>()
const open = defineModel<boolean>('open', { default: false })

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const formError = ref<string | null>(null)

const schema = toTypedSchema(
  z.object({
    title: z.string().trim().min(3, 'Use at least 3 characters.').max(140),
    priority: z.enum(['critical', 'high', 'normal', 'low']),
    effectiveDate: z.string({ error: 'Pick a date.' }).min(1, 'Pick a date.'),
    reason: z.string().max(2000).nullable(),
    furtherInformation: z.string().max(2000).nullable(),
    equipmentNotes: z.string().max(2000).nullable(),
  }),
)
const { defineField, errors, handleSubmit, isSubmitting, resetForm, setFieldError } = useForm({
  validationSchema: schema,
})
const [title] = defineField('title')
const [priority] = defineField<'priority', Priority>('priority')
const [effectiveDate] = defineField('effectiveDate')
const [reason] = defineField('reason')
const [furtherInformation] = defineField('furtherInformation')
const [equipmentNotes] = defineField('equipmentNotes')

watch(open, (value) => {
  if (!value) return
  formError.value = null
  resetForm({
    values: {
      title: props.request.title,
      priority: props.request.priority,
      effectiveDate: props.request.effectiveDate,
      reason: props.request.reason,
      furtherInformation: props.request.furtherInformation,
      equipmentNotes: props.request.equipmentNotes,
    },
  })
})

const save = handleSubmit(async (values) => {
  formError.value = null
  const body: UpdatePeopleRequest = {
    title: values.title,
    priority: values.priority,
    effectiveDate: values.effectiveDate,
    reason: values.reason?.trim() || null,
    furtherInformation: values.furtherInformation?.trim() || null,
    equipmentNotes: values.equipmentNotes?.trim() || null,
    version: props.request.version,
  }
  try {
    await api.patch(requestPath(props.request.id), body)
    toast.success('Request updated.')
    open.value = false
    await queryClient.invalidateQueries({ queryKey: peopleKeys.requests.module })
  } catch (error) {
    if (isApiError(error) && error.isValidationError) {
      for (const [path, messages] of Object.entries(error.fieldErrors)) {
        if (path in values) setFieldError(path as keyof typeof values, messages[0])
        else formError.value = messages[0] ?? null
      }
      return
    }
    if (isApiError(error) && error.code === 'version_conflict') {
      await queryClient.invalidateQueries({ queryKey: peopleKeys.requests.module })
    }
    formError.value = describeError(error).detail ?? describeError(error).title
  }
})
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Edit request"
    description="People Ops sees your changes right away."
    size="lg"
  >
    <form id="people-edit-form" class="grid gap-4" novalidate @submit="save">
      <UiField label="Title" :error="errors.title">
        <UiInput v-model="title" :maxlength="140" />
      </UiField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Priority" :error="errors.priority">
          <UiSelect v-model="priority" :options="PRIORITY_OPTIONS" />
        </UiField>
        <UiField :label="TYPE_META[request.type].effectiveLabel" :error="errors.effectiveDate">
          <UiDatePicker v-model="effectiveDate" />
        </UiField>
      </div>
      <UiField label="Reason" optional :error="errors.reason">
        <UiTextarea v-model="reason" :rows="3" :maxlength="2000" />
      </UiField>
      <UiField label="Further information" optional :error="errors.furtherInformation">
        <UiTextarea v-model="furtherInformation" :rows="2" :maxlength="2000" />
      </UiField>
      <UiField label="Equipment notes" optional :error="errors.equipmentNotes">
        <UiTextarea v-model="equipmentNotes" :rows="2" :maxlength="2000" />
      </UiField>
      <p v-if="formError" role="alert" class="text-sm text-st-negative">{{ formError }}</p>
    </form>
    <template #footer>
      <UiButton variant="secondary" @click="open = false">Cancel</UiButton>
      <UiButton variant="primary" type="submit" form="people-edit-form" :loading="isSubmitting">
        Save changes
      </UiButton>
    </template>
  </UiDialog>
</template>
