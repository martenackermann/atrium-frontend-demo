import { expect, test, type Page } from '@playwright/test'
import { signInAs } from './helpers'

/**
 * Slice A4 review screenshots (Home, people requests, news) against the comps, written to
 * docs/screenshots/{home,people,news}/. Runs in the Playwright "screenshots" project only
 * (`pnpm screenshots`); the regular e2e run skips it.
 */
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
  await page.screenshot({ path })
}

/** Sign in as another persona (the login page redirects while a session exists). */
async function switchTo(page: Page, persona: Parameters<typeof signInAs>[1]) {
  await page.evaluate(() => {
    localStorage.removeItem('atrium.auth.token')
    localStorage.removeItem('atrium.auth.expires')
  })
  await signInAs(page, persona)
}

async function openByText(page: Page, path: string, text: string) {
  await page.goto(path)
  await page.getByRole('link', { name: text }).first().click()
}

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => useTheme(page, theme))

    test('home', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await signInAs(page, 'emma')
      await expect(page.getByTestId('needs-attention')).toBeVisible()
      await shot(page, `docs/screenshots/home/home-emma-1440-${theme}.png`)
      await page.setViewportSize({ width: 390, height: 844 })
      await shot(page, `docs/screenshots/home/home-emma-390-${theme}.png`)
      await page.setViewportSize({ width: 1440, height: 900 })
      await switchTo(page, 'paula')
      await expect(page.getByTestId('your-queues')).toBeVisible()
      await shot(page, `docs/screenshots/home/home-paula-1440-${theme}.png`)
    })

    test('people requests', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await signInAs(page, 'emma')
      await page.goto('/people-requests')
      await expect(page.getByTestId('reply-banner')).toBeVisible()
      await shot(page, `docs/screenshots/people/my-requests-1440-${theme}.png`)
      await openByText(page, '/people-requests', 'Access to the dispatch planning board')
      await expect(page.getByTestId('waiting-banner')).toBeVisible()
      await shot(page, `docs/screenshots/people/detail-waiting-1440-${theme}.png`)
      await page.setViewportSize({ width: 390, height: 844 })
      await shot(page, `docs/screenshots/people/detail-waiting-390-${theme}.png`)

      await page.setViewportSize({ width: 1440, height: 900 })
      await switchTo(page, 'max')
      await page.goto('/people-requests/new')
      await page.getByRole('radio', { name: /Onboarding/ }).click()
      await page.getByRole('textbox', { name: 'Title' }).fill('Field Technician – Eastgate')
      await shot(page, `docs/screenshots/people/stepper-1440-${theme}.png`)

      await switchTo(page, 'paula')
      await page.goto('/back-office/people')
      await expect(page.getByTestId('ops-panel')).toBeVisible()
      await shot(page, `docs/screenshots/people/ops-queue-1440-${theme}.png`)
    })

    test('news', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await signInAs(page, 'emma')
      await page.goto('/news')
      await expect(page.getByRole('heading', { name: 'Welcome to Atrium' })).toBeVisible()
      await shot(page, `docs/screenshots/news/feed-1440-${theme}.png`)
      await page.getByRole('link', { name: 'Welcome to Atrium' }).first().click()
      await expect(page.locator('.news-prose')).toBeVisible()
      await shot(page, `docs/screenshots/news/article-1440-${theme}.png`)

      await switchTo(page, 'paula')
      await openByText(page, '/back-office/news', 'Quarterly town hall at Campus')
      await expect(page.getByRole('textbox', { name: 'Article body' })).toBeVisible()
      await shot(page, `docs/screenshots/news/editor-1440-${theme}.png`)
      await page.goto('/back-office/links')
      await expect(page.getByTestId('link-row-0')).toBeVisible()
      await shot(page, `docs/screenshots/news/links-1440-${theme}.png`)
    })
  })
}
