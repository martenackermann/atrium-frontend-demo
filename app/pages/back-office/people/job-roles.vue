<script setup lang="ts">
import { Pencil, Plus } from '@lucide/vue'
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import { peopleKeys, useJobRoles } from '~/modules/people/api'
import type { JobRoleDto } from '~/modules/people/api/types'
import type { DataTableColumn } from '~/types/ui'

/**
 * `/back-office/people/job-roles` (SCREENS §7.5, owned by A4): the job-role catalogue — name,
 * category, active; New / Edit dialog; deactivate (inactive roles can't be chosen any more).
 */
definePageMeta({ title: 'Job roles', access: ['people_ops', 'it_admin'] })

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const roles = useJobRoles(true)

const search = ref('')
const rows = computed(() => {
  const term = search.value.trim().toLowerCase()
  return (roles.data.value ?? []).filter(
    (role) => !term || `${role.name} ${role.category ?? ''}`.toLowerCase().includes(term),
  )
})

const columns: DataTableColumn<JobRoleDto>[] = [
  { key: 'name', label: 'Name', required: true, mobile: 'title' },
  { key: 'category', label: 'Category', value: (row) => row.category ?? '—', mobile: 'meta' },
  { key: 'active', label: 'Status', width: '140px', mobile: 'status' },
  {
    key: 'actions',
    label: 'Actions',
    align: 'right',
    width: '100px',
    required: true,
    mobile: 'hidden',
  },
]

const dialogOpen = ref(false)
const editing = ref<JobRoleDto | null>(null)
const formError = ref<string | null>(null)
const schema = toTypedSchema(
  z.object({
    name: z.string().trim().min(2, 'Use at least 2 characters.').max(100),
    category: z.string().max(80).nullable(),
    active: z.boolean(),
  }),
)
const { defineField, errors, handleSubmit, isSubmitting, resetForm, setFieldError } = useForm({
  validationSchema: schema,
})
const [name] = defineField('name')
const [category] = defineField('category')
const [active] = defineField<'active', boolean>('active')

function openDialog(role: JobRoleDto | null = null) {
  editing.value = role
  formError.value = null
  resetForm({
    values: {
      name: role?.name ?? '',
      category: role?.category ?? null,
      active: role?.active ?? true,
    },
  })
  dialogOpen.value = true
}

const save = handleSubmit(async (values) => {
  formError.value = null
  const body = {
    name: values.name.trim(),
    category: values.category?.trim() || null,
    active: values.active,
  }
  try {
    if (editing.value) {
      await api.patch(`/people/job-roles/${editing.value.id}`, body)
      toast.success('Job role saved.')
    } else {
      await api.post('/people/job-roles', body)
      toast.success(`${body.name} added.`)
    }
    dialogOpen.value = false
    await queryClient.invalidateQueries({ queryKey: peopleKeys.jobRoles.all })
  } catch (error) {
    if (isApiError(error) && error.isValidationError) {
      for (const [path, messages] of Object.entries(error.fieldErrors)) {
        if (path === 'name' || path === 'category') setFieldError(path, messages[0])
      }
      return
    }
    if (isApiError(error) && error.code === 'conflict') {
      setFieldError('name', error.detail ?? 'This name is taken.')
      return
    }
    formError.value = describeError(error).detail ?? describeError(error).title
  }
})

async function toggle(role: JobRoleDto) {
  try {
    await api.patch(`/people/job-roles/${role.id}`, { active: !role.active })
    toast.success(role.active ? `${role.name} deactivated.` : `${role.name} reactivated.`)
    await queryClient.invalidateQueries({ queryKey: peopleKeys.jobRoles.all })
  } catch (error) {
    toast.error(describeError(error))
  }
}
</script>

<template>
  <PageBody>
    <PageHeader
      title="Job roles"
      subtitle="The roles people requests can name. Deactivated roles stay on existing requests."
    >
      <template #actions>
        <UiButton variant="primary" :icon="Plus" @click="openDialog()">New job role</UiButton>
      </template>
    </PageHeader>

    <div class="mt-6 max-w-sm">
      <UiInput
        v-model="search"
        type="search"
        placeholder="Search roles"
        aria-label="Search roles"
      />
    </div>

    <DataTable
      class="mt-4"
      :columns="columns"
      :rows="rows"
      :loading="roles.isPending.value"
      :error="roles.error.value"
      noun="job roles"
      storage-key="job-roles"
      caption="Job roles"
      :empty="{ title: 'No job roles match', description: 'Try another name or add the role.' }"
      @retry="roles.refetch()"
    >
      <template #cell-active="{ row }">
        <span
          class="inline-flex h-[22px] items-center rounded-sm border px-2 text-meta"
          :class="
            row.active
              ? 'border-st-positive-line bg-st-positive-bg text-st-positive'
              : 'border-st-neutral-line bg-st-neutral-bg text-st-neutral'
          "
          >{{ row.active ? 'Active' : 'Inactive' }}</span
        >
      </template>
      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-1">
          <UiIconButton :icon="Pencil" :label="`Edit ${row.name}`" @click="openDialog(row)" />
          <UiButton size="sm" variant="ghost" @click="toggle(row)">{{
            row.active ? 'Deactivate' : 'Reactivate'
          }}</UiButton>
        </div>
      </template>
    </DataTable>

    <UiDialog
      v-model:open="dialogOpen"
      :title="editing ? `Edit ${editing.name}` : 'New job role'"
      description="Job roles appear in the people request form."
    >
      <form id="job-role-form" class="grid gap-4" novalidate @submit="save">
        <UiField label="Name" :error="errors.name">
          <UiInput v-model="name" :maxlength="100" />
        </UiField>
        <UiField label="Category" optional :error="errors.category">
          <UiInput v-model="category" :maxlength="80" />
        </UiField>
        <UiSwitch v-model="active" label="Active" description="Inactive roles can't be chosen." />
        <p v-if="formError" role="alert" class="text-sm text-st-negative">{{ formError }}</p>
      </form>
      <template #footer>
        <UiButton variant="secondary" @click="dialogOpen = false">Cancel</UiButton>
        <UiButton variant="primary" type="submit" form="job-role-form" :loading="isSubmitting">
          {{ editing ? 'Save changes' : 'Add job role' }}
        </UiButton>
      </template>
    </UiDialog>
  </PageBody>
</template>
