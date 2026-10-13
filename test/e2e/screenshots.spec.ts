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
    // Hide the Nuxt DevTools launcher of `nuxt dev` (not part of the app).
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '#nuxt-devtools-container, #nuxt-devtools-anchor { display: none !important; }'
      document.head.append(style)
    })
  }, theme)
}

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => useTheme(page, theme))

    test('login', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1100 })
      await page.goto('/login')
      await expect(page.getByTestId('persona-ian')).toBeVisible()
      await page.screenshot({ path: `${OUT}/login-1440-${theme}.png`, fullPage: true })
      await page.setViewportSize({ width: 390, height: 844 })
      await page.screenshot({ path: `${OUT}/login-390-${theme}.png` })
    })

    test('shell, palette, drawer', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await signInAs(page, 'max')
      await expect(page.getByTestId('placeholder-page')).toBeVisible()
      await page.screenshot({ path: `${OUT}/shell-1440-${theme}.png` })

      await page.keyboard.press('ControlOrMeta+k')
      await expect(page.getByTestId('command-palette')).toBeVisible()
      await page.screenshot({ path: `${OUT}/palette-1440-${theme}.png` })
      await page.keyboard.press('Escape')

      await page.getByTestId('inbox-button').click()
      await expect(page.getByTestId('inbox-drawer')).toBeVisible()
      await page.screenshot({ path: `${OUT}/drawer-1440-${theme}.png` })
      await page.keyboard.press('Escape')

      await page.goto('/settings/deputies')
      await expect(page.getByRole('heading', { level: 1, name: 'Deputies' })).toBeVisible()
      await page.screenshot({ path: `${OUT}/deputies-1440-${theme}.png` })

      await page.goto('/inbox')
      await page.screenshot({ path: `${OUT}/inbox-1440-${theme}.png` })
    })

    test('mobile shell', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await signInAs(page, 'emma')
      await expect(page.getByRole('navigation', { name: 'Tabs' })).toBeVisible()
      await page.screenshot({ path: `${OUT}/shell-390-${theme}.png` })
    })
  })
}
