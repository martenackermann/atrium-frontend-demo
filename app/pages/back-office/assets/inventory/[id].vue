<script setup lang="ts">
import { Trash2 } from '@lucide/vue'
import { describeError, isApiError } from '~/lib/api'
import { assetKeys, useAsset, useAssetAssignments, useAssetTimeline } from '~/modules/assets/api'
import type { AssetDto, ReturnCondition } from '~/modules/assets/api/types'
import { ASSET_ACTION_MESSAGES, ASSET_ADMIN_ACTIONS } from '~/modules/assets/constants'
import type { FactItem, TabItem } from '~/types/ui'

/**
 * `/back-office/assets/inventory/[id]` — Asset admin detail (SCREENS §6.6): header with the
 * ActionBar (Assign, Unassign, Return, Send to repair, Complete repair, Scrap) and Delete; tabs
 * Details (editable, version-checked), Assignments (history) and Timeline (field diffs,
 * cost-centre syncs, reminders) with the lifecycle diagram.
 */
definePageMeta({ title: 'Asset', access: ['asset_admin', 'it_admin'] })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const api = useApi()
const queryClient = useQueryClient()
const { confirm } = useConfirm()
const id = computed(() => String(route.params.id))

const asset = useAsset(id)
const a = computed(() => asset.data.value)
useBreadcrumbTail(() => a.value?.assetTag)
watch(
  () => asset.error.value,
  (error) => {
    if (isApiError(error) && error.status === 404) {
      showError({ statusCode: 404, statusMessage: 'Not found' })
    }
  },
)

type Tab = 'details' | 'assignments' | 'timeline'
const tab = computed<Tab>({
  get: () =>
    ['assignments', 'timeline'].includes(String(route.query.tab))
      ? (route.query.tab as Tab)
      : 'details',
  set: (value) =>
    void router.replace({
      query: { ...route.query, tab: value === 'details' ? undefined : value },
    }),
})
const assignments = useAssetAssignments(
  id,
  () => tab.value === 'assignments' || tab.value === 'timeline',
)
const timeline = useAssetTimeline(id, () => tab.value === 'timeline')
const tabs = computed<TabItem<Tab>[]>(() => [
  { value: 'details', label: 'Details' },
  { value: 'assignments', label: 'Assignments', count: assignments.data.value?.length ?? null },
  { value: 'timeline', label: 'Timeline' },
])
const visited = computed(() => [
  ...new Set(
    (timeline.data.value ?? []).flatMap((entry) =>
      [entry.fromState, entry.toState].filter((s): s is string => Boolean(s)),
    ),
  ),
])

// --- actions ---------------------------------------------------------------------------------
const actionBar = ref<{ done: () => void; setReasonError: (error: unknown) => void } | null>(null)
const { run, isPending, variables } = useWorkflowAction<AssetDto>({
  resourcePath: () => `/assets/${id.value}`,
  invalidate: [assetKeys.module],
  messages: ASSET_ACTION_MESSAGES,
  onSuccess: (detail) => queryClient.setQueryData(assetKeys.assets.detail(detail.id), detail),
})
const pending = computed(() => (isPending.value ? (variables.value?.action ?? null) : null))

const assignOpen = ref(false)
const assignErrors = ref<Record<string, string | undefined>>({})
const returnOpen = ref(false)
const returnError = ref<string | null>(null)

async function onRun(action: string, body: Record<string, unknown>) {
  if (action === 'assign') {
    assignErrors.value = {}
    assignOpen.value = true
    return
  }
  if (action === 'return') {
    returnError.value = null
    returnOpen.value = true
    return
  }
  try {
    await run(action, body)
    actionBar.value?.done()
  } catch (error) {
    actionBar.value?.setReasonError(error)
  }
}

async function assign(body: { userId: string; note: string | null }) {
  try {
    await run('assign', body)
    assignOpen.value = false
  } catch (error) {
    if (isApiError(error) && error.status === 422) {
      assignErrors.value = {
        userId: error.fieldError('userId') ?? undefined,
        note: error.fieldError('note') ?? undefined,
      }
    }
  }
}

async function recordReturn(body: { condition: ReturnCondition; note: string | null }) {
  try {
    await run('return', body)
    returnOpen.value = false
  } catch (error) {
    if (isApiError(error) && error.status === 422) {
      returnError.value = error.fieldError('condition') ?? describeError(error).detail ?? null
    }
  }
}

const deleting = ref(false)
async function remove() {
  if (!a.value) return
  const ok = await confirm({
    title: `Delete ${a.value.assetTag}?`,
    description:
      'The asset disappears from the inventory and the dashboard. Its history stays in the audit log.',
    confirmLabel: 'Delete asset',
    destructive: true,
  })
  if (!ok) return
  deleting.value = true
  try {
    await api.delete(`/assets/${id.value}`)
    await queryClient.invalidateQueries({ queryKey: assetKeys.module })
    toast.success(`${a.value.assetTag} deleted.`)
    await navigateTo('/back-office/assets/inventory')
  } catch (error) {
    toast.error(describeError(error))
  } finally {
    deleting.value = false
  }
}

// --- header facts ------------------------------------------------------------------------------
const holderLine = computed(() => {
  const asset = a.value
  const assignment = asset?.currentAssignment
  if (!asset || !assignment) return null
  if (asset.status === 'pending_acceptance') {
    return `Waiting for ${assignment.user.displayName} to accept since ${formatDate(assignment.assignedAt)}`
  }
  if (assignment.acceptedAt) {
    return `${asset.status === 'in_repair' ? 'Returns to' : 'With'} ${assignment.user.displayName} since ${formatDate(assignment.acceptedAt)}`
  }
  return null
})
const summary = computed<FactItem[]>(() => {
  const asset = a.value
  if (!asset) return []
  return [
    {
      label: 'Assigned to',
      value: asset.assignedUser?.displayName ?? 'Nobody',
      detail: asset.assignedUser?.email,
    },
    {
      label: 'Cost centre',
      value: asset.costCenter.code,
      detail: asset.costCenter.name,
      mono: true,
    },
    {
      label: 'Platform',
      value:
        asset.platform?.name ?? (asset.deviceType.requiresPlatform ? 'Not set' : 'Not applicable'),
    },
    { label: 'Purchased', value: asset.purchaseDate ? formatDate(asset.purchaseDate) : null },
    { label: 'MDM', value: asset.mdmEnrolled ? 'Enrolled' : 'Not enrolled' },
    {
      label: 'Added',
      value: formatDate(asset.createdAt),
      detail: asset.createdBy ? `by ${asset.createdBy.displayName}` : null,
    },
  ]
})
</script>

<template>
  <PageBody>
    <ProblemAlert
      v-if="
        asset.error.value && !(isApiError(asset.error.value) && asset.error.value.status === 404)
      "
      :error="asset.error.value"
      :retry="() => asset.refetch()"
    />
    <div v-else-if="asset.isPending.value" class="grid gap-4" aria-busy="true">
      <UiSkeleton class="h-10 w-2/3" />
      <UiSkeleton class="h-48 w-full" />
    </div>

    <template v-else-if="a">
      <PageHeader :title="a.model.name">
        <template #meta>
          <span>{{ a.deviceType.name }} · {{ a.manufacturer.name }}</span>
          <span aria-hidden="true">·</span>
          <span class="mono">{{ a.assetTag }}</span>
          <span aria-hidden="true">·</span>
          <span
            >Serial <span class="mono">{{ a.serialNumber }}</span></span
          >
        </template>
        <template #status>
          <StatusBadge enum="assetStatus" :value="a.status" />
          <UiMiniChip v-if="a.deletedAt" label="Deleted" />
          <span v-if="holderLine" class="text-sm text-ink-muted">{{ holderLine }}</span>
        </template>
        <template #actions>
          <ActionBar
            ref="actionBar"
            :actions="a.availableActions"
            :config="ASSET_ADMIN_ACTIONS"
            :pending="pending"
            sticky-mobile
            @run="onRun"
          />
          <UiButton
            v-if="a.availableActions.includes('delete')"
            variant="ghost"
            :icon="Trash2"
            :loading="deleting"
            @click="remove"
            >Delete</UiButton
          >
        </template>
      </PageHeader>

      <FactGrid class="mt-8" :items="summary" />

      <UiTabs v-model="tab" class="mt-10" :tabs="tabs" aria-label="Asset sections">
        <template #details>
          <div class="pt-6">
            <AssetsAssetEditForm v-if="a.availableActions.includes('edit')" :asset="a" />
            <div v-else class="grid gap-4">
              <p class="rounded-lg border border-rule bg-well px-4 py-3 text-base">
                {{
                  a.deletedAt
                    ? 'This asset was deleted. Its details can no longer change.'
                    : 'Scrapped assets can no longer be edited.'
                }}
              </p>
              <FactGrid
                :items="[
                  { label: 'Serial number', value: a.serialNumber, mono: true },
                  { label: 'Device name', value: a.name, mono: true },
                  { label: 'Model', value: a.model.name },
                ]"
              />
            </div>
            <div v-if="a.notes && !a.availableActions.includes('edit')" class="mt-6">
              <h2 class="text-md font-semibold">Notes</h2>
              <p class="mt-1 text-base whitespace-pre-line">{{ a.notes }}</p>
            </div>
          </div>
        </template>
        <template #assignments>
          <div class="pt-6">
            <ProblemAlert
              v-if="assignments.error.value"
              :error="assignments.error.value"
              :retry="() => assignments.refetch()"
            />
            <AssetsAssignmentHistory
              v-else
              :rows="assignments.data.value"
              :loading="assignments.isPending.value"
            />
          </div>
        </template>
        <template #timeline>
          <div class="grid gap-10 pt-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <h2 class="sr">History of this device</h2>
            <div>
              <ProblemAlert
                v-if="timeline.error.value"
                :error="timeline.error.value"
                :retry="() => timeline.refetch()"
              />
              <LifecycleTimeline
                v-else
                title="Timeline"
                :entries="timeline.data.value"
                :loading="timeline.isPending.value"
              />
            </div>
            <WorkflowDiagram
              name="asset"
              title="How a device moves"
              default-open
              :current="a.status"
              :visited="visited"
            />
          </div>
        </template>
      </UiTabs>

      <AssetsAssignDialog
        v-model:open="assignOpen"
        :device-label="`${a.model.name} · ${a.assetTag}`"
        :loading="pending === 'assign'"
        :errors="assignErrors"
        @submit="assign"
      />
      <AssetsReturnDialog
        v-model:open="returnOpen"
        :holder="a.assignedUser?.displayName ?? null"
        :loading="pending === 'return'"
        :error="returnError"
        @submit="recordReturn"
      />
    </template>
  </PageBody>
</template>
