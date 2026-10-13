import { summaryKey } from '~/lib/query/keys'

/**
 * Home API layer (owned by slice A4). `GET /home/my-day` aggregates every module, so its key lives
 * under ['summary', …] and refreshes after any mutation.
 */
export const homeKeys = {
  myDay: summaryKey('home', 'my-day'),
}
