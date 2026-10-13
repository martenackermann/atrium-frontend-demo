import { expect, test, type Page } from '@playwright/test'
import { signInAs } from './helpers'

/**
 * Travel screenshots (slice A2) for review against the comps, written to docs/screenshots/travel/.
 * Runs in the Playwright project "screenshots":
 *   pnpm screenshots test/e2e/travel-screenshots.spec.ts
 */
const OUT = 'docs/screenshots/travel'
const THEMES = ['light', 'dark'] as const

async function useTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
  await page.addInitScript((value) => {
    localStorage.setItem('atrium-theme', value)
  }, theme)
}

/** Screenshot without the dev-only overlays of `nuxt dev` (Nuxt DevTools, Query devtools). */
async function shot(page: Page, name: string, fullPage = false) {
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>(
      '[id^="nuxt-devtools"], .tsqd-parent-container, [class*="tsqd-"]',
    )) {
      element.style.display = 'none'
    }
  })
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage })
}

async function typeDateTime(page: Page, index: number, digits: string) {
  await page.getByRole('spinbutton', { name: /^day/ }).nth(index).click()
  await page.keyboard.type(digits)
}

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await useTheme(page, theme)
      await page.setViewportSize({ width: 1440, height: 1000 })
    })

    test('traveller screens', async ({ page }) => {
      await signInAs(page, 'emma', '/travel')
      await expect(page.getByRole('link', { name: 'TRV-000001' })).toBeVisible()
      await shot(page, `my-trips-1440-${theme}`)

      await page.goto('/travel/new')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await shot(page, `chooser-1440-${theme}`)

      await page.goto('/travel/new/car')
      await typeDateTime(page, 0, '201020260800')
      await typeDateTime(page, 1, '211020261800')
      await page.getByLabel('Destination').fill('Westbay')
      await page.getByRole('button', { name: 'Next: Vehicle' }).click()
      await page.getByRole('radio', { name: 'Automatic guaranteed' }).click()
      await expect(
        page
          .getByRole('complementary', { name: 'Summary' })
          .getByText('Needs approval because…')
          .filter({ visible: true }),
      ).toBeVisible()
      await shot(page, `car-stepper-1440-${theme}`)
      await page.getByRole('button', { name: 'Discard draft' }).click()

      await page.goto('/travel')
      await page.getByRole('link', { name: 'TRV-000001' }).click()
      await expect(page.getByText('Needs approval because…')).toBeVisible()
      await shot(page, `request-detail-1440-${theme}`, true)

      await page.goto('/travel')
      await page.getByRole('link', { name: 'TRV-000003' }).click()
      await page.getByRole('button', { name: 'Show PIN' }).click()
      await expect(page.getByText('4821', { exact: true })).toBeVisible()
      await shot(page, `booked-detail-pin-1440-${theme}`)
    })

    test('approvals and travel desk', async ({ page }) => {
      await signInAs(page, 'max', '/travel/approvals')
      await page.getByRole('option', { name: /Car rental to Westbay/ }).click()
      await expect(page.getByText('Automatic transmission (guaranteed)').first()).toBeVisible()
      await shot(page, `approvals-1440-${theme}`)

      await page.evaluate(() => {
        localStorage.removeItem('atrium.auth.token')
        localStorage.removeItem('atrium.auth.expires')
      })
      await signInAs(page, 'tom', '/back-office/travel')
      await expect(page.getByRole('button', { name: 'Book', exact: true })).toBeVisible()
      await shot(page, `travel-desk-1440-${theme}`)

      await page.getByRole('button', { name: 'Book', exact: true }).click()
      await expect(page.getByRole('dialog').getByText('Book this trip')).toBeVisible()
      await shot(page, `book-dialog-1440-${theme}`)
      await page.keyboard.press('Escape')

      await page.goto('/back-office/travel/car-classes')
      await expect(page.getByRole('cell', { name: 'ECMR', exact: true }).first()).toBeVisible()
      await shot(page, `car-classes-1440-${theme}`)
    })

    test('mobile', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await signInAs(page, 'emma', '/travel')
      await expect(page.getByRole('heading', { level: 1, name: 'My trips' })).toBeVisible()
      await shot(page, `my-trips-390-${theme}`)
      await page
        .getByRole('link', { name: /Riverton → Westbay/ })
        .first()
        .click()
      await expect(page.getByText('Needs approval because…')).toBeVisible()
      await shot(page, `request-detail-390-${theme}`)
      await page.goto('/travel/new/train')
      await expect(page.getByText('Step 1 of 5')).toBeVisible()
      await shot(page, `train-stepper-390-${theme}`)
    })
  })
}
