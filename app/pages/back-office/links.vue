<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  GripVertical,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from '@lucide/vue'
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import { newsKeys, useLinks } from '~/modules/news/api'
import type { UsefulLinkDto } from '~/modules/news/api/types'
import { LINK_ICONS, linkIcon } from '~/modules/news/constants'

/**
 * `/back-office/links` (SCREENS §8, owned by A4): the useful links on Home. A sortable list (drag
 * handle; up/down buttons on every screen size) saved with `PUT /links/order`, an active switch,
 * New / Edit dialog (title, https URL, description, icon from the allowlist, category) and Delete.
 */
definePageMeta({ title: 'Useful links', access: ['news_editor', 'it_admin'] })

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const links = useLinks(true)

const order = ref<UsefulLinkDto[]>([])
watch(
  () => links.data.value,
  (value) => {
    order.value = [...(value ?? [])]
  },
  { immediate: true },
)
const invalidate = () => queryClient.invalidateQueries({ queryKey: newsKeys.links.module })

async function saveOrder(next: UsefulLinkDto[], moved: UsefulLinkDto) {
  const previous = order.value
  order.value = next
  try {
    await api.put('/links/order', { ids: next.map((link) => link.id) })
    toast.success(`Moved ${moved.title}.`)
    await invalidate()
  } catch (error) {
    order.value = previous
    toast.error(describeError(error))
  }
}

function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= order.value.length) return
  const next = [...order.value]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item!)
  void saveOrder(next, item!)
}

// Drag and drop (desktop); the buttons stay available for keyboard and touch.
const dragIndex = ref<number | null>(null)
const overIndex = ref<number | null>(null)
function onDrop(index: number) {
  const from = dragIndex.value
  dragIndex.value = null
  overIndex.value = null
  if (from === null || from === index) return
  const next = [...order.value]
  const [item] = next.splice(from, 1)
  next.splice(index, 0, item!)
  void saveOrder(next, item!)
}

async function toggleActive(link: UsefulLinkDto, active: boolean) {
  try {
    await api.patch(`/links/${link.id}`, { active })
    toast.success(active ? `${link.title} is shown on Home.` : `${link.title} is hidden.`)
    await invalidate()
  } catch (error) {
    toast.error(describeError(error))
  }
}

const removing = ref<UsefulLinkDto | null>(null)
const deleteOpen = computed({
  get: () => removing.value !== null,
  set: (value: boolean) => {
    if (!value) removing.value = null
  },
})
const deleting = ref(false)
async function remove() {
  const link = removing.value
  if (!link) return
  deleting.value = true
  try {
    await api.delete(`/links/${link.id}`)
    toast.success('Link deleted.')
    removing.value = null
    await invalidate()
  } catch (error) {
    toast.error(describeError(error))
  } finally {
    deleting.value = false
  }
}

// Dialog ------------------------------------------------------------------------------------------
const dialogOpen = ref(false)
const editing = ref<UsefulLinkDto | null>(null)
const formError = ref<string | null>(null)
const schema = toTypedSchema(
  z.object({
    title: z.string().trim().min(1, 'Give the link a title.').max(80),
    url: z
      .string()
      .trim()
      .regex(
        /^https:\/\/[^\s/]+\.[^\s]+$/,
        'Use an https:// address, like https://wiki.example.com.',
      ),
    description: z.string().max(200).nullable(),
    icon: z.string().nullable(),
    category: z.string().max(60).nullable(),
    active: z.boolean(),
  }),
)
const { defineField, errors, handleSubmit, isSubmitting, resetForm, setFieldError } = useForm({
  validationSchema: schema,
})
const [title] = defineField('title')
const [url] = defineField('url')
const [description] = defineField('description')
const [icon] = defineField('icon')
const [category] = defineField('category')
const [active] = defineField<'active', boolean>('active')
const iconOptions = Object.entries(LINK_ICONS).map(([value, meta]) => ({
  value,
  label: meta.label,
}))

function openDialog(link: UsefulLinkDto | null = null) {
  editing.value = link
  formError.value = null
  resetForm({
    values: {
      title: link?.title ?? '',
      url: link?.url ?? 'https://',
      description: link?.description ?? null,
      icon: link?.icon ?? 'link',
      category: link?.category ?? null,
      active: link?.active ?? true,
    },
  })
  dialogOpen.value = true
}

const save = handleSubmit(async (values) => {
  formError.value = null
  const body = {
    title: values.title.trim(),
    url: values.url.trim(),
    description: values.description?.trim() || null,
    icon: values.icon || null,
    category: values.category?.trim() || null,
    active: values.active,
  }
  try {
    if (editing.value) await api.patch(`/links/${editing.value.id}`, body)
    else await api.post('/links', body)
    toast.success(editing.value ? 'Link saved.' : `${body.title} added.`)
    dialogOpen.value = false
    await invalidate()
  } catch (error) {
    if (isApiError(error) && error.isValidationError) {
      for (const [path, messages] of Object.entries(error.fieldErrors)) {
        if (['title', 'url', 'description', 'icon', 'category'].includes(path)) {
          setFieldError(path as 'title', messages[0])
        } else formError.value = messages[0] ?? null
      }
      return
    }
    formError.value = describeError(error).detail ?? describeError(error).title
  }
})
</script>

<template>
  <PageBody>
    <PageHeader
      title="Useful links"
      subtitle="Shown on Home in this order. Inactive links are visible to editors only."
    >
      <template #actions>
        <UiButton variant="primary" :icon="Plus" @click="openDialog()">New link</UiButton>
      </template>
    </PageHeader>

    <div v-if="links.isPending.value" class="mt-8 grid gap-2" aria-busy="true">
      <UiSkeleton v-for="index in 6" :key="index" class="h-14" />
    </div>
    <ProblemAlert v-else-if="links.error.value" :error="links.error.value" class="mt-8" />
    <EmptyState
      v-else-if="!order.length"
      class="mt-10"
      :icon="Link2"
      title="No links yet"
      description="Add the tools people open every day."
    >
      <UiButton variant="secondary" :icon="Plus" @click="openDialog()">New link</UiButton>
    </EmptyState>
    <ol
      v-else
      class="m-0 mt-8 list-none border-t border-ink p-0"
      aria-label="Useful links in order"
    >
      <li
        v-for="(link, index) in order"
        :key="link.id"
        class="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 border-b border-rule py-3 transition-colors md:grid-cols-[24px_36px_minmax(0,1fr)_160px_auto] md:gap-y-3"
        :class="[overIndex === index && 'bg-marker-tint', !link.active && 'text-ink-muted']"
        draggable="true"
        :data-testid="`link-row-${index}`"
        @dragstart="dragIndex = index"
        @dragover.prevent="overIndex = index"
        @dragleave="overIndex = null"
        @drop.prevent="onDrop(index)"
      >
        <GripVertical class="size-4 cursor-grab text-ink-subtle max-md:hidden" aria-hidden="true" />
        <span
          class="grid size-9 place-items-center rounded-md bg-well text-ink-muted shadow-[inset_0_0_0_1px_var(--rule)]"
          aria-hidden="true"
        >
          <component :is="linkIcon(link.icon)" class="size-4" />
        </span>
        <div class="min-w-0">
          <p class="flex items-center gap-2 font-semibold text-ink">
            {{ link.title }}
            <span v-if="!link.active" class="text-meta font-medium text-ink-subtle">Hidden</span>
          </p>
          <a
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="link inline-flex max-w-full items-center gap-1 text-sm text-ink-muted"
            ><span class="truncate">{{ link.url }}</span
            ><ExternalLink class="size-3 flex-none" aria-hidden="true" /><span class="sr"
              >(opens in a new tab)</span
            ></a
          >
        </div>
        <span class="text-sm text-ink-muted max-md:hidden">{{ link.category ?? '—' }}</span>
        <!-- Phones: the controls get their own row under the title, so the title keeps the width. -->
        <div class="flex items-center gap-1 max-md:col-start-2 max-md:-ml-1">
          <UiSwitch
            :model-value="link.active"
            @update:model-value="(value: boolean) => toggleActive(link, value)"
            ><span class="sr">Show {{ link.title }} on Home</span></UiSwitch
          >
          <UiIconButton
            :icon="ArrowUp"
            :label="`Move ${link.title} up`"
            size="sm"
            :disabled="index === 0"
            @click="move(index, -1)"
          />
          <UiIconButton
            :icon="ArrowDown"
            :label="`Move ${link.title} down`"
            size="sm"
            :disabled="index === order.length - 1"
            @click="move(index, 1)"
          />
          <UiIconButton
            :icon="Pencil"
            :label="`Edit ${link.title}`"
            size="sm"
            @click="openDialog(link)"
          />
          <UiIconButton
            :icon="Trash2"
            :label="`Delete ${link.title}`"
            size="sm"
            @click="removing = link"
          />
        </div>
      </li>
    </ol>

    <NewsConfirmDelete
      v-model:open="deleteOpen"
      :title="`Delete ${removing?.title ?? 'this link'}?`"
      description="It disappears from Home for everyone. You can add it again later."
      confirm-label="Delete link"
      :loading="deleting"
      @confirm="remove"
    />
    <UiDialog
      v-model:open="dialogOpen"
      :title="editing ? `Edit ${editing.title}` : 'New link'"
      description="Links open in a new tab."
    >
      <form id="link-form" class="grid gap-4" novalidate @submit="save">
        <UiField label="Title" :error="errors.title">
          <UiInput v-model="title" :maxlength="80" />
        </UiField>
        <UiField label="URL" hint="https:// addresses only." :error="errors.url">
          <UiInput v-model="url" type="url" />
        </UiField>
        <UiField label="Description" optional :error="errors.description">
          <UiInput v-model="description" :maxlength="200" />
        </UiField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UiField label="Icon" :error="errors.icon">
            <UiSelect v-model="icon" :options="iconOptions" />
          </UiField>
          <UiField label="Category" optional :error="errors.category">
            <UiInput v-model="category" :maxlength="60" />
          </UiField>
        </div>
        <UiSwitch v-model="active" label="Show on Home" />
        <p v-if="formError" role="alert" class="text-sm text-st-negative">{{ formError }}</p>
      </form>
      <template #footer>
        <UiButton variant="secondary" @click="dialogOpen = false">Cancel</UiButton>
        <UiButton variant="primary" type="submit" form="link-form" :loading="isSubmitting">
          {{ editing ? 'Save link' : 'Add link' }}
        </UiButton>
      </template>
    </UiDialog>
  </PageBody>
</template>
