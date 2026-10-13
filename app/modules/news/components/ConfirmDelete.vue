<script setup lang="ts">
/**
 * Delete confirmation for news posts and links. A local dialog instead of the shared
 * `useConfirm()`, whose confirm button currently resolves as "cancel" (reported to the foundation).
 */
defineProps<{ title: string; description: string; confirmLabel: string; loading?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <UiDialog v-model:open="open" :title="title" :description="description" size="sm">
    <template #footer>
      <UiButton variant="secondary" @click="open = false">Keep it</UiButton>
      <UiButton variant="danger-solid" :loading="loading" @click="emit('confirm')">{{
        confirmLabel
      }}</UiButton>
    </template>
  </UiDialog>
</template>
