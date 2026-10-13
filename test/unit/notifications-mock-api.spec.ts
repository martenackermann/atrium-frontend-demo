import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createHttpClient } from '~/lib/api/http'
import { resetDemoData } from '~/mocks/db'
import { createMockServer, TEST_API_BASE } from '~/mocks/node'
import type { LoginResponse, NotificationPage } from '~/types/api'

/**
 * SPEC §10.1: every persona has 3-6 in-app notifications, mixed read/unread, consistent with the
 * seeded records. The back-office personas get them as individuals (their own trips, trainings,
 * devices, and comments on the people requests Paula works on), with the backend template texts.
 */
const server = createMockServer(TEST_API_BASE)
let token: string | null = null
const api = createHttpClient({ baseUrl: TEST_API_BASE, getToken: () => token })

async function notificationsOf(personaKey: string) {
  const session = await api.post<LoginResponse>('/auth/demo-login', { personaKey })
  token = session.accessToken
  return api.get<NotificationPage>('/me/notifications', { perPage: 50 })
}
const titles = (page: NotificationPage) => page.data.map((n) => n.title)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
  resetDemoData({ refDate: new Date(2026, 9, 13) })
  token = null
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('back-office persona notifications', () => {
  it.each(['tom', 'tina', 'arne', 'paula', 'ian'])(
    '%s has 3-6 notifications, at least 2 of them unread',
    async (persona) => {
      const page = await notificationsOf(persona)
      expect(page.data.length).toBeGreaterThanOrEqual(3)
      expect(page.data.length).toBeLessThanOrEqual(6)
      expect(page.meta.unread).toBeGreaterThanOrEqual(2)
      expect(page.data.filter((n) => !n.readAt)).toHaveLength(page.meta.unread)
      // Newest first, and the unread ones are recent (within the last week).
      const unread = page.data.filter((n) => !n.readAt)
      for (const n of unread) {
        expect(new Date(n.createdAt).getTime()).toBeGreaterThan(new Date(2026, 9, 6).getTime())
      }
    },
  )

  it('Tom: his own trip approved by Helen and a monitor swap', async () => {
    const page = await notificationsOf('tom')
    expect(titles(page)).toEqual([
      'Approved – to book: car Riverton → Oakridge',
      expect.stringMatching(/^Return confirmed: AST-\d{5}$/),
      'Confirm your new monitor',
      'Booked: Duty of Care for Business Travel',
    ])
    expect(page.data[0]!.body).toBe(
      'Helen Brooks approved the car trip Riverton → Oakridge for Tom Travel-Desk. The travel desk books it next.',
    )
    expect(page.data[1]!.body).toMatch(
      /^IT support has Skylark View 24 \(AST-\d{5}\) back in good condition\./,
    )
  })

  it('Tina: the S-T8 registration she made and her own train trip', async () => {
    const page = await notificationsOf('tina')
    expect(titles(page)).toEqual([
      'Booking not possible: Riverton Central → Northport Central',
      "You're registered for Advanced Troubleshooting Lab",
      'To book: train Riverton Central → Northport Central for Tina Training-Office',
      'Confirm your new laptop',
    ])
    expect(page.data[1]!.body).toBe(
      'TRN-000008 · 31 Oct – 1 Nov · Northgate Learning. Priya Raman decides next.',
    )
  })

  it('Arne: his car trip and the laptop Domenica Glover assigned to him', async () => {
    const page = await notificationsOf('arne')
    expect(titles(page)).toEqual([
      'Booked: car Riverton → Lakeside',
      expect.stringMatching(/^Return confirmed: AST-\d{5}$/),
      'Confirm your new laptop',
      'To book: car Riverton → Lakeside for Arne Assets',
    ])
    expect(page.data[2]!.body).toMatch(
      /^Domenica Glover assigned Quillon Book 14 \(AST-\d{5}, serial \w+\) to you\. Accept or decline it by \d{4}-\d{2}-\d{2}\.$/,
    )
  })

  it('Paula: comments from requesters and managers on the requests she works on', async () => {
    const page = await notificationsOf('paula')
    expect(
      page.data.filter((n) => n.templateId === 'people.comment_added').map((n) => n.body),
    ).toEqual([
      'Victor Lang on Cloud Engineer → Security Analyst: The security clearance for Roscoe came through today.',
      'Sofia Site-Manager on Field Technician – Hillford: Please add him to the Hillford dispatch group as well.',
      'Max Manager on Senior Field Technician – Riverton: His badge does not open the Riverton depot.',
    ])
    expect(titles(page)).toContain(
      'Approved – to book: flight Riverton Airport → Southmere Airport',
    )
  })

  it('Ian: his trip, a phone swap and a withdrawn course', async () => {
    const page = await notificationsOf('ian')
    expect(titles(page)).toEqual([
      expect.stringMatching(/^Return confirmed: AST-\d{5}$/),
      'Confirm your new smartphone',
      'Approved – to book: car Riverton → Highmoor',
      'Withdrawn: Ian IT-Admin – Kubernetes Fundamentals',
      "You're registered for Kubernetes Fundamentals",
    ])
  })
})
