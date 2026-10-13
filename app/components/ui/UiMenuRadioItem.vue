<script setup lang="ts">
import { Check } from '@lucide/vue'
import { DropdownMenuItemIndicator, DropdownMenuRadioItem } from 'reka-ui'

/** A radio item: label + meta line; the current choice is ticked and set in 600. */
defineProps<{ value: string; meta?: string }>()
defineEmits<{ select: [event: Event] }>()
</script>

<template>
  <DropdownMenuRadioItem
    :value="value"
    class="group flex min-h-9 w-full max-md:min-h-11 cursor-pointer items-center gap-2.5 rounded-md py-1.5 pr-2.5 pl-8 text-left text-base outline-none select-none data-[state=checked]:font-semibold data-highlighted:bg-hover relative"
    @select="$emit('select', $event)"
  >
    <DropdownMenuItemIndicator class="absolute left-2.5 grid place-items-center">
      <Check class="size-4" aria-hidden="true" />
    </DropdownMenuItemIndicator>
    <span class="grid min-w-0 leading-[18px]">
      <span class="truncate"><slot /></span>
      <span v-if="meta" class="truncate text-meta font-normal text-ink-subtle">{{ meta }}</span>
    </span>
  </DropdownMenuRadioItem>
</template>
