<script setup lang="ts">
/** Mobile "Menu" tab: the sidebar as a drawer, including the account and persona menu (DESIGN §7). */
const { menuOpen } = useShell()
</script>

<template>
  <UiDrawer v-model:open="menuOpen" title="Menu" side="left" width="320px">
    <div class="grid gap-4 p-3">
      <AppNav @navigate="menuOpen = false" />
      <PersonaSwitcher />
    </div>
  </UiDrawer>
</template>
