<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { cn } from '~/lib/cn'

/** Popover (DESIGN §9): level 2, radius 10, hairline. Trigger via the `trigger` slot (as-child). */
const props = withDefaults(
  defineProps<{
    side?: 'top' | 'right' | 'bottom' | 'left'
    align?: 'start' | 'center' | 'end'
    class?: HTMLAttributes['class']
  }>(),
  { side: 'bottom', align: 'start' },
)
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :side="side"
        :align="align"
        :side-offset="6"
        :class="
          cn(
            'z-[60] w-72 rounded-lg border border-rule bg-raised p-4 shadow-pop outline-none data-[state=open]:animate-[atrium-menu-in_var(--dur-2)_var(--curve-out)]',
            props.class,
          )
        "
      >
        <slot :close="() => (open = false)" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
