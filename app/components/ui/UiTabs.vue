<script setup lang="ts" generic="T extends string">
import type { HTMLAttributes } from 'vue'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { cn } from '~/lib/cn'
import type { TabItem } from '~/types/ui'

/**
 * Tabs (DESIGN §9): label + optional count pill; 2px ink underline on the selected tab; the count
 * turns marker on the selected tab when it counts needs-you items (`countTone: 'you'`).
 * Panels are named slots: <template #approvals>…</template>. Without slots, use it as a tab bar.
 * When the tabs don't fit (narrow list panes), the row scrolls sideways with a fade on the cut
 * edge and keeps the selected tab in view.
 */
const props = defineProps<{
  tabs: readonly TabItem<T>[]
  ariaLabel?: string
  class?: HTMLAttributes['class']
  listClass?: string
}>()
const model = defineModel<T>()
const slots = useSlots()

const list = ref<{ $el: HTMLElement } | null>(null)
const fade = ref<{ start: boolean; end: boolean }>({ start: false, end: false })

function measure() {
  const el = list.value?.$el
  if (!el) return
  fade.value = {
    start: el.scrollLeft > 2,
    end: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
  }
}

function revealSelected() {
  const el = list.value?.$el
  const active = el?.querySelector<HTMLElement>('[data-state="active"]')
  if (el && active) {
    // Scroll the row only (scrollIntoView would also scroll the page).
    const left = active.offsetLeft - el.offsetLeft
    if (left < el.scrollLeft) el.scrollLeft = left - 24
    else if (left + active.offsetWidth > el.scrollLeft + el.clientWidth)
      el.scrollLeft = left + active.offsetWidth - el.clientWidth + 24
  }
  measure()
}

useResizeObserver(() => list.value?.$el, measure)
watch(model, () => nextTick(revealSelected))
onMounted(() => nextTick(revealSelected))

const maskStyle = computed(() => {
  const { start, end } = fade.value
  if (!start && !end) return undefined
  const image = `linear-gradient(to right, ${start ? 'transparent, black 24px' : 'black'}, ${
    end ? 'black calc(100% - 24px), transparent' : 'black'
  })`
  return { maskImage: image, WebkitMaskImage: image }
})
</script>

<template>
  <TabsRoot v-model="model" :class="props.class" activation-mode="manual">
    <TabsList
      ref="list"
      :aria-label="ariaLabel"
      :style="maskStyle"
      :class="
        cn(
          'flex gap-5 overflow-x-auto border-b border-rule [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          listClass,
        )
      "
      @scroll.passive="measure"
    >
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.value"
        :value="tab.value"
        :disabled="tab.disabled"
        class="group relative inline-flex h-9 flex-none items-center gap-1.5 font-medium whitespace-nowrap text-ink-muted outline-none hover:text-ink focus-visible:rounded-xs focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus data-[state=active]:font-[650] data-[state=active]:text-ink data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-t-[2px] data-[state=active]:after:bg-ink max-md:h-10"
      >
        {{ tab.label }}
        <span
          v-if="tab.count !== undefined && tab.count !== null"
          class="num inline-grid h-[18px] min-w-5 place-items-center rounded-pill bg-st-neutral-bg px-1.5 text-[11.5px] font-semibold text-ink-muted"
          :class="
            tab.countTone === 'you' &&
            'group-data-[state=active]:bg-marker group-data-[state=active]:text-marker-ink'
          "
          >{{ tab.count }}</span
        >
      </TabsTrigger>
    </TabsList>
    <template v-for="tab in tabs" :key="tab.value">
      <TabsContent v-if="slots[tab.value]" :value="tab.value" class="outline-none">
        <slot :name="tab.value" />
      </TabsContent>
    </template>
  </TabsRoot>
</template>
