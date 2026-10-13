<script setup lang="ts">
import { Archive, ArchiveRestore, Ellipsis, Pencil, Plus, Trash2 } from '@lucide/vue'
import { describeError } from '~/lib/api'
import { assetKeys, useDeviceTypes, useManufacturers, useModels } from '~/modules/assets/api'
import type { AssetModelDto } from '~/modules/assets/api/types'
import type { DataTableColumn } from '~/types/ui'

/**
 * `/back-office/assets/models` — Models (SCREENS §6.7): name, manufacturer, device type, storage,
 * colour, assets, "Archived" badge; filters device type, manufacturer, q, include archived;
 * New / Edit (dialog), Archive / Restore, Delete (disabled while assets use the model).
 */
definePageMeta({ title: 'Models', access: ['asset_admin', 'it_admin'] })

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const { confirm } = useConfirm()

const list = useListQuery({
  filters: ['deviceTypeId', 'manufacturerId', 'includeArchived'],
  defaultSort: 'name',
})
const models = useModels(() => list.apiQuery.value)
const deviceTypes = useDeviceTypes()
const filter = (key: string) => String(list.state.value.filters[key] ?? '')
const manufacturers = useManufacturers(() => ({
  deviceTypeId: filter('deviceTypeId') || undefined,
  includeArchived: true,
}))

const ANY = 'any'
const typeFilter = computed<string>({
  get: () => filter('deviceTypeId') || ANY,
  set: (value) =>
    list.update({ filters: { deviceTypeId: value === ANY ? '' : value, manufacturerId: '' } }),
})
const manufacturerFilter = computed<string>({
  get: () => filter('manufacturerId') || ANY,
  set: (value) => list.setFilter('manufacturerId', value === ANY ? undefined : value),
})
const includeArchived = computed<boolean>({
  get: () => filter('includeArchived') === 'true',
  set: (value) => list.setFilter('includeArchived', value ? 'true' : undefined),
})

const columns: DataTableColumn<AssetModelDto>[] = [
  { key: 'name', label: 'Name', sort: 'name', required: true, mobile: 'title' },
  { key: 'manufacturer', label: 'Manufacturer', value: (r) => r.manufacturer.name, mobile: 'meta' },
  { key: 'deviceType', label: 'Device type', value: (r) => r.deviceType.name, mobile: 'meta' },
  {
    key: 'storageGb',
    label: 'Storage',
    value: (r) => (r.storageGb ? `${r.storageGb} GB` : null),
    align: 'right',
    width: '100px',
  },
  { key: 'color', label: 'Colour', width: '120px' },
  {
    key: 'assetCount',
    label: 'Assets',
    sort: 'assetCount',
    format: 'num',
    align: 'right',
    width: '90px',
  },
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

const dialogOpen = ref(false)
const editing = ref<AssetModelDto | null>(null)
function openDialog(model: AssetModelDto | null) {
  editing.value = model
  dialogOpen.value = true
}

async function setArchived(model: AssetModelDto, archived: boolean) {
  try {
    await api.patch(`/assets/catalog/models/${model.id}`, { archived })
    await queryClient.invalidateQueries({ queryKey: assetKeys.module })
    toast.success(
      archived
        ? `${model.name} archived. It no longer appears in the new-asset form.`
        : `${model.name} restored.`,
    )
  } catch (error) {
    toast.error(describeError(error))
  }
}

async function remove(model: AssetModelDto) {
  const ok = await confirm({
    title: `Delete ${model.name}?`,
    description: 'The model disappears from the catalogue. No asset uses it.',
    confirmLabel: 'Delete model',
    destructive: true,
  })
  if (!ok) return
  try {
    await api.delete(`/assets/catalog/models/${model.id}`)
    await queryClient.invalidateQueries({ queryKey: assetKeys.module })
    toast.success(`${model.name} deleted.`)
  } catch (error) {
    toast.error(describeError(error))
  }
}
</script>

<template>
  <PageBody wide>
    <PageHeader
      title="Models"
      subtitle="What can be bought. Archive old models to keep them out of the new-asset form."
    >
      <template #actions>
        <UiButton variant="primary" :icon="Plus" @click="openDialog(null)">New model</UiButton>
      </template>
    </PageHeader>

    <DataTable
      class="mt-6"
      :columns="columns"
      :rows="models.data.value?.data"
      :meta="models.data.value?.meta"
      :loading="models.isPending.value"
      :error="models.error.value"
      :list="list"
      noun="models"
      storage-key="asset-models"
      search-placeholder="Model or manufacturer"
      caption="Models"
      :empty="{
        title: 'No models match these filters.',
        description: 'Change the filters, or add a model with New model.',
      }"
      @retry="models.refetch()"
    >
      <template #filters>
        <UiSelect
          v-model="typeFilter"
          size="sm"
          aria-label="Device type"
          class="w-44"
          :options="[
            { value: ANY, label: 'Any device type' },
            ...(deviceTypes.data.value ?? []).map((t) => ({ value: t.id, label: t.name })),
          ]"
        />
        <UiSelect
          v-model="manufacturerFilter"
          size="sm"
          aria-label="Manufacturer"
          class="w-48"
          :options="[
            { value: ANY, label: 'Any manufacturer' },
            ...(manufacturers.data.value ?? []).map((m) => ({ value: m.id, label: m.name })),
          ]"
        />
        <UiCheckbox v-model="includeArchived" label="Include archived" class="h-[30px]" />
      </template>
      <template #cell-archived="{ row }">
        <UiTag v-if="row.archived" tone="neutral" :icon="Archive">Archived</UiTag>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex justify-end" @click.stop>
          <UiMenu>
            <template #trigger>
              <UiIconButton :icon="Ellipsis" :label="`Actions for ${row.name}`" />
            </template>
            <UiMenuItem :icon="Pencil" @select="openDialog(row)">Edit</UiMenuItem>
            <UiMenuItem v-if="!row.archived" :icon="Archive" @select="setArchived(row, true)"
              >Archive</UiMenuItem
            >
            <UiMenuItem v-else :icon="ArchiveRestore" @select="setArchived(row, false)"
              >Restore</UiMenuItem
            >
            <UiMenuItem
              :icon="Trash2"
              destructive
              :disabled="row.assetCount > 0"
              :meta="row.assetCount > 0 ? `In use by ${row.assetCount} assets` : undefined"
              @select="remove(row)"
              >Delete</UiMenuItem
            >
          </UiMenu>
        </div>
      </template>
    </DataTable>

    <AssetsModelDialog v-model:open="dialogOpen" :model="editing" />
  </PageBody>
</template>
