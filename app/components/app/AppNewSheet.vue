<script setup lang="ts">
/** Mobile "New" action sheet: the create commands the user is allowed (DESIGN §7). */
const { newSheetOpen } = useShell()
const { createCommands } = useCommands()

async function go(to: unknown) {
  newSheetOpen.value = false
  if (to) await navigateTo(to as string)
}
</script>

<template>
  <UiDialog v-model:open="newSheetOpen" title="New request">
    <ul class="m-0 grid list-none gap-1 p-0">
      <li v-for="command in createCommands" :key="command.id">
        <button
          type="button"
          class="flex h-11 w-full items-center gap-3 rounded-md px-2.5 text-left text-base hover:bg-hover"
          @click="go(command.to)"
        >
          <component
            :is="command.icon"
            v-if="command.icon"
            class="size-5 text-ink-muted"
            aria-hidden="true"
          />
          {{ command.label }}
        </button>
      </li>
    </ul>
  </UiDialog>
</template>
