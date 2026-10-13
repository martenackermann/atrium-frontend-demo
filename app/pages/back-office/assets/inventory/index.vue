<script setup lang="ts">
import { Plus, SlidersHorizontal } from '@lucide/vue'
import { useAssetList, useDeviceTypes, useManufacturers, useModels } from '~/modules/assets/api'
import type { AssetListItem } from '~/modules/assets/api/types'
import { ASSET_STATUS_ORDER } from '~/modules/assets/constants'
import type { UserProfile, UserRef } from '~/types/api'
import type { DataTableColumn } from '~/types/ui'

/**
 * `/back-office/assets/inventory` — Inventory (SCREENS §6.4): server-side DataTable with a column
 * chooser, filters in the URL (q, status, device type, manufacturer filtered by type, model,
 * assigned user, cost centre, purchase date range, include deleted) and CSV export.
 */
definePageMeta({ title: 'Inventory', access: ['asset_admin', 'it_admin'] })

const api = useApi()
const enums = useEnums()
const org = useOrg()

const list = useListQuery({
  filters: [
    'status',
    'deviceTypeId',
    'manufacturerId',
    'modelId',
    'assignedUserId',
    'costCenterId',
    'from',
    'to',
    'includeDeleted',
  ],
  defaultSort: '-updatedAt',
})
const assets = useAssetList(() => list.apiQuery.value)

const filter = (key: string) => String(list.state.value.filters[key] ?? '')
const ANY = 'any'
const selectModel = (key: string, dependents: string[] = []) =>
  computed<string>({
    get: () => filter(key) || ANY,
    set: (value) =>
      list.update({
        filters: Object.fromEntries([
          [key, value === ANY ? '' : value],
          ...dependents.map((dependent) => [dependent, '']),
        ]),
      }),
  })
const statusFilter = selectModel('status')
// A stale or hand-edited URL must not break the list: drop a status the API would reject.
watchEffect(() => {
  const status = filter('status')
  if (status && !(ASSET_STATUS_ORDER as readonly string[]).includes(status))
    list.setFilter('status', undefined)
})
const typeFilter = selectModel('deviceTypeId', ['manufacturerId', 'modelId'])
const manufacturerFilter = selectModel('manufacturerId', ['modelId'])
const modelFilter = selectModel('modelId')
const costCenterFilter = selectModel('costCenterId')
const includeDeleted = computed<boolean>({
  get: () => filter('includeDeleted') === 'true',
  set: (value) => list.setFilter('includeDeleted', value ? 'true' : undefined),
})

const deviceTypes = useDeviceTypes()
const manufacturers = useManufacturers(() => ({
  deviceTypeId: filter('deviceTypeId') || undefined,
  includeArchived: true,
}))
const models = useModels(() => ({
  perPage: 100,
  includeArchived: true,
  ...(filter('deviceTypeId') ? { deviceTypeId: filter('deviceTypeId') } : {}),
  ...(filter('manufacturerId') ? { manufacturerId: filter('manufacturerId') } : {}),
}))

const statusOptions = computed(() => [
  { value: ANY, label: 'Any status' },
  ...ASSET_STATUS_ORDER.map((status) => ({
    value: status,
    label: enums.label('assetStatus', status),
  })),
])
const typeOptions = computed(() => [
  { value: ANY, label: 'Any device type' },
  ...(deviceTypes.data.value ?? []).map((t) => ({ value: t.id, label: t.name })),
])
const manufacturerOptions = computed(() => [
  { value: ANY, label: 'Any manufacturer' },
  ...(manufacturers.data.value ?? []).map((m) => ({ value: m.id, label: m.name })),
])
const modelOptions = computed(() => [
  { value: ANY, label: 'Any model' },
  ...(models.data.value?.data ?? []).map((m) => ({ value: m.id, label: m.name })),
])
const costCenterOptions = computed(() => [
  { value: ANY, label: 'Any cost centre' },
  ...org.costCenterOptions.value,
])

// Assigned user: the URL holds the id; the picker needs a UserRef (resolved once from /users/{id}).
const assignedUser = ref<UserRef | null>(null)
watch(
  () => filter('assignedUserId'),
  async (id) => {
    if (!id) {
      assignedUser.value = null
      return
    }
    if (assignedUser.value?.id === id) return
    try {
      const profile = await api.get<UserProfile>(`/users/${id}`)
      assignedUser.value = profile
    } catch {
      assignedUser.value = null
    }
  },
  { immediate: true },
)
watch(assignedUser, (user) => {
  if ((user?.id ?? '') !== filter('assignedUserId')) list.setFilter('assignedUserId', user?.id)
})

// Below 768px the filters fold behind a "Filters (n)" button (SCREENS §9).
const showFilters = ref(false)
const activeFilters = computed(
  () =>
    Object.values(list.state.value.filters).filter((value) => String(value ?? '') !== '').length,
)

const columns: DataTableColumn<AssetListItem>[] = [
  {
    key: 'assetTag',
    label: 'Asset tag',
    sort: 'assetTag',
    format: 'mono',
    required: true,
    width: '120px',
    mobile: 'meta',
  },
  { key: 'model', label: 'Model', sort: 'model', value: (r) => r.model.name, mobile: 'title' },
  { key: 'status', label: 'Status', sort: 'status', width: '170px', mobile: 'status' },
  {
    key: 'assignedUser',
    label: 'Assigned to',
    value: (r) => r.assignedUser?.displayName,
    mobile: 'meta',
  },
  { key: 'serialNumber', label: 'Serial', sort: 'serialNumber', format: 'mono' },
  { key: 'name', label: 'Device name', format: 'mono', hidden: true },
  { key: 'deviceType', label: 'Type', value: (r) => r.deviceType.name },
  { key: 'manufacturer', label: 'Manufacturer', value: (r) => r.manufacturer.name, hidden: true },
  { key: 'platform', label: 'Platform', value: (r) => r.platform?.name, hidden: true },
  {
    key: 'costCenter',
    label: 'Cost centre',
    value: (r) => r.costCenter.code,
    format: 'mono',
    width: '110px',
  },
  { key: 'purchaseDate', label: 'Purchased', sort: 'purchaseDate', format: 'date', hidden: true },
  {
    key: 'updatedAt',
    label: 'Updated',
    sort: 'updatedAt',
    value: (r) => formatAge(r.updatedAt),
    width: '110px',
  },
]
</script>

<template>
  <PageBody wide>
    <PageHeader
      title="Inventory"
      :subtitle="
        assets.data.value
          ? `${assets.data.value.meta.total === 1 ? '1 asset matches' : `${assets.data.value.meta.total} assets match`}. Every device, where it is and who has it.`
          : 'Every device, where it is and who has it.'
      "
    >
      <template #actions>
        <UiButton variant="primary" :icon="Plus" to="/back-office/assets/inventory/new"
          >New asset</UiButton
        >
      </template>
    </PageHeader>

    <DataTable
      class="mt-6"
      :columns="columns"
      :rows="assets.data.value?.data"
      :meta="assets.data.value?.meta"
      :loading="assets.isPending.value"
      :error="assets.error.value"
      :list="list"
      :row-to="(row) => `/back-office/assets/inventory/${row.id}`"
      noun="assets"
      storage-key="asset-inventory"
      search-placeholder="Asset tag, serial, name or person"
      caption="Inventory"
      export-path="/assets/export.csv"
      export-filename="assets.csv"
      :empty="{
        title: 'No assets match these filters',
        description: 'Change or clear the filters to see more.',
      }"
      @retry="assets.refetch()"
    >
      <template #filters>
        <UiButton
          size="sm"
          variant="secondary"
          :icon="SlidersHorizontal"
          class="md:hidden"
          :aria-expanded="showFilters"
          @click="showFilters = !showFilters"
          >Filters{{ activeFilters ? ` (${activeFilters})` : '' }}</UiButton
        >
        <UiSelect
          v-model="statusFilter"
          aria-label="Status"
          :options="statusOptions"
          class="w-48 max-md:w-full"
          :class="!showFilters && 'max-md:hidden'"
        />
        <UiSelect
          v-model="typeFilter"
          aria-label="Device type"
          :options="typeOptions"
          class="w-44 max-md:w-full"
          :class="!showFilters && 'max-md:hidden'"
        />
        <UiSelect
          v-model="manufacturerFilter"
          aria-label="Manufacturer"
          :options="manufacturerOptions"
          class="w-48 max-md:w-full"
          :class="!showFilters && 'max-md:hidden'"
        />
        <UiSelect
          v-model="modelFilter"
          aria-label="Model"
          :options="modelOptions"
          class="w-56 max-md:w-full"
          :class="!showFilters && 'max-md:hidden'"
        />
        <label for="inventory-assigned-user" class="sr">Assigned to</label>
        <UserPicker
          id="inventory-assigned-user"
          v-model="assignedUser"
          placeholder="Assigned to…"
          class="w-56 max-md:w-full"
          :class="!showFilters && 'max-md:hidden'"
        />
        <UiSelect
          v-model="costCenterFilter"
          aria-label="Cost centre"
          :options="costCenterOptions"
          class="w-56 max-md:w-full"
          :class="!showFilters && 'max-md:hidden'"
        />
        <DateRangeFilter
          :class="!showFilters && 'max-md:hidden'"
          label="Purchased"
          :from="filter('from') || null"
          :to="filter('to') || null"
          @change="({ from, to }) => list.update({ filters: { from: from ?? '', to: to ?? '' } })"
        />
        <UiCheckbox
          v-model="includeDeleted"
          label="Include deleted"
          class="h-[38px] items-center"
          :class="!showFilters && 'max-md:hidden'"
        />
      </template>
      <template #cell-status="{ row }">
        <span class="inline-flex items-center gap-1.5">
          <StatusBadge enum="assetStatus" :value="row.status" />
          <UiMiniChip v-if="row.deletedAt" label="Deleted" />
        </span>
      </template>
    </DataTable>
  </PageBody>
</template>
