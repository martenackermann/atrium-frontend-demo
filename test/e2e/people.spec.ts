import { expect, test } from '@playwright/test'
import { signInAs, trackConsoleErrors } from './helpers'

/**
 * People requests (slice A4) in demo mode: the requester's reply flow, the onboarding stepper,
 * the People Ops queue and the privacy rules for it_admin (SCREENS §7, SPEC §3.4/§5.4).
 */

test('Emma answers the open question and the request goes back to People Ops', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await signInAs(page, 'emma')
  await page.goto('/people-requests')
  await expect(page.getByTestId('reply-banner')).toContainText(
    'People Ops needs your reply on 1 request',
  )
  await page.getByRole('link', { name: 'Access to the dispatch planning board' }).click()

  await expect(
    page.getByRole('heading', { level: 1, name: 'Access to the dispatch planning board' }),
  ).toBeVisible()
  await expect(page.getByTestId('waiting-banner')).toContainText(
    'Which regions do you need to plan for?',
  )
  await expect(page.getByText('Needs your reply').first()).toBeVisible()

  await page.getByRole('textbox', { name: 'Your reply' }).fill('Riverton and Westbay, please.')
  await page.getByRole('button', { name: 'Send reply' }).click()
  await expect(
    page.getByText('Reply sent. The request is back with People Ops.', { exact: true }),
  ).toBeVisible()
  await expect(page.getByTestId('waiting-banner')).toHaveCount(0)
  await expect(page.getByTestId('conversation')).toContainText('Riverton and Westbay, please.')
  await expect(page.getByText('In progress').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('Max starts an onboarding with the stepper', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await signInAs(page, 'max')
  await page.goto('/people-requests/new')
  await expect(page.getByRole('heading', { name: 'What do you need?' })).toBeVisible()

  // Step 1: validation, then type, title, priority.
  await page.getByRole('button', { name: /Next/ }).click()
  await expect(page.getByText('Choose what you need.')).toBeVisible()
  await page.getByRole('radio', { name: /Onboarding/ }).click()
  await page.getByRole('textbox', { name: 'Title' }).fill('Field Technician – Eastgate')
  await page.getByRole('button', { name: /Next/ }).click()

  // Step 2: the new colleague and the start date.
  await expect(page.getByRole('heading', { name: 'Who is joining?' })).toBeVisible()
  await page.getByRole('textbox', { name: 'First name' }).fill('Kit')
  await page.getByRole('textbox', { name: 'Last name' }).fill('Marlow')
  await page.getByRole('spinbutton', { name: /day/i }).first().click()
  await page.keyboard.type('15012030')
  await page.getByRole('button', { name: /Next/ }).click()

  // Step 3: job role and manager are required for onboarding.
  await expect(page.getByRole('heading', { name: 'Role and organisation' })).toBeVisible()
  await page.getByRole('button', { name: /Next/ }).click()
  await expect(page.getByText('Choose the job role of the new colleague.')).toBeVisible()
  await page.getByRole('combobox', { name: 'Job role' }).click()
  await page.getByRole('option', { name: 'Field Technician', exact: true }).click()
  await page.getByRole('combobox', { name: 'Manager', exact: true }).fill('Sofia')
  await page.getByRole('option', { name: /Sofia Site-Manager/ }).click()
  await page.getByRole('button', { name: /Next/ }).click()

  // Step 4: details with the personal-data panel open for onboarding.
  await expect(page.getByTestId('personal-data-panel')).toContainText(
    'Visible only to you, the manager and People Ops',
  )
  await page
    .getByRole('textbox', { name: 'Reason' })
    .fill('Second technician for the Eastgate team.')
  await page.getByRole('textbox', { name: 'Private email' }).fill('kit.marlow@example.com')
  await page.getByRole('button', { name: /Next/ }).click()

  // Step 5: review and send.
  await expect(page.getByRole('heading', { name: 'Check and send' })).toBeVisible()
  await page.getByRole('button', { name: 'Send to People Ops' }).click()
  await expect(page.getByText('PPL-000016 sent to People Ops.', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Field Technician – Eastgate' }),
  ).toBeVisible()
  await expect(page.getByTestId('personal-data')).toContainText('kit.marlow@example.com')
  expect(errors).toEqual([])
})

test('Paula works the People Ops queue', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await signInAs(page, 'paula')
  await page.goto('/back-office/people')
  const list = page.getByRole('listbox', { name: 'People Ops' })
  await expect(list.getByRole('option')).toHaveCount(3)
  await list.getByRole('option', { name: /PPL-000008/ }).click()
  await expect(page.getByTestId('ops-panel')).toBeVisible()
  await expect(page.getByTestId('personal-data')).toBeVisible()

  await page.getByRole('button', { name: 'Start work' }).click()
  await expect(page.getByText('Work started.', { exact: true })).toBeVisible()
  await expect(list.getByRole('option')).toHaveCount(2)

  await page.getByRole('tab', { name: /Working/ }).click()
  await list.getByRole('option', { name: /PPL-000008/ }).click()
  await page.getByRole('textbox', { name: 'Add a comment' }).fill('Laptop is reserved.')
  await page.getByRole('switch').first().click()
  await page.getByRole('button', { name: 'Add internal comment' }).click()
  await expect(page.getByText('Internal comment added.', { exact: true })).toBeVisible()
  await expect(page.getByTestId('conversation')).toContainText('Laptop is reserved.')
  expect(errors).toEqual([])
})

test('Ian sees people requests with personal data redacted', async ({ page }) => {
  await signInAs(page, 'ian')
  await page.goto('/back-office/people?queue=waiting')
  const list = page.getByRole('listbox', { name: 'People Ops' })
  await list.getByRole('option', { name: /PPL-000006/ }).click()
  await expect(page.getByTestId('personal-data-redacted')).toContainText('Personal data is hidden')
  await expect(page.getByRole('textbox', { name: 'Internal note' })).toHaveValue(
    'Waiting for laptop from IT stock',
  )
})

test('job roles can be added by People Ops', async ({ page }) => {
  await signInAs(page, 'paula')
  await page.goto('/back-office/people/job-roles')
  await page.getByRole('button', { name: 'New job role' }).click()
  await page.getByRole('dialog').getByRole('textbox', { name: 'Name' }).fill('Fleet Coordinator')
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: /Category/ })
    .fill('Logistics')
  await page.getByRole('button', { name: 'Add job role' }).click()
  await expect(page.getByText('Fleet Coordinator added.', { exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Fleet Coordinator', exact: true })).toBeVisible()
})
