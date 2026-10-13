import { expect, test, type Page } from '@playwright/test'
import { signInAs } from './helpers'

/**
 * Foundation screenshots for review against the comps (`_spec/atrium/comps/shots`), written to
 * docs/screenshots/foundation/. Run with `pnpm screenshots` (Playwright project "screenshots");
 * the regular e2e run skips this file.
 */
const OUT = 'docs/screenshots/foundation'
const THEMES = ['light', 'dark'] as const

async function useTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
  await page.addInitScript((value) => {
    localStorage.setItem('atrium-theme', value)
  }, theme)
}

/** Screenshot without the dev-only overlays of `nuxt dev` (Nuxt DevTools, Query devtools). */
async function shot(page: Page, path: string, fullPage = false) {
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>(
      '[id^="nuxt-devtools"], .tsqd-parent-container, [class*="tsqd-"]',
    )) {
      element.style.display = 'none'
    }
  })
  await page.screenshot({ path, fullPage })
}

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => useTheme(page, theme))

    test('login', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1100 })
      await page.goto('/login')
      await expect(page.getByTestId('persona-ian')).toBeVisible()
      await shot(page, `${OUT}/login-1440-${theme}.png`, true)
      await page.setViewportSize({ width: 390, height: 844 })
      await shot(page, `${OUT}/login-390-${theme}.png`)
    })

    test('shell, palette, drawer', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await signInAs(page, 'max')
      await expect(page.getByTestId('placeholder-page')).toBeVisible()
      await shot(page, `${OUT}/shell-1440-${theme}.png`)

      await page.keyboard.press('ControlOrMeta+k')
      await expect(page.getByTestId('command-palette')).toBeVisible()
      await shot(page, `${OUT}/palette-1440-${theme}.png`)
      await page.keyboard.press('Escape')

      await page.getByTestId('inbox-button').click()
      await expect(page.getByTestId('inbox-drawer')).toBeVisible()
      await shot(page, `${OUT}/drawer-1440-${theme}.png`)
      await page.keyboard.press('Escape')

      await page.goto('/settings/deputies')
      await expect(page.getByRole('heading', { level: 1, name: 'Deputies' })).toBeVisible()
      await expect(
        page.getByRole('cell', { name: 'Sofia Site-Manager', exact: true }),
      ).toBeVisible()
      await shot(page, `${OUT}/deputies-1440-${theme}.png`)

      await page.goto('/inbox')
      await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible()
      await shot(page, `${OUT}/inbox-1440-${theme}.png`)
    })

    test('mobile shell', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await signInAs(page, 'emma')
      await expect(page.getByRole('navigation', { name: 'Tabs' })).toBeVisible()
      await shot(page, `${OUT}/shell-390-${theme}.png`)
    })
  })
}
