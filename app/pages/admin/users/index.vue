<script setup lang="ts">
import { Check, UserPlus } from '@lucide/vue'
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import { coreKeys } from '~/lib/query/core'
import type { AdminUserDto, AssignableRole, CreateAdminUser, Page, UserRef } from '~/types/api'
import type { DataTableColumn } from '~/types/ui'

/**
 * Admin · Users (SCREENS §2 /admin/users): filterable user table (q, role, department, active) and
 * the "New user" dialog. Row → /admin/users/{id}.
 */
definePageMeta({ title: 'Users', access: ['it_admin'] })

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const org = useOrg()

const list = useListQuery({
  filters: ['role', 'departmentId', 'active'],
  defaultSort: 'displayName',
})
const users = useQuery({
  queryKey: computed(() => coreKeys.adminUsers(list.apiQuery.value)),
  queryFn: ({ signal }) =>
    api.get<Page<AdminUserDto>>('/admin/users', list.apiQuery.value, { signal }),
  placeholderData: keepPreviousData,
})

const ASSIGNABLE: { value: AssignableRole; label: string }[] = [
  { value: 'executive', label: 'Executive' },
  { value: 'training_office', label: 'Training office' },
  { value: 'travel_desk', label: 'Travel desk' },
  { value: 'asset_admin', label: 'Asset admin' },
  { value: 'people_ops', label: 'People ops' },
  { value: 'news_editor', label: 'News editor' },
  { value: 'it_admin', label: 'IT admin' },
]
const roleLabel = (role: string) => ASSIGNABLE.find((item) => item.value === role)?.label ?? role
// Select items can't have an empty value (Reka), so "any" stands for "no filter".
const ANY = 'any'
const filterModel = (key: string) =>
  computed<string>({
    get: () => String(list.state.value.filters[key] || ANY),
    set: (value) => list.setFilter(key, value === ANY ? undefined : value),
  })
const roleFilter = filterModel('role')
const departmentFilter = filterModel('departmentId')
const activeFilter = filterModel('active')

const columns: DataTableColumn<AdminUserDto>[] = [
  { key: 'displayName', label: 'Name', sort: 'displayName', required: true, mobile: 'title' },
  { key: 'email', label: 'Email', mobile: 'meta' },
  {
    key: 'department',
    label: 'Department',
    value: (row) => row.department?.name ?? '—',
    mobile: 'meta',
  },
  { key: 'manager', label: 'Manager', value: (row) => row.manager?.displayName ?? '—' },
  { key: 'roles', label: 'Roles' },
  { key: 'isSiteManager', label: 'Site manager', align: 'center', width: '110px', hidden: true },
  { key: 'active', label: 'Active', align: 'center', width: '80px', mobile: 'status' },
  {
    key: 'lastLoginAt',
    label: 'Last sign-in',
    sort: 'lastLoginAt',
    value: (row) => (row.lastLoginAt ? formatAge(row.lastLoginAt) : 'Never'),
  },
]

// New user ---------------------------------------------------------------------------------------
const dialogOpen = ref(false)
const formError = ref<string | null>(null)
const schema = toTypedSchema(
  z.object({
    email: z.email('Enter a valid email address.'),
    firstName: z.string().trim().min(1, 'Enter a first name.'),
    lastName: z.string().trim().min(1, 'Enter a last name.'),
    jobTitle: z.string().optional(),
    departmentId: z.string().nullable().optional(),
    siteId: z.string().nullable().optional(),
    costCenterId: z.string({ error: 'Choose a cost centre.' }).min(1, 'Choose a cost centre.'),
    manager: z.custom<UserRef | null>().optional(),
    roles: z.array(z.string()),
    initialPassword: z.string().min(8, 'Use at least 8 characters.'),
  }),
)
const { defineField, errors, handleSubmit, isSubmitting, resetForm, setErrors } = useForm({
  validationSchema: schema,
})
const [email] = defineField('email')
const [firstName] = defineField('firstName')
const [lastName] = defineField('lastName')
const [jobTitle] = defineField('jobTitle')
const [departmentId] = defineField('departmentId')
const [siteId] = defineField('siteId')
const [costCenterId] = defineField('costCenterId')
const [manager] = defineField<'manager', UserRef | null>('manager')
const [roles] = defineField('roles')
const [initialPassword] = defineField('initialPassword')

function openNew() {
  formError.value = null
  resetForm({ values: { roles: [], manager: null, departmentId: null, siteId: null } })
  dialogOpen.value = true
}

function toggleRole(role: string, on: boolean | 'indeterminate') {
  const current = roles.value ?? []
  roles.value = on === true ? [...current, role] : current.filter((item) => item !== role)
}

const create = handleSubmit(async (values) => {
  formError.value = null
  const body: CreateAdminUser = {
    email: values.email,
    firstName: values.firstName,
    lastName: values.lastName,
    jobTitle: values.jobTitle?.trim() || null,
    departmentId: values.departmentId ?? null,
    siteId: values.siteId ?? null,
    costCenterId: values.costCenterId,
    managerId: values.manager?.id ?? null,
    roles: values.roles as AssignableRole[],
    initialPassword: values.initialPassword,
  }
  try {
    const user = await api.post<AdminUserDto>('/admin/users', body)
    toast.success(`${user.displayName} can now sign in.`)
    dialogOpen.value = false
    await queryClient.invalidateQueries({ queryKey: ['core', 'admin', 'users'] })
    await navigateTo(`/admin/users/${user.id}`)
  } catch (error) {
    if (isApiError(error) && error.isValidationError) {
      const { managerId, ...rest } = error.fieldErrors
      setErrors({ ...rest, ...(managerId ? { manager: managerId } : {}) })
      return
    }
    formError.value = describeError(error).detail ?? describeError(error).title
  }
})
</script>

<template>
  <PageBody wide>
    <PageHeader title="Users" subtitle="Accounts, reporting lines and roles.">
      <template #actions>
        <UiButton variant="primary" :icon="UserPlus" @click="openNew">New user</UiButton>
      </template>
    </PageHeader>

    <DataTable
      class="mt-6"
      :columns="columns"
      :rows="users.data.value?.data"
      :meta="users.data.value?.meta"
      :loading="users.isPending.value"
      :error="users.error.value"
      :list="list"
      :row-to="(row) => `/admin/users/${row.id}`"
      noun="users"
      storage-key="admin-users"
      search-placeholder="Search name, email or number"
      caption="Users"
      @retry="users.refetch()"
    >
      <template #filters>
        <UiSelect
          v-model="roleFilter"
          size="sm"
          aria-label="Role"
          :options="[
            { value: ANY, label: 'Any role' },
            { value: 'manager', label: 'Manager' },
            ...ASSIGNABLE,
          ]"
          class="w-40"
        />
        <UiSelect
          v-model="departmentFilter"
          size="sm"
          aria-label="Department"
          :options="[{ value: ANY, label: 'Any department' }, ...org.departmentOptions.value]"
          class="w-52"
        />
        <UiSelect
          v-model="activeFilter"
          size="sm"
          aria-label="Active"
          :options="[
            { value: ANY, label: 'Active and inactive' },
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]"
          class="w-44"
        />
      </template>
      <template #cell-roles="{ row }">
        <span class="flex flex-wrap gap-1">
          <UiTag v-if="row.isManager" tone="neutral">Manager</UiTag>
          <UiTag v-for="role in row.roles" :key="role" tone="neutral">{{ roleLabel(role) }}</UiTag>
        </span>
      </template>
      <template #cell-isSiteManager="{ row }">
        <Check v-if="row.isSiteManager" class="mx-auto size-4" aria-label="Site manager" />
      </template>
      <template #cell-active="{ row }">
        <UiTag :tone="row.active ? 'positive' : 'neutral'">{{
          row.active ? 'Active' : 'Inactive'
        }}</UiTag>
      </template>
      <template #empty>
        <EmptyState
          compact
          title="No users match these filters."
          description="Change or clear the filters to see more."
        />
      </template>
    </DataTable>

    <UiDialog
      v-model:open="dialogOpen"
      title="New user"
      description="They sign in with this email and the initial password."
      size="lg"
    >
      <form id="new-user-form" class="grid gap-4 md:grid-cols-2" novalidate @submit="create">
        <UiField label="First name" :error="errors.firstName"
          ><UiInput v-model="firstName"
        /></UiField>
        <UiField label="Last name" :error="errors.lastName"><UiInput v-model="lastName" /></UiField>
        <UiField label="Email" class="md:col-span-2" :error="errors.email">
          <UiInput v-model="email" type="email" placeholder="first.last@example.com" />
        </UiField>
        <UiField label="Job title" optional :error="errors.jobTitle"
          ><UiInput v-model="jobTitle"
        /></UiField>
        <UiField label="Department" optional :error="errors.departmentId">
          <UiSelect v-model="departmentId" :options="org.departmentOptions.value" />
        </UiField>
        <UiField label="Site" optional :error="errors.siteId">
          <UiSelect v-model="siteId" :options="org.siteOptions.value" />
        </UiField>
        <UiField label="Cost centre" :error="errors.costCenterId">
          <UiSelect v-model="costCenterId" :options="org.costCenterOptions.value" />
        </UiField>
        <UiField label="Manager" optional class="md:col-span-2" :error="errors.manager">
          <UserPicker v-model="manager" />
        </UiField>
        <UiField
          label="Roles"
          optional
          group
          class="md:col-span-2"
          hint="Everyone is an employee; managers come from reporting lines."
          :error="errors.roles"
        >
          <div class="grid gap-2 sm:grid-cols-2">
            <UiCheckbox
              v-for="role in ASSIGNABLE"
              :key="role.value"
              :label="role.label"
              :model-value="(roles ?? []).includes(role.value)"
              @update:model-value="(value) => toggleRole(role.value, value)"
            />
          </div>
        </UiField>
        <UiField
          label="Initial password"
          class="md:col-span-2"
          hint="At least 8 characters. Share it securely."
          :error="errors.initialPassword"
        >
          <UiInput v-model="initialPassword" type="password" autocomplete="new-password" />
        </UiField>
        <p v-if="formError" role="alert" class="text-sm text-st-negative md:col-span-2">
          {{ formError }}
        </p>
      </form>
      <template #footer>
        <UiButton variant="secondary" @click="dialogOpen = false">Cancel</UiButton>
        <UiButton variant="primary" type="submit" form="new-user-form" :loading="isSubmitting"
          >Create user</UiButton
        >
      </template>
    </UiDialog>
  </PageBody>
</template>
