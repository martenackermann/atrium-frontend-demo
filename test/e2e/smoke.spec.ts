import { expect, test } from '@playwright/test'

/**
 * Smoke test in demo mode: MSW worker starts before mount, the auth middleware redirects to
 * /login, personas come from the mock API, signing in lands on the home page with module nav.
 */
test('app loads in demo mode and a persona can sign in', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Sign in to Atrium' })).toBeVisible()

  const persona = page.getByTestId('persona-emma.employee@example.com')
  await expect(persona).toBeVisible()
  await persona.click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Welcome, Emma' })).toBeVisible()
  await expect(page.getByTestId('current-user')).toHaveText('Emma Employee')

  const nav = page.getByRole('navigation', { name: 'Main' })
  for (const label of ['Home', 'Training', 'Travel', 'News']) {
    await expect(nav.getByRole('link', { name: label })).toBeVisible()
  }

  // Session survives a reload (token in localStorage, /me answered by the mock).
  await page.reload()
  await expect(page.getByTestId('current-user')).toHaveText('Emma Employee')

  expect(consoleErrors).toEqual([])
})

test('private routes redirect to login with a return path', async ({ page }) => {
  await page.goto('/training')
  await expect(page).toHaveURL(/\/login\?redirect=\/training$/)
})
