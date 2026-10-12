/**
 * Tiny status-machine helper so mocks emulate the backend's workflow rules (XState + CASL there):
 * which actions a user may perform on a record (`availableActions`) and what status an action
 * leads to. Responses should include `availableActions` exactly like the real API does.
 *
 * @example
 * const attendeeWorkflow = defineMockWorkflow<AttendeeRecord>()({
 *   approve: {
 *     from: ['pending_manager_approval'],
 *     to: (attendee) => (attendee.needsExecutive ? 'pending_executive_approval' : 'to_book'),
 *     guard: (attendee, user) => attendee.approverId === user.id,
 *   },
 *   decline: { from: ['pending_manager_approval'], to: 'declined', guard: isApprover },
 * })
 *
 * attendeeWorkflow.availableActions(attendee, user) // ['approve', 'decline']
 * const status = attendeeWorkflow.transition(attendee, 'approve', user) // or throws 409/403
 */
import type { MockUser } from './core/types'
import { conflict, forbidden } from './http'

export interface WorkflowTransition<E extends { status: string }, U> {
  /** Statuses the action is valid in ('*' = any). */
  from: ReadonlyArray<E['status']> | '*'
  /** Target status (or computed from the record). */
  to: E['status'] | ((entity: E, user: U) => E['status'])
  /** Who may perform it. Defaults to everyone who can see the record. */
  guard?: (entity: E, user: U) => boolean
}

export interface MockWorkflow<E extends { status: string }, A extends string, U> {
  readonly actions: readonly A[]
  /** Valid for the current status AND allowed for the user. */
  can: (entity: E, action: A, user: U) => boolean
  /** Actions to expose as `availableActions` in API responses. */
  availableActions: (entity: E, user: U) => A[]
  /** Next status, or throws a 409 (wrong status) / 403 (not allowed) problem response. */
  transition: (entity: E, action: A, user: U) => E['status']
}

export function defineMockWorkflow<E extends { status: string }, U = MockUser>() {
  return <A extends string>(
    transitions: Record<A, WorkflowTransition<E, U>>,
  ): MockWorkflow<E, A, U> => {
    const actions = Object.keys(transitions) as A[]
    const validFor = (entity: E, action: A) => {
      const { from } = transitions[action]
      return from === '*' || from.includes(entity.status)
    }
    const allowed = (entity: E, action: A, user: U) =>
      transitions[action].guard?.(entity, user) ?? true

    return {
      actions,
      can: (entity, action, user) => validFor(entity, action) && allowed(entity, action, user),
      availableActions: (entity, user) =>
        actions.filter((action) => validFor(entity, action) && allowed(entity, action, user)),
      transition(entity, action, user) {
        const definition = transitions[action]
        if (!definition) throw conflict(`Unknown action "${action}".`)
        if (!validFor(entity, action)) {
          throw conflict(`"${action}" is not possible while the status is "${entity.status}".`)
        }
        if (!allowed(entity, action, user)) throw forbidden()
        return typeof definition.to === 'function' ? definition.to(entity, user) : definition.to
      },
    }
  }
}
