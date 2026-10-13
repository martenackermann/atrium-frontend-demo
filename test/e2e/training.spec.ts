import { expect, test, type Page } from '@playwright/test'
import { signInAs, trackConsoleErrors } from './helpers'

/**
 * Training main flows in demo mode (MSW): request → approve → book, decline with a reason,
 * learning goals, a feedback round, and the office queues. Each test starts from fresh demo data.
 */

async function resetDemo(page: Page) {
  await page.goto('/login')
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith('atrium.')) localStorage.removeItem(key)
  })
}

async function typeDate(page: Page, index: number, ddmmyyyy: string) {
  await page.getByRole('spinbutton', { name: /day/ }).nth(index).pressSequentially(ddmmyyyy)
}

function future(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}${date.getFullYear()}`
}

test.beforeEach(async ({ page }) => resetDemo(page))

/** Sign out (keep the demo data) and sign in as someone else. */
async function switchTo(page: Page, persona: Parameters<typeof signInAs>[1], path: string) {
  await page.evaluate(() => {
    localStorage.removeItem('atrium.auth.token')
    localStorage.removeItem('atrium.auth.expires')
  })
  await signInAs(page, persona, path)
}

test('Emma requests a training, Max approves it, Tina books it', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await signInAs(page, 'emma', '/training')
  await page.getByRole('link', { name: 'Request training' }).click()
  await expect(page.getByRole('heading', { name: 'Which training is it?' })).toBeVisible()
  await page.getByLabel('Topic').fill('Incident Communication Basics')
  await page.getByLabel('Provider').fill('Northgate Learning')
  await page.getByLabel('Location').fill('Riverton')
  await typeDate(page, 0, future(20))
  await typeDate(page, 1, future(21))
  await page.getByLabel('Cost per attendee').fill('640')
  await page.getByRole('button', { name: /Next: Attendees/ }).click()

  await expect(page.getByRole('heading', { name: 'Who attends?' })).toBeVisible()
  await expect(page.getByText('Approved by').first()).toBeVisible()
  await expect(page.getByText('Max Manager', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: /Next: Documents/ }).click()
  await page.getByRole('button', { name: /Next: Review/ }).click()
  await expect(page.getByText('Emma Employee → Max Manager → Training office')).toBeVisible()
  await page.getByRole('button', { name: 'Submit request' }).click()

  await expect(page).toHaveURL(/\/training\/requests\//)
  await expect(page.getByRole('heading', { name: 'Incident Communication Basics' })).toBeVisible()
  await expect(page.getByText('Awaiting manager').first()).toBeVisible()

  await switchTo(page, 'max', '/training/approvals')
  await page.getByRole('option', { name: /Incident Communication Basics/ }).click()
  await page.getByRole('button', { name: /^Approve/ }).click()
  await expect(page.getByText('Approved.').first()).toBeVisible()
  await expect(page.getByRole('option', { name: /Incident Communication Basics/ })).toHaveCount(0)

  await switchTo(page, 'tina', '/back-office/training')
  await page.getByRole('option', { name: /Incident Communication Basics/ }).click()
  await page
    .getByRole('button', { name: /Book it/ })
    .first()
    .click()
  await page.getByLabel('Booking reference').fill('NGL-4711')
  await page.getByRole('dialog').getByRole('button', { name: 'Book it' }).click()
  await expect(page.getByText(/Booked\. The attendee gets the details/).first()).toBeVisible()
  expect(errors).toEqual([])
})

test('Max declines with a reason (D shortcut)', async ({ page }) => {
  await signInAs(page, 'max', '/training/approvals')
  await page.getByRole('option', { name: /Customer Communication Masterclass/ }).click()
  await page.keyboard.press('d')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Decline this training?')).toBeVisible()
  await dialog.getByRole('textbox').fill('Please join the internal session in spring.')
  await dialog.getByRole('button', { name: 'Decline training' }).click()
  await expect(page.getByText('Declined. The attendee is told why.').first()).toBeVisible()
})

test('approvals tabs: deputy items for Priya and the team override', async ({ page }) => {
  await signInAs(page, 'max', '/training/approvals?tab=deputy')
  await expect(page.getByRole('option', { name: /Advanced Troubleshooting Lab/ })).toHaveCount(2)
  await page
    .getByRole('option', { name: /Advanced Troubleshooting Lab/ })
    .first()
    .click()
  await expect(page.getByText("You're deputy for Priya Raman")).toBeVisible()
  await page.goto('/training/approvals?tab=team')
  await expect(page.getByRole('option', { name: /Safety Inspection Basics/ })).toBeVisible()
})

test('Emma writes her learning goals and gives feedback', async ({ page }) => {
  await signInAs(page, 'emma', '/training')
  await page.getByText('First Aid at Work Refresher').first().click()
  await expect(page.getByRole('heading', { name: 'Learning goals' })).toBeVisible()
  await page.getByLabel('Goal 1').fill('Run the first-aid drill for the Riverton team')
  await page.getByRole('button', { name: 'Save goals' }).click()
  await expect(page.getByText(/Goals saved/).first()).toBeVisible()

  await page.goto('/training/ratings')
  await page.getByText('Spreadsheet Analysis Essentials').first().click()
  await expect(page.getByText(/Round 2 of 3/)).toBeVisible()
  for (const statement of [
    'I apply what I learned in my daily work.',
    'My manager supported me in putting it into practice.',
    'The training was worthwhile for the organisation.',
  ]) {
    await page
      .getByRole('radiogroup', { name: statement })
      .getByRole('radio', { name: 'Mostly agree' })
      .click()
  }
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(page.getByText('Thanks for your feedback.').first()).toBeVisible()
  await expect(page).toHaveURL(/\/training\/ratings$/)
})

test('training office queues and ratings overview', async ({ page }) => {
  await signInAs(page, 'tina', '/back-office/training')
  await expect(page.getByRole('option', { name: /ITIL Foundation/ })).toBeVisible()
  await page.getByRole('tab', { name: /Cancellations/ }).click()
  await expect(page.getByRole('option')).toHaveCount(2)
  await page.getByRole('tab', { name: /Booking impossible/ }).click()
  await page.getByRole('option', { name: /Data Protection Officer Course/ }).click()
  await expect(page.getByRole('button', { name: 'Retry booking' })).toBeVisible()
  await page.goto('/back-office/training/ratings')
  await expect(page.getByText('Round 2 · In practice')).toBeVisible()
  await page.goto('/back-office/training/requests')
  await expect(page.getByText('TRN-000016')).toBeVisible()
})
