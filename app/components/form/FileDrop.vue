<script setup lang="ts">
import { FileUp, TriangleAlert, X } from '@lucide/vue'
import { describeError, isApiError } from '~/lib/api'
import type { AttachmentDto, AttachmentPurpose } from '~/types/api'

/**
 * FileDrop (DESIGN §9, API.md "Uploads"): staged upload with progress — files are uploaded to
 * `POST /attachments` as soon as they are dropped; v-model holds the staged AttachmentDtos whose
 * ids you send as `attachmentIds`. Type and size limits come from /meta/config.
 */
const props = withDefaults(
  defineProps<{
    purpose: AttachmentPurpose
    /** Maximum number of files (API default ≤ 10). */
    max?: number
    disabled?: boolean
    id?: string
  }>(),
  { max: 10 },
)
const model = defineModel<AttachmentDto[]>({ default: () => [] })
/** True while a file is still uploading: bind `v-model:uploading` to disable the form's submit. */
const uploading = defineModel<boolean>('uploading', { default: false })

const api = useApi()
const config = usePublicConfig()
const toast = useToast()

const FALLBACK_LIMIT = 10 * 1024 * 1024
const limit = computed(() => config.data.value?.uploadMaxBytes ?? FALLBACK_LIMIT)
const allowed = computed(
  () =>
    config.data.value?.allowedMimeTypes[props.purpose] ??
    (props.purpose === 'travel_booking_confirmation'
      ? ['application/pdf']
      : ['application/pdf', 'image/png', 'image/jpeg']),
)
const pdfOnly = computed(() => allowed.value.length === 1 && allowed.value[0] === 'application/pdf')
const imagesOnly = computed(() => allowed.value.every((type) => type.startsWith('image/')))
const kindLabel = computed(() => (pdfOnly.value ? 'PDFs' : imagesOnly.value ? 'images' : 'files'))
const typeLabel = computed(() => {
  if (pdfOnly.value) return 'PDF'
  if (imagesOnly.value) return 'PNG, JPEG or WebP'
  return 'PDF, Word, PNG or JPEG'
})

interface Pending {
  key: string
  name: string
  progress: number
  error: string | null
  controller: AbortController
}
const pending = ref<Pending[]>([])
watchEffect(() => {
  const busy = pending.value.some((item) => !item.error)
  if (uploading.value !== busy) uploading.value = busy
})
const dragging = ref(false)
const input = ref<HTMLInputElement>()
const generated = useId()

async function upload(file: File) {
  const key = `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`
  const entry: Pending = {
    key,
    name: file.name,
    progress: 0,
    error: null,
    controller: new AbortController(),
  }
  pending.value.push(entry)
  const item = pending.value.find((candidate) => candidate.key === key)!

  if (file.size > limit.value) {
    item.error = `${file.name} is ${formatBytes(file.size)}. The limit is ${formatBytes(limit.value)}.`
    return
  }
  if (file.type && !allowed.value.includes(file.type)) {
    item.error = `${file.name} is not a ${typeLabel.value} file.`
    return
  }
  try {
    const dto = await api.upload(file, props.purpose, {
      onProgress: (fraction) => (item.progress = fraction),
      signal: item.controller.signal,
    })
    model.value = [...model.value, dto]
    pending.value = pending.value.filter((candidate) => candidate.key !== key)
  } catch (error) {
    item.error = isApiError(error)
      ? (error.detail ?? error.title)
      : `${file.name} could not be uploaded.`
  }
}

function addFiles(files: FileList | File[] | null | undefined) {
  if (!files || props.disabled) return
  const room = props.max - model.value.length - pending.value.filter((item) => !item.error).length
  const list = Array.from(files)
  if (list.length > room) {
    toast.info(`You can add ${room} more ${room === 1 ? 'file' : 'files'} here.`)
  }
  for (const file of list.slice(0, Math.max(room, 0))) void upload(file)
}

function onDrop(event: DragEvent) {
  dragging.value = false
  addFiles(event.dataTransfer?.files)
}

function onPick(event: Event) {
  addFiles((event.target as HTMLInputElement).files)
  if (input.value) input.value.value = ''
}

async function remove(file: AttachmentDto) {
  model.value = model.value.filter((item) => item.id !== file.id)
  try {
    await api.delete(`/attachments/${file.id}`)
  } catch (error) {
    // Linked files are removed through their request; staged ones expire after 24 h anyway.
    if (!(isApiError(error) && error.status === 409)) toast.error(describeError(error))
  }
}

function dismiss(item: Pending) {
  item.controller.abort()
  pending.value = pending.value.filter((candidate) => candidate.key !== item.key)
}
</script>

<template>
  <div class="grid gap-3">
    <label
      :for="id ?? `filedrop-${generated}`"
      class="grid cursor-pointer justify-items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors duration-(--dur-1) ease-standard"
      :class="[
        dragging ? 'border-ink bg-marker-tint' : 'border-field bg-sheet hover:bg-hover',
        disabled && 'pointer-events-none opacity-45',
      ]"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <FileUp class="size-5 text-ink-muted" aria-hidden="true" />
      <span class="text-base font-medium"
        >Drop {{ kindLabel }} here or <span class="link">browse</span></span
      >
      <span class="text-sm text-ink-muted"
        >{{ typeLabel }} up to {{ formatBytes(limit) }} each</span
      >
      <input
        :id="id ?? `filedrop-${generated}`"
        ref="input"
        type="file"
        class="sr"
        :accept="allowed.join(',')"
        :multiple="max > 1"
        :disabled="disabled"
        @change="onPick"
      />
    </label>

    <ul v-if="pending.length" class="m-0 grid list-none gap-2 p-0" aria-live="polite">
      <li v-for="item in pending" :key="item.key" class="grid gap-1.5 text-sm">
        <div class="flex items-center gap-2">
          <TriangleAlert v-if="item.error" class="size-4 text-st-negative" aria-hidden="true" />
          <span class="truncate" :class="item.error ? 'text-st-negative' : 'text-ink'">{{
            item.error ?? `Uploading ${item.name}…`
          }}</span>
          <UiIconButton
            :icon="X"
            size="sm"
            :label="`Dismiss ${item.name}`"
            class="ml-auto"
            @click="dismiss(item)"
          />
        </div>
        <UiProgress v-if="!item.error" :value="item.progress" :label="`Uploading ${item.name}`" />
      </li>
    </ul>

    <FileList :files="model" removable @remove="remove" />
  </div>
</template>
