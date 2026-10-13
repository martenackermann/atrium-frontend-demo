export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'atrium-theme'

function readStored(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function writeStored(mode: ThemeMode) {
  try {
    if (mode === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // storage unavailable: the choice lasts for this page only
  }
}

/**
 * Theme: light / dark / system (SCREENS §1.1). Stored in localStorage (try/catch), applied as
 * data-theme on <html> (tokens switch by themselves). The head script in nuxt.config applies the
 * stored value before the first paint.
 */
// Module-level singleton (client-only app).
const mode = ref<ThemeMode>(import.meta.client ? readStored() : 'system')

export function useTheme() {
  const prefersDark = usePreferredDark()
  const resolved = computed<ResolvedTheme>(() =>
    mode.value === 'system' ? (prefersDark.value ? 'dark' : 'light') : mode.value,
  )

  function apply() {
    if (import.meta.client) document.documentElement.dataset.theme = resolved.value
  }

  function set(next: ThemeMode) {
    mode.value = next
    writeStored(next)
    apply()
  }

  /** Flip between light and dark (the top-bar button). */
  function toggle() {
    set(resolved.value === 'dark' ? 'light' : 'dark')
  }

  return { mode, resolved, set, toggle, apply }
}
