<script setup lang="ts">
/**
 * ReasonDialog (SCREENS §1.6): asks for a reason (3–1000 characters) before a transition such as
 * decline, reject or cancel. The textarea autofocuses (bottom sheet on mobile). Emits the reason;
 * the caller runs the action and closes the dialog (keep it open on a 422).
 */
const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    label?: string
    /** Who sees it: "Emma sees this reason in her email." */
    hint?: string
    confirmLabel: string
    destructive?: boolean
    required?: boolean
    min?: number
    max?: number
    loading?: boolean
    /** Server-side error for the reason (e.g. from a 422). */
    error?: string | null
  }>(),
  { label: 'Reason', required: true, min: 3, max: 1000 },
)
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: [reason: string] }>()

const reason = ref('')
const touched = ref(false)
watch(open, (value) => {
  if (value) {
    reason.value = ''
    touched.value = false
  }
})

const localError = computed(() => {
  if (!touched.value) return null
  const text = reason.value.trim()
  if (props.required && text.length < props.min) {
    return text.length === 0
      ? 'Add a reason. The requester needs it to change the request.'
      : `Use at least ${props.min} characters.`
  }
  return null
})

function submit() {
  touched.value = true
  if (localError.value) return
  emit('submit', reason.value.trim())
}
</script>

<template>
  <UiDialog v-model:open="open" :title="title" :description="description" size="sm">
    <form id="reason-dialog-form" class="grid gap-3" novalidate @submit.prevent="submit">
      <UiField :label="label" :hint="hint" :error="localError ?? error" :optional="!required">
        <UiTextarea v-model="reason" :maxlength="max" autofocus />
      </UiField>
    </form>
    <template #footer>
      <UiButton variant="secondary" @click="open = false">Cancel</UiButton>
      <UiButton
        type="submit"
        form="reason-dialog-form"
        :variant="destructive ? 'danger-solid' : 'primary'"
        :loading="loading"
        >{{ confirmLabel }}</UiButton
      >
    </template>
  </UiDialog>
</template>
