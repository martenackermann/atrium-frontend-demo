<script setup lang="ts">
import { FileText, X } from '@lucide/vue'
import { describeError } from '~/lib/api'
import type { AttachmentDto } from '~/types/api'

/**
 * FileList (DESIGN §9): file-text · name (opens via a 5-minute signed URL) · size · uploader ·
 * remove. Files are private and shown only to people on the request.
 */
const props = defineProps<{
  files: readonly AttachmentDto[]
  removable?: boolean
  empty?: string
}>()
const emit = defineEmits<{ remove: [file: AttachmentDto] }>()

const api = useApi()
const toast = useToast()

async function open(file: AttachmentDto) {
  try {
    await api.openAttachment(file.id)
  } catch (error) {
    toast.error(describeError(error))
  }
}
</script>

<template>
  <ul v-if="files.length" class="m-0 list-none p-0">
    <li
      v-for="file in props.files"
      :key="file.id"
      class="flex items-center gap-3 border-b border-rule py-2.5 text-base last:border-b-0"
    >
      <FileText class="size-4 text-ink-subtle" aria-hidden="true" />
      <button type="button" class="link min-w-0 truncate text-left font-medium" @click="open(file)">
        {{ file.originalName }}
      </button>
      <span class="ml-auto flex-none text-sm text-ink-muted">
        {{ formatBytes(file.sizeBytes) }} · {{ file.uploadedBy.displayName }}
      </span>
      <UiIconButton
        v-if="removable"
        :icon="X"
        size="sm"
        :label="`Remove ${file.originalName}`"
        @click="emit('remove', file)"
      />
    </li>
  </ul>
  <p v-else-if="empty" class="text-sm text-ink-muted">{{ empty }}</p>
</template>
