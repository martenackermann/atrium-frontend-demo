<script setup lang="ts">
import type { UserRef } from '~/types/api'

/**
 * "Who is travelling?" (SCREENS §5.3): yourself by default; managers pick someone from their
 * team (`scope=team`), the travel desk anyone. Others see their own name.
 */
const props = defineProps<{
  me: UserRef | null
  canPickOthers: boolean
  isDesk: boolean
  error?: string | null
  label?: string
}>()
const model = defineModel<UserRef | null>({ required: true })

const who = ref<'me' | 'other'>(
  model.value && props.me && model.value.id !== props.me.id ? 'other' : 'me',
)
watch(
  () => model.value?.id,
  (id) => {
    if (id && props.me && id !== props.me.id) who.value = 'other'
  },
)
watch(who, (value) => {
  if (value === 'me') model.value = props.me
  else if (model.value?.id === props.me?.id) model.value = null
})
</script>

<template>
  <div class="grid gap-3">
    <UiSegmented
      v-if="canPickOthers"
      v-model="who"
      :label="label ?? 'Who is travelling?'"
      :options="[
        { value: 'me', label: 'Me' },
        { value: 'other', label: isDesk ? 'Someone else' : 'Someone in my team' },
      ]"
    />
    <UiField
      id="traveller"
      :label="label ?? 'Traveller'"
      :hint="
        who === 'other'
          ? isDesk
            ? 'The travel desk can book for anyone.'
            : 'People in your reporting line.'
          : undefined
      "
      :error="error"
    >
      <UserPicker v-if="who === 'other'" v-model="model" :scope="isDesk ? 'all' : 'team'" />
      <div
        v-else-if="model"
        class="flex items-center gap-3 rounded-md border border-rule bg-well px-3 py-2.5"
      >
        <UiAvatar :name="model.displayName" :initials="model.initials" size="sm" me />
        <span class="grid leading-tight">
          <span class="font-medium">{{ model.displayName }}</span>
          <span v-if="model.jobTitle" class="text-sm text-ink-muted">{{ model.jobTitle }}</span>
        </span>
      </div>
    </UiField>
  </div>
</template>
