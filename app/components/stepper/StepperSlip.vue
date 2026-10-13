<script setup lang="ts">
import { CircleCheck, Pencil, Stamp } from '@lucide/vue'
import type { FactItem, ReasonChip, RouteStop } from '~/types/ui'

/**
 * The live summary slip (DESIGN §8.2): title + Draft tag, facts, the "Needs approval because…"
 * box (neutral paper; only its stamp icon takes the waiting tone; reasons are plain icon + text
 * lines, R2; clicking one focuses its field), then the vertical "What happens next" route.
 * With no reasons the box turns positive: "No approval needed".
 */
const props = withDefaults(
  defineProps<{
    title: string
    facts?: readonly FactItem[]
    /** null = not known yet (no box). [] = no approval needed. */
    reasons?: readonly ReasonChip[] | null
    reasonsTip?: string
    /** Text when no reasons apply (or an exemption). */
    clearTitle?: string
    clearText?: string
    route?: readonly RouteStop[]
    routeTitle?: string
  }>(),
  {
    reasonsTip: 'Without these, it goes straight to the desk.',
    clearTitle: 'No approval needed',
    routeTitle: 'What happens next',
  },
)
defineEmits<{ 'select-reason': [code: string] }>()

const hasReasons = computed(() => (props.reasons?.length ?? 0) > 0)
</script>

<template>
  <div class="grid gap-4" aria-live="polite">
    <header
      class="flex items-center justify-between gap-2.5 border-b border-rule pb-3 max-[900px]:hidden"
    >
      <h2 class="font-display text-[21px] leading-[26px] font-normal tracking-[-0.01em]">
        {{ title }}
      </h2>
      <UiTag tone="neutral" :icon="Pencil">Draft</UiTag>
    </header>

    <dl v-if="facts?.length || $slots.facts" class="m-0 grid">
      <div
        v-for="fact in facts"
        :key="fact.label"
        class="grid grid-cols-[72px_minmax(0,1fr)] gap-2.5 border-b border-rule py-[9px]"
      >
        <dt class="text-[12.5px] leading-5 text-ink-subtle">{{ fact.label }}</dt>
        <dd class="m-0 text-[13.5px] leading-5 font-medium" :class="fact.mono && 'mono'">
          {{ fact.value ?? '—' }}
          <small
            v-if="fact.detail"
            class="block text-[12.5px] leading-[18px] font-normal text-ink-muted"
            >{{ fact.detail }}</small
          >
        </dd>
      </div>
      <slot name="facts" />
    </dl>

    <div
      v-if="reasons !== null && reasons !== undefined"
      class="rounded-md border p-3.5"
      :class="
        hasReasons ? 'border-rule-strong bg-well' : 'border-st-positive-line bg-st-positive-bg'
      "
    >
      <h3
        class="flex items-center gap-2 text-[13.5px] leading-[18px] font-[650]"
        :class="hasReasons ? 'mb-2.5 text-ink' : 'text-st-positive'"
      >
        <Stamp v-if="hasReasons" class="size-4 text-st-waiting" aria-hidden="true" />
        <CircleCheck v-else class="size-4" aria-hidden="true" />
        {{ hasReasons ? 'Needs approval because…' : clearTitle }}
      </h3>
      <ReasonChips
        v-if="hasReasons"
        :reasons="reasons ?? []"
        variant="lines"
        interactive
        @select="(code) => $emit('select-reason', code)"
      />
      <p
        class="mt-2.5 text-[12.5px] leading-[18px]"
        :class="hasReasons ? 'text-ink-muted' : 'text-st-positive'"
      >
        {{ hasReasons ? reasonsTip : clearText }}
      </p>
    </div>

    <section v-if="route?.length">
      <h3 class="mb-3 text-[13.5px] font-[650]">{{ routeTitle }}</h3>
      <RoutingSlip :stops="route" variant="vertical" />
    </section>
    <slot />
  </div>
</template>
