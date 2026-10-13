<script setup lang="ts">
import { DropdownMenuItem } from 'reka-ui'
import type { Component, HTMLAttributes } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { cn } from '~/lib/cn'

/** A DropdownMenu item: icon · label · meta (or shortcut). `to` navigates; `destructive` is negative. */
const props = defineProps<{
  icon?: Component
  meta?: string
  kbd?: string
  to?: RouteLocationRaw
  destructive?: boolean
  disabled?: boolean
  class?: HTMLAttributes['class']
}>()
const emit = defineEmits<{ select: [event: Event] }>()

async function onSelect(event: Event) {
  emit('select', event)
  if (props.to) await navigateTo(props.to)
}
</script>

<template>
  <DropdownMenuItem
    :disabled="disabled"
    :class="
      cn(
        'flex min-h-9 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-base outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-45 data-highlighted:bg-hover',
        destructive ? 'text-st-negative' : 'text-ink',
        props.class,
      )
    "
    @select="onSelect"
  >
    <component
      :is="icon"
      v-if="icon"
      class="size-4"
      :class="destructive ? 'text-st-negative' : 'text-ink-subtle'"
      aria-hidden="true"
    />
    <span class="min-w-0 flex-1"><slot /></span>
    <span v-if="meta" class="ml-auto text-meta text-ink-subtle">{{ meta }}</span>
    <UiKbd v-if="kbd" class="ml-auto">{{ kbd }}</UiKbd>
  </DropdownMenuItem>
</template>
