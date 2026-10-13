import { expect, test, type Page } from '@playwright/test'
import { dateDigitsIn, signInAs, trackConsoleErrors, type PersonaKey } from './helpers'

/**
 * Travel (slice A2) in demo mode: the main flows of SCREENS §5 against the MSW mock API.
 * Each test starts with fresh demo data (new browser context → empty localStorage).
 */

/** Switch persona inside one context (the mock database in localStorage is kept). */
async function switchTo(page: Page, persona: PersonaKey, redirect?: string) {
  await page.evaluate(() => {
    localStorage.removeItem('atrium.auth.token')
    localStorage.removeItem('atrium.auth.expires')
  })
  await signInAs(page, persona, redirect)
}

/** Sign in, then open a page (focus-layout pages have no persona switcher to wait for). */
async function signInAndOpen(page: Page, persona: PersonaKey, url: string) {
  await signInAs(page, persona)
  await page.goto(url)
}

/** Type a date-time into the n-th UiDatePicker of the step (segments: day, month, year, hour, minute). */
async function typeDateTime(page: Page, index: number, digits: string) {
  await page.getByRole('spinbutton', { name: /^day/ }).nth(index).click()
  await page.keyboard.type(digits)
}

/** Visible text in the live summary slip (it also renders a collapsed copy for small screens). */
const inSlip = (page: Page, text: string) =>
  page
    .getByRole('complementary', { name: 'Summary' })
    .getByText(text)
    .filter({ visible: true })
    .first()

test.describe('travel', () => {
  test('my trips lists S-V1 and its detail explains both reasons', async ({ page }) => {
    const errors = trackConsoleErrors(page)
    await signInAs(page, 'emma', '/travel')
    await expect(page.getByRole('heading', { level: 1, name: 'My trips' })).toBeVisible()
    await page.getByRole('link', { name: 'TRV-000001' }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Car rental to Westbay' }),
    ).toBeVisible()
    await expect(page).toHaveTitle(/TRV-000001/)
    await expect(page.getByText('Needs approval because…')).toBeVisible()
    await expect(page.getByText('Automatic transmission (guaranteed)').first()).toBeVisible()
    await expect(page.getByText('Foreign travel').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Withdraw…' }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test('the car stepper shows live reasons from the preview', async ({ page }) => {
    await signInAndOpen(page, 'emma', '/travel/new/car')
    await expect(page.getByRole('heading', { name: /Where and when/ })).toBeVisible()
    await expect(inSlip(page, 'No approval needed')).toBeVisible()

    await typeDateTime(page, 0, `${dateDigitsIn(7)}0800`)
    await typeDateTime(page, 1, `${dateDigitsIn(8)}1800`)
    await page.getByLabel('Destination').fill('Westbay')
    await page.getByRole('button', { name: 'Next: Vehicle' }).click()

    await page.getByRole('radio', { name: 'Automatic guaranteed' }).click()
    await expect(inSlip(page, 'Needs approval because…')).toBeVisible()
    await expect(inSlip(page, 'Automatic transmission (guaranteed)')).toBeVisible()
    await expect(page.getByLabel('Why do you need this?')).toBeVisible()

    await page.getByRole('radio', { name: 'Manual' }).click()
    await expect(inSlip(page, 'No approval needed')).toBeVisible()
  })

  test('a saver-fare train journey goes to the manager for approval', async ({ page }) => {
    await signInAndOpen(page, 'emma', '/travel/new/train')
    await page.getByLabel('From').fill('Riverton Central')
    await page.getByLabel('To', { exact: true }).fill('Northport Central')
    await typeDateTime(page, 0, `${dateDigitsIn(7)}0715`)
    await typeDateTime(page, 1, `${dateDigitsIn(8)}1830`)
    await page.getByRole('button', { name: 'Next: Travellers' }).click()
    await page.getByRole('button', { name: 'Next: Tickets' }).click()
    await page.getByRole('radio', { name: /Saver fare/ }).click()
    await expect(inSlip(page, 'Saver fare (non-refundable)')).toBeVisible()
    await page.getByRole('button', { name: 'Next: Costs & approval' }).click()
    await expect(page.getByRole('radio', { name: /Max Manager/ })).toBeChecked()
    await page.getByRole('button', { name: 'Next: Review' }).click()
    await page.getByRole('button', { name: 'Submit request' }).click()

    await expect(
      page.getByRole('heading', { level: 1, name: 'Train journey to Northport' }),
    ).toBeVisible()
    await expect(page.getByText('Awaiting approval').first()).toBeVisible()
    await expect(page).toHaveTitle(/TRV-000041/)
  })

  test('Max approves from the approvals split view', async ({ page }) => {
    await signInAs(page, 'max', '/travel/approvals')
    await expect(page.getByRole('heading', { level: 1, name: 'Approvals' })).toBeVisible()
    const item = page.getByRole('option', { name: /Car rental to Southmere/ })
    await item.click()
    await expect(page.getByText('Diesel engine').first()).toBeVisible()
    await page
      .getByRole('button', { name: /^Approve/ })
      .first()
      .click()
    await expect(page.getByText(/Approved\. The travel desk books/).first()).toBeVisible()
    await expect(item).toHaveCount(0)
  })

  test('the travel desk books with a PDF and PIN; the traveller reveals the PIN', async ({
    page,
  }) => {
    await signInAs(page, 'tom', '/back-office/travel')
    await expect(page.getByRole('heading', { level: 1, name: 'Travel desk' })).toBeVisible()
    await page.getByRole('searchbox', { name: /Search by reference/ }).fill('TRV-000002')
    await expect(page.getByRole('option')).toHaveCount(1)
    await page.getByRole('option', { name: /Train journey to Hillford for Emma Employee/ }).click()
    await page.getByRole('button', { name: 'Book', exact: true }).click()

    const dialog = page.getByRole('dialog').filter({ hasText: 'Book this trip' })
    await dialog.getByRole('button', { name: 'Book trip' }).click()
    await expect(dialog.getByText('Enter the booking number from the provider.')).toBeVisible()
    await dialog.getByLabel('Booking number').fill('DB-48213-7')
    await dialog.getByLabel('PIN').fill('4821')
    await dialog.locator('input[type=file]').setInputFiles({
      name: 'booking-confirmation.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 demo confirmation'),
    })
    // Uploaded (not just "Uploading …"): the file is listed with its remove button.
    await expect(
      dialog.getByRole('button', { name: 'Remove booking-confirmation.pdf' }),
    ).toBeVisible()
    await dialog.getByRole('button', { name: 'Book trip' }).click()
    await expect(page.getByText(/Booked\. Emma gets the confirmation/).first()).toBeVisible()

    await switchTo(page, 'emma', '/travel')
    await page.getByRole('link', { name: 'TRV-000002' }).click()
    await expect(page.getByText('DB-48213-7', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Show PIN' }).click()
    await expect(page.getByText('4821', { exact: true })).toBeVisible()
  })

  test('the travel desk marks a booking impossible and retries it', async ({ page }) => {
    await signInAs(page, 'tom', '/back-office/travel')
    await page.getByRole('searchbox', { name: /Search by reference/ }).fill('TRV-000013')
    await expect(page.getByRole('option')).toHaveCount(1)
    await page.getByRole('option', { name: /Car rental to Oakridge/ }).click()
    await page.getByRole('button', { name: 'Booking impossible…' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('textbox').fill('No cars left at the Riverton branch.')
    await dialog.getByRole('button', { name: 'Mark booking impossible' }).click()
    await expect(
      page.getByText('Marked as impossible. The traveller has been told.').first(),
    ).toBeVisible()

    await page.getByRole('tab', { name: /Booking impossible/ }).click()
    await page.getByRole('option', { name: /Car rental to Oakridge/ }).click()
    await expect(page.getByText('No cars left at the Riverton branch.').first()).toBeVisible()
    await page.getByRole('button', { name: 'Retry booking' }).click()
    await expect(page.getByText('Back in the booking queue.').first()).toBeVisible()
  })

  test('the travel desk adds a car class', async ({ page }) => {
    await signInAs(page, 'tom', '/back-office/travel/car-classes')
    await expect(page.getByRole('cell', { name: 'ECMR', exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'New class' }).click()
    const dialog = page.getByRole('dialog').filter({ hasText: 'New car class' })
    await dialog.getByLabel('Code').fill('cdar')
    await dialog.getByLabel('Name').fill('Compact automatic')
    await dialog.getByRole('button', { name: 'Add class' }).click()
    await expect(page.getByRole('cell', { name: 'CDAR', exact: true }).first()).toBeVisible()
    await expect(
      page.getByRole('cell', { name: 'Compact automatic', exact: true }).first(),
    ).toBeVisible()
  })

  test('IT admins see bookings but cannot reveal PINs', async ({ page }) => {
    await signInAs(page, 'ian', '/back-office/travel?queue=all')
    await page.getByRole('searchbox', { name: /Search by reference/ }).fill('TRV-000003')
    await expect(page.getByRole('option')).toHaveCount(1)
    await page.getByRole('option', { name: /Flight to Northport for Emma Employee/ }).click()
    await expect(page.getByText('QX7H2L', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Show PIN' })).toHaveCount(0)
  })

  test('works at 375 px without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await signInAs(page, 'emma', '/travel')
    await expect(page.getByRole('heading', { level: 1, name: 'My trips' })).toBeVisible()
    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(await overflow()).toBeLessThanOrEqual(0)
    await page
      .getByRole('link', { name: /Riverton → Westbay/ })
      .first()
      .click()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Car rental to Westbay' }),
    ).toBeVisible()
    expect(await overflow()).toBeLessThanOrEqual(0)
    await page.goto('/travel/new/car')
    await expect(page.getByText('Step 1 of 6')).toBeVisible()
    expect(await overflow()).toBeLessThanOrEqual(0)
  })
})
