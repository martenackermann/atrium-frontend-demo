<script setup lang="ts">
import { ArrowRight, ChevronDown } from '@lucide/vue'
import { iconForState } from '~/lib/status'
import { layoutWorkflow } from '~/lib/workflow-layout'
import type { WorkflowDefinition } from '~/types/api'

/**
 * WorkflowDiagram (DESIGN §8.4, SCREENS §1.6): renders `/meta/workflows/{name}` — the main path as
 * badges joined by arrows, branch states below their source, the cancellation path as a note.
 * The current state is drawn in its tone, visited states outlined, everything else neutral.
 * A text equivalent (ordered list of states and transitions) is always present for screen readers.
 *
 *   <WorkflowDiagram name="travel_request" :current="request.status" :visited="visitedStates" />
 */
const props = withDefaults(
  defineProps<{
    /** Workflow name; fetched from /meta/workflows/{name} unless `definition` is given. */
    name?: string
    definition?: WorkflowDefinition | null
    current?: string | null
    /** States the record went through (from its timeline). */
    visited?: readonly string[]
    title?: string
    collapsible?: boolean
    defaultOpen?: boolean
  }>(),
  { title: 'How this request moves', collapsible: true, defaultOpen: false },
)

const query = useWorkflowDefinition(() => (props.definition ? null : props.name))
const definition = computed(() => props.definition ?? query.data.value ?? null)
const layout = computed(() => (definition.value ? layoutWorkflow(definition.value) : null))
const open = ref(props.defaultOpen || !props.collapsible)

function toneOf(stateId: string, tone: string) {
  if (stateId === props.current) return tone
  return 'neutral'
}

const TONES: Record<string, string> = {
  neutral: 'bg-st-neutral-bg text-st-neutral border-st-neutral-line',
  waiting: 'bg-st-waiting-bg text-st-waiting border-st-waiting-line',
  you: 'bg-st-you-bg text-st-you border-st-you-line',
  moving: 'bg-st-moving-bg text-st-moving border-st-moving-line',
  positive: 'bg-st-positive-bg text-st-positive border-st-positive-line',
  negative: 'bg-st-negative-bg text-st-negative border-st-negative-line',
  blocked: 'bg-st-blocked-bg text-st-blocked border-st-blocked-line',
}

const ENUM_FOR: Record<string, string> = {
  training_attendee: 'attendeeStatus',
  travel_request: 'travelStatus',
  asset: 'assetStatus',
  people_request: 'peopleRequestStatus',
  news_post: 'newsStatus',
}
const enumIconOf = (stateId: string) =>
  iconForState(stateId, ENUM_FOR[definition.value?.name ?? ''])

const transitionsText = computed(() =>
  (definition.value?.transitions ?? []).map((transition) => {
    const from =
      definition.value?.states.find((state) => state.id === transition.from)?.label ??
      transition.from
    const to =
      definition.value?.states.find((state) => state.id === transition.to)?.label ?? transition.to
    return `${from} → ${to}: ${transition.label}${transition.actors.length ? ` (${transition.actors.join(', ')})` : ''}`
  }),
)
</script>

<template>
  <section class="border-t border-rule pt-3.5" :aria-label="title">
    <component
      :is="collapsible ? 'button' : 'div'"
      :type="collapsible ? 'button' : undefined"
      class="flex w-full items-center gap-2 text-left text-ink-muted hover:text-ink"
      :aria-expanded="collapsible ? open : undefined"
      @click="collapsible && (open = !open)"
    >
      <h3 class="text-[13.5px] font-[650] text-current">{{ title }}</h3>
      <ChevronDown
        v-if="collapsible"
        class="size-4 transition-transform duration-(--dur-2)"
        :class="open && 'rotate-180'"
        aria-hidden="true"
      />
    </component>

    <div v-if="open" class="mt-4">
      <div v-if="!layout" class="flex gap-2">
        <UiSkeleton v-for="index in 4" :key="index" class="h-[22px] w-24" />
      </div>
      <template v-else>
        <div class="flex flex-wrap items-start gap-y-3 max-md:hidden" aria-hidden="true">
          <!-- Each arrow travels with the state after it, so a wrapped line starts "→ State"
               instead of ending on an arrow that points at nothing. -->
          <div v-for="(state, index) in layout.main" :key="state.id" class="flex items-start">
            <span v-if="index > 0" class="grid h-[22px] w-7 place-items-center text-ink-subtle">
              <ArrowRight class="size-3.5" />
            </span>
            <div class="grid justify-items-start gap-0">
              <span
                class="inline-flex h-[22px] items-center gap-[5px] rounded-sm border pr-2 pl-1.5 text-meta font-medium whitespace-nowrap"
                :class="[
                  TONES[toneOf(state.id, state.tone)],
                  visited?.includes(state.id) &&
                    state.id !== current &&
                    'outline outline-1 outline-offset-1 outline-ink-subtle',
                ]"
              >
                <component :is="enumIconOf(state.id)" class="size-[13px]" :stroke-width="2" />
                {{ state.label }}
              </span>
              <div
                v-for="branch in layout.branches.filter((item) => item.from === state.id)"
                :key="branch.state.id"
                class="relative pt-[22px] pl-3.5 before:absolute before:top-0 before:left-3.5 before:h-[18px] before:border-l-[1.5px] before:border-rule-strong"
              >
                <span
                  class="-ml-0.5 inline-flex h-[22px] items-center gap-[5px] rounded-sm border pr-2 pl-1.5 text-meta font-medium whitespace-nowrap"
                  :class="TONES[toneOf(branch.state.id, branch.state.tone)]"
                >
                  <component
                    :is="enumIconOf(branch.state.id)"
                    class="size-[13px]"
                    :stroke-width="2"
                  />
                  {{ branch.state.label }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <p
          v-if="layout.cancellation.length"
          class="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-muted max-md:hidden"
          aria-hidden="true"
        >
          Cancellation:
          <template v-for="(state, index) in layout.cancellation" :key="state.id">
            <span
              class="inline-flex h-[22px] items-center gap-[5px] rounded-sm border pr-2 pl-1.5 text-meta font-medium"
              :class="TONES[toneOf(state.id, state.tone)]"
            >
              <component :is="enumIconOf(state.id)" class="size-[13px]" :stroke-width="2" />
              {{ state.label }}
            </span>
            <ArrowRight
              v-if="index < layout.cancellation.length - 1"
              class="size-3.5 text-ink-subtle"
            />
          </template>
        </p>

        <!-- Mobile: a vertical state list with the current state highlighted (SCREENS §9). -->
        <ol class="m-0 grid list-none gap-1.5 p-0 md:hidden" aria-hidden="true">
          <li v-for="state in definition?.states" :key="state.id">
            <span
              class="inline-flex h-[22px] items-center gap-[5px] rounded-sm border pr-2 pl-1.5 text-meta font-medium"
              :class="TONES[toneOf(state.id, state.tone)]"
            >
              <component :is="enumIconOf(state.id)" class="size-[13px]" :stroke-width="2" />
              {{ state.label }}
            </span>
            <span v-if="state.id === current" class="ml-2 text-sm text-ink-muted">current</span>
          </li>
        </ol>

        <div class="sr">
          <p>
            States, current state
            {{ definition?.states.find((state) => state.id === current)?.label ?? 'unknown' }}:
          </p>
          <ol>
            <li v-for="state in definition?.states" :key="state.id">
              {{ state.label }}{{ state.terminal ? ' (final)' : '' }}
            </li>
          </ol>
          <p>Transitions:</p>
          <ol>
            <li v-for="(line, index) in transitionsText" :key="index">{{ line }}</li>
          </ol>
        </div>
      </template>
    </div>
  </section>
</template>
