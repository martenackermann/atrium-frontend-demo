/**
 * Draft auto-save for steppers (SCREENS §1.7, DESIGN §7 focus mode): the form values are saved to
 * localStorage per stepper ("Draft saved in this browser"); closing keeps the draft; "Discard draft"
 * removes it. Storage failures are ignored (private mode).
 *
 *   const draft = useStepperDraft('travel-car', values, { version: 1 })
 *   onMounted(() => { const saved = draft.restore(); if (saved) setValues(saved) })
 *   // after a successful submit: draft.clear()
 */
export function useStepperDraft<T extends object>(
  key: string,
  values: MaybeRefOrGetter<T>,
  options: { version?: number; debounce?: number } = {},
) {
  const storageKey = `atrium.draft.${key}.v${options.version ?? 1}`
  const savedAt = ref<Date | null>(null)
  let paused = false

  function read(): { values: T; savedAt: string } | null {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? (JSON.parse(raw) as { values: T; savedAt: string }) : null
    } catch {
      return null
    }
  }

  function save() {
    if (paused) return
    try {
      const now = new Date()
      localStorage.setItem(
        storageKey,
        JSON.stringify({ values: toValue(values), savedAt: now.toISOString() }),
      )
      savedAt.value = now
    } catch {
      // storage unavailable: the draft lasts for this page only
    }
  }

  watchDebounced(() => JSON.stringify(toValue(values)), save, { debounce: options.debounce ?? 500 })

  /** The saved values, if any (also sets `savedAt`). */
  function restore(): T | null {
    const draft = read()
    if (!draft) return null
    savedAt.value = new Date(draft.savedAt)
    return draft.values
  }

  /** Remove the draft (after submit, or "Discard draft"). Pauses saving for this page. */
  function clear() {
    paused = true
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
    savedAt.value = null
  }

  return { savedAt, restore, clear, save, hasDraft: () => read() !== null }
}
