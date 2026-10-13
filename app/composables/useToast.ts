export type ToastTone = 'success' | 'info' | 'error'

export interface ToastMessage {
  id: number
  tone: ToastTone
  title: string
  description?: string
  /** e.g. Undo. Runs, then closes the toast. */
  action?: { label: string; run: () => void | Promise<void> }
  /** ms; errors stay until dismissed (DESIGN §9 Toast). */
  duration?: number
}

type ToastInput = Omit<ToastMessage, 'id' | 'tone'> | string

let nextId = 1
// Module-level singleton: toasts are raised from click handlers and store actions (after awaits),
// where no Nuxt context is active. The app is client-only, so one list per page is correct.
const toasts = ref<ToastMessage[]>([])

/**
 * Toasts (DESIGN §9): ink panel, marker icon, words mirror the action ("Approved."), 4.2 s,
 * paused on hover, errors stay until dismissed. Rendered by <UiToaster> in app.vue.
 *
 *   const toast = useToast()
 *   toast.success('Approved.', { description: 'Travel desk books it next.', action: { label: 'Undo', run } })
 *   toast.error(describeError(error))
 */
export function useToast() {
  function push(tone: ToastTone, input: ToastInput, extra: Partial<ToastMessage> = {}) {
    const base = typeof input === 'string' ? { title: input } : input
    const toast: ToastMessage = {
      id: nextId++,
      tone,
      duration: tone === 'error' ? Number.POSITIVE_INFINITY : 4200,
      ...base,
      ...extra,
    }
    toasts.value = [...toasts.value, toast].slice(-4)
    return toast.id
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  return {
    toasts,
    success: (input: ToastInput, extra?: Partial<ToastMessage>) => push('success', input, extra),
    info: (input: ToastInput, extra?: Partial<ToastMessage>) => push('info', input, extra),
    error: (input: ToastInput, extra?: Partial<ToastMessage>) => push('error', input, extra),
    dismiss,
  }
}
