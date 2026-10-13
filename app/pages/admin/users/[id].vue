<script setup lang="ts">
import { Save } from '@lucide/vue'
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import { coreKeys } from '~/lib/query/core'
import type {
  AdminUserDto,
  AssignableRole,
  AuditEntryDto,
  Page,
  UpdateAdminUser,
  UserProfile,
  UserRef,
} from '~/types/api'

/**
 * Admin · User detail (SCREENS §2 /admin/users/[id]): edit form with optimistic locking (`version`,
 * SPEC_RESOLUTIONS #26), 422 manager-cycle on the Manager field. Side: direct reports + audit.
 */
definePageMeta({ title: 'User', access: ['it_admin'] })

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const route = useRoute()
const org = useOrg()
const id = computed(() => String(route.params.id))

const user = useQuery({
  queryKey: computed(() => coreKeys.adminUser(id.value)),
  queryFn: ({ signal }) => api.get<AdminUserDto>(`/admin/users/${id.value}`, undefined, { signal }),
})
const profile = useQuery({
  queryKey: computed(() => coreKeys.user(id.value)),
  queryFn: ({ signal }) => api.get<UserProfile>(`/users/${id.value}`, undefined, { signal }),
})
const audit = useQuery({
  queryKey: computed(() => coreKeys.audit({ entityType: 'user', entityId: id.value })),
  queryFn: ({ signal }) =>
    api.get<Page<AuditEntryDto>>(
      '/audit',
      { entityType: 'user', entityId: id.value, perPage: 20 },
      { signal },
    ),
})
useBreadcrumbTail(() => user.data.value?.displayName)

const ASSIGNABLE: { value: AssignableRole; label: string }[] = [
  { value: 'executive', label: 'Executive' },
  { value: 'training_office', label: 'Training office' },
  { value: 'travel_desk', label: 'Travel desk' },
  { value: 'asset_admin', label: 'Asset admin' },
  { value: 'people_ops', label: 'People ops' },
  { value: 'news_editor', label: 'News editor' },
  { value: 'it_admin', label: 'IT admin' },
]

const schema = toTypedSchema(
  z.object({
    firstName: z.string().trim().min(1, 'Enter a first name.'),
    lastName: z.string().trim().min(1, 'Enter a last name.'),
    jobTitle: z.string().nullable(),
    departmentId: z.string().nullable(),
    siteId: z.string().nullable(),
    costCenterId: z.string().min(1, 'Choose a cost centre.'),
    manager: z.custom<UserRef | null>(),
    isSiteManager: z.boolean(),
    roles: z.array(z.string()),
    active: z.boolean(),
  }),
)
const { defineField, errors, handleSubmit, isSubmitting, resetForm, setErrors, meta } = useForm({
  validationSchema: schema,
})
const [firstName] = defineField('firstName')
const [lastName] = defineField('lastName')
const [jobTitle] = defineField('jobTitle')
const [departmentId] = defineField('departmentId')
const [siteId] = defineField('siteId')
const [costCenterId] = defineField('costCenterId')
const [manager] = defineField<'manager', UserRef | null>('manager')
const [isSiteManager] = defineField('isSiteManager')
const [roles] = defineField('roles')
const [active] = defineField('active')
const formError = ref<string | null>(null)

watch(
  () => user.data.value,
  (value) => {
    if (!value) return
    resetForm({
      values: {
        firstName: value.firstName,
        lastName: value.lastName,
        jobTitle: value.jobTitle,
        departmentId: value.department?.id ?? null,
        siteId: value.site?.id ?? null,
        costCenterId: value.costCenter.id,
        manager: value.manager,
        isSiteManager: value.isSiteManager,
        roles: [...value.roles],
        active: value.active,
      },
    })
  },
  { immediate: true },
)

function toggleRole(role: string, on: boolean | 'indeterminate') {
  const current = roles.value ?? []
  roles.value = on === true ? [...current, role] : current.filter((item) => item !== role)
}

const save = handleSubmit(async (values) => {
  formError.value = null
  const body: UpdateAdminUser = {
    firstName: values.firstName,
    lastName: values.lastName,
    jobTitle: values.jobTitle?.trim() || null,
    departmentId: values.departmentId,
    siteId: values.siteId,
    costCenterId: values.costCenterId,
    managerId: values.manager?.id ?? null,
    isSiteManager: values.isSiteManager,
    roles: values.roles as AssignableRole[],
    active: values.active,
    version: user.data.value?.version,
  }
  try {
    const updated = await api.patch<AdminUserDto>(`/admin/users/${id.value}`, body)
    queryClient.setQueryData(coreKeys.adminUser(id.value), updated)
    toast.success('Changes saved.')
    await queryClient.invalidateQueries({ queryKey: ['core'] })
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
  <PageBody>
    <ProblemAlert v-if="user.error.value" :error="user.error.value" :retry="() => user.refetch()" />
    <div v-else-if="user.isPending.value" class="grid gap-3">
      <UiSkeleton class="h-10 w-1/2" />
      <UiSkeleton v-for="index in 4" :key="index" class="h-12" />
    </div>
    <template v-else-if="user.data.value">
      <PageHeader :title="user.data.value.displayName">
        <template #meta>
          <span>{{ user.data.value.email }}</span>
          <span aria-hidden="true">·</span>
          <span class="mono">{{ user.data.value.employeeNumber }}</span>
          <template v-if="user.data.value.lastLoginAt">
            <span aria-hidden="true">·</span>
            <span>Last sign-in {{ formatAge(user.data.value.lastLoginAt) }}</span>
          </template>
        </template>
        <template #status>
          <UiTag :tone="user.data.value.active ? 'positive' : 'neutral'">
            {{ user.data.value.active ? 'Active' : 'Inactive' }}
          </UiTag>
        </template>
      </PageHeader>

      <div class="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form class="grid content-start gap-4 md:grid-cols-2" novalidate @submit="save">
          <UiField label="First name" :error="errors.firstName"
            ><UiInput v-model="firstName"
          /></UiField>
          <UiField label="Last name" :error="errors.lastName"
            ><UiInput v-model="lastName"
          /></UiField>
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
            <UserPicker v-model="manager" :exclude="[id]" />
          </UiField>
          <UiSwitch
            v-model="isSiteManager"
            class="md:col-span-2"
            label="Site manager"
            description="Approvals for this person's reports skip to their manager."
          />
          <UiField label="Roles" optional group class="md:col-span-2" :error="errors.roles">
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
          <UiSwitch
            v-model="active"
            class="md:col-span-2"
            label="Active"
            description="Inactive users can't sign in."
          />
          <p v-if="formError" role="alert" class="text-sm text-st-negative md:col-span-2">
            {{ formError }}
          </p>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2 md:col-span-2">
            <UiButton
              type="submit"
              variant="primary"
              :icon="Save"
              :loading="isSubmitting"
              :disabled="!meta.dirty"
            >
              Save changes
            </UiButton>
            <span v-if="!meta.dirty" class="text-sm text-ink-subtle">Nothing changed yet.</span>
          </div>
        </form>

        <aside class="grid content-start gap-8">
          <section class="grid gap-3" aria-labelledby="reports-heading">
            <h2 id="reports-heading" class="text-lg font-[650] tracking-heading">
              Direct reports
              <span class="num text-ink-muted">{{
                profile.data.value?.directReports.length ?? 0
              }}</span>
            </h2>
            <ul
              v-if="profile.data.value?.directReports.length"
              class="m-0 grid list-none gap-2 p-0"
            >
              <li v-for="report in profile.data.value.directReports" :key="report.id">
                <NuxtLink
                  :to="`/admin/users/${report.id}`"
                  class="flex items-center gap-2.5 text-ink no-underline hover:underline"
                >
                  <UiAvatar :name="report.displayName" :initials="report.initials" size="sm" />
                  {{ report.displayName }}
                </NuxtLink>
              </li>
            </ul>
            <p v-else class="text-ink-muted">Nobody reports to {{ user.data.value.firstName }}.</p>
          </section>
          <section class="grid gap-3" aria-labelledby="history-heading">
            <h2 id="history-heading" class="text-lg font-[650] tracking-heading">History</h2>
            <AuditTrail
              v-if="audit.data.value?.data.length"
              :entries="audit.data.value.data"
              show-changes
            />
            <p v-else class="text-ink-muted">No changes recorded.</p>
          </section>
        </aside>
      </div>
    </template>
  </PageBody>
</template>
