import { expect, test, type Page } from '@playwright/test'
import {
  dateDigitsIn,
  DISPLAY_NAMES,
  signInAs,
  trackConsoleErrors,
  type PersonaKey,
} from './helpers'

/**
 * Cross-module happy paths (integration), persona by persona, in one browser context per test.
 *
 * Demo mode (default): runs against the MSW mock API; every test starts from fresh demo data.
 * API mode: point PLAYWRIGHT_BASE_URL at a frontend built with NUXT_PUBLIC_DEMO_MODE=api against a
 * freshly seeded backend (`pnpm demo:reset`) and set E2E_API=1. Records are named uniquely, so
 * the suite can run more than once against the same database (the Home "My day" counts run
 * only with E2E_FRESH_SEED=1, i.e. right after `pnpm demo:reset`). With E2E_MAILPIT_URL
 * (e.g. http://localhost:8025) the emails each step sends are checked in Mailpit too.
 */

const API_MODE = process.env.E2E_API === '1'
const MAILPIT = process.env.E2E_MAILPIT_URL
const RUN = Date.now().toString(36).slice(-5).toUpperCase()

test.describe.configure({ mode: API_MODE ? 'serial' : 'parallel' })

/** Sign out (keep the data) and sign in as someone else. */
async function switchTo(page: Page, persona: PersonaKey, path: string) {
  await page.evaluate(() => {
    localStorage.removeItem('atrium.auth.token')
    localStorage.removeItem('atrium.auth.expires')
  })
  await signInAs(page, persona, path)
}

async function typeDate(page: Page, index: number, days: number, time = '') {
  await page.getByRole('spinbutton', { name: /^day/ }).nth(index).click()
  await page.keyboard.type(dateDigitsIn(days) + time)
}

const toast = (page: Page, text: string | RegExp) => page.getByText(text).first()

/** Mailpit search (API mode only): waits until a message to `to` matches `subject`. */
async function expectMail(to: string, subject: RegExp) {
  if (!MAILPIT) return
  await expect
    .poll(
      async () => {
        const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)
        const body = (await res.json()) as { messages: Array<{ Subject: string }> }
        return body.messages.some((message) => subject.test(message.Subject))
      },
      { message: `mail to ${to} matching ${subject}`, timeout: 20_000 },
    )
    .toBe(true)
}

test('training ≥ €5,000: Sofia requests for her technician, Max (escalated) and Clara approve, Tina books, Emma rates', async ({
  page,
}) => {
  test.setTimeout(240_000)
  const errors = trackConsoleErrors(page)
  const topic = `Fibre Network Leadership ${RUN}`

  await signInAs(page, 'sofia')
  await page.goto('/training/new')
  await expect(page.getByRole('heading', { name: 'Which training is it?' })).toBeVisible()
  await page.getByLabel('Topic').fill(topic)
  await page.getByLabel('Provider').fill('Clearview Institute')
  await page.getByLabel('Location').fill('Hillford')
  await typeDate(page, 0, 30)
  await typeDate(page, 1, 32)
  await page.getByLabel('Cost per attendee').fill('5600')
  await page.getByRole('combobox', { name: 'Executive approver' }).click()
  await page.getByRole('option', { name: /Clara CEO/ }).click()
  await page.getByRole('button', { name: /Next: Attendees/ }).click()

  await expect(page.getByRole('heading', { name: 'Who attends?' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Add an attendee' }).fill('Larry')
  await page.getByRole('option', { name: /Larry Skiles/ }).click()
  const attendees = page.getByRole('list', { name: 'Attendees' })
  await expect(attendees).toContainText('Larry Skiles')
  // The stepper starts with the requester as an attendee: this one is for the technician only.
  const removeSofia = attendees.getByRole('button', { name: 'Remove Sofia Site-Manager' })
  if (await removeSofia.count()) await removeSofia.click()
  await expect(attendees.getByRole('listitem')).toHaveCount(1)
  // SPEC §6.1: site managers are skipped - the approval escalates past Sofia to Max.
  await expect(attendees.getByText('Max Manager', { exact: true })).toBeVisible()
  await expect(attendees.getByText('Escalated past Sofia Site-Manager')).toBeVisible()
  await page.getByRole('button', { name: /Next: Documents/ }).click()
  await page.getByRole('button', { name: /Next: Review/ }).click()
  await page.getByRole('button', { name: 'Submit request' }).click()
  await expect(page.getByRole('heading', { name: topic })).toBeVisible()
  await expectMail('max.manager@example.com', /^Approval needed: Larry Skiles – Fibre Network/)

  await switchTo(page, 'max', '/training/approvals')
  await page.getByRole('option', { name: new RegExp(topic) }).click()
  await page
    .getByRole('button', { name: /^Approve/ })
    .first()
    .click()
  await expect(toast(page, /Approved\./)).toBeVisible()
  await expectMail('clara.ceo@example.com', /^Executive approval needed .*Fibre Network/)

  await switchTo(page, 'clara', '/training/approvals?tab=executive')
  await page.getByRole('option', { name: new RegExp(topic) }).click()
  await page
    .getByRole('button', { name: /^Approve/ })
    .first()
    .click()
  await expect(toast(page, /Approved\./)).toBeVisible()
  await expectMail('training-office@example.com', /^To book: Fibre Network/)

  await switchTo(page, 'tina', '/back-office/training')
  await page.getByRole('option', { name: new RegExp(topic) }).click()
  await page
    .getByRole('button', { name: /Book it/ })
    .first()
    .click()
  await page.getByLabel('Booking reference').fill(`CVI-${RUN}`)
  await page.getByRole('dialog').getByRole('button', { name: 'Book it' }).click()
  await expect(toast(page, /Booked\./)).toBeVisible()

  await expect(page.getByRole('option', { name: new RegExp(topic) })).toHaveCount(0)
  await page.goto(`/back-office/training/requests?q=${encodeURIComponent(topic)}`)
  await page.getByText(topic).first().click()
  await expect(page.getByRole('heading', { name: topic })).toBeVisible()
  await expect(page.getByText('Booked').first()).toBeVisible()

  // A feedback round that is due (S-T3, loop 1) - the rating step of the training lifecycle.
  await switchTo(page, 'emma', '/training/ratings')
  await page.getByText('Project Fundamentals Workshop').first().click()
  await expect(page.getByText(/Round 1 of 3/)).toBeVisible()
  for (const group of await page.getByRole('radiogroup').all())
    await group.getByRole('radio').nth(3).click()
  await page.getByRole('button', { name: 'Send feedback' }).click()
  await expect(toast(page, 'Thanks for your feedback.')).toBeVisible()
  expect(errors).toEqual([])
})

test('assets: Arne assigns a device in stock to Emma, Emma accepts it', async ({ page }) => {
  test.setTimeout(150_000)
  const errors = trackConsoleErrors(page)
  await signInAs(page, 'arne', '/back-office/assets/inventory?status=in_stock')
  await expect(page.getByRole('heading', { level: 1, name: 'Inventory' })).toBeVisible()
  await page
    .getByRole('cell', { name: /^AST-\d{5}$/ })
    .first()
    .click()
  await expect(page).toHaveURL(/inventory\/[0-9a-f-]{36}/)
  const model = (await page.getByRole('heading', { level: 1 }).innerText()).trim()

  await page.getByRole('button', { name: 'Assign' }).click()
  const dialog = page.getByRole('dialog', { name: 'Assign device' })
  await dialog.getByRole('combobox').click()
  await page.keyboard.type('Emma')
  await page.getByRole('option', { name: /Emma Employee/ }).click()
  await dialog.getByRole('button', { name: 'Assign device' }).click()
  await expect(toast(page, 'Assigned. They get an email to accept the device.')).toBeVisible()
  await expectMail('emma.employee@example.com', /^Confirm your new /)

  await switchTo(page, 'emma', '/assets')
  const pending = page.getByRole('region', { name: /devices? wait/ })
  const card = pending.getByRole('article', { name: model }).first()
  await card.getByRole('button', { name: /^Accept/ }).click()
  const accept = page.getByRole('dialog', { name: /^Accept your/ })
  const platforms = accept.getByRole('radio')
  if (await platforms.count()) await platforms.first().click()
  await accept.getByRole('button', { name: /^Accept/ }).click()
  await expect(toast(page, /accepted\. It is now registered to you\./)).toBeVisible()
  await expect(page.getByRole('region', { name: 'In use' })).toContainText(model)
  await expectMail('it-support@example.com', /^Emma Employee accepted AST-/)
  expect(errors).toEqual([])
})

test('people: Emma asks for access, Paula works it, asks a question, Emma replies, Paula completes', async ({
  page,
}) => {
  test.setTimeout(180_000)
  const errors = trackConsoleErrors(page)
  const title = `Access to the fleet planning tool ${RUN}`

  await signInAs(page, 'emma')
  await page.goto('/people-requests/new')
  await page.getByRole('radio', { name: /Role or access change/ }).click()
  await page.getByRole('textbox', { name: 'Title' }).fill(title)
  await page.getByRole('button', { name: /Next/ }).click()
  await page.getByRole('button', { name: 'Choose me' }).click()
  await expect(page.getByRole('combobox', { name: 'Person' })).toHaveValue('Emma Employee')
  await typeDate(page, 0, 14)
  await page.getByRole('button', { name: /Next/ }).click()
  await expect(page.getByRole('heading', { name: 'Role and organisation' })).toBeVisible()
  await page.getByRole('button', { name: /Next/ }).click()
  await page
    .getByRole('textbox', { name: 'Reason' })
    .fill('I plan the Westbay routes from next month.')
  await page.getByRole('button', { name: /Next/ }).click()
  await page.getByRole('button', { name: 'Send to People Ops' }).click()
  await expect(toast(page, /sent to People Ops\./)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await expectMail(
    'people-ops@example.com',
    /^New role or access change request: Access to the fleet/,
  )

  await switchTo(page, 'paula', '/back-office/people')
  const queue = page.getByRole('listbox', { name: 'People Ops' })
  await queue.getByRole('option', { name: new RegExp(title) }).click()
  await page.getByRole('button', { name: 'Start work' }).click()
  await expect(toast(page, 'Work started.')).toBeVisible()

  await page.getByRole('tab', { name: /Working/ }).click()
  await queue.getByRole('option', { name: new RegExp(title) }).click()
  await page.getByRole('button', { name: 'More actions' }).first().click()
  await page.getByRole('menuitem', { name: /^Ask requester/ }).click()
  const ask = page.getByRole('dialog', { name: 'Ask the requester' })
  await ask.getByRole('textbox').fill('Do you need edit rights or only read access?')
  await ask.getByRole('button', { name: 'Send question' }).click()
  await expect(toast(page, 'Question sent to the requester.')).toBeVisible()
  await expectMail('emma.employee@example.com', /is now Waiting on requester|New comment on PPL-/)

  await switchTo(page, 'emma', '/people-requests')
  await page.getByRole('link', { name: title }).click()
  await expect(page.getByTestId('waiting-banner')).toContainText('Do you need edit rights')
  await page.getByRole('textbox', { name: 'Your reply' }).fill('Edit rights, please.')
  await page.getByRole('button', { name: 'Send reply' }).click()
  await expect(toast(page, 'Reply sent. The request is back with People Ops.')).toBeVisible()

  await switchTo(page, 'paula', '/back-office/people?queue=in_progress')
  await queue.getByRole('option', { name: new RegExp(title) }).click()
  await expect(page.getByTestId('conversation')).toContainText('Edit rights, please.')
  await page.getByRole('button', { name: /^Complete/ }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Complete request' }).click()
  await expect(toast(page, 'Completed. The requester is told.')).toBeVisible()
  await expectMail('emma.employee@example.com', /is now Completed/)
  expect(errors).toEqual([])
})

test('news: Paula writes a post, schedules it, then publishes it now', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = trackConsoleErrors(page)
  const title = `Canteen opens earlier ${RUN}`
  await signInAs(page, 'paula', '/back-office/news/new')
  await page.getByTestId('news-title').fill(title)
  await page.getByTestId('news-summary').fill('Breakfast from 7:00 at Campus from next week.')
  await page.getByRole('textbox', { name: 'Article body' }).click()
  await page.keyboard.type('Breakfast is served from 7:00. Coffee as always.')
  await page.getByTestId('news-save').click()
  await expect(toast(page, 'Draft saved.')).toBeVisible()

  await page.getByTestId('news-schedule').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Schedule post' }).click()
  await expect(toast(page, 'Scheduled.')).toBeVisible()
  await expect(page.getByText('Scheduled', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Publish now' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publish now' }).click()
  await expect(toast(page, 'Published.')).toBeVisible()
  await switchTo(page, 'emma', '/news')
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  expect(errors).toEqual([])
})

test('travel: Emma rents an automatic car (needs approval), Max approves, Tom books with PDF and PIN', async ({
  page,
}) => {
  test.setTimeout(200_000)
  const errors = trackConsoleErrors(page)
  const destination = `Lakeside ${RUN}`

  await signInAs(page, 'emma')
  await page.goto('/travel/new/car')
  await expect(page.getByRole('heading', { name: /Where and when/ })).toBeVisible()
  await typeDate(page, 0, 12, '0800')
  await typeDate(page, 1, 13, '1800')
  await page.getByLabel('Destination').fill(destination)
  await page.getByRole('button', { name: 'Next: Vehicle' }).click()
  await page.getByRole('radio', { name: 'Automatic guaranteed' }).click()
  await page
    .getByLabel('Why do you need this?')
    .fill('Medical reasons: I cannot drive a manual car.')
  await page.getByRole('button', { name: /^Next: Handover/ }).click()
  await page.getByLabel('Branch', { exact: true }).fill('Riverton')
  await page.getByLabel('Return branch').fill('Riverton')
  await page.getByRole('button', { name: 'Next: Driver' }).click()
  await expect(page.getByRole('heading', { name: 'Who drives?' })).toBeVisible()
  const phone = page.getByLabel('Phone')
  if (!(await phone.inputValue())) await phone.fill('555-0142')
  await page.getByRole('spinbutton', { name: /^day/ }).first().click()
  await page.keyboard.type('15061990')
  await page.getByRole('button', { name: /^Next: Costs/ }).click()
  await expect(page.getByRole('radio', { name: /Max Manager/ })).toBeChecked()
  await page.getByRole('button', { name: 'Next: Review' }).click()
  await page.getByRole('button', { name: 'Submit request' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: `Car rental to ${destination}` }),
  ).toBeVisible()
  await expect(page.getByText('Automatic transmission (guaranteed)').first()).toBeVisible()
  await expectMail('max.manager@example.com', /^Travel approval needed: Emma Employee – car/)

  await switchTo(page, 'max', '/travel/approvals')
  await page.getByRole('option', { name: new RegExp(`Car rental to ${destination}`) }).click()
  await page
    .getByRole('button', { name: /^Approve/ })
    .first()
    .click()
  await expect(toast(page, /Approved\. The travel desk books/)).toBeVisible()
  await expectMail('travel-desk@example.com', /^Approved – to book: car .*Lakeside/)

  await switchTo(page, 'tom', '/back-office/travel')
  await page.getByRole('option', { name: new RegExp(`Car rental to ${destination}`) }).click()
  await page.getByRole('button', { name: 'Book', exact: true }).click()
  const book = page.getByRole('dialog').filter({ hasText: 'Book this trip' })
  await book.getByLabel('Booking number').fill(`RC-${RUN}`)
  await book.getByLabel('PIN').fill('7310')
  await book.locator('input[type=file]').setInputFiles({
    name: 'rental-confirmation.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% demo rental confirmation\n'),
  })
  await expect(book.getByRole('button', { name: 'Remove rental-confirmation.pdf' })).toBeVisible()
  await book.getByRole('button', { name: 'Book trip' }).click()
  await expect(toast(page, /Booked\. Emma gets the confirmation/)).toBeVisible()
  await expectMail('emma.employee@example.com', /^Booked: car .*Lakeside/)

  await switchTo(page, 'emma', '/travel')
  await page
    .getByRole('link', { name: new RegExp(destination) })
    .first()
    .click()
  await expect(page.getByText(`RC-${RUN}`, { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Show PIN' }).click()
  await expect(page.getByText('7310', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('travel: a saver-fare train journey goes to Max, who approves it from the inbox drawer', async ({
  page,
}) => {
  test.setTimeout(150_000)
  const errors = trackConsoleErrors(page)
  const to = `Southmere Central ${RUN}`
  await signInAs(page, 'emma')
  await page.goto('/travel/new/train')
  await page.getByLabel('From').fill('Riverton Central')
  await page.getByLabel('To', { exact: true }).fill(to)
  await typeDate(page, 0, 15, '0715')
  await typeDate(page, 1, 16, '1830')
  await page.getByRole('button', { name: 'Next: Travellers' }).click()
  await page.getByRole('button', { name: 'Next: Tickets' }).click()
  await page.getByRole('radio', { name: /Saver fare/ }).click()
  await page.getByRole('button', { name: 'Next: Costs & approval' }).click()
  await expect(page.getByRole('radio', { name: /Max Manager/ })).toBeChecked()
  await page.getByRole('button', { name: 'Next: Review' }).click()
  await page.getByRole('button', { name: 'Submit request' }).click()
  await expect(page.getByText('Awaiting approval').first()).toBeVisible()

  // Quick approve from the inbox drawer (SPEC_RESOLUTIONS #4: actionsPath).
  await switchTo(page, 'max', '/')
  await page.getByTestId('inbox-button').click()
  const drawer = page.getByTestId('inbox-drawer')
  const item = drawer.getByRole('article').filter({ hasText: to })
  await expect(item).toContainText('Approve train: Emma Employee')
  await item.getByRole('button', { name: 'Approve' }).click()
  await expect(toast(page, 'Approved.')).toBeVisible()
  await expect(drawer.getByRole('article').filter({ hasText: to })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('⌘K search jumps across modules', async ({ page }) => {
  await signInAs(page, 'tom', '/')
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByTestId('command-palette')
  await expect(palette).toBeVisible()
  await page.keyboard.type('TRV-000003')
  await expect(palette.getByRole('option', { name: /TRV-000003/ })).toBeVisible()
  await palette.getByRole('option', { name: /TRV-000003/ }).click()
  await expect(page).toHaveURL(/\/travel\/requests\/[0-9a-f-]{36}/)
  await expect(page.getByText('QX7H2L', { exact: true })).toBeVisible()

  await page.keyboard.press('ControlOrMeta+k')
  await page.keyboard.type('Westbay')
  await expect(palette.getByRole('option').first()).toBeVisible()
})

/** Home "My day" across modules for the personas of SPEC §2.3 (seeded data, demo mode). */
const DAYS: Array<[PersonaKey, RegExp, string[]]> = [
  ['emma', /6 things need you/, ['Rate: Spreadsheet Analysis Essentials', 'Confirm your new']],
  ['max', /11 things need you/, ['Approve', 'Rate Emma Employee']],
  ['clara', /5 things need you/, ['executive step', 'Approve flight: Victor Lang']],
  ['tom', /12 things need you/, ['Book train: Hillford Central → Riverton Central']],
  ['paula', /3 things need you/, ['Onboarding: Cloud Engineer – Campus']],
]

for (const [persona, count, texts] of DAYS) {
  test(`Home "My day" for ${DISPLAY_NAMES[persona]}`, async ({ page }) => {
    test.skip(API_MODE && !process.env.E2E_FRESH_SEED, 'counts need a freshly seeded database')
    const errors = trackConsoleErrors(page)
    await signInAs(page, persona)
    await expect(page.getByTestId('greeting')).toContainText(count)
    const needs = page.getByTestId('needs-attention')
    for (const text of texts) await expect(needs).toContainText(text)
    expect(errors).toEqual([])
  })
}
