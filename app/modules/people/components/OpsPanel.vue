<script setup lang="ts">
import { Lock, Save } from '@lucide/vue'
import { describeError, isApiError } from '~/lib/api'
import type { Page, UserSummary } from '~/types/api'
import { peopleKeys, requestPath } from '../api'
import type { PeopleRequestDetail, Priority, UpdatePeopleRequest } from '../api/types'
import { isClosed, PRIORITY_OPTIONS } from '../constants'

/**
 * People Ops controls (SCREENS §7.4): assignee and priority selects (saved on change) and the
 * internal note, which only People Ops and it_admin ever see.
 */
const props = defineProps<{ request: PeopleRequestDetail }>()

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()

const team = useQuery({
  queryKey: ['people', 'ops-team'],
  queryFn: ({ signal }) =>
    api.get<Page<UserSummary>>('/users', { role: 'people_ops', perPage: 100 }, { signal }),
  staleTime: 10 * 60_000,
})

const UNASSIGNED = 'none'
const assigneeOptions = computed(() => [
  { value: UNASSIGNED, label: 'Unassigned' },
  ...(team.data.value?.data ?? []).map((user) => ({ value: user.id, label: user.displayName })),
])
const assignee = ref<string>(UNASSIGNED)
const priority = ref<Priority>('normal')
const note = ref('')
const noteError = ref<string | null>(null)
const saving = ref<string | null>(null)

watch(
  () => props.request,
  (request) => {
    assignee.value = request.assignee?.id ?? UNASSIGNED
    priority.value = request.priority
    note.value = request.internalNote ?? ''
  },
  { immediate: true },
)

const canEditFields = computed(() => props.request.availableActions.includes('edit'))
const canEditInternal = computed(() => props.request.availableActions.includes('edit_internal'))

async function patch(field: string, body: UpdatePeopleRequest, message: string) {
  saving.value = field
  try {
    await api.patch(requestPath(props.request.id), { ...body, version: props.request.version })
    toast.success(message)
  } catch (error) {
    if (field === 'note' && isApiError(error) && error.status === 422) {
      noteError.value = error.fieldError('internalNote') ?? error.detail ?? error.title
    } else {
      toast.error(describeError(error))
    }
  } finally {
    saving.value = null
    await queryClient.invalidateQueries({ queryKey: peopleKeys.requests.module })
  }
}

function onAssignee(value: string | null | undefined) {
  if (!value || value === (props.request.assignee?.id ?? UNASSIGNED)) return
  const name = assigneeOptions.value.find((option) => option.value === value)?.label
  void patch(
    'assignee',
    { assigneeId: value === UNASSIGNED ? null : value },
    value === UNASSIGNED ? 'Request unassigned.' : `Assigned to ${name}.`,
  )
}

function onPriority(value: Priority | null | undefined) {
  if (!value || value === props.request.priority) return
  void patch('priority', { priority: value }, 'Priority changed.')
}

function saveNote() {
  noteError.value = null
  void patch('note', { internalNote: note.value.trim() || null }, 'Internal note saved.')
}
</script>

<template>
  <section
    aria-labelledby="ops-heading"
    class="grid gap-4 rounded-xl border border-rule bg-well p-4"
    data-testid="ops-panel"
  >
    <h2 id="ops-heading" class="flex items-center gap-2 text-md font-[650]">
      <Lock class="size-4 text-ink-subtle" aria-hidden="true" />
      People Ops only
    </h2>
    <div class="grid gap-4 sm:grid-cols-2">
      <UiField label="Assignee">
        <UiSelect
          :model-value="assignee"
          :options="assigneeOptions"
          :disabled="!canEditInternal || saving === 'assignee'"
          aria-label="Assignee"
          @update:model-value="onAssignee"
        />
      </UiField>
      <UiField
        label="Priority"
        :hint="isClosed(request.status) ? 'Closed requests keep their priority.' : undefined"
      >
        <UiSelect
          :model-value="priority"
          :options="PRIORITY_OPTIONS"
          :disabled="!canEditFields || saving === 'priority'"
          aria-label="Priority"
          @update:model-value="onPriority"
        />
      </UiField>
    </div>
    <UiField
      label="Internal note"
      hint="Only People Ops sees this note. It is never part of an email."
      :error="noteError"
    >
      <UiTextarea v-model="note" :rows="3" :maxlength="4000" :disabled="!canEditInternal" />
    </UiField>
    <div class="flex justify-end">
      <UiButton
        size="sm"
        :icon="Save"
        :loading="saving === 'note'"
        :disabled="!canEditInternal || note.trim() === (request.internalNote ?? '')"
        @click="saveNote"
      >
        Save note
      </UiButton>
    </div>
  </section>
</template>
