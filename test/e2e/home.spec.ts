import { expect, test } from '@playwright/test'
import { signInAs, trackConsoleErrors } from './helpers'

/** Home "My day" (slice A4, DESIGN §8.1) in demo mode. */

test("Emma's day: greeting, the reply to-do, open requests, news and links", async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await signInAs(page, 'emma')
  await expect(page.getByTestId('greeting')).toContainText(
    /Good (morning|afternoon|evening), Emma\./,
  )
  await expect(page.getByTestId('greeting')).toContainText('1 thing needs you')

  const needs = page.getByTestId('needs-attention')
  await expect(
    needs.getByRole('heading', { name: /Reply needed: Access to the dispatch/ }),
  ).toBeVisible()
  await expect(needs).toContainText('Which regions do you need to plan for?')
  await expect(page.getByTestId('open-requests')).toContainText(
    'Access to the dispatch planning board',
  )
  await expect(page.getByTestId('home-news').getByRole('heading', { level: 3 }).first()).toHaveText(
    'Welcome to Atrium',
  )
  const wiki = page.getByTestId('home-links').getByRole('link', { name: /Wiki/ })
  await expect(wiki).toHaveAttribute('target', '_blank')
  await expect(wiki).toHaveAttribute('rel', /noopener/)

  await needs.getByRole('link', { name: 'Reply', exact: true }).click()
  await expect(page).toHaveURL(/\/people-requests\//)
  await expect(page.getByTestId('waiting-banner')).toBeVisible()
  expect(errors).toEqual([])
})

test('People Ops sees its queue tiles and triage to-dos', async ({ page }) => {
  await signInAs(page, 'paula')
  await expect(page.getByTestId('greeting')).toContainText('3 things need you')
  await expect(page.getByTestId('needs-attention')).toContainText(
    'Onboarding: Cloud Engineer – Campus',
  )
  const queues = page.getByTestId('your-queues')
  await expect(queues).toContainText('People ops')
  await expect(queues.getByRole('link', { name: /unassigned/ })).toBeVisible()
})

test('Home works at 375 px without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await signInAs(page, 'emma')
  await expect(page.getByTestId('needs-attention')).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
