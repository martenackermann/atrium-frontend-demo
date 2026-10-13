export interface ConfirmOptions {
  /** "Cancel this booking?" */
  title: string
  /** Consequence sentence: "The travel desk is notified and the booking number stops working." */
  description?: string
  /** Verb + object: "Cancel booking". */
  confirmLabel: string
  /** "Keep booking". Default "Cancel". */
  cancelLabel?: string
  destructive?: boolean
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve?: (value: boolean) => void
}

/**
 * Confirmation for focus-stealing decisions only (DESIGN §1 principle 5). Rendered by
 * <UiConfirmDialog> in app.vue (AlertDialog; bottom sheet on mobile).
 *
 *   if (await confirm({ title: 'Remove this deputy?', confirmLabel: 'Remove deputy', destructive: true })) …
 */
// Module-level singleton (client-only app): usable from any handler, no Nuxt context needed.
const state = ref<ConfirmState>({ open: false, title: '', confirmLabel: '' })

export function useConfirm() {
  function confirm(options: ConfirmOptions): Promise<boolean> {
    state.value.resolve?.(false)
    return new Promise((resolve) => {
      state.value = { ...options, open: true, resolve }
    })
  }

  function settle(value: boolean) {
    const resolve = state.value.resolve
    state.value = { ...state.value, open: false, resolve: undefined }
    resolve?.(value)
  }

  return { state, confirm, settle }
}
