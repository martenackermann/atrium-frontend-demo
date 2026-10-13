/**
 * Zero stubs for `GET /<module>/queues/counts` (SPEC_RESOLUTIONS #5) so nav badges work before a
 * slice implements its counts. Shapes follow API.md (TrainingCounts, TravelCounts, assets, people).
 * A module replaces the stub by returning `counts` from its mocks/providers.ts.
 */
import type { MockUser } from './types'

const has = (user: MockUser, ...roles: string[]) =>
  roles.some((role) => user.roles.includes(role as never))

export const COUNT_STUBS: Record<string, (user: MockUser) => Record<string, unknown>> = {
  training: (user) => ({
    mine: { active: 0, ratingsDue: 0, goalsMissing: 0 },
    approvals: { manager: 0, executive: 0, deputy: 0, team: 0 },
    office: has(user, 'training_office', 'it_admin')
      ? {
          toBook: 0,
          cancellationRequested: 0,
          pendingApproval: 0,
          bookingImpossible: 0,
          ratingsOverdue: 0,
          billingOpen: 0,
        }
      : null,
  }),
  travel: (user) => ({
    mine: { active: 0 },
    approvals: { mine: 0, deputy: 0, team: 0 },
    desk: has(user, 'travel_desk', 'it_admin')
      ? {
          pendingApproval: 0,
          toBook: 0,
          toBookHighPriority: 0,
          cancellationRequested: 0,
          bookingImpossible: 0,
        }
      : null,
  }),
  assets: (user) => ({
    mine: { pending: 0 },
    admin: has(user, 'asset_admin', 'it_admin')
      ? { pendingAcceptance: 0, acceptanceOverdue: 0, inRepair: 0, inStock: 0 }
      : null,
  }),
  people: (user) => ({
    mine: { open: 0, waitingOnMe: 0 },
    ops: has(user, 'people_ops', 'it_admin')
      ? { open: 0, reopened: 0, inProgress: 0, waiting: 0, unassigned: 0, critical: 0 }
      : null,
  }),
}
