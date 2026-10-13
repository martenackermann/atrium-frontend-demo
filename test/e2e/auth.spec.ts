import { expect, test } from '@playwright/test'
import { signInAs, trackConsoleErrors } from './helpers'

test('private routes redirect to sign-in with a return path', async ({ page }) => {
  await page.goto('/travel')
  await expect(page).toHaveURL(/\/login\?redirect=(\/|%2F)travel$/)
  await expect(page.getByRole('heading', { name: 'Sign in to Atrium' })).toBeVisible()
})

test('the sign-in page lists the nine demo personas', async ({ page }) => {
  await page.goto('/login')
  for (const key of ['emma', 'max', 'sofia', 'clara', 'tom', 'tina', 'arne', 'paula', 'ian']) {
    await expect(page.getByTestId(`persona-${key}`)).toBeVisible()
  }
  await expect(page.getByText('Demo password: demo1234')).toBeVisible()
})

test('a wrong password shows the inline error; the demo password signs in', async ({ page }) => {
  await page.goto('/login?redirect=/settings/profile')
  await page.getByRole('textbox', { name: 'Email' }).fill('emma.employee@example.com')
  await page.getByRole('textbox', { name: 'Password' }).fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.')

  await page.getByRole('textbox', { name: 'Password' }).fill('demo1234')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/settings\/profile$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Emma Employee' })).toBeVisible()
})

test('Emma signs in with her persona card and the session survives a reload', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await signInAs(page, 'emma')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId('greeting')).toContainText('Emma.')
  await page.reload()
  await expect(page.getByTestId('current-user').first()).toHaveText('Emma Employee')
  expect(errors).toEqual([])
})

test('signing out returns to the sign-in page', async ({ page }) => {
  await signInAs(page, 'max')
  await page.getByTestId('account-menu').first().click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/inbox')
  await expect(page).toHaveURL(/\/login\?redirect=/)
})
