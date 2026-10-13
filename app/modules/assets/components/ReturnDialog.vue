<script setup lang="ts">
import type { RadioCardOption } from '~/types/ui'
import type { ReturnCondition } from '../api/types'

/**
 * Record a return (SPEC §5.3 `return`): condition OK → back to stock, damaged → in repair; optional
 * note. The former holder gets a confirmation. Emits the body of `return`.
 */
defineProps<{ holder: string | null; loading?: boolean; error?: string | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: [body: { condition: ReturnCondition; note: string | null }] }>()

const condition = ref<ReturnCondition | undefined>()
const note = ref('')
const touched = ref(false)
watch(open, (value) => {
  if (value) {
    condition.value = undefined
    note.value = ''
    touched.value = false
  }
})

const options: RadioCardOption<ReturnCondition>[] = [
  {
    value: 'ok',
    title: 'OK',
    description: 'Goes back to stock, ready for the next person.',
    tag: { label: 'In stock', tone: 'neutral' },
  },
  {
    value: 'damaged',
    title: 'Damaged',
    description: 'Goes to repair first.',
    tag: { label: 'In repair', tone: 'waiting' },
  },
]

function submit() {
  touched.value = true
  if (!condition.value) return
  emit('submit', { condition: condition.value, note: note.value.trim() || null })
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Record the return"
    :description="
      holder
        ? `${holder} handed the device back. They get a confirmation.`
        : 'The device comes back to IT.'
    "
    size="md"
  >
    <form id="return-form" class="grid gap-4" novalidate @submit.prevent="submit">
      <UiField
        label="Condition"
        group
        :error="(touched && !condition ? 'Choose the condition of the device.' : null) ?? error"
      >
        <UiRadioCards v-model="condition" :options="options" aria-label="Condition" />
      </UiField>
      <UiField label="Note" optional hint="For example what is broken.">
        <UiTextarea v-model="note" :maxlength="1000" :rows="3" />
      </UiField>
    </form>
    <template #footer>
      <UiButton variant="secondary" @click="open = false">Cancel</UiButton>
      <UiButton type="submit" form="return-form" variant="primary" :loading="loading"
        >Record return</UiButton
      >
    </template>
  </UiDialog>
</template>
