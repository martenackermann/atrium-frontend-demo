<script setup lang="ts">
import { Check } from '@lucide/vue'
import type { RouteStop } from '~/types/ui'

/**
 * RoutingSlip (DESIGN §1, §9 "route track") — the signature: monogram stamps on a ruled line.
 * Inked stamps have signed off; the coloured stamp is where the request sits now (waiting tone
 * for others, marker when the viewer acts, moving when a desk works on it); dashed = ahead.
 * Solid ink connector = done, dashed = not yet.
 *
 * Variants: `compact` (26px stamps, summary line below), `full` (32px + 3 label lines),
 * `vertical` (28px; summary slip and mobile detail).
 */
const props = withDefaults(
  defineProps<{
    stops: readonly RouteStop[]
    variant?: 'compact' | 'full' | 'vertical'
    /** Compact summary line, e.g. "With Max Manager since 08:41" (bold names via the slot). */
    summary?: string
  }>(),
  { variant: 'compact' },
)

const ariaLabel = computed(() => {
  const parts = props.stops.map((stop) => {
    const who = stop.who ? `${stop.step}, ${stop.who}` : stop.step
    const state = {
      done: 'done',
      current: 'current step',
      stopped: 'stopped here',
      skipped: 'skipped',
      future: 'still ahead',
    }[stop.state]
    return `${who} (${state})`
  })
  return `Route: ${parts.join('; ')}.`
})

const stampClass = (stop: RouteStop) => [
  `stop-${stop.state}`,
  stop.state === 'current' ? `tone-${stop.tone ?? 'waiting'}` : '',
]
</script>

<template>
  <div class="routing-slip" :class="`variant-${variant}`">
    <ol :aria-label="ariaLabel" :style="{ '--stops': stops.length }">
      <li
        v-for="(stop, index) in stops"
        :key="index"
        :class="stampClass(stop)"
        :title="
          variant === 'compact' ? `${stop.step}${stop.who ? ` · ${stop.who}` : ''}` : undefined
        "
      >
        <span class="stamp" aria-hidden="true">
          <Check
            v-if="stop.state === 'done' && !stop.initials && !stop.icon"
            :stroke-width="2.25"
          />
          <component :is="stop.icon" v-else-if="stop.icon" :stroke-width="2.25" />
          <template v-else>{{ stop.initials }}</template>
        </span>
        <template v-if="variant !== 'compact'">
          <div class="labels">
            <span class="step">{{ stop.step }}</span>
            <span v-if="stop.who" class="who">{{ stop.who }}</span>
            <span v-if="stop.when" class="when">{{ stop.when }}</span>
          </div>
        </template>
      </li>
    </ol>
    <p v-if="variant === 'compact' && (summary || $slots.summary)" class="route-where">
      <slot name="summary">{{ summary }}</slot>
    </p>
  </div>
</template>

<style scoped>
ol {
  list-style: none;
  margin: 0;
  padding: 0;
}

.stamp {
  display: grid;
  place-items: center;
  flex: none;
  border-radius: 50%;
  font: 600 11px/1 var(--face-sans);
  letter-spacing: -0.02em;
  color: var(--ink-subtle);
  border: 1.5px dashed var(--rule-strong);
  background: var(--sheet);
}
.stamp :deep(svg) {
  width: 12px;
  height: 12px;
}
.stop-done .stamp {
  background: var(--ink);
  color: var(--sheet);
  border: 1.5px solid var(--ink);
  box-shadow:
    inset 0 0 0 1.5px var(--ink),
    inset 0 0 0 2.5px color-mix(in srgb, var(--sheet) 45%, transparent);
}
.stop-current .stamp {
  border: 1.5px solid var(--st-waiting-fg);
  color: var(--st-waiting-fg);
  background: var(--st-waiting-bg);
}
.stop-current.tone-moving .stamp {
  border-color: var(--st-moving-fg);
  color: var(--st-moving-fg);
  background: var(--st-moving-bg);
}
.stop-current.tone-you .stamp {
  border-color: var(--marker-strong);
  color: var(--marker-ink);
  background: var(--marker);
}
.stop-stopped .stamp {
  border: 1.5px solid var(--st-negative-fg);
  color: var(--st-negative-fg);
  background: var(--st-negative-bg);
}
.stop-skipped .stamp {
  opacity: 0.6;
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
}

/* compact: inline stamps joined by short connectors */
.variant-compact ol {
  display: flex;
  align-items: center;
}
.variant-compact li {
  display: flex;
  align-items: center;
}
.variant-compact .stamp {
  width: 26px;
  height: 26px;
}
.variant-compact li + li::before {
  content: '';
  width: 12px;
  margin: 0 3px;
  border-top: 1.5px dashed var(--rule-strong);
}
.variant-compact li.stop-done + li::before {
  border-top-style: solid;
  border-top-color: var(--ink);
}
.route-where {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--ink-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.route-where :deep(b) {
  color: var(--ink);
  font-weight: 500;
}

/* full: grid of stops with label lines */
.variant-full ol {
  display: grid;
  grid-template-columns: repeat(var(--stops, 4), minmax(0, 1fr));
}
.variant-full li {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding-right: 12px;
}
.variant-full li::after {
  content: '';
  position: absolute;
  top: 16px;
  left: 40px;
  right: 8px;
  border-top: 1.5px dashed var(--rule-strong);
}
.variant-full li:last-child::after {
  display: none;
}
.variant-full li.stop-done::after {
  border-top: 1.5px solid var(--ink);
  animation: atrium-ink-in var(--dur-4) var(--curve-out) both;
}
.variant-full .stamp {
  width: 32px;
  height: 32px;
  margin-bottom: 10px;
}
.variant-full .stamp :deep(svg) {
  width: 15px;
  height: 15px;
}
.labels {
  display: grid;
  gap: 1px;
}
.step {
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}
.who {
  font-size: 13px;
  line-height: 18px;
  color: var(--ink-muted);
}
.when {
  font-size: 12px;
  line-height: 16px;
  color: var(--ink-subtle);
}
.stop-skipped .step,
.stop-skipped .who {
  color: var(--ink-subtle);
}

/* vertical: summary slip, mobile detail */
.variant-vertical li {
  position: relative;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 12px;
  padding-bottom: 14px;
}
.variant-vertical li:last-child {
  padding-bottom: 0;
}
.variant-vertical li::before {
  content: '';
  position: absolute;
  left: 13px;
  top: 28px;
  bottom: 0;
  border-left: 1.5px dashed var(--rule-strong);
}
.variant-vertical li:last-child::before {
  display: none;
}
.variant-vertical li.stop-done::before {
  border-left: 1.5px solid var(--ink);
}
.variant-vertical .stamp {
  width: 28px;
  height: 28px;
}
.variant-vertical .labels {
  padding-top: 4px;
}
.variant-vertical .step {
  font-size: 13px;
}
.variant-vertical .who,
.variant-vertical .when {
  font-size: 12.5px;
}

@media (max-width: 767px) {
  .variant-full ol {
    grid-template-columns: minmax(0, 1fr);
  }
  .variant-full li {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    column-gap: 12px;
    padding: 0 0 14px;
  }
  .variant-full .stamp {
    grid-row: span 3;
    margin: 0;
  }
  .variant-full li::after {
    top: 34px;
    left: 15px;
    right: auto;
    bottom: 0;
    border-top: 0;
    border-left: 1.5px dashed var(--rule-strong);
  }
  .variant-full li.stop-done::after {
    border-top: 0;
    border-left: 1.5px solid var(--ink);
    animation: none;
  }
}
</style>
