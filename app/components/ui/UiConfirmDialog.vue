<script setup lang="ts">
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'

/**
 * Global confirmation (useConfirm()). Destructive confirms name the consequence:
 * "Cancel this booking? The travel desk is notified and the booking number stops working."
 * [Keep booking] [Cancel booking]. Mounted once in app.vue.
 *
 * The buttons settle the promise themselves: Reka's AlertDialogAction/Cancel close the dialog
 * before the click handler runs, which used to resolve every confirm as "cancel". Esc and
 * outside clicks still go through the `open` setter and resolve false.
 */
const { state, settle } = useConfirm()
const open = computed({
  get: () => state.value.open,
  set: (value) => {
    if (!value) settle(false)
  },
})
</script>

<template>
  <AlertDialogRoot v-model:open="open">
    <AlertDialogPortal>
      <AlertDialogOverlay
        class="fixed inset-0 z-[80] bg-scrim data-[state=open]:animate-[atrium-fade_var(--dur-2)_var(--curve-standard)]"
      />
      <AlertDialogContent
        class="fixed inset-x-0 bottom-0 z-[80] grid gap-3 rounded-t-[14px] bg-raised p-6 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-dialog outline-none data-[state=open]:animate-[atrium-sheet-up_var(--dur-3)_var(--curve-out)] md:inset-x-auto md:top-[18vh] md:bottom-auto md:left-1/2 md:w-full md:max-w-[440px] md:-translate-x-1/2 md:rounded-xl md:pb-6 md:data-[state=open]:animate-[atrium-pop_var(--dur-2)_var(--curve-out)]"
      >
        <AlertDialogTitle class="text-xl font-semibold">{{ state.title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="state.description" class="text-base text-ink-muted">
          {{ state.description }}
        </AlertDialogDescription>
        <div class="mt-2 flex flex-wrap justify-end gap-2 max-md:[&>*]:h-11 max-md:[&>*]:flex-1">
          <UiButton variant="secondary" data-testid="confirm-cancel" @click="settle(false)">{{
            state.cancelLabel ?? 'Cancel'
          }}</UiButton>
          <UiButton
            :variant="state.destructive ? 'danger-solid' : 'primary'"
            data-testid="confirm-accept"
            @click="settle(true)"
            >{{ state.confirmLabel }}</UiButton
          >
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
