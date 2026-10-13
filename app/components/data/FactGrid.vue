<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/cn'
import type { FactItem } from '~/types/ui'

/**
 * Fact grid (DESIGN §8.3): 3 columns (2 below 1280px), ink top rule, label above value, codes and
 * money in mono. Pass `items`, or use the default slot with <div><dt/><dd/></div> children.
 */
const props = withDefaults(
  defineProps<{ items?: readonly FactItem[]; columns?: 2 | 3; class?: HTMLAttributes['class'] }>(),
  {
    columns: 3,
  },
)
</script>

<template>
  <dl
    :class="
      cn(
        'm-0 grid grid-cols-2 border-t border-ink [&>div]:border-b [&>div]:border-rule [&>div]:py-3 [&>div]:pr-4 [&_dd]:m-0 [&_dd]:mt-[3px] [&_dd]:text-base [&_dd]:leading-5 [&_dd]:font-medium [&_dt]:text-[12.5px] [&_dt]:leading-[18px] [&_dt]:text-ink-subtle',
        columns === 3 && 'xl:grid-cols-3',
        props.class,
      )
    "
  >
    <template v-if="items">
      <div v-for="item in items" :key="item.label">
        <dt>{{ item.label }}</dt>
        <dd :class="item.mono && 'mono'">{{ item.value ?? '—' }}</dd>
        <dd
          v-if="item.detail"
          class="!mt-0 !text-[12.5px] !leading-[18px] !font-normal text-ink-muted"
        >
          {{ item.detail }}
        </dd>
      </div>
    </template>
    <slot />
  </dl>
</template>
