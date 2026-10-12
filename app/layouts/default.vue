<script setup lang="ts">
// PLACEHOLDER shell (phase 2a): proves navigation aggregation + auth. Phase 2b builds the real
// app shell from DESIGN.md / SCREENS.md.
const auth = useAuthStore()
const { sections } = useNavigation()
const { enabled: demoMode, reset } = useDemoMode()
</script>

<template>
  <div class="min-h-dvh">
    <header
      class="flex items-center gap-6 border-b border-neutral-200 px-6 py-3 dark:border-neutral-800"
    >
      <NuxtLink to="/" class="font-semibold">Atrium</NuxtLink>
      <nav aria-label="Main" class="flex flex-1 flex-wrap gap-4 text-sm">
        <NuxtLink
          v-for="entry in [...sections.main, ...sections.admin]"
          :key="entry.id"
          :to="entry.to"
          class="inline-flex items-center gap-1.5 hover:underline"
          active-class="font-semibold"
        >
          <component :is="entry.icon" v-if="entry.icon" class="size-4" aria-hidden="true" />
          {{ entry.label }}
        </NuxtLink>
      </nav>
      <div class="flex items-center gap-3 text-sm">
        <button v-if="demoMode" type="button" class="hover:underline" @click="reset()">
          Reset demo data
        </button>
        <span data-testid="current-user">{{ auth.user?.displayName }}</span>
        <button type="button" class="hover:underline" @click="auth.logout()">Sign out</button>
      </div>
    </header>
    <main class="mx-auto max-w-6xl px-6 py-8">
      <slot />
    </main>
  </div>
</template>
