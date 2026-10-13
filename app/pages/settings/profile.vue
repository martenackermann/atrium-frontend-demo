<script setup lang="ts">
import { coreKeys } from '~/lib/query/core'
import type { UserProfile } from '~/types/api'
import type { ThemeMode } from '~/composables/useTheme'

/**
 * Profile (SCREENS §2 /settings/profile): read-only org data from `/users/{me}` (IT changes it in
 * Admin → Users) and the one preference the app stores: the colour theme.
 */
definePageMeta({ title: 'Profile' })

const api = useApi()
const auth = useAuthStore()
const theme = useTheme()

const profile = useQuery({
  queryKey: computed(() => coreKeys.user(auth.me?.id ?? '')),
  queryFn: ({ signal }) => api.get<UserProfile>(`/users/${auth.me!.id}`, undefined, { signal }),
  enabled: computed(() => Boolean(auth.me)),
})

const ROLE_LABELS: Record<string, string> = {
  employee: 'Employee',
  manager: 'Manager',
  executive: 'Executive',
  training_office: 'Training office',
  travel_desk: 'Travel desk',
  asset_admin: 'Asset admin',
  people_ops: 'People ops',
  news_editor: 'News editor',
  it_admin: 'IT admin',
}

const facts = computed(() => {
  const user = profile.data.value
  if (!user) return []
  return [
    { label: 'Email', value: user.email },
    { label: 'Job title', value: user.jobTitle ?? '—' },
    { label: 'Department', value: user.department?.name ?? '—' },
    {
      label: 'Site',
      value: user.site?.name ?? '—',
      detail: user.isSiteManager ? 'Site manager' : null,
    },
    { label: 'Cost centre', value: user.costCenter.code, detail: user.costCenter.name, mono: true },
    { label: 'Phone', value: user.phone ?? '—' },
  ]
})

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Match system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]
const themeMode = computed({
  get: () => theme.mode.value,
  set: (value: ThemeMode) => theme.set(value),
})
</script>

<template>
  <PageBody>
    <PageHeader
      :title="profile.data.value?.displayName ?? auth.me?.displayName ?? 'Profile'"
      subtitle="Your details come from IT. Ask them if something is wrong."
    />

    <ProblemAlert
      v-if="profile.error.value"
      class="mt-6"
      :error="profile.error.value"
      :retry="() => profile.refetch()"
    />
    <div v-else-if="profile.isPending.value" class="mt-8 grid gap-3">
      <UiSkeleton v-for="index in 3" :key="index" class="h-12" />
    </div>
    <template v-else-if="profile.data.value">
      <FactGrid class="mt-8" :items="facts" />

      <section class="mt-10 grid gap-3 md:grid-cols-2" aria-label="Reporting line">
        <div class="grid content-start gap-2">
          <h2 class="text-lg font-[650] tracking-heading">Manager</h2>
          <div v-if="profile.data.value.manager" class="flex items-center gap-3">
            <UiAvatar
              :name="profile.data.value.manager.displayName"
              :initials="profile.data.value.manager.initials"
            />
            <span class="grid">
              <span class="font-medium">{{ profile.data.value.manager.displayName }}</span>
              <span class="text-sm text-ink-muted">{{ profile.data.value.manager.jobTitle }}</span>
            </span>
          </div>
          <p v-else class="text-ink-muted">You're at the top of the organisation.</p>
        </div>
        <div class="grid content-start gap-2">
          <h2 class="text-lg font-[650] tracking-heading">
            Direct reports
            <span class="num text-ink-muted">{{ profile.data.value.directReports.length }}</span>
          </h2>
          <ul v-if="profile.data.value.directReports.length" class="m-0 grid list-none gap-2 p-0">
            <li
              v-for="report in profile.data.value.directReports"
              :key="report.id"
              class="flex items-center gap-3"
            >
              <UiAvatar :name="report.displayName" :initials="report.initials" size="sm" />
              <span class="font-medium">{{ report.displayName }}</span>
              <span class="text-sm text-ink-muted">{{ report.jobTitle }}</span>
            </li>
          </ul>
          <p v-else class="text-ink-muted">Nobody reports to you.</p>
        </div>
      </section>

      <section class="mt-10 grid gap-3" aria-labelledby="roles-heading">
        <h2 id="roles-heading" class="text-lg font-[650] tracking-heading">Roles</h2>
        <div class="flex flex-wrap gap-2">
          <UiTag v-for="role in profile.data.value.roles" :key="role">{{
            ROLE_LABELS[role] ?? role
          }}</UiTag>
        </div>
      </section>
    </template>

    <section class="mt-10 grid gap-3" aria-labelledby="prefs-heading">
      <h2 id="prefs-heading" class="text-lg font-[650] tracking-heading">Preferences</h2>
      <UiField label="Theme" hint="Stored in this browser.">
        <UiSegmented v-model="themeMode" :options="themeOptions" label="Theme" />
      </UiField>
    </section>
  </PageBody>
</template>
