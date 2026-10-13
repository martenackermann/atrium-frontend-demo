/**
 * Mock workflow engine — declare a state machine once (mirroring the backend's XState machine +
 * permission predicates, SPEC §5) and get:
 *
 *  - `availableActions(entity, user)`: events the machine allows ∧ the user may perform, in
 *    canonical order, plus capability flags (`edit`, `view_pin`, …) — SPEC D7;
 *  - `actionsHandler(api('/travel/requests/:id/actions/:action'), …)`: the transition endpoint with
 *    the API semantics (unknown action / invisible → 404, wrong state → 409 invalid_transition,
 *    not permitted → 403, invalid body → 422, success → 200 + detail DTO) and an audit entry;
 *  - `definition`: the WorkflowDefinition served at /meta/workflows/{name}.
 *
 * Register it in the module's mocks/providers.ts (`workflows: [myWorkflow]`).
 */
import { http, type JsonBodyType, type RequestHandler } from 'msw'
import type { ZodType } from 'zod'
import type { ActingAs, ModuleName, Tone, WorkflowDefinition } from '~/types/api'
import { recordAudit } from './core/audit'
import type { MockUser } from './core/types'
import { db, type MockCollection, type MockRecord } from './db'
import { forbidden, invalidTransition, notFound, ok, param, readJson, requireUser } from './http'

export interface WorkflowEntity extends MockRecord {
  status: string
}

export interface TransitionContext<E extends WorkflowEntity, B = Record<string, unknown>> {
  entity: E
  user: MockUser
  body: B
  actingAs: ActingAs
  from: string
  now: Date
}

export interface MockTransition<E extends WorkflowEntity> {
  event: string
  /** States the event is valid in. */
  from: readonly string[]
  /** Target state; with several possible targets list them all and pass `resolveTo`. */
  to: string | readonly string[]
  resolveTo?: (context: TransitionContext<E>) => string
  /** Button / diagram label: "Approve". */
  label: string
  /** Diagram actor labels: ['Approver', 'Deputy', 'Manager chain']. */
  actors: string[]
  /**
   * Who may perform it (relationship + role, SPEC §3). Return how the user acts
   * ('approver', 'deputy', 'back_office', …), `true` (= 'self') or `false`.
   */
  allowed: (entity: E, user: MockUser) => ActingAs | boolean
  /** Action body (zod). Invalid → 422 with dot-path `errors`. */
  body?: ZodType<Record<string, unknown>>
  /** Extra field updates: timestamps, reasons, decisions… (status is set by the engine). */
  apply?: (context: TransitionContext<E> & { to: string }) => Partial<Omit<E, 'id'>>
  /** Audit sentence; default "<actor> <event>" (+ "as deputy for …"). */
  summary?: (context: TransitionContext<E> & { to: string }) => string
  /** Run after the update (notifications, cascades). */
  after?: (context: TransitionContext<E> & { to: string; updated: E }) => void
}

const textOf = (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value : null)

export interface MockWorkflowConfig<E extends WorkflowEntity> {
  name: string
  label: string
  module: ModuleName
  /** Audit entity type: 'travel_request'. */
  entityType: string
  states: Record<string, { label: string; tone: Tone; terminal?: boolean }>
  initialStates: string[]
  transitions: MockTransition<E>[]
  /** Capability flags appended to availableActions (`edit`, `view_pin`, …). */
  capabilities?: Record<string, (entity: E, user: MockUser) => boolean>
  /** System transitions (no endpoint), shown in the diagram: auto_publish, requester_replied… */
  systemTransitions?: Array<{
    from: string
    to: string
    event: string
    label: string
    actors: string[]
  }>
  /** Label for audit entries: entity → 'Emma Employee'. */
  entityLabel?: (entity: E) => string
}

export interface MockWorkflow<E extends WorkflowEntity> {
  config: MockWorkflowConfig<E>
  definition: WorkflowDefinition
  availableActions: (entity: E, user: MockUser) => string[]
  can: (entity: E, event: string, user: MockUser) => boolean
  /** Programmatic transition (seeds, other handlers). Throws problem Responses like the endpoint. */
  transition: (
    collection: MockCollection<E>,
    entity: E,
    event: string,
    user: MockUser,
    body?: Record<string, unknown>,
  ) => E
  /**
   * MSW handler for `POST <path>` where path contains `:id` and `:action`.
   * `find` returns the entity only if the user may see it (else 404).
   */
  actionsHandler: (
    path: string,
    options: {
      collection: MockCollection<E>
      find?: (id: string, user: MockUser) => E | undefined
      toDto: (entity: E, user: MockUser) => JsonBodyType
    },
  ) => RequestHandler
}

const asActingAs = (value: ActingAs | boolean): ActingAs =>
  value === true ? 'self' : (value as ActingAs)

export function defineMockWorkflow<E extends WorkflowEntity>(
  config: MockWorkflowConfig<E>,
): MockWorkflow<E> {
  const events = [...new Set(config.transitions.map((transition) => transition.event))]

  const definition: WorkflowDefinition = {
    name: config.name as WorkflowDefinition['name'],
    label: config.label,
    initialStates: config.initialStates,
    states: Object.entries(config.states).map(([id, state]) => ({
      id,
      label: state.label,
      tone: state.tone,
      terminal: Boolean(state.terminal),
    })),
    transitions: [
      ...config.transitions.flatMap((transition) =>
        transition.from.flatMap((from) =>
          (Array.isArray(transition.to) ? transition.to : [transition.to]).map((to: string) => ({
            from,
            to,
            event: transition.event,
            label: transition.label,
            actors: transition.actors,
          })),
        ),
      ),
      ...(config.systemTransitions ?? []),
    ],
  }

  /** The first transition for `event` valid in the entity's state and allowed for the user. */
  function resolve(entity: E, event: string, user: MockUser) {
    const candidates = config.transitions.filter((transition) => transition.event === event)
    const inState = candidates.filter((transition) => transition.from.includes(entity.status))
    for (const transition of inState) {
      const allowed = transition.allowed(entity, user)
      if (allowed) return { transition, actingAs: asActingAs(allowed), candidates, inState }
    }
    return { transition: null, actingAs: null, candidates, inState }
  }

  function availableActions(entity: E, user: MockUser): string[] {
    const actions = events.filter((event) => resolve(entity, event, user).transition)
    for (const [capability, check] of Object.entries(config.capabilities ?? {})) {
      if (check(entity, user)) actions.push(capability)
    }
    return actions
  }

  function transition(
    collection: MockCollection<E>,
    entity: E,
    event: string,
    user: MockUser,
    body: Record<string, unknown> = {},
  ): E {
    const resolved = resolve(entity, event, user)
    if (resolved.candidates.length === 0) throw notFound(`Unknown action '${event}'.`)
    if (resolved.inState.length === 0) throw invalidTransition(event, entity.status)
    if (!resolved.transition || !resolved.actingAs) throw forbidden()
    const { transition: step, actingAs } = resolved

    const context: TransitionContext<E> = {
      entity,
      user,
      body,
      actingAs,
      from: entity.status,
      now: new Date(),
    }
    const to =
      step.resolveTo?.(context) ?? (Array.isArray(step.to) ? step.to[0]! : (step.to as string))
    const patch = { ...step.apply?.({ ...context, to }), status: to } as Partial<Omit<E, 'id'>>
    const updated = collection.update(entity.id, patch)!

    const actingNote =
      actingAs === 'deputy'
        ? ' (as deputy)'
        : actingAs === 'manager_chain'
          ? ' (as manager in the chain)'
          : ''
    recordAudit(db, {
      module: config.module,
      entityType: config.entityType,
      entityId: entity.id,
      entityLabel: config.entityLabel?.(updated) ?? config.label,
      action: event,
      actorId: user.id,
      actingAs,
      fromState: context.from,
      toState: to,
      // Like the API: actions without a reason (approve, book, …) show their comment instead.
      reason: textOf(body.reason) ?? textOf(body.comment),
      summary:
        step.summary?.({ ...context, to }) ??
        `${user.displayName} ${event.replace(/_/g, ' ')}${actingNote}`,
    })
    step.after?.({ ...context, to, updated })
    return updated
  }

  function actionsHandler(
    path: string,
    options: {
      collection: MockCollection<E>
      find?: (id: string, user: MockUser) => E | undefined
      toDto: (entity: E, user: MockUser) => JsonBodyType
    },
  ): RequestHandler {
    return http.post(path, async ({ request, params }) => {
      const user = requireUser(request)
      const id = param(params.id)
      const entity = options.find ? options.find(id, user) : options.collection.find(id)
      if (!entity) throw notFound()
      const event = param(params.action)
      const resolved = resolve(entity, event, user)
      if (resolved.candidates.length === 0) throw notFound(`Unknown action '${event}'.`)
      if (resolved.inState.length === 0) throw invalidTransition(event, entity.status)
      if (!resolved.transition) throw forbidden()
      const body = resolved.transition.body
        ? await readJson(request, resolved.transition.body)
        : await readJson<Record<string, unknown>>(request)
      const updated = transition(options.collection, entity, event, user, body ?? {})
      return ok(options.toDto(updated, user))
    })
  }

  return {
    config,
    definition,
    availableActions,
    can: (entity, event, user) => Boolean(resolve(entity, event, user).transition),
    transition,
    actionsHandler,
  }
}
