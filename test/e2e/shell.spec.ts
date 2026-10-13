import { expect, test } from '@playwright/test'
import { signInAs } from './helpers'

const WORK = ['Home', 'Inbox', 'Training', 'Travel', 'My devices', 'People requests', 'News']

test.describe('navigation follows the role (SCREENS §1.2)', () => {
  test('Emma sees her work only: no approvals, no back office, no admin', async ({ page }) => {
    await signInAs(page, 'emma')
    const main = page.getByRole('complementary', { name: 'Main' })
    const work = main.getByRole('navigation', { name: 'My work' })
    for (const label of WORK) {
      await expect(work.getByRole('link', { name: label, exact: true })).toBeVisible()
    }
    await expect(main.getByRole('link', { name: 'Approvals' })).toHaveCount(0)
    await expect(main.getByRole('navigation', { name: 'Back office' })).toHaveCount(0)
    await expect(main.getByRole('navigation', { name: 'Admin' })).toHaveCount(0)
  })

  test('Max sees the approval queues and no back office', async ({ page }) => {
    await signInAs(page, 'max')
    const main = page.getByRole('complementary', { name: 'Main' })
    await expect(main.getByRole('link', { name: 'Approvals' })).toHaveCount(2)
    await expect(main.getByRole('navigation', { name: 'Back office' })).toHaveCount(0)
  })

  test('Paula sees the People ops and News back offices only', async ({ page }) => {
    await signInAs(page, 'paula')
    const main = page.getByRole('complementary', { name: 'Main' })
    const backOffice = main.getByRole('navigation', { name: 'Back office' })
    await expect(backOffice.getByRole('link', { name: 'People ops', exact: true })).toBeVisible()
    await expect(backOffice.getByRole('link', { name: 'News', exact: true })).toBeVisible()
    await expect(backOffice.getByRole('link', { name: 'Travel desk' })).toHaveCount(0)
    await expect(backOffice.getByRole('link', { name: 'Training office' })).toHaveCount(0)
    await expect(main.getByRole('navigation', { name: 'Admin' })).toHaveCount(0)
  })

  test('a page outside the role shows the 403 view', async ({ page }) => {
    await signInAs(page, 'emma')
    await page.goto('/admin/users')
    await expect(page.getByTestId('error-view')).toContainText('have access')
  })
})

test.describe('shell', () => {
  test.beforeEach(async ({ page }) => signInAs(page, 'max'))

  test('Ctrl/Cmd+K opens the command palette and jumps to a page', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+k')
    await expect(page.getByTestId('command-palette')).toBeVisible()
    await page.keyboard.type('deputies')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/settings\/deputies/)
    await expect(page.getByRole('heading', { level: 1, name: 'Deputies' })).toBeVisible()
  })

  test('the search button opens the palette too', async ({ page }) => {
    await page.getByTestId('search-trigger').click()
    await expect(page.getByTestId('command-palette')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('command-palette')).toBeHidden()
  })

  test('the inbox drawer opens from the top bar', async ({ page }) => {
    await page.getByTestId('inbox-button').click()
    await expect(page.getByRole('dialog', { name: 'Inbox' })).toBeVisible()
    await expect(page.getByTestId('inbox-drawer')).toBeVisible()
  })

  test('the theme toggle switches between light and dark and is remembered', async ({ page }) => {
    const html = page.locator('html')
    const before = await html.getAttribute('data-theme')
    const after = before === 'dark' ? 'light' : 'dark'
    await page.getByTestId('theme-toggle').click()
    await expect(html).toHaveAttribute('data-theme', after)
    await page.reload()
    await expect(html).toHaveAttribute('data-theme', after)
  })

  test('the demo ribbon names the demo password', async ({ page }) => {
    await expect(page.getByText('password demo1234')).toBeVisible()
  })
})

test('the shell works at 375 px with the mobile tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await signInAs(page, 'emma')
  await expect(page.getByRole('navigation', { name: 'Tabs' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Main' })).toBeHidden()
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(375)
})
