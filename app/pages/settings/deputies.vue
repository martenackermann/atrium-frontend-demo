<script setup lang="ts">
import { Info, Pencil, Plus, Trash2, UserRoundCheck } from '@lucide/vue'
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import { coreKeys } from '~/lib/query/core'
import type { CreateDeputy, DeputiesResponse, DeputyDto, UserRef } from '~/types/api'
import type { DataTableColumn } from '~/types/ui'

/**
 * Deputies (SCREENS §2 /settings/deputies, SPEC §2.5): "My deputies" (add/edit/remove; managers
 * and executives only) and "I'm deputy for" (read-only). `?add=1` opens the dialog (⌘K command).
 */
definePageMeta({ title: 'Deputies' })

const api = useApi()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const queryClient = useQueryClient()
const route = useRoute()
const router = useRouter()

const canName = computed(() => auth.can(['manager', 'executive']))

const deputies = useQuery({
  queryKey: coreKeys.deputies,
  queryFn: ({ signal }) => api.get<DeputiesResponse>('/me/deputies', undefined, { signal }),
})

const windowText = (row: DeputyDto) =>
  row.validFrom || row.validTo
    ? `${row.validFrom ? formatDate(row.validFrom) : 'Now'} – ${row.validTo ? formatDate(row.validTo) : 'until removed'}`
    : 'Permanent, until removed'

const columns: DataTableColumn<DeputyDto>[] = [
  {
    key: 'deputy',
    label: 'Deputy',
    required: true,
    value: (row) => row.deputy.displayName,
    mobile: 'title',
  },
  { key: 'window', label: 'Window', value: windowText, mobile: 'meta' },
  { key: 'state', label: 'State', width: '140px', mobile: 'status' },
  { key: 'note', label: 'Note', value: (row) => row.note ?? '—', mobile: 'meta' },
  {
    key: 'actions',
    label: 'Actions',
    align: 'right',
    width: '120px',
    required: true,
    mobile: 'hidden',
  },
]
const asDeputyColumns: DataTableColumn<DeputyDto>[] = [
  {
    key: 'principal',
    label: 'Deputy for',
    required: true,
    value: (row) => row.principal.displayName,
    mobile: 'title',
  },
  { key: 'window', label: 'Window', value: windowText, mobile: 'meta' },
  { key: 'state', label: 'State', width: '140px', mobile: 'status' },
  { key: 'note', label: 'Note', value: (row) => row.note ?? '—', mobile: 'meta' },
]

// Add / edit dialog ------------------------------------------------------------------------------
const dialogOpen = ref(false)
const editing = ref<DeputyDto | null>(null)
const formError = ref<string | null>(null)

const schema = toTypedSchema(
  z
    .object({
      deputy: z
        .custom<UserRef | null>()
        .refine((value) => Boolean(value), 'Choose who stands in for you.'),
      range: z.object({ start: z.string().nullable(), end: z.string().nullable() }),
      note: z.string().max(200, 'Keep the note under 200 characters.').nullable(),
    })
    .refine(
      (value) => !value.range.start || !value.range.end || value.range.end >= value.range.start,
      {
        message: 'The end date must be on or after the start date.',
        path: ['range'],
      },
    ),
)
const { defineField, errors, handleSubmit, isSubmitting, resetForm, setFieldError } = useForm({
  validationSchema: schema,
})
const [deputy] = defineField<'deputy', UserRef | null>('deputy')
const [range] = defineField<'range', { start: string | null; end: string | null }>('range')
const [note] = defineField('note')

function openDialog(row: DeputyDto | null = null) {
  editing.value = row
  formError.value = null
  resetForm({
    values: {
      deputy: row?.deputy ?? null,
      range: { start: row?.validFrom ?? null, end: row?.validTo ?? null },
      note: row?.note ?? null,
    },
  })
  dialogOpen.value = true
}

watch(
  () => route.query.add,
  (value) => {
    if (value === '1' && canName.value) {
      openDialog()
      void router.replace({ query: { ...route.query, add: undefined } })
    }
  },
  { immediate: true },
)

const save = handleSubmit(async (values) => {
  formError.value = null
  const body: Omit<CreateDeputy, 'deputyId'> = {
    validFrom: values.range.start,
    validTo: values.range.end,
    note: values.note?.trim() || null,
  }
  try {
    if (editing.value) {
      await api.patch(`/me/deputies/${editing.value.id}`, body)
      toast.success('Deputy updated.')
    } else {
      await api.post('/me/deputies', { ...body, deputyId: values.deputy!.id })
      toast.success(`${values.deputy!.displayName} is now your deputy.`)
    }
    dialogOpen.value = false
    await queryClient.invalidateQueries({ queryKey: coreKeys.deputies })
  } catch (error) {
    if (isApiError(error) && error.isValidationError) {
      const map: Record<string, 'deputy' | 'range' | 'note'> = {
        deputyId: 'deputy',
        validFrom: 'range',
        validTo: 'range',
        note: 'note',
      }
      for (const [path, messages] of Object.entries(error.fieldErrors)) {
        const field = map[path]
        if (field) setFieldError(field, messages[0])
        else formError.value = messages[0] ?? null
      }
      return
    }
    formError.value = describeError(error).detail ?? describeError(error).title
  }
})

async function remove(row: DeputyDto) {
  const ok = await confirm({
    title: `Remove ${row.deputy.displayName} as deputy?`,
    description: 'They can no longer approve requests for you. Decisions they already made stay.',
    confirmLabel: 'Remove deputy',
    destructive: true,
  })
  if (!ok) return
  try {
    await api.delete(`/me/deputies/${row.id}`)
    toast.success('Deputy removed.')
    await queryClient.invalidateQueries({ queryKey: coreKeys.deputies })
  } catch (error) {
    toast.error(describeError(error))
  }
}
</script>

<template>
  <PageBody>
    <PageHeader
      title="Deputies"
      subtitle="Who approves for you while you're away, and whom you stand in for."
    >
      <template v-if="canName" #actions>
        <UiButton variant="primary" :icon="Plus" @click="openDialog()">Add deputy</UiButton>
      </template>
    </PageHeader>

    <div class="mt-6 flex gap-3 rounded-lg border border-rule bg-well px-4 py-3 text-base">
      <Info class="mt-0.5 size-4 flex-none text-ink-muted" aria-hidden="true" />
      <p>
        Deputies can approve training and travel requests for you during the window. They can't
        approve their own requests.
      </p>
    </div>

    <section class="mt-8 grid gap-3" aria-labelledby="mine-heading">
      <h2 id="mine-heading" class="text-lg font-[650] tracking-heading">My deputies</h2>
      <DataTable
        :columns="columns"
        :rows="deputies.data.value?.asPrincipal"
        :loading="deputies.isPending.value"
        :error="deputies.error.value"
        noun="deputies"
        storage-key="deputies"
        caption="My deputies"
        @retry="deputies.refetch()"
      >
        <template #cell-state="{ row }"
          ><StatusBadge enum="deputyState" :value="row.state"
        /></template>
        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-1">
            <UiIconButton
              :icon="Pencil"
              :label="`Edit ${row.deputy.displayName}`"
              @click="openDialog(row)"
            />
            <UiIconButton
              :icon="Trash2"
              :label="`Remove ${row.deputy.displayName}`"
              @click="remove(row)"
            />
          </div>
        </template>
        <template #empty>
          <EmptyState
            :icon="UserRoundCheck"
            compact
            :title="canName ? 'You haven\'t named a deputy' : 'No deputies'"
            :description="
              canName
                ? 'Add one before you go on leave.'
                : 'Only managers and executives can name deputies.'
            "
          >
            <UiButton v-if="canName" variant="secondary" :icon="Plus" @click="openDialog()"
              >Add deputy</UiButton
            >
          </EmptyState>
        </template>
      </DataTable>
    </section>

    <section class="mt-10 grid gap-3" aria-labelledby="theirs-heading">
      <h2 id="theirs-heading" class="text-lg font-[650] tracking-heading">I'm deputy for</h2>
      <DataTable
        :columns="asDeputyColumns"
        :rows="deputies.data.value?.asDeputy"
        :loading="deputies.isPending.value"
        :error="deputies.error.value"
        noun="deputyships"
        storage-key="deputy-for"
        caption="I'm deputy for"
        :empty="{
          title: 'Nobody has named you as deputy',
          description:
            'When someone does, you get an email and their requests appear in your approvals.',
        }"
        @retry="deputies.refetch()"
      >
        <template #cell-state="{ row }"
          ><StatusBadge enum="deputyState" :value="row.state"
        /></template>
      </DataTable>
    </section>

    <UiDialog
      v-model:open="dialogOpen"
      :title="editing ? `Edit ${editing.deputy.displayName}` : 'Add a deputy'"
      description="Leave the dates empty for a permanent deputy."
    >
      <form id="deputy-form" class="grid gap-4" novalidate @submit="save">
        <UiField label="Deputy" :error="errors.deputy">
          <UserPicker
            v-model="deputy"
            :disabled="Boolean(editing)"
            :exclude="auth.me ? [auth.me.id] : []"
          />
        </UiField>
        <UiField label="Window" optional hint="From and to, both inclusive." :error="errors.range">
          <UiDateRangePicker v-model="range" />
        </UiField>
        <UiField label="Note" optional :error="errors.note">
          <UiTextarea v-model="note" :maxlength="200" :rows="2" />
        </UiField>
        <p v-if="formError" role="alert" class="text-sm text-st-negative">{{ formError }}</p>
      </form>
      <template #footer>
        <UiButton variant="secondary" @click="dialogOpen = false">Cancel</UiButton>
        <UiButton variant="primary" type="submit" form="deputy-form" :loading="isSubmitting">
          {{ editing ? 'Save changes' : 'Add deputy' }}
        </UiButton>
      </template>
    </UiDialog>
  </PageBody>
</template>
