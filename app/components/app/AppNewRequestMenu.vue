<script setup lang="ts">
import { ChevronDown, Plus } from '@lucide/vue'

/** "New request" menu (DESIGN §7/§8.1): the create commands the user may run, from module registries. */
defineProps<{ rail?: boolean }>()
const { newRequestCommands, createCommands } = useCommands()
const extra = computed(() => createCommands.value.filter((command) => !command.newRequest))
</script>

<template>
  <UiMenu align="start">
    <template #trigger>
      <UiButton
        variant="secondary"
        :class="rail ? 'mb-3.5 size-11 px-0' : 'mb-3.5 w-full justify-start'"
        :aria-label="rail ? 'New request' : undefined"
      >
        <Plus class="size-4" aria-hidden="true" />
        <template v-if="!rail">
          New request
          <ChevronDown class="ml-auto size-4 text-ink-subtle" aria-hidden="true" />
        </template>
      </UiButton>
    </template>
    <UiMenuItem
      v-for="command in newRequestCommands"
      :key="command.id"
      :icon="command.icon"
      :to="command.to"
    >
      {{ command.label }}
    </UiMenuItem>
    <template v-if="extra.length">
      <UiMenuSeparator />
      <UiMenuItem v-for="command in extra" :key="command.id" :icon="command.icon" :to="command.to">
        {{ command.label }}
      </UiMenuItem>
    </template>
  </UiMenu>
</template>
