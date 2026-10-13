<script setup lang="ts">
import { Pencil } from '@lucide/vue'
import { isApiError } from '~/lib/api'
import { usePeopleAction } from '../api'
import type { PeopleRequestDetail } from '../api/types'
import { ACTION_MESSAGES, PEOPLE_ACTIONS } from '../constants'

/**
 * The request's ActionBar (availableActions in API order) plus "Edit" while editable. Reason and
 * question dialogs keep their text on a 422 and show the server message.
 */
const props = withDefaults(
  defineProps<{ request: PeopleRequestDetail; stickyMobile?: boolean; max?: number }>(),
  { max: 3 },
)
const emit = defineEmits<{ done: [detail: PeopleRequestDetail, action: string] }>()

const bar = ref<{ setReasonError: (error: unknown) => void; done: () => void }>()
const editOpen = ref(false)
const pending = ref<string | null>(null)
const action = usePeopleAction(() => props.request.id)
const toast = useToast()

async function run(name: string, body: Record<string, unknown>) {
  pending.value = name
  try {
    const detail = await action.run(name, body)
    toast.success(ACTION_MESSAGES[name] ?? 'Done.')
    bar.value?.done()
    emit('done', detail, name)
  } catch (error) {
    if (isApiError(error) && error.status === 422) bar.value?.setReasonError(error)
  } finally {
    pending.value = null
  }
}

defineExpose({ edit: () => (editOpen.value = true) })
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UiButton
      v-if="request.availableActions.includes('edit')"
      :icon="Pencil"
      data-testid="people-edit"
      @click="editOpen = true"
      >Edit</UiButton
    >
    <ActionBar
      ref="bar"
      :actions="request.availableActions"
      :config="PEOPLE_ACTIONS"
      :pending="pending"
      :max="max"
      :sticky-mobile="stickyMobile"
      @run="run"
    />
    <PeopleEditDialog v-model:open="editOpen" :request="request" />
  </div>
</template>
