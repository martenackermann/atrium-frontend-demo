import { expect, test, type Page } from '@playwright/test'
import { signInAs } from './helpers'

/**
 * Training screenshots for review (docs/screenshots/training/), run with `pnpm screenshots`
 * (Playwright project "screenshots"). Demo mode, light theme, desktop 1440 and mobile 390.
 */
const OUT = 'docs/screenshots/training'

async function shot(page: Page, name: string, fullPage = false) {
  await page.evaluate(() => {
    for (const element of document.querySelectorAll<HTMLElement>(
      '[id^="nuxt-devtools"], .tsqd-parent-container, [class*="tsqd-"]',
    ))
      element.style.display = 'none'
  })
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage })
}

async function fresh(page: Page) {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('/login')
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith('atrium.')) localStorage.removeItem(key)
    localStorage.setItem('atrium-theme', 'light')
  })
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await fresh(page)
})

test('Max: approvals, team tab, participation detail', async ({ page }) => {
  await signInAs(page, 'max', '/training/approvals')
  await page
    .getByRole('option', { name: /Fiber Splicing/ })
    .first()
    .click()
  await expect(
    page.getByText('Why you’re seeing this').or(page.getByText("Why you're seeing this")).first(),
  ).toBeVisible()
  await shot(page, 'approvals-1440')
  await page.goto('/training/approvals?tab=deputy')
  await page.getByRole('option').first().click()
  await shot(page, 'approvals-deputy-1440')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/training/approvals')
  await expect(page.getByRole('option').first()).toBeVisible()
  await shot(page, 'approvals-390')
})

test('Emma: my training, participation, stepper, rating form', async ({ page }) => {
  await signInAs(page, 'emma', '/training')
  await expect(page.getByText('Customer Communication Masterclass').first()).toBeVisible()
  await shot(page, 'my-training-1440')
  await page.getByText('Spreadsheet Analysis Essentials').first().click()
  await expect(page.getByRole('heading', { name: 'Approval path' })).toBeVisible()
  await shot(page, 'participation-1440', true)
  await page.goto('/training/ratings')
  await page.getByText('Spreadsheet Analysis Essentials').first().click()
  await expect(page.getByText(/Round 2 of 3/)).toBeVisible()
  await shot(page, 'rating-loop2-1440')
  await page.goto('/training')
  await page.getByRole('link', { name: 'Request training' }).click()
  await page.getByLabel('Topic').fill('Negotiation Basics')
  await page.getByLabel('Provider').fill('Harbor Training Group')
  await page.getByLabel('Location').fill('Riverton')
  await page.getByLabel('Cost per attendee').fill('5400')
  await page.getByRole('combobox', { name: /Executive approver/ }).click()
  await page.getByRole('option', { name: /Clara CEO/ }).click()
  await shot(page, 'stepper-details-1440')
  await page.setViewportSize({ width: 390, height: 844 })
  await shot(page, 'stepper-details-390')
})

test('Tina: office queues, request with back office, ratings overview', async ({ page }) => {
  await signInAs(page, 'tina', '/back-office/training')
  await page.getByRole('option').first().click()
  await shot(page, 'office-to-book-1440')
  await page.goto('/back-office/training/requests')
  await expect(page.getByText('TRN-000016').first()).toBeVisible()
  await shot(page, 'office-requests-1440')
  await page.getByText('First Aid at Work Refresher').first().click()
  await expect(page.getByRole('heading', { name: 'Back office' })).toBeVisible()
  await shot(page, 'request-detail-1440', true)
  await page.goto('/back-office/training/ratings')
  await expect(page.getByText('Round 2 · In practice')).toBeVisible()
  await shot(page, 'ratings-overview-1440', true)
})
