import { expect, test } from '@playwright/test'
import { signInAs, trackConsoleErrors } from './helpers'

/** News and useful links (slice A4) in demo mode: feed, article, editor lifecycle, links admin. */

test('Emma reads the news feed and an article', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await signInAs(page, 'emma')
  await page.goto('/news')
  await expect(page.getByRole('heading', { level: 1, name: 'News' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Welcome to Atrium' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Quarterly town hall at Campus' })).toHaveCount(0)

  await page.getByRole('radio', { name: 'Changelog' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome to Atrium' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Atrium update: deputies with validity windows' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Atrium update: deputies with validity windows' }),
  ).toBeVisible()
  await expect(page.locator('.news-prose')).toContainText('Settings → Deputies')
  await expect(page.locator('.news-prose script')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Paula writes, publishes and archives a post', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await signInAs(page, 'paula')
  await page.goto('/back-office/news/new')
  await page.getByTestId('news-title').fill('Bike sheds at Campus')
  await page.getByTestId('news-summary').fill('New covered bike sheds next to the main entrance.')
  const editor = page.getByRole('textbox', { name: 'Article body' })
  await editor.click()
  await page.keyboard.type('The sheds open on Monday. Bring your own lock.')
  await page.getByTestId('news-save').click()
  await expect(page.getByText('Draft saved.', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Bike sheds at Campus' })).toBeVisible()

  await page.getByRole('button', { name: 'Publish now' }).click()
  await expect(page.getByText('Published.', { exact: true })).toBeVisible()
  await expect(page.getByText('Published', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Archive' }).click()
  await expect(page.getByText('Archived.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Restore as draft' }).click()
  await expect(page.getByText('Restored as a draft.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Publish now' }).click()
  await expect(page.getByText('Published.', { exact: true })).toBeVisible()

  await page.goto('/news')
  await expect(page.getByRole('heading', { name: 'Bike sheds at Campus' })).toBeVisible()
  expect(errors).toEqual([])
})

test('Paula reorders the useful links', async ({ page }) => {
  await signInAs(page, 'paula')
  await page.goto('/back-office/links')
  await expect(page.getByTestId('link-row-0')).toContainText('Wiki')
  await page.getByRole('button', { name: 'Move Wiki down' }).click()
  await expect(page.getByText('Moved Wiki.', { exact: true })).toBeVisible()
  await expect(page.getByTestId('link-row-0')).toContainText('Canteen menu')
  await expect(page.getByTestId('link-row-1')).toContainText('Wiki')
})

test('employees cannot open the editor', async ({ page }) => {
  await signInAs(page, 'emma')
  await page.goto('/back-office/news')
  await expect(page.getByText("You don't have access to this page")).toBeVisible()
})
