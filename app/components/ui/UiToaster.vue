<script setup lang="ts">
import { Check, Info, TriangleAlert, X } from '@lucide/vue'
import {
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastViewport,
} from 'reka-ui'

/**
 * Toasts (DESIGN §9): ink panel, paper text, marker icon, optional action (Undo); bottom-right,
 * above the tab bar on mobile; 4.2 s, paused on hover; errors stay until dismissed.
 * Mounted once in app.vue; raise them with useToast().
 */
const { toasts, dismiss } = useToast()

function onOpenChange(id: number, open: boolean) {
  if (!open) dismiss(id)
}
</script>

<template>
  <ToastProvider :duration="4200" swipe-direction="right" label="Notification">
    <ToastRoot
      v-for="toast in toasts"
      :key="toast.id"
      :duration="toast.duration === Infinity ? 86_400_000 : toast.duration"
      :type="toast.tone === 'error' ? 'foreground' : 'background'"
      class="flex w-full items-start gap-3 rounded-lg bg-ink py-3 pr-2 pl-3.5 text-base text-ink-inverse shadow-pop data-[state=open]:animate-[atrium-toast-in_var(--dur-3)_var(--curve-out)] data-[swipe=end]:translate-x-(--reka-toast-swipe-end-x) data-[swipe=move]:translate-x-(--reka-toast-swipe-move-x)"
      @update:open="(open) => onOpenChange(toast.id, open)"
    >
      <TriangleAlert
        v-if="toast.tone === 'error'"
        class="mt-0.5 size-4 text-st-negative-line"
        aria-hidden="true"
      />
      <!-- A marker disc with marker ink reads on the ink toast (light) and the paper toast (dark). -->
      <span
        v-else
        class="mt-px grid size-[18px] flex-none place-items-center rounded-full bg-marker text-marker-ink"
        aria-hidden="true"
      >
        <Info v-if="toast.tone === 'info'" class="size-3" :stroke-width="2.5" />
        <Check v-else class="size-3" :stroke-width="3" />
      </span>
      <div class="grid min-w-0 flex-1 gap-0.5">
        <ToastTitle class="font-medium">{{ toast.title }}</ToastTitle>
        <ToastDescription v-if="toast.description" class="text-sm opacity-80">{{
          toast.description
        }}</ToastDescription>
      </div>
      <ToastAction
        v-if="toast.action"
        :alt-text="toast.action.label"
        as-child
        @click="toast.action.run()"
      >
        <button
          type="button"
          class="h-[30px] rounded-[7px] px-2.5 text-sm font-semibold hover:bg-[color-mix(in_srgb,var(--ink-inverse)_12%,transparent)] max-md:h-10"
        >
          {{ toast.action.label }}
        </button>
      </ToastAction>
      <ToastClose
        class="grid size-[30px] flex-none place-items-center rounded-[7px] opacity-70 hover:bg-[color-mix(in_srgb,var(--ink-inverse)_12%,transparent)] hover:opacity-100 max-md:size-10"
        aria-label="Dismiss"
      >
        <X class="size-4" aria-hidden="true" />
      </ToastClose>
    </ToastRoot>
    <ToastViewport
      class="fixed right-3 bottom-[76px] left-3 z-[90] m-0 grid list-none gap-2 p-0 outline-none md:right-5 md:bottom-5 md:left-auto md:w-[420px]"
    />
  </ToastProvider>
</template>
