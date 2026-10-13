<script setup lang="ts">
import type { Component } from 'vue'

/** Mini-chip flag (DESIGN §9): "Escalated", "for Priya Raman" — 20px pill, never colour-only. */
defineProps<{ icon?: Component; label: string }>()
</script>

<template>
  <span
    class="inline-flex h-5 items-center gap-1 rounded-pill bg-sheet px-[7px] text-[11.5px] font-medium whitespace-nowrap text-ink-muted shadow-[inset_0_0_0_1px_var(--rule-strong)]"
  >
    <component :is="icon" v-if="icon" class="size-3" aria-hidden="true" />
    {{ label }}
  </span>
</template>
