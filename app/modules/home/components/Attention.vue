<script setup lang="ts">
import { ArrowRight, CircleCheck } from '@lucide/vue'
import type { InboxItem } from '~/types/api'

/**
 * "Needs your attention" (DESIGN §8.1): a marker-wash region with the most urgent to-dos (the
 * head of the inbox) acted on in place, and a footer that names the rest and links to the Inbox.
 * With nothing to do the region turns sheet: "Nothing needs you right now."
 */
const props = withDefaults(
  defineProps<{ items: readonly InboxItem[]; total: number; shown?: number }>(),
  { shown: 3 },
)

const visible = computed(() => props.items.slice(0, props.shown))
const rest = computed(() => props.total - visible.value.length)
const restText = computed(() => {
  const names = props.items
    .slice(props.shown)
    .map((item) => item.title.charAt(0).toLowerCase() + item.title.slice(1))
  if (!names.length) return `${rest.value} more in your inbox.`
  const listed =
    names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]
  const more = rest.value - names.length
  return `${rest.value} more: ${listed}${more > 0 ? `, and ${more} other${more === 1 ? '' : 's'}` : ''}.`
})
</script>

<template>
  <section
    v-if="total > 0"
    class="needs region-marker rounded-xl px-[22px] pt-[18px] pb-1 max-md:-mx-1 max-md:px-3.5 max-md:pt-3.5"
    aria-labelledby="needs-heading"
    data-testid="needs-attention"
  >
    <header class="flex items-center gap-2.5 pb-1.5">
      <h2 id="needs-heading" class="text-lg font-[650] tracking-heading">Needs your attention</h2>
      <span
        class="num grid h-[22px] min-w-[22px] place-items-center rounded-pill bg-marker px-[7px] text-[12px] font-bold text-marker-ink"
        >{{ total }}</span
      >
      <span class="ml-auto text-[12.5px] text-ink-muted max-md:hidden">Most urgent first</span>
    </header>
    <div class="first-task">
      <HomeAttentionItem v-for="item in visible" :key="item.id" :item="item" />
    </div>
    <footer
      class="flex flex-wrap items-center gap-4 border-t border-[color-mix(in_srgb,var(--marker-strong)_38%,transparent)] py-3.5 text-[13.5px] leading-5 text-ink-muted md:pl-14"
    >
      <p class="flex-1">
        <template v-if="rest > 0">{{ restText }}</template>
        <template v-else>That's everything for now.</template>
      </p>
      <NuxtLink
        to="/inbox"
        class="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-ink no-underline hover:underline"
        >Open Inbox<ArrowRight class="size-3.5" aria-hidden="true"
      /></NuxtLink>
    </footer>
  </section>
  <section
    v-else
    class="flex items-center gap-3 rounded-xl border border-rule bg-sheet px-5 py-4"
    aria-labelledby="needs-heading"
    data-testid="needs-attention-empty"
  >
    <CircleCheck class="size-5 text-st-positive" aria-hidden="true" />
    <div>
      <h2 id="needs-heading" class="text-md font-[650]">Nothing needs you right now.</h2>
      <p class="text-sm text-ink-muted">
        New approvals, replies and ratings appear here, and in your inbox.
      </p>
    </div>
  </section>
</template>

<style scoped>
.first-task > :first-child {
  border-top: 0;
}
</style>
