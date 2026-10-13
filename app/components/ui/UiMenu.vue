<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { cn } from '~/lib/cn'

/**
 * DropdownMenu (DESIGN §9): level 2 with hairline; group labels; items with icon · label ·
 * meta/shortcut; separators; destructive items last, in negative.
 *
 *   <UiMenu aria-label="Request actions">
 *     <template #trigger><UiIconButton :icon="Ellipsis" label="More actions" /></template>
 *     <UiMenuItem :icon="Copy" @select="duplicate">Duplicate</UiMenuItem>
 *     <UiMenuSeparator />
 *     <UiMenuItem destructive @select="cancel">Cancel request</UiMenuItem>
 *   </UiMenu>
 */
const props = withDefaults(
  defineProps<{
    side?: 'top' | 'right' | 'bottom' | 'left'
    align?: 'start' | 'center' | 'end'
    class?: HTMLAttributes['class']
  }>(),
  { side: 'bottom', align: 'end' },
)
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger as-child>
      <slot name="trigger" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :side="side"
        :align="align"
        :side-offset="6"
        :collision-padding="8"
        :class="
          cn(
            'z-[60] max-h-(--reka-dropdown-menu-content-available-height) min-w-60 overflow-y-auto rounded-lg border border-rule bg-raised p-1.5 shadow-pop outline-none data-[state=open]:animate-[atrium-menu-in_var(--dur-2)_var(--curve-out)]',
            props.class,
          )
        "
      >
        <slot />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
