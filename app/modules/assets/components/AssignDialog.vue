<script setup lang="ts">
import type { UserRef } from '~/types/api'

/**
 * Assign dialog (SCREENS §6.6): choose the person (UserPicker, active users) and an optional note.
 * The user gets an email and an in-app to-do to accept the device. Emits the body of `assign`.
 */
const props = defineProps<{
  deviceLabel: string
  loading?: boolean
  errors?: Record<string, string | undefined>
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: [body: { userId: string; note: string | null }] }>()

const user = ref<UserRef | null>(null)
const note = ref('')
const touched = ref(false)
watch(open, (value) => {
  if (value) {
    user.value = null
    note.value = ''
    touched.value = false
  }
})
const userError = computed(
  () =>
    (touched.value && !user.value ? 'Choose who gets the device.' : null) ?? props.errors?.userId,
)

function submit() {
  touched.value = true
  if (!user.value) return
  emit('submit', { userId: user.value.id, note: note.value.trim() || null })
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Assign device"
    :description="`${deviceLabel}. They get an email and a to-do to accept it.`"
    size="md"
  >
    <form id="assign-form" class="grid gap-4" novalidate @submit.prevent="submit">
      <UiField label="Person" :error="userError">
        <UserPicker v-model="user" placeholder="Search by name or email" />
      </UiField>
      <UiField
        label="Note"
        optional
        hint="Shown to the person in the email and on the device."
        :error="errors?.note"
      >
        <UiTextarea v-model="note" :maxlength="1000" :rows="3" />
      </UiField>
    </form>
    <template #footer>
      <UiButton variant="secondary" @click="open = false">Cancel</UiButton>
      <UiButton type="submit" form="assign-form" variant="primary" :loading="loading"
        >Assign device</UiButton
      >
    </template>
  </UiDialog>
</template>
