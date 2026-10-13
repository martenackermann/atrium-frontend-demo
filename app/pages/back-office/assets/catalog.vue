<script setup lang="ts">
import { Archive, ArchiveRestore, Check, Ellipsis, Pencil, Plus, Trash2 } from '@lucide/vue'
import { describeError } from '~/lib/api'
import { assetKeys, useDeviceTypes, useManufacturers, usePlatforms } from '~/modules/assets/api'
import type { DeviceTypeDto, ManufacturerDto, PlatformDto } from '~/modules/assets/api/types'
import type { DataTableColumn, TabItem } from '~/types/ui'

/**
 * `/back-office/assets/catalog` — Catalogue (SCREENS §6.8): tabs Device types (code, name, requires
 * platform, assets), Manufacturers (name, device types, models, assets, archived) and Platforms
 * (name, device types, assets, archived). Create/edit dialogs; archive instead of delete when in use.
 */
definePageMeta({ title: 'Catalogue', access: ['asset_admin', 'it_admin'] })

const api = useApi()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const { confirm } = useConfirm()

type Tab = 'device-types' | 'manufacturers' | 'platforms'
const tab = computed<Tab>({
  get: () =>
    ['manufacturers', 'platforms'].includes(String(route.query.tab))
      ? (route.query.tab as Tab)
      : 'device-types',
  set: (value) =>
    void router.replace({ query: { tab: value === 'device-types' ? undefined : value } }),
})

const deviceTypes = useDeviceTypes()
const manufacturers = useManufacturers({ includeArchived: true })
const platforms = usePlatforms({ includeArchived: true })
const typeName = (id: string) => deviceTypes.data.value?.find((t) => t.id === id)?.name ?? '—'
const typeNames = (ids: readonly string[]) => ids.map(typeName).join(', ') || '—'

const tabs = computed<TabItem<Tab>[]>(() => [
  { value: 'device-types', label: 'Device types', count: deviceTypes.data.value?.length ?? null },
  {
    value: 'manufacturers',
    label: 'Manufacturers',
    count: manufacturers.data.value?.length ?? null,
  },
  { value: 'platforms', label: 'Platforms', count: platforms.data.value?.length ?? null },
])

const typeColumns: DataTableColumn<DeviceTypeDto>[] = [
  { key: 'name', label: 'Name', required: true, mobile: 'title' },
  { key: 'code', label: 'Code', format: 'mono', mobile: 'meta' },
  { key: 'requiresPlatform', label: 'Requires platform', align: 'center', width: '150px' },
  {
    key: 'assetCount',
    label: 'Assets',
    format: 'num',
    align: 'right',
    width: '90px',
    mobile: 'meta',
  },
  {
    key: 'actions',
    label: 'Actions',
    align: 'right',
    width: '80px',
    required: true,
    mobile: 'hidden',
  },
]
const manufacturerColumns: DataTableColumn<ManufacturerDto>[] = [
  { key: 'name', label: 'Name', required: true, mobile: 'title' },
  {
    key: 'deviceTypeIds',
    label: 'Device types',
    value: (r) => typeNames(r.deviceTypeIds),
    mobile: 'meta',
  },
  { key: 'modelCount', label: 'Models', format: 'num', align: 'right', width: '90px' },
  { key: 'assetCount', label: 'Assets', format: 'num', align: 'right', width: '90px' },
  { key: 'archived', label: 'State', width: '110px', mobile: 'status' },
  {
    key: 'actions',
    label: 'Actions',
    align: 'right',
    width: '80px',
    required: true,
    mobile: 'hidden',
  },
]
const platformColumns: DataTableColumn<PlatformDto>[] = [
  { key: 'name', label: 'Name', required: true, mobile: 'title' },
  {
    key: 'deviceTypeIds',
    label: 'Device types',
    value: (r) => typeNames(r.deviceTypeIds),
    mobile: 'meta',
  },
  { key: 'assetCount', label: 'Assets', format: 'num', align: 'right', width: '90px' },
  { key: 'archived', label: 'State', width: '110px', mobile: 'status' },
  {
    key: 'actions',
    label: 'Actions',
    align: 'right',
    width: '80px',
    required: true,
    mobile: 'hidden',
  },
]

// Dialogs ---------------------------------------------------------------------------------------
const typeDialog = ref(false)
const editingType = ref<DeviceTypeDto | null>(null)
const entryDialog = ref(false)
const entryKind = ref<'manufacturers' | 'platforms'>('manufacturers')
const editingEntry = ref<ManufacturerDto | PlatformDto | null>(null)

function openNew() {
  if (tab.value === 'device-types') {
    editingType.value = null
    typeDialog.value = true
  } else {
    entryKind.value = tab.value
    editingEntry.value = null
    entryDialog.value = true
  }
}
function editType(row: DeviceTypeDto) {
  editingType.value = row
  typeDialog.value = true
}
function editEntry(kind: 'manufacturers' | 'platforms', row: ManufacturerDto | PlatformDto) {
  entryKind.value = kind
  editingEntry.value = row
  entryDialog.value = true
}
const newLabel = computed(
  () =>
    ({
      'device-types': 'New device type',
      manufacturers: 'New manufacturer',
      platforms: 'New platform',
    })[tab.value],
)

async function setArchived(
  kind: 'manufacturers' | 'platforms',
  row: ManufacturerDto | PlatformDto,
  archived: boolean,
) {
  try {
    await api.patch(`/assets/catalog/${kind}/${row.id}`, { archived })
    await queryClient.invalidateQueries({ queryKey: assetKeys.module })
    toast.success(archived ? `${row.name} archived.` : `${row.name} restored.`)
  } catch (error) {
    toast.error(describeError(error))
  }
}

async function removeType(row: DeviceTypeDto) {
  const ok = await confirm({
    title: `Delete ${row.name}?`,
    description: 'Manufacturers and platforms stop listing it. No model uses it.',
    confirmLabel: 'Delete device type',
    destructive: true,
  })
  if (!ok) return
  try {
    await api.delete(`/assets/catalog/device-types/${row.id}`)
    await queryClient.invalidateQueries({ queryKey: assetKeys.module })
    toast.success(`${row.name} deleted.`)
  } catch (error) {
    toast.error(describeError(error))
  }
}
</script>

<template>
  <PageBody wide>
    <PageHeader
      title="Catalogue"
      subtitle="Device types, manufacturers and platforms that models and assets build on."
    >
      <template #actions>
        <UiButton variant="primary" :icon="Plus" @click="openNew">{{ newLabel }}</UiButton>
      </template>
    </PageHeader>

    <UiTabs v-model="tab" class="mt-6" :tabs="tabs" aria-label="Catalogue sections">
      <template #device-types>
        <DataTable
          class="mt-4"
          :columns="typeColumns"
          :rows="deviceTypes.data.value"
          :loading="deviceTypes.isPending.value"
          :error="deviceTypes.error.value"
          noun="device types"
          caption="Device types"
          @retry="deviceTypes.refetch()"
        >
          <template #cell-requiresPlatform="{ row }">
            <template v-if="row.requiresPlatform">
              <Check class="mx-auto size-4" aria-hidden="true" /><span class="sr">Yes</span>
            </template>
            <span v-else class="sr">No</span>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end" @click.stop>
              <UiMenu>
                <template #trigger>
                  <UiIconButton :icon="Ellipsis" :label="`Actions for ${row.name}`" />
                </template>
                <UiMenuItem :icon="Pencil" @select="editType(row)">Edit</UiMenuItem>
                <UiMenuItem
                  :icon="Trash2"
                  destructive
                  :disabled="row.assetCount > 0"
                  :meta="row.assetCount > 0 ? `In use by ${row.assetCount} assets` : undefined"
                  @select="removeType(row)"
                  >Delete</UiMenuItem
                >
              </UiMenu>
            </div>
          </template>
        </DataTable>
      </template>

      <template #manufacturers>
        <DataTable
          class="mt-4"
          :columns="manufacturerColumns"
          :rows="manufacturers.data.value"
          :loading="manufacturers.isPending.value"
          :error="manufacturers.error.value"
          noun="manufacturers"
          caption="Manufacturers"
          @retry="manufacturers.refetch()"
        >
          <template #cell-archived="{ row }">
            <UiTag v-if="row.archived" tone="neutral" :icon="Archive">Archived</UiTag>
            <span v-else class="text-ink-muted">Active</span>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end" @click.stop>
              <UiMenu>
                <template #trigger>
                  <UiIconButton :icon="Ellipsis" :label="`Actions for ${row.name}`" />
                </template>
                <UiMenuItem :icon="Pencil" @select="editEntry('manufacturers', row)"
                  >Edit</UiMenuItem
                >
                <UiMenuItem
                  v-if="!row.archived"
                  :icon="Archive"
                  @select="setArchived('manufacturers', row, true)"
                  >Archive</UiMenuItem
                >
                <UiMenuItem
                  v-else
                  :icon="ArchiveRestore"
                  @select="setArchived('manufacturers', row, false)"
                  >Restore</UiMenuItem
                >
              </UiMenu>
            </div>
          </template>
        </DataTable>
      </template>

      <template #platforms>
        <DataTable
          class="mt-4"
          :columns="platformColumns"
          :rows="platforms.data.value"
          :loading="platforms.isPending.value"
          :error="platforms.error.value"
          noun="platforms"
          caption="Platforms"
          @retry="platforms.refetch()"
        >
          <template #cell-archived="{ row }">
            <UiTag v-if="row.archived" tone="neutral" :icon="Archive">Archived</UiTag>
            <span v-else class="text-ink-muted">Active</span>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end" @click.stop>
              <UiMenu>
                <template #trigger>
                  <UiIconButton :icon="Ellipsis" :label="`Actions for ${row.name}`" />
                </template>
                <UiMenuItem :icon="Pencil" @select="editEntry('platforms', row)">Edit</UiMenuItem>
                <UiMenuItem
                  v-if="!row.archived"
                  :icon="Archive"
                  @select="setArchived('platforms', row, true)"
                  >Archive</UiMenuItem
                >
                <UiMenuItem
                  v-else
                  :icon="ArchiveRestore"
                  @select="setArchived('platforms', row, false)"
                  >Restore</UiMenuItem
                >
              </UiMenu>
            </div>
          </template>
        </DataTable>
      </template>
    </UiTabs>

    <AssetsDeviceTypeDialog v-model:open="typeDialog" :device-type="editingType" />
    <AssetsCatalogEntryDialog v-model:open="entryDialog" :kind="entryKind" :entry="editingEntry" />
  </PageBody>
</template>
