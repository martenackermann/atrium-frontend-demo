import { http } from 'msw'
import { isoDay } from '~/mocks/core/org'
import { defineMockHandlers } from '~/mocks/define'
import { ok, requireUser } from '~/mocks/http'
import { inboxFor, myDayFor } from '~/mocks/registry'
import type { MyDay, UpcomingItem } from '../api/types'

/**
 * `GET /home/my-day` for demo mode (API.md §7.4, owned by A4): the head of the inbox from every
 * module's inbox provider plus the my-day fragments (A1/A2 upcoming, A3 assets, A4 news + links).
 */
const UPCOMING_DAYS = 30
const UPCOMING_MAX = 8

export default defineMockHandlers(({ api }) => [
  http.get(api('/home/my-day'), ({ request }) => {
    const user = requireUser(request)
    const inbox = inboxFor(user)
    const fragments = myDayFor(user)
    const today = new Date()
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const until = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + UPCOMING_DAYS + 1,
    ).toISOString()
    const upcoming = ((fragments.upcoming as UpcomingItem[] | undefined) ?? [])
      .filter((item) => item.startsAt < until && (item.endsAt ?? item.startsAt) >= from)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, UPCOMING_MAX)
    const body: MyDay = {
      date: isoDay(today),
      inbox: {
        total: inbox.length,
        high: inbox.filter((item) => item.priority === 'high').length,
        top: inbox.slice(0, 5),
      },
      upcoming,
      assets: (fragments.assets as MyDay['assets'] | undefined) ?? null,
      news: (fragments.news as MyDay['news'] | undefined) ?? [],
      links: (fragments.links as MyDay['links'] | undefined) ?? [],
    }
    return ok(body as never)
  }),
])
