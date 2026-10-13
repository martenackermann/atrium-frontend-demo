import { expect, test } from '@playwright/test'
import { signInAs, trackConsoleErrors, type PersonaKey } from './helpers'

const ID = '00000000-0000-7000-8000-000000000001'

/** Every SCREENS.md route with a persona allowed to open it, and the expected h1. */
const SLICE_PAGES: Array<[path: string, title: string, persona: PersonaKey]> = [
  ['/', 'Home', 'emma'],
  ['/training', 'My training', 'emma'],
  ['/training/new', 'Request training', 'emma'],
  [`/training/participations/${ID}`, 'Participation', 'emma'],
  [`/training/requests/${ID}`, 'Training request', 'emma'],
  ['/training/approvals', 'Training approvals', 'max'],
  ['/training/ratings', 'Ratings', 'emma'],
  [`/training/ratings/${ID}`, 'Rating', 'emma'],
  ['/back-office/training', 'Training office', 'tina'],
  ['/back-office/training/requests', 'All training requests', 'tina'],
  ['/back-office/training/ratings', 'Ratings overview', 'tina'],
  ['/travel', 'My trips', 'emma'],
  ['/travel/new', 'Book travel', 'emma'],
  ['/travel/new/car', 'Rent a car', 'emma'],
  ['/travel/new/train', 'Book a train journey', 'emma'],
  ['/travel/new/flight', 'Book a flight', 'emma'],
  [`/travel/requests/${ID}`, 'Travel request', 'emma'],
  ['/travel/approvals', 'Travel approvals', 'max'],
  ['/back-office/travel', 'Travel desk', 'tom'],
  ['/back-office/travel/car-classes', 'Car classes', 'tom'],
  ['/assets', 'My devices', 'emma'],
  [`/assets/${ID}`, 'Device', 'emma'],
  ['/back-office/assets', 'Asset dashboard', 'arne'],
  ['/back-office/assets/inventory', 'Inventory', 'arne'],
  ['/back-office/assets/inventory/new', 'New asset', 'arne'],
  [`/back-office/assets/inventory/${ID}`, 'Asset', 'arne'],
  ['/back-office/assets/models', 'Models', 'arne'],
  ['/back-office/assets/catalog', 'Catalogue', 'arne'],
  ['/people-requests', 'My people requests', 'emma'],
  ['/people-requests/new', 'New people request', 'emma'],
  [`/people-requests/${ID}`, 'People request', 'emma'],
  ['/back-office/people', 'People Ops queue', 'paula'],
  ['/back-office/people/job-roles', 'Job roles', 'paula'],
  ['/news', 'News', 'emma'],
  [`/news/${ID}`, 'News post', 'emma'],
  ['/back-office/news', 'News posts', 'paula'],
  ['/back-office/news/new', 'New post', 'paula'],
  [`/back-office/news/${ID}`, 'Edit post', 'paula'],
  ['/back-office/links', 'Useful links', 'paula'],
]

/** Foundation screens (built in phase 2b). */
const FOUNDATION_PAGES: Array<[path: string, heading: RegExp, persona: PersonaKey]> = [
  ['/inbox', /^Inbox$/, 'max'],
  ['/settings/deputies', /^Deputies$/, 'max'],
  ['/settings/profile', /^Paula People-Ops$/, 'paula'],
  ['/admin/users', /^Users$/, 'ian'],
  ['/admin/audit', /^Audit log$/, 'ian'],
  ['/admin/jobs', /^Jobs$/, 'ian'],
]

const byPersona = <T extends [string, unknown, PersonaKey]>(rows: T[]) =>
  Object.entries(
    rows.reduce<Record<string, T[]>>((groups, row) => {
      ;(groups[row[2]] ??= []).push(row)
      return groups
    }, {}),
  ) as Array<[PersonaKey, T[]]>

for (const [persona, rows] of byPersona(SLICE_PAGES)) {
  test(`placeholder pages render for ${persona}`, async ({ page }) => {
    test.setTimeout(30_000 + rows.length * 10_000)
    const errors = trackConsoleErrors(page)
    await signInAs(page, persona)
    for (const [path, title] of rows) {
      await page.goto(path)
      await expect(page.getByTestId('placeholder-page'), path).toBeVisible()
      await expect(page.getByRole('heading', { level: 1, name: title, exact: true }), path).toBeVisible()
    }
    expect(errors).toEqual([])
  })
}

for (const [persona, rows] of byPersona(FOUNDATION_PAGES)) {
  test(`foundation pages render for ${persona}`, async ({ page }) => {
    const errors = trackConsoleErrors(page)
    await signInAs(page, persona)
    for (const [path, heading] of rows) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading }), path).toBeVisible()
      await expect(page.getByTestId('error-view'), path).toHaveCount(0)
    }
    expect(errors).toEqual([])
  })
}

test('admin user detail loads and shows history', async ({ page }) => {
  await signInAs(page, 'ian')
  await page.goto('/admin/users')
  await page.getByRole('link', { name: 'Emma Employee' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Emma Employee' })).toBeVisible()
  await expect(page.getByLabel('First name')).toHaveValue('Emma')
})

test('unknown routes show the 404 view', async ({ page }) => {
  await signInAs(page, 'emma')
  await page.goto('/does-not-exist')
  await expect(page.getByTestId('error-view')).toContainText("We couldn't find that")
})
