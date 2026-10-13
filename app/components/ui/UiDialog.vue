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
} from 'reka-ui'
import { cn } from '~/lib/cn'

/**
 * Dialog (DESIGN §9): only for focus-stealing decisions. Scrim + level-3 panel radius 12;
 * title (20/600) · description · body · footer (secondary left of primary). Bottom sheet < 768px.
 */
const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    size?: 'sm' | 'md' | 'lg'
    class?: HTMLAttributes['class']
  }>(),
  { size: 'md' },
)
const open = defineModel<boolean>('open', { default: false })

// Overlays opened from code (shortcuts, the top bar, a row action) have no Reka trigger to
// return to: give focus back to whatever had it when they opened.
let returnTo: HTMLElement | null = null
watch(open, (value) => {
  if (value) returnTo = document.activeElement as HTMLElement | null
})
function restoreFocus(event: Event) {
  if (returnTo?.isConnected && returnTo !== document.body) {
    event.preventDefault()
    returnTo.focus()
  }
  returnTo = null
}

/** Opening moves focus to the first field (not the close button); dialogs without fields keep
 * Reka's default (the first button). */
function focusFirstField(event: Event) {
  const content = event.target as HTMLElement | null
  const field = content?.querySelector<HTMLElement>(
    '[data-dialog-body] :is(input:not([type="hidden"]):not([aria-hidden="true"]), textarea, [role="combobox"], [role="radio"][data-state="checked"], [role="radio"])',
  )
  if (field && !field.hasAttribute('disabled')) {
    event.preventDefault()
    field.focus()
  }
}
</script>

<template>
  <DialogRoot v-model:open="open">
    <slot name="trigger" />
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-[atrium-fade_var(--dur-2)_var(--curve-standard)]"
      />
      <DialogContent
        :class="
          cn(
            'fixed z-50 grid max-h-[calc(100dvh-32px)] gap-0 overflow-y-auto bg-raised shadow-dialog outline-none',
            'inset-x-0 bottom-0 rounded-t-[14px] pb-[env(safe-area-inset-bottom)] data-[state=open]:animate-[atrium-sheet-up_var(--dur-3)_var(--curve-out)]',
            // Desktop: 14vh from the top, so the height leaves that offset (+16px) free - otherwise the
            // footer ends below short (~720px) viewports.
            'md:inset-x-auto md:top-[14vh] md:bottom-auto md:left-1/2 md:max-h-[calc(100dvh-14vh-16px)] md:w-full md:-translate-x-1/2 md:rounded-xl md:pb-0 md:data-[state=open]:animate-[atrium-pop_var(--dur-2)_var(--curve-out)]',
            size === 'sm' && 'md:max-w-[420px]',
            size === 'md' && 'md:max-w-[520px]',
            size === 'lg' && 'md:max-w-[680px]',
            props.class,
          )
        "
        @open-auto-focus="focusFirstField"
        @close-auto-focus="restoreFocus"
      >
        <header class="flex items-start gap-3 px-6 pt-5 pb-2">
          <div class="grid flex-1 gap-1.5">
            <DialogTitle class="text-xl font-semibold">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="text-base text-ink-muted">{{
              description
            }}</DialogDescription>
          </div>
          <DialogClose
            class="-mt-1 -mr-2 grid size-[34px] place-items-center rounded-md text-ink-muted hover:bg-hover hover:text-ink max-md:size-10"
            aria-label="Close"
          >
            <X class="size-4" aria-hidden="true" />
          </DialogClose>
        </header>
        <div class="px-6 py-3" data-dialog-body>
          <slot />
        </div>
        <footer
          v-if="$slots.footer"
          class="flex flex-wrap items-center justify-end gap-2 border-t border-rule px-6 py-4 max-md:[&>*]:h-11 max-md:[&>*]:flex-1"
        >
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
