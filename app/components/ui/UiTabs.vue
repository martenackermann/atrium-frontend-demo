<script setup lang="ts" generic="T extends string">
import type { HTMLAttributes } from 'vue'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { cn } from '~/lib/cn'
import type { TabItem } from '~/types/ui'

/**
 * Tabs (DESIGN §9): label + optional count pill; 2px ink underline on the selected tab; the count
 * turns marker on the selected tab when it counts needs-you items (`countTone: 'you'`).
 * Panels are named slots: <template #approvals>…</template>. Without slots, use it as a tab bar.
 */
const props = defineProps<{
  tabs: readonly TabItem<T>[]
  ariaLabel?: string
  class?: HTMLAttributes['class']
  listClass?: string
}>()
const model = defineModel<T>()
const slots = useSlots()
</script>

<template>
  <TabsRoot v-model="model" :class="props.class" activation-mode="manual">
    <TabsList
      :aria-label="ariaLabel"
      :class="cn('flex gap-5 overflow-x-auto border-b border-rule', listClass)"
    >
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.value"
        :value="tab.value"
        :disabled="tab.disabled"
        class="group relative inline-flex h-9 flex-none items-center gap-1.5 font-medium whitespace-nowrap text-ink-muted outline-none hover:text-ink focus-visible:rounded-xs focus-visible:outline-2 focus-visible:outline-focus data-[state=active]:font-[650] data-[state=active]:text-ink data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-t-[2px] data-[state=active]:after:bg-ink"
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
