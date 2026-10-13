import { expect, type Page } from '@playwright/test'

export type PersonaKey =
  'emma' | 'max' | 'sofia' | 'clara' | 'tom' | 'tina' | 'arne' | 'paula' | 'ian'

export const DISPLAY_NAMES: Record<PersonaKey, string> = {
  emma: 'Emma Employee',
  max: 'Max Manager',
  sofia: 'Sofia Site-Manager',
  clara: 'Clara CEO',
  tom: 'Tom Travel-Desk',
  tina: 'Tina Training-Office',
  arne: 'Arne Assets',
  paula: 'Paula People-Ops',
  ian: 'Ian IT-Admin',
}

/** Demo sign-in through the persona card on /login (MSW mode). */
export async function signInAs(page: Page, persona: PersonaKey, redirect?: string) {
  await page.goto(redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login')
  await page.getByTestId(`persona-${persona}`).getByRole('button').click()
  await expect(page.getByTestId('current-user').first()).toHaveText(DISPLAY_NAMES[persona])
}

/** Collect console errors (ignoring expected 4xx responses from the mock API). */
export function trackConsoleErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (/Failed to load resource: the server responded with a status of 4\d\d/.test(text)) return
    // Nuxt DevTools' sandboxed iframe in `nuxt dev` (not part of the app).
    if (text.includes("Blocked script execution in 'about:blank'")) return
    errors.push(text)
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}
