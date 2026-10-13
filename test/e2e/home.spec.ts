import { expect, test } from '@playwright/test'
import { signInAs, trackConsoleErrors } from './helpers'

/** Home "My day" (slice A4, DESIGN §8.1) in demo mode. */

test("Emma's day: to-dos from every module, open requests, news and links", async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await signInAs(page, 'emma')
  await expect(page.getByTestId('greeting')).toContainText(
    /Good (morning|afternoon|evening), Emma\./,
  )
  // Training ratings and goals, two devices and the people question (SPEC §2.3).
  await expect(page.getByTestId('greeting')).toContainText('6 things need you')
  await expect(page.getByTestId('greeting')).toContainText('waiting for your reply on PPL-000004')

  const needs = page.getByTestId('needs-attention')
  await expect(
    needs.getByRole('heading', { name: 'Rate: Spreadsheet Analysis Essentials' }),
  ).toBeVisible()
  await expect(needs.getByRole('heading', { name: 'Confirm your new smartphone' })).toBeVisible()
  // The asset tag is part of the subtitle and is not repeated as the reference.
  await expect(needs.getByText('Marlowe X5 128 GB Midnight · AST-00115')).toBeVisible()
  await expect(needs).not.toContainText('AST-00115 · Marlowe')

  const open = page.getByTestId('open-requests')
  await expect(open).toContainText('Access to the dispatch planning board')
  await expect(open).toContainText('First Aid at Work Refresher')
  await expect(open).toContainText('Westbay')
  await expect(page.getByTestId('home-news').getByRole('heading', { level: 3 }).first()).toHaveText(
    'Welcome to Atrium',
  )
  const wiki = page.getByTestId('home-links').getByRole('link', { name: /Wiki/ })
  await expect(wiki).toHaveAttribute('target', '_blank')
  await expect(wiki).toHaveAttribute('rel', /noopener/)

  await open
    .getByRole('link', { name: /Access to the dispatch planning board/ })
    .first()
    .click()
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
