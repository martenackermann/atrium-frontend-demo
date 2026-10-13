<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import type { Crumb } from '~/types/ui'

/** Breadcrumbs (DESIGN §9): 13px, chevron separators, current in ink 500; middle crumbs truncate on mobile. */
defineProps<{ crumbs: readonly Crumb[] }>()
</script>

<template>
  <nav aria-label="Breadcrumb" class="min-w-0">
    <ol class="m-0 flex min-w-0 list-none items-center gap-1.5 p-0 text-sm text-ink-subtle">
      <li
        v-for="(crumb, index) in crumbs"
        :key="index"
        class="flex min-w-0 items-center gap-1.5"
        :class="index > 0 && index < crumbs.length - 1 && 'max-md:hidden'"
      >
        <ChevronRight v-if="index > 0" class="size-3.5 flex-none" aria-hidden="true" />
        <NuxtLink
          v-if="crumb.to && index < crumbs.length - 1"
          :to="crumb.to"
          class="truncate no-underline hover:text-ink"
          >{{ crumb.label }}</NuxtLink
        >
        <span v-else aria-current="page" class="truncate font-medium text-ink">{{
          crumb.label
        }}</span>
      </li>
    </ol>
  </nav>
</template>
