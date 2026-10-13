import type { EnumOption, InboxItem, SearchHit } from '~/types/api'
import type { MockUser } from '~/mocks/core/types'
import { db } from '~/mocks/db'
import { defineMockProviders } from '~/mocks/define'
import {
  APPROVAL_REASON_LABELS,
  APPROVAL_REASON_ORDER,
  EXEMPTION_LABEL,
  isHighPriority,
  travelReference,
} from '../lib/rules'
import {
  ACTIVE_STATUSES,
  canView,
  dayOf,
  decideRight,
  HIGH_PRIORITY_DAYS,
  inScope,
  isDesk,
  principalsOf,
  seesAll,
  today,
} from './logic'
import { travelWorkflow } from './workflow'

/**
 * Travel contributions to foundation endpoints in demo mode: /meta/enums, /meta/workflows,
 * /me/inbox (API.md §8), /search, /home/my-day (`upcoming`), /travel/queues/counts and the
 * high-priority digest job — the same rules as the backend providers.
 */
const o = (value: string, label: string, tone: EnumOption['tone'] = null): EnumOption => ({
  value,
  label,
  tone,
  description: null,
})

const DAY_MS = 86_400_000
const startOfDay = (iso: string) => {
  const date = new Date(iso)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString()
}
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso),
  )

function inbox(user: MockUser): InboxItem[] {
  const now = new Date()
  const items: InboxItem[] = []
  const principals = principalsOf(user)
  for (const row of db.travelRequests.where(
    (r) =>
      r.status === 'pending_approval' &&
      r.travellerId !== user.id &&
      Boolean(r.approverId && (r.approverId === user.id || principals.includes(r.approverId))),
  )) {
    const asDeputy = row.approverId !== user.id
    const traveller = db.users.find(row.travellerId)
    const approver = row.approverId ? db.users.find(row.approverId) : undefined
    const decides = decideRight(row, user) !== false
    const n = row.approvalReasons.length
    items.push({
      id: `travel.approval_required:${row.id}`,
      module: 'travel',
      type: 'travel.approval_required',
      reference: travelReference(row.number),
      title: `Approve ${row.kind}: ${traveller?.displayName ?? ''}`,
      subtitle: [
        row.route,
        shortDate(row.startsAt),
        `${n} reason${n === 1 ? '' : 's'}`,
        ...(asDeputy && approver ? [`for ${approver.displayName}`] : []),
      ].join(' · '),
      dueAt: startOfDay(row.startsAt),
      priority: isHighPriority(row.status, row.startsAt, now, HIGH_PRIORITY_DAYS)
        ? 'high'
        : 'normal',
      actingAs: asDeputy ? 'deputy' : 'approver',
      link: `/travel/approvals?tab=${asDeputy ? 'deputy' : 'approvals'}&selected=${row.id}`,
      actionsPath: `/travel/requests/${row.id}`,
      entityId: row.id,
      createdAt: row.createdAt,
      quickActions: decides
        ? [...(dayOf(row.startsAt) >= today() ? ['approve'] : []), 'decline']
        : [],
    })
  }
  // Desk queues: travel_desk only (it_admin gets no back-office items, API.md §8).
  if (isDesk(user)) {
    for (const row of db.travelRequests.where(
      (r) => r.status === 'to_book' || r.status === 'cancellation_requested',
    )) {
      const traveller = db.users.find(row.travellerId)?.displayName ?? ''
      const base = {
        module: 'travel' as const,
        reference: travelReference(row.number),
        dueAt: startOfDay(row.startsAt),
        actingAs: 'back_office' as const,
        actionsPath: `/travel/requests/${row.id}`,
        entityId: row.id,
        createdAt: row.createdAt,
        quickActions: [] as string[],
      }
      if (row.status === 'to_book') {
        items.push({
          ...base,
          id: `travel.booking_required:${row.id}`,
          type: 'travel.booking_required',
          title: `Book ${row.kind}: ${row.route}`,
          subtitle: `${traveller} · ${shortDate(row.startsAt)}`,
          priority: isHighPriority(row.status, row.startsAt, now, HIGH_PRIORITY_DAYS)
            ? 'high'
            : 'normal',
          link: `/back-office/travel?queue=to_book&selected=${row.id}`,
        })
      } else {
        items.push({
          ...base,
          id: `travel.cancellation_review:${row.id}`,
          type: 'travel.cancellation_review',
          title: `Cancellation: ${row.route}`,
          subtitle: [traveller, row.cancellationReason].filter(Boolean).join(' · '),
          priority:
            new Date(row.startsAt).getTime() <= now.getTime() + 3 * DAY_MS ? 'high' : 'normal',
          link: `/back-office/travel?queue=cancellations&selected=${row.id}`,
        })
      }
    }
  }
  return items
}

export default defineMockProviders({
  workflows: [travelWorkflow],
  enums: {
    travelKind: [o('car', 'Car'), o('train', 'Train'), o('flight', 'Flight')],
    travelStatus: [
      o('pending_approval', 'Awaiting approval', 'waiting'),
      o('to_book', 'To book', 'moving'),
      o('booked', 'Booked', 'positive'),
      o('declined', 'Declined', 'negative'),
      o('booking_impossible', 'Booking impossible', 'blocked'),
      o('cancellation_requested', 'Cancellation requested', 'waiting'),
      o('cancelled', 'Cancelled', 'neutral'),
    ],
    approvalReason: APPROVAL_REASON_ORDER.map((code) => o(code, APPROVAL_REASON_LABELS[code])),
    approvalExemption: [o('executive_traveller', EXEMPTION_LABEL)],
    vehicleType: [o('car', 'Car'), o('van', 'Van')],
    handoverMode: [o('branch', 'Branch'), o('delivery', 'Delivery')],
    dropOffMode: [o('branch', 'Branch'), o('collection', 'Collection')],
    tripType: [o('one_way', 'One way'), o('return', 'Return')],
    fareType: [o('saver', 'Saver fare'), o('flex', 'Flex fare')],
  },
  inbox: (user) => inbox(user),
  search: (user, q): SearchHit[] => {
    const term = q.trim().toLowerCase()
    const reference = /^trv-(\d{1,9})$/i.exec(term)?.[1]
    return db.travelRequests
      .where((row) => {
        if (!canView(row, user)) return false
        if (reference) return row.number === Number(reference)
        const traveller = db.users.find(row.travellerId)?.displayName ?? ''
        return `${row.route} ${traveller}`.toLowerCase().includes(term)
      })
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      .slice(0, 5)
      .map((row) => ({
        module: 'travel',
        type: 'travel_request',
        id: row.id,
        reference: travelReference(row.number),
        title: `${row.kind === 'car' ? 'Car' : row.kind === 'train' ? 'Train' : 'Flight'} ${row.route}`,
        subtitle: `${db.users.find(row.travellerId)?.displayName ?? ''} · ${shortDate(row.startsAt)}`,
        link: `/travel/requests/${row.id}`,
      }))
  },
  myDay: (user) => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start.getTime() + 31 * DAY_MS)
    return {
      upcoming: db.travelRequests
        .where(
          (row) =>
            ['pending_approval', 'to_book', 'booked'].includes(row.status) &&
            (row.travellerId === user.id || Boolean(row.train?.companionIds.includes(user.id))) &&
            new Date(row.startsAt) >= start &&
            new Date(row.startsAt) < end,
        )
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .slice(0, 8)
        .map((row) => ({
          module: 'travel',
          entityId: row.id,
          kind: row.kind,
          title: row.route,
          subtitle:
            row.status === 'booked'
              ? `Booked · ${row.booking?.bookingNumber ?? ''}`.trim()
              : row.status === 'to_book'
                ? 'Waiting for the travel desk'
                : 'Awaiting approval',
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          status: row.status,
          link: `/travel/requests/${row.id}`,
        })),
    }
  },
  counts: (user) => {
    const now = new Date()
    const rows = db.travelRequests.all()
    const pendingInTeam = rows.filter(
      (row) => row.status === 'pending_approval' && inScope(row, user, 'team'),
    )
    return {
      mine: {
        active: rows.filter(
          (row) =>
            (ACTIVE_STATUSES as readonly string[]).includes(row.status) &&
            inScope(row, user, 'mine'),
        ).length,
      },
      approvals: {
        mine: rows.filter((row) => inScope(row, user, 'approvals')).length,
        deputy: rows.filter((row) => inScope(row, user, 'deputy')).length,
        team: pendingInTeam.filter((row) => decideRight(row, user) === 'manager_chain').length,
      },
      desk: seesAll(user)
        ? {
            pendingApproval: rows.filter((r) => r.status === 'pending_approval').length,
            toBook: rows.filter((r) => r.status === 'to_book').length,
            toBookHighPriority: rows.filter(
              (r) =>
                r.status === 'to_book' &&
                isHighPriority(r.status, r.startsAt, now, HIGH_PRIORITY_DAYS),
            ).length,
            cancellationRequested: rows.filter((r) => r.status === 'cancellation_requested').length,
            bookingImpossible: rows.filter((r) => r.status === 'booking_impossible').length,
          }
        : null,
    }
  },
  jobs: [
    {
      name: 'travel.high-priority-digest',
      description:
        'Emails the travel desk a list of trips that start within the high-priority window and are not booked yet.',
      slice: 'A2',
      cron: '30 7 * * 1-5',
      run: () => {
        const now = new Date()
        const rows = db.travelRequests.where((row) =>
          isHighPriority(row.status, row.startsAt, now, HIGH_PRIORITY_DAYS),
        )
        // The desk mailbox gets the email; in the offline demo emails are skipped.
        return {
          highPriority: rows.length,
          pendingApproval: rows.filter((r) => r.status === 'pending_approval').length,
          toBook: rows.filter((r) => r.status === 'to_book').length,
          sent: rows.length ? 1 : 0,
        }
      },
    },
  ],
})
