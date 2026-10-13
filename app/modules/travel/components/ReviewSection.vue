<script setup lang="ts">
import { Pencil } from '@lucide/vue'
import type { FactItem } from '~/types/ui'

/** One section of the Review step: title, "Edit" link back to its step, and the facts. */
defineProps<{ title: string; facts: FactItem[] }>()
defineEmits<{ edit: [] }>()
</script>

<template>
  <section class="grid gap-2">
    <header class="flex items-center justify-between gap-3">
      <h3 class="text-[15px] font-[650]">{{ title }}</h3>
      <UiButton size="sm" variant="ghost" :icon="Pencil" @click="$emit('edit')"
        >Edit<span class="sr-only"> {{ title }}</span></UiButton
      >
    </header>
    <FactGrid :items="facts" :columns="2" />
  </section>
</template>
