const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

/**
 * Radio groups select on arrow keys (ARIA radio group pattern). Reka checks the newly focused
 * radio only while the arrow key is still held when its focus timer runs, so a quick tap
 * (synthetic keys, some assistive tech) moved focus without selecting. Bind to the group's
 * `keydown`: after the roving focus moves, the focused radio is clicked (a no-op if checked).
 */
export function selectFocusedRadio(event: KeyboardEvent) {
  if (!ARROWS.has(event.key)) return
  const group = event.currentTarget as HTMLElement | null
  requestAnimationFrame(() => {
    const focused = document.activeElement as HTMLElement | null
    if (
      group?.contains(focused) &&
      focused?.getAttribute('role') === 'radio' &&
      focused.getAttribute('aria-checked') !== 'true'
    )
      focused.click()
  })
}
