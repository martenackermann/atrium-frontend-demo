import { defineMockProviders } from '~/mocks/define'

/**
 * Home contributions (owned by slice A4). Home owns `GET /home/my-day` in its handlers.ts and
 * builds it from `myDayFor(user)` + `inboxFor(user)` in ~/mocks/registry (fragments from all modules).
 */
export default defineMockProviders({})
