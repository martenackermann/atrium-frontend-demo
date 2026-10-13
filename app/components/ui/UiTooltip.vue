<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'

/**
 * Tooltip (DESIGN §9): ink panel, paper text, 12px, 400 ms delay (TooltipProvider in app.vue).
 * Never the only place for essential information. Wraps its trigger (as-child).
 */
withDefaults(
  defineProps<{
    content: string
    side?: 'top' | 'right' | 'bottom' | 'left'
    disabled?: boolean
  }>(),
  { side: 'top' },
)
</script>

<template>
  <TooltipRoot :disabled="disabled">
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        :side="side"
        :side-offset="6"
        class="z-[70] max-w-64 rounded-md bg-ink px-2 py-1 text-meta text-ink-inverse shadow-pop data-[state=delayed-open]:animate-[atrium-fade_var(--dur-2)_var(--curve-out)]"
      >
        {{ content }}
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
