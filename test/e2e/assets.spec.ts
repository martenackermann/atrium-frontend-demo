import { expect, test } from '@playwright/test'
import { signInAs } from './helpers'

/** Assets slice (A3) main flows in demo mode (MSW): SCREENS §6, SPEC §5.3. */

test.describe('my devices (Emma)', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'emma', '/assets')
    await expect(page.getByRole('heading', { level: 1, name: 'My devices' })).toBeVisible()
  })

  test('accepts the new laptop with the installed platform', async ({ page }) => {
    const pending = page.getByRole('region', { name: /devices? wait/ })
    await expect(pending.getByRole('article')).toHaveCount(2)
    const laptop = pending.getByRole('article', { name: 'Vireo Pro 14' })
    await expect(laptop).toContainText('AST-00118')
    await laptop.getByRole('button', { name: 'Accept laptop' }).click()

    const dialog = page.getByRole('dialog', { name: 'Accept your laptop' })
    await dialog.getByRole('button', { name: 'Accept laptop' }).click()
    await expect(dialog).toContainText('Choose the platform installed on the device.')
    await dialog.getByRole('radio', { name: 'Strata OS 15' }).click()
    await dialog.getByRole('button', { name: 'Accept laptop' }).click()

    await expect(
      page.getByText('Laptop accepted. It is now registered to you.', { exact: true }),
    ).toBeVisible()
    await expect(pending.getByRole('article')).toHaveCount(1)
    const inUse = page.getByRole('region', { name: 'In use' })
    await expect(inUse.getByRole('link', { name: /Vireo Pro 14/ })).toContainText('Strata OS 15')
  })

  test('declines the phone with a reason', async ({ page }) => {
    const phone = page.getByRole('article', { name: 'Marlowe X5 128 GB Midnight' })
    await phone.getByRole('button', { name: 'Decline…' }).click()
    const dialog = page.getByRole('dialog', { name: 'Decline this smartphone?' })
    await dialog.getByRole('button', { name: 'Decline smartphone' }).click()
    await expect(dialog).toContainText('Add a reason')
    await dialog.getByRole('textbox').fill('I already have a phone from the field team.')
    await dialog.getByRole('button', { name: 'Decline smartphone' }).click()
    await expect(
      page.getByText('Smartphone declined. IT support has your reason.', { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('article', { name: 'Marlowe X5 128 GB Midnight' })).toHaveCount(0)
  })

  test('opens the device detail without admin history', async ({ page }) => {
    await page.getByRole('link', { name: /Skylark View 27/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Skylark View 27' })).toBeVisible()
    await expect(page.getByText('AST-00064').filter({ visible: true }).first()).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Timeline' })).toHaveCount(0)
  })
})

test.describe('asset admin (Arne)', () => {
  test.beforeEach(async ({ page }) => signInAs(page, 'arne'))

  test('dashboard shows the status cards and waiting devices', async ({ page }) => {
    await page.goto('/back-office/assets')
    await expect(page.getByRole('heading', { level: 1, name: 'Asset dashboard' })).toBeVisible()
    await expect(page.getByRole('link', { name: /82\s*In use/ })).toBeVisible()
    await expect(page.getByText('1 overdue').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible()
  })

  test('filters the inventory, assigns a device and sends another to repair', async ({ page }) => {
    await page.goto('/back-office/assets/inventory?status=in_stock')
    await expect(page.getByRole('heading', { level: 1, name: 'Inventory' })).toBeVisible()
    await expect(page.getByText(/22 assets match/)).toBeVisible()
    await page
      .getByRole('cell', { name: /^AST-\d{5}$/ })
      .first()
      .click()
    await expect(page).toHaveURL(/inventory\/[0-9a-f-]{36}/)

    await page.getByRole('button', { name: 'Assign' }).click()
    const dialog = page.getByRole('dialog', { name: 'Assign device' })
    await dialog.getByRole('combobox').click()
    await page.keyboard.type('Max')
    await page.getByRole('option', { name: /Max Manager/ }).click()
    await dialog.getByRole('button', { name: 'Assign device' }).click()
    await expect(
      page.getByText('Assigned. They get an email to accept the device.', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText(/Waiting for Max Manager to accept/)).toBeVisible()

    await page.getByRole('tab', { name: 'Timeline' }).click()
    await expect(
      page.getByText('Arne Assets assigned the device to Max Manager (back office)'),
    ).toBeVisible()
  })

  test('keeps the cost centre read-only while assigned and edits notes', async ({ page }) => {
    await page.goto('/back-office/assets/inventory?q=AST-00064')
    await page.getByRole('cell', { name: 'AST-00064', exact: true }).click()
    await expect(page.getByText(/Follows Emma Employee while the device is assigned/)).toBeVisible()
    await page.getByRole('textbox', { name: /notes/i }).fill('Spare cable in the drawer.')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(
      page.getByText('Saved. The change is in the timeline.', { exact: true }),
    ).toBeVisible()
    await page.getByRole('tab', { name: 'Timeline' }).click()
    await expect(
      page.getByText('Arne Assets edited the details (back office)').first(),
    ).toBeVisible()
  })

  test('adds a new asset to stock', async ({ page }) => {
    await page.goto('/back-office/assets/inventory/new')
    const field = (label: string) => page.getByRole('combobox', { name: label })
    await field('Device type').click()
    await page.getByRole('option', { name: 'Monitor' }).click()
    await field('Manufacturer').click()
    await page.getByRole('option', { name: 'Skylark Displays' }).click()
    await field('Model').click()
    await page.getByRole('option', { name: 'Skylark View 24' }).click()
    await page.getByLabel('Serial number').fill('SKY-E2E-0001')
    await page.getByRole('button', { name: 'Add to stock' }).click()
    await expect(page.getByText(/^AST-\d{5} added to stock\.$/)).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Skylark View 24' })).toBeVisible()
  })

  test('names a phone model from base name, storage and colour', async ({ page }) => {
    await page.goto('/back-office/assets/models')
    await page.getByRole('button', { name: 'New model' }).click()
    const dialog = page.getByRole('dialog', { name: 'New model' })
    await dialog.getByRole('combobox', { name: 'Device type' }).click()
    await page.getByRole('option', { name: 'Smartphone' }).click()
    await dialog.getByRole('combobox', { name: 'Manufacturer' }).click()
    await page.getByRole('option', { name: 'Marlowe Mobile' }).click()
    await dialog.getByLabel('Base name').fill('Marlowe X6')
    await dialog.getByLabel('Storage').fill('512')
    await dialog.getByLabel('Colour').fill('Dune')
    await expect(dialog).toContainText('Shown as Marlowe X6 512 GB Dune')
    await dialog.getByRole('button', { name: 'Add model' }).click()
    await expect(
      page.getByText('Marlowe X6 512 GB Dune added to the catalogue.', { exact: true }),
    ).toBeVisible()
  })

  test('catalogue lists manufacturers and archived platforms', async ({ page }) => {
    await page.goto('/back-office/assets/catalog?tab=platforms')
    await expect(page.getByRole('cell', { name: 'Pocket OS 17', exact: true })).toBeVisible()
    await expect(page.getByText('Archived').first()).toBeVisible()
    await page.getByRole('tab', { name: /Manufacturers/ }).click()
    await expect(page.getByRole('cell', { name: 'Vireo Computing', exact: true })).toBeVisible()
  })
})

test('employees cannot open the asset back office', async ({ page }) => {
  await signInAs(page, 'emma')
  await page.goto('/back-office/assets/inventory')
  await expect(page.getByTestId('error-view')).toContainText('have access')
})

test('my devices fit a 375px screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await signInAs(page, 'emma', '/assets')
  await expect(page.getByRole('button', { name: 'Accept laptop' })).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
