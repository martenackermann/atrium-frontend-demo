/**
 * Shared app-shell state (client-only singletons): overlays opened from anywhere (⌘K palette,
 * Inbox drawer, mobile menu, "New" sheet) and whether a pushed mobile detail view is showing
 * (DESIGN §7: pushed detail views hide the tab bar).
 */
const paletteOpen = ref(false)
const inboxOpen = ref(false)
const menuOpen = ref(false)
const newSheetOpen = ref(false)
const shortcutsOpen = ref(false)
const mobileDetail = ref(false)

export function useShell() {
  return { paletteOpen, inboxOpen, menuOpen, newSheetOpen, shortcutsOpen, mobileDetail }
}

/** True when typing in a field or an overlay is open — global single-key shortcuts stay quiet. */
export function isTypingContext(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (!target) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return Boolean(document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"]'))
}
