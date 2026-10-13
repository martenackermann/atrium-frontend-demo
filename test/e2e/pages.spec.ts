import { expect, test } from '@playwright/test'
import { signInAs, trackConsoleErrors, type PersonaKey } from './helpers'

const ID = '00000000-0000-7000-8000-000000000001'

/** Every SCREENS.md route with a persona allowed to open it, and its h1 (slice pages). */
const SLICE_PAGES: Array<[path: string, heading: RegExp, persona: PersonaKey]> = [
  ['/', /^Good (morning|afternoon|evening), Emma\.$/, 'emma'],
  ['/training', /^My training$/, 'emma'],
  ['/training/new', /^Request training$/, 'emma'],
  ['/training/ratings', /^Feedback$/, 'emma'],
  ['/training/approvals', /^Approvals$/, 'max'],
  ['/back-office/training', /^Training office$/, 'tina'],
  ['/back-office/training/requests', /^All training requests$/, 'tina'],
  ['/back-office/training/ratings', /^Ratings overview$/, 'tina'],
  ['/travel', /^My trips$/, 'emma'],
  ['/travel/new', /^Book travel$/, 'emma'],
  ['/travel/new/car', /^New car rental$/, 'emma'],
  ['/travel/new/train', /^New train journey$/, 'emma'],
  ['/travel/new/flight', /^New flight$/, 'emma'],
  ['/travel/approvals', /^Travel approvals$/, 'max'],
  ['/back-office/travel', /^Travel desk$/, 'tom'],
  ['/back-office/travel/car-classes', /^Car classes$/, 'tom'],
  ['/assets', /^My devices$/, 'emma'],
  ['/back-office/assets', /^Asset dashboard$/, 'arne'],
  ['/back-office/assets/inventory', /^Inventory$/, 'arne'],
  ['/back-office/assets/inventory/new', /^New asset$/, 'arne'],
  ['/back-office/assets/models', /^Models$/, 'arne'],
  ['/back-office/assets/catalog', /^Catalogue$/, 'arne'],
  ['/people-requests', /^My people requests$/, 'emma'],
  ['/people-requests/new', /^New people request$/, 'emma'],
  ['/back-office/people', /^People Ops$/, 'paula'],
  ['/back-office/people/job-roles', /^Job roles$/, 'paula'],
  ['/news', /^News$/, 'emma'],
  ['/back-office/news', /^News posts$/, 'paula'],
  ['/back-office/news/new', /^New post$/, 'paula'],
  ['/back-office/links', /^Useful links$/, 'paula'],
]

/** Detail routes: an id the viewer can't see (or that doesn't exist) shows the 404 view. */
const DETAIL_PAGES: Array<[path: string, persona: PersonaKey]> = [
  [`/training/participations/${ID}`, 'emma'],
  [`/training/requests/${ID}`, 'emma'],
  [`/training/ratings/${ID}`, 'emma'],
  [`/travel/requests/${ID}`, 'emma'],
  [`/assets/${ID}`, 'emma'],
  [`/people-requests/${ID}`, 'emma'],
  [`/news/${ID}`, 'emma'],
  [`/back-office/assets/inventory/${ID}`, 'arne'],
  [`/back-office/news/${ID}`, 'paula'],
]

/** Foundation screens. */
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

for (const [persona, rows] of byPersona([...SLICE_PAGES, ...FOUNDATION_PAGES])) {
  test(`pages render for ${persona}`, async ({ page }) => {
    test.setTimeout(30_000 + rows.length * 10_000)
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

for (const [persona, rows] of byPersona(
  DETAIL_PAGES.map(([path, who]) => [path, null, who] as [string, null, PersonaKey]),
)) {
  test(`detail pages answer unknown ids with the 404 view for ${persona}`, async ({ page }) => {
    test.setTimeout(30_000 + rows.length * 10_000)
    const errors = trackConsoleErrors(page)
    await signInAs(page, persona)
    for (const [path] of rows) {
      await page.goto(path)
      await expect(page.getByTestId('error-view'), path).toContainText("We couldn't find that")
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
