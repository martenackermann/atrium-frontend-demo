/**
 * Lays out a WorkflowDefinition for WorkflowDiagram (DESIGN §8.4): the main path as a row of states
 * joined by arrows, branch states hanging below their source (Declined under Awaiting approval,
 * Booking impossible under To book), and cancellation states as a note line.
 */
import type { WorkflowDefinition, WorkflowState } from '~/types/api'

export interface DiagramLayout {
  main: WorkflowState[]
  branches: Array<{ from: string; state: WorkflowState; label: string }>
  cancellation: WorkflowState[]
}

const FORWARD_TONES = ['waiting', 'moving', 'positive', 'you']
const isCancellation = (state: WorkflowState) => /cancel/.test(state.id)

export function layoutWorkflow(definition: WorkflowDefinition): DiagramLayout {
  const states = new Map(definition.states.map((state) => [state.id, state]))
  const outgoing = (id: string) =>
    definition.transitions.filter((transition) => transition.from === id)

  // Main path: from the first initial state, keep taking the most "forward" transition.
  const main: WorkflowState[] = []
  const seen = new Set<string>()
  let current = states.get(definition.initialStates[0] ?? definition.states[0]?.id ?? '')
  while (current && !seen.has(current.id)) {
    main.push(current)
    seen.add(current.id)
    const candidates = outgoing(current.id)
      .map((transition) => states.get(transition.to))
      .filter((state): state is WorkflowState => Boolean(state))
      .filter((state) => !seen.has(state.id) && !isCancellation(state))
    const next =
      candidates.find((state) => FORWARD_TONES.includes(state.tone) && !state.terminal) ??
      candidates.find((state) => state.tone === 'positive') ??
      candidates.find((state) => FORWARD_TONES.includes(state.tone))
    current = next
  }

  const onMain = new Set(main.map((state) => state.id))
  const branches: DiagramLayout['branches'] = []
  const placed = new Set<string>()
  for (const state of main) {
    for (const transition of outgoing(state.id)) {
      const target = states.get(transition.to)
      if (!target || onMain.has(target.id) || isCancellation(target) || placed.has(target.id))
        continue
      placed.add(target.id)
      branches.push({ from: state.id, state: target, label: transition.label })
    }
  }

  const cancellation = definition.states.filter((state) => isCancellation(state))
  return { main, branches, cancellation }
}
