import { navigation } from '~/config/navigation'
import { flattenNavigation } from '~/lib/navigation'

/**
 * App-wide keys (SCREENS §1.3): ⌘K / Ctrl+K opens the palette; `g` then a letter jumps (g h home,
 * g i inbox, g t training, g v travel, g a devices, g p people requests); `?` shows the sheet.
 * Single-key shortcuts stay quiet while typing or when an overlay is open. Hidden on touch.
 */
export function useGlobalShortcuts() {
  const { paletteOpen, shortcutsOpen } = useShell()
  const chords = new Map(
    flattenNavigation(navigation)
      .filter(({ item }) => item.shortcut)
      .map(({ item }) => [item.shortcut![1], item.to]),
  )
  let pendingG = 0

  useEventListener('keydown', (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      paletteOpen.value = !paletteOpen.value
      return
    }
    if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return
    if (isTypingContext(event)) return

    const key = event.key.toLowerCase()
    if (pendingG && Date.now() - pendingG < 1200) {
      pendingG = 0
      const target = chords.get(key)
      if (target) {
        event.preventDefault()
        void navigateTo(target)
      }
      return
    }
    if (key === 'g') {
      pendingG = Date.now()
      return
    }
    if (event.key === '?') {
      event.preventDefault()
      shortcutsOpen.value = true
    }
  })
}
