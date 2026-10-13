import { expect, test, type Page } from '@playwright/test'
import { signInAs } from './helpers'

/**
 * Assets review screenshots (light + dark, desktop + 390px) into docs/screenshots/assets/.
 * Runs in the "screenshots" project only:
 *   pnpm exec playwright test --project=screenshots test/e2e/assets-screenshots.spec.ts
 */
const OUT = 'docs/screenshots/assets'
const THEMES = ['light', 'dark'] as const

async function useTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
  await page.addInitScript((value) => {
    localStorage.setItem('atrium-theme', value)
  }, theme)
}

async function shot(page: Page, path: string) {
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>(
      '[id^="nuxt-devtools"], .tsqd-parent-container, [class*="tsqd-"]',
    )) {
      element.style.display = 'none'
    }
  })
  await page.waitForTimeout(400)
  await page.screenshot({ path, fullPage: true })
}

for (const theme of THEMES) {
  test.describe(`assets · ${theme}`, () => {
    test.beforeEach(async ({ page }) => useTheme(page, theme))

    test('my devices (Emma)', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1100 })
      await signInAs(page, 'emma', '/assets')
      await expect(page.getByRole('button', { name: 'Accept laptop' })).toBeVisible()
      await shot(page, `${OUT}/my-devices-1440-${theme}.png`)
      await page.getByRole('button', { name: 'Accept laptop' }).click()
      await expect(page.getByRole('dialog', { name: 'Accept your laptop' })).toBeVisible()
      await page.screenshot({ path: `${OUT}/accept-dialog-1440-${theme}.png` })
      await page.keyboard.press('Escape')
      await page.setViewportSize({ width: 390, height: 844 })
      await shot(page, `${OUT}/my-devices-390-${theme}.png`)
    })

    test('asset admin (Arne)', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1700 })
      await signInAs(page, 'arne', '/back-office/assets')
      await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible()
      await shot(page, `${OUT}/dashboard-1440-${theme}.png`)

      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.goto('/back-office/assets/inventory?status=in_repair')
      await expect(page.getByText(/5 assets match/)).toBeVisible()
      await shot(page, `${OUT}/inventory-1440-${theme}.png`)

      await page.goto('/back-office/assets/inventory?q=AST-00064')
      await page.getByRole('cell', { name: 'AST-00064', exact: true }).click()
      await page.getByRole('tab', { name: 'Timeline' }).click()
      await expect(page.getByText(/assigned the device to Emma Employee/)).toBeVisible()
      await shot(page, `${OUT}/asset-timeline-1440-${theme}.png`)

      await page.setViewportSize({ width: 1440, height: 1300 })
      await page.getByRole('tab', { name: 'Details' }).click()
      await shot(page, `${OUT}/asset-details-1440-${theme}.png`)

      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.goto('/back-office/assets/models')
      await expect(page.getByRole('cell', { name: 'Vireo Pro 14', exact: true })).toBeVisible()
      await shot(page, `${OUT}/models-1440-${theme}.png`)

      await page.goto('/back-office/assets/catalog?tab=manufacturers')
      await expect(page.getByRole('cell', { name: 'Vireo Computing', exact: true })).toBeVisible()
      await shot(page, `${OUT}/catalog-1440-${theme}.png`)

      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/back-office/assets')
      await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible()
      await shot(page, `${OUT}/dashboard-390-${theme}.png`)
      await page.goto('/back-office/assets/inventory')
      await expect(page.getByText(/assets match/)).toBeVisible()
      await shot(page, `${OUT}/inventory-390-${theme}.png`)
    })
  })
}
