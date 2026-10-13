<script setup lang="ts">
import { Ellipsis, Pencil, Plus, Power, Star } from '@lucide/vue'
import { describeError, isApiError } from '~/lib/api'
import type { DataTableColumn } from '~/types/ui'
import { travelKeys, useCarClasses } from '~/modules/travel/api'
import type { CarRentalClassDto, CarRentalClassInput } from '~/modules/travel/api/types'

/**
 * Car classes (SCREENS §5.7): code, name, vehicle type, "Standard" badge, example models, sort
 * order, active. New / Edit (dialog), "Make standard" (exactly one per vehicle type — the standard
 * class decides the `vehicle_class_upgrade` approval reason), Deactivate.
 */
definePageMeta({ title: 'Car classes', access: ['travel_desk', 'it_admin'] })

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()

const classes = useCarClasses({ includeInactive: true })
const rows = computed(() => classes.data.value ?? null)

const columns: DataTableColumn<CarRentalClassDto>[] = [
  { key: 'code', label: 'Code', format: 'mono', required: true, width: '90px', mobile: 'title' },
  { key: 'name', label: 'Name', required: true, mobile: 'meta' },
  {
    key: 'vehicleType',
    label: 'Vehicle',
    value: (row) => (row.vehicleType === 'van' ? 'Van' : 'Car'),
    mobile: 'meta',
  },
  { key: 'standard', label: 'Standard', mobile: 'status', width: '120px' },
  { key: 'exampleModels', label: 'Example models', value: (row) => row.exampleModels ?? '—' },
  { key: 'sortOrder', label: 'Order', format: 'num', align: 'right', width: '80px' },
  { key: 'active', label: 'Active', width: '100px' },
  {
    key: 'actions',
    label: 'Actions',
    align: 'right',
    required: true,
    width: '56px',
    mobile: 'hidden',
  },
]

const empty = (): CarRentalClassInput => ({
  code: '',
  name: '',
  description: null,
  exampleModels: null,
  vehicleType: 'car',
  isDefault: false,
  sortOrder: 0,
  active: true,
})
const editing = ref<CarRentalClassDto | null>(null)
const dialogOpen = ref(false)
const form = reactive<CarRentalClassInput>(empty())
const errors = ref<Record<string, string | null>>({})
const formError = ref<string | null>(null)
const saving = ref(false)

function openNew() {
  editing.value = null
  Object.assign(form, empty())
  errors.value = {}
  formError.value = null
  dialogOpen.value = true
}
function openEdit(row: CarRentalClassDto) {
  editing.value = row
  Object.assign(form, { ...row })
  errors.value = {}
  formError.value = null
  dialogOpen.value = true
}

async function refresh() {
  await queryClient.invalidateQueries({ queryKey: travelKeys.carClasses.all })
}

async function save() {
  errors.value = {}
  formError.value = null
  if (!/^[A-Za-z]{4}$/.test(form.code.trim())) errors.value.code = 'Use a 4-letter code, e.g. ECMR.'
  if (form.name.trim().length < 2) errors.value.name = 'Give the class a name.'
  if (Object.values(errors.value).some(Boolean)) return
  saving.value = true
  const body = {
    ...form,
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    description: form.description?.trim() || null,
    exampleModels: form.exampleModels?.trim() || null,
    sortOrder: Number(form.sortOrder) || 0,
  }
  try {
    if (editing.value) {
      const { id: _id, ...patch } = { ...body, id: editing.value.id }
      await api.patch(`/travel/car-classes/${editing.value.id}`, patch)
      toast.success(`${body.code} saved.`)
    } else {
      await api.post('/travel/car-classes', body)
      toast.success(`${body.code} added.`)
    }
    dialogOpen.value = false
    await refresh()
  } catch (error) {
    if (isApiError(error) && error.isValidationError) {
      errors.value = Object.fromEntries(
        Object.entries(error.fieldErrors).map(([k, v]) => [k, v[0] ?? null]),
      )
    } else if (isApiError(error) && error.status === 409) {
      errors.value = { code: error.detail ?? 'This code is taken.' }
    } else {
      formError.value = describeError(error).detail ?? describeError(error).title
    }
  } finally {
    saving.value = false
  }
}

async function patch(row: CarRentalClassDto, body: Partial<CarRentalClassInput>, message: string) {
  try {
    await api.patch(`/travel/car-classes/${row.id}`, body)
    toast.success(message)
    await refresh()
  } catch (error) {
    toast.error(describeError(error))
  }
}

const { confirm } = useConfirm()
const vehicleLabel = (row: CarRentalClassDto) => (row.vehicleType === 'van' ? 'van' : 'car')

// Both change what travellers can book without approval, so they ask first; activating doesn't.
async function makeStandard(row: CarRentalClassDto) {
  const ok = await confirm({
    title: `Make ${row.code} the standard ${vehicleLabel(row)}?`,
    description: `It replaces the current standard class. Requests for any other ${vehicleLabel(row)} class then need approval.`,
    confirmLabel: 'Make standard',
  })
  if (!ok) return
  await patch(
    row,
    { isDefault: true },
    `${row.code} is now the standard ${row.vehicleType}. Other ${row.vehicleType} classes need approval.`,
  )
}

async function toggleActive(row: CarRentalClassDto) {
  if (
    row.active &&
    !(await confirm({
      title: `Deactivate ${row.code}?`,
      description:
        'Nobody can choose it for new requests. Existing requests keep it. You can activate it again.',
      confirmLabel: 'Deactivate',
      cancelLabel: 'Keep active',
      destructive: true,
    }))
  )
    return
  await patch(
    row,
    { active: !row.active },
    row.active
      ? `${row.code} deactivated. Nobody can choose it for new requests.`
      : `${row.code} activated.`,
  )
}
</script>

<template>
  <PageBody wide>
    <PageHeader
      title="Car classes"
      subtitle="The standard class per vehicle type needs no approval; every other class does."
    >
      <template #actions>
        <UiButton variant="primary" :icon="Plus" @click="openNew">New class</UiButton>
      </template>
    </PageHeader>

    <DataTable
      class="mt-6"
      :columns="columns"
      :rows="rows"
      :loading="classes.isPending.value"
      :error="classes.error.value"
      noun="car classes"
      storage-key="travel-car-classes"
      :empty="{ title: 'No car classes', description: 'Add the standard class first.' }"
      @retry="classes.refetch()"
    >
      <template #cell-standard="{ row }">
        <UiTag v-if="row.isDefault" tone="positive" :icon="Star">Standard</UiTag>
      </template>
      <template #cell-active="{ row }">
        <span :class="row.active ? 'text-st-positive' : 'text-ink-subtle'">{{
          row.active ? 'Active' : 'Inactive'
        }}</span>
      </template>
      <template #cell-actions="{ row }">
        <UiMenu :aria-label="`Actions for ${row.code}`">
          <template #trigger>
            <UiIconButton :icon="Ellipsis" :label="`Actions for ${row.code}`" />
          </template>
          <UiMenuItem :icon="Pencil" @select="openEdit(row)">Edit</UiMenuItem>
          <UiMenuItem v-if="!row.isDefault && row.active" :icon="Star" @select="makeStandard(row)"
            >Make standard</UiMenuItem
          >
          <UiMenuItem
            v-if="!row.isDefault"
            :icon="Power"
            :destructive="row.active"
            @select="toggleActive(row)"
            >{{ row.active ? 'Deactivate' : 'Activate' }}</UiMenuItem
          >
        </UiMenu>
      </template>
    </DataTable>

    <UiDialog
      v-model:open="dialogOpen"
      :title="editing ? `Edit ${editing.code}` : 'New car class'"
      description="Industry-style 4-letter codes, e.g. ECMR for an economy car with a manual gearbox."
    >
      <form class="grid gap-5" novalidate @submit.prevent="save">
        <div class="grid gap-5 sm:grid-cols-[120px_minmax(0,1fr)]">
          <UiField label="Code" :error="errors.code">
            <UiInput v-model="form.code" mono maxlength="4" class="uppercase" />
          </UiField>
          <UiField label="Name" :error="errors.name">
            <UiInput v-model="form.name" maxlength="80" />
          </UiField>
        </div>
        <UiField label="Vehicle type" group :error="errors.vehicleType">
          <UiSegmented
            v-model="form.vehicleType"
            label="Vehicle type"
            :options="[
              { value: 'car', label: 'Car' },
              { value: 'van', label: 'Van' },
            ]"
          />
        </UiField>
        <UiField label="Description" optional :error="errors.description">
          <UiTextarea v-model="form.description" :maxlength="500" :rows="2" />
        </UiField>
        <UiField
          label="Example models"
          optional
          hint="Shown on the class card."
          :error="errors.exampleModels"
        >
          <UiInput v-model="form.exampleModels" maxlength="200" />
        </UiField>
        <UiField label="Sort order" :error="errors.sortOrder">
          <UiInput v-model="form.sortOrder" type="number" min="0" max="9999" class="w-32" />
        </UiField>
        <div class="grid gap-3">
          <UiSwitch
            v-model="form.isDefault"
            label="Standard class"
            description="The standard class of its vehicle type needs no approval. Setting it replaces the current one."
            :disabled="editing?.isDefault"
          />
          <UiSwitch v-model="form.active" label="Active" :disabled="form.isDefault" />
        </div>
        <p v-if="formError" class="text-sm text-st-negative" role="alert">{{ formError }}</p>
        <div class="flex justify-end gap-2">
          <UiButton variant="secondary" @click="dialogOpen = false">Cancel</UiButton>
          <UiButton type="submit" variant="primary" :loading="saving">{{
            editing ? 'Save class' : 'Add class'
          }}</UiButton>
        </div>
      </form>
    </UiDialog>
  </PageBody>
</template>
