import { expect, test, type Page } from '@playwright/test'
import { dateDigitsIn, signInAs, type PersonaKey } from './helpers'

/**
 * The README screenshots in docs/screenshots/ (`pnpm screenshots`, Playwright project
 * "screenshots"; the regular e2e run skips this file). Demo mode, so the data is the mock seed,
 * relative to today. Desktop shots are 1440×900 at 1x, phone shots 390×844 at 2x.
 * SCREENSHOTS_DIR writes them somewhere else (handy for a review run).
 */
const OUT = process.env.SCREENSHOTS_DIR ?? 'docs/screenshots'
const THEMES = ['light', 'dark'] as const
type Theme = (typeof THEMES)[number]

test.describe.configure({ mode: 'parallel' })
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })

async function useTheme(page: Page, theme: Theme) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
  await page.addInitScript((value) => {
    localStorage.setItem('atrium-theme', value)
  }, theme)
}

/** Screenshot of the viewport without dev overlays, hover or focus artefacts. */
async function shot(page: Page, name: string) {
  await page.mouse.move(0, 0)
  await page.evaluate(async () => {
    for (const element of document.querySelectorAll<HTMLElement>(
      '[id^="nuxt-devtools"], .tsqd-parent-container, [class*="tsqd-"]',
    )) {
      element.style.display = 'none'
    }
    await document.fonts.ready
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled', caret: 'hide' })
}

/** Undo the scrolling that clicking into a long form causes (window and inner scroll areas). */
async function scrollToTop(page: Page) {
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    for (const element of document.querySelectorAll<HTMLElement>('*')) {
      if (element.scrollTop > 0) element.scrollTop = 0
    }
  })
}

/** Sign in on the login page, then open `path` (steppers run in focus mode, without the shell). */
async function signIn(page: Page, persona: PersonaKey, path?: string) {
  await signInAs(page, persona)
  if (path) await page.goto(path)
}

for (const theme of THEMES) {
  test.describe(theme, () => {
    test.beforeEach(async ({ page }) => useTheme(page, theme))

    test(`login (${theme})`, async ({ page }) => {
      await page.goto('/login')
      await expect(page.getByTestId('persona-ian')).toBeVisible()
      await shot(page, `login-${theme}`)
    })

    test(`home, Emma (${theme})`, async ({ page }) => {
      await signIn(page, 'emma')
      await expect(page.getByTestId('needs-attention')).toBeVisible()
      await shot(page, `home-${theme}`)
    })

    test(`approvals, Max (${theme})`, async ({ page }) => {
      await signIn(page, 'max', '/travel/approvals')
      await page.getByRole('option', { name: /Car rental to Westbay/ }).click()
      await expect(page.getByText('Automatic transmission (guaranteed)').first()).toBeVisible()
      await shot(page, `approvals-${theme}`)
    })

    test(`car stepper, Emma (${theme})`, async ({ page }) => {
      await signIn(page, 'emma', '/travel/new/car')
      await page.getByRole('spinbutton', { name: /^day/ }).nth(0).click()
      await page.keyboard.type(`${dateDigitsIn(7)}0800`)
      await page.getByRole('spinbutton', { name: /^day/ }).nth(1).click()
      await page.keyboard.type(`${dateDigitsIn(9)}1800`)
      await page.getByLabel('Destination').fill('Westbay')
      await page.getByRole('button', { name: 'Next: Vehicle' }).click()
      await page.getByRole('radio', { name: 'Automatic guaranteed' }).click()
      await page.getByRole('checkbox', { name: /Foreign travel/ }).click()
      await expect(
        page
          .getByRole('complementary', { name: 'Summary' })
          .getByText('Needs approval because…')
          .filter({ visible: true }),
      ).toBeVisible()
      await scrollToTop(page)
      await shot(page, `car-stepper-${theme}`)
    })

    test(`travel desk booking, Tom (${theme})`, async ({ page }) => {
      await signIn(page, 'tom', '/back-office/travel')
      await page.getByRole('button', { name: 'Book', exact: true }).click()
      await expect(page.getByRole('dialog').getByText('Book this trip')).toBeVisible()
      await shot(page, `travel-desk-${theme}`)
    })

    test(`training office, Tina (${theme})`, async ({ page }) => {
      await signIn(page, 'tina', '/back-office/training')
      await page.getByRole('option').first().click()
      await shot(page, `training-office-${theme}`)
    })

    test(`asset dashboard, Arne (${theme})`, async ({ page }) => {
      await signIn(page, 'arne', '/back-office/assets')
      await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible()
      await shot(page, `assets-dashboard-${theme}`)
    })

    test(`people queue, Paula (${theme})`, async ({ page }) => {
      await signIn(page, 'paula', '/back-office/people')
      await expect(page.getByTestId('ops-panel')).toBeVisible()
      await shot(page, `people-queue-${theme}`)
    })

    test(`news article, Emma (${theme})`, async ({ page }) => {
      await signIn(page, 'emma', '/news')
      await page.getByRole('link', { name: 'Welcome to Atrium' }).first().click()
      await expect(page.locator('.news-prose')).toBeVisible()
      await shot(page, `news-article-${theme}`)
    })
  })
}

test(`feedback overview, Tina (light)`, async ({ page }) => {
  await useTheme(page, 'light')
  await signIn(page, 'tina', '/back-office/training/ratings')
  await expect(page.getByText('Round 2 · In practice')).toBeVisible()
  await shot(page, 'training-ratings-light')
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true })

  test('My day, Emma (light)', async ({ page }) => {
    await useTheme(page, 'light')
    await signIn(page, 'emma')
    await expect(page.getByTestId('needs-attention')).toBeVisible()
    await shot(page, 'mobile-home-light')
  })

  test('approval detail, Max (dark)', async ({ page }) => {
    await useTheme(page, 'dark')
    await signIn(page, 'max', '/travel/approvals')
    await page.getByRole('option', { name: /Car rental to Westbay/ }).click()
    await expect(page.getByText('Automatic transmission (guaranteed)').first()).toBeVisible()
    await shot(page, 'mobile-approval-dark')
  })
})
