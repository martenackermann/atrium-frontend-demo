<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { X } from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  VisuallyHidden,
} from 'reka-ui'
import { cn } from '~/lib/cn'

/**
 * Drawer (DESIGN §9): right panel 420px, inset 8px, radius 12, level 3; header (serif title,
 * actions, close). Esc and scrim close it; focus moves into the panel. Full width on mobile.
 * `side="left"` is used for the mobile menu.
 */
const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    side?: 'right' | 'left'
    width?: string
    class?: HTMLAttributes['class']
  }>(),
  { side: 'right', width: '420px' },
)
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <DialogRoot v-model:open="open">
    <slot name="trigger" />
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-[atrium-fade_var(--dur-2)_var(--curve-standard)]"
      />
      <DialogContent
        :style="{ '--drawer-w': width }"
        :class="
          cn(
            'fixed inset-y-0 z-50 flex w-full flex-col bg-raised shadow-dialog outline-none md:inset-y-2 md:w-[min(var(--drawer-w),calc(100vw-16px))] md:rounded-xl',
            side === 'right'
              ? 'right-0 md:right-2 data-[state=open]:animate-[atrium-slide-in_var(--dur-3)_var(--curve-out)]'
              : 'left-0 md:left-2',
            props.class,
          )
        "
      >
        <header class="flex items-center gap-2 border-b border-rule py-3 pr-3 pl-5">
          <DialogTitle
            class="mr-auto font-display text-[24px] leading-[30px] font-normal tracking-[-0.01em]"
          >
            {{ title }}
          </DialogTitle>
          <VisuallyHidden v-if="!description"
            ><DialogDescription>{{ title }}</DialogDescription></VisuallyHidden
          >
          <DialogDescription v-else class="sr">{{ description }}</DialogDescription>
          <slot name="actions" />
          <DialogClose
            class="grid size-[34px] place-items-center rounded-md text-ink-muted hover:bg-hover hover:text-ink"
            aria-label="Close"
          >
            <X class="size-4" aria-hidden="true" />
          </DialogClose>
        </header>
        <slot name="header" />
        <div class="min-h-0 flex-1 overflow-y-auto">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="border-t border-rule px-5 py-3">
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
