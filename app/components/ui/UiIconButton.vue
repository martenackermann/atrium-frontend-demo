<script setup lang="ts">
import { NuxtLink } from '#components'
import type { Component, HTMLAttributes } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { cn } from '~/lib/cn'

/**
 * Icon-only button (DESIGN §9): 34px, always an aria-label + a desktop Tooltip, optional marker pip.
 */
const props = withDefaults(
  defineProps<{
    label: string
    icon: Component
    /** Count pip (marker). Hidden when 0/empty. */
    pip?: number | string | null
    size?: 'sm' | 'md'
    to?: RouteLocationRaw
    tooltip?: boolean
    disabled?: boolean
    class?: HTMLAttributes['class']
  }>(),
  { size: 'md', tooltip: true },
)

defineEmits<{ click: [event: MouseEvent] }>()
// The tooltip wraps the button: attributes (data-testid, aria-expanded, …) go to the button.
defineOptions({ inheritAttrs: false })

const tag = computed(() => (props.to ? NuxtLink : 'button'))
const showPip = computed(
  () => props.pip !== null && props.pip !== undefined && props.pip !== 0 && props.pip !== '',
)
</script>

<template>
  <UiTooltip :content="label" :disabled="!tooltip">
    <component
      :is="tag"
      v-bind="$attrs"
      :to="to"
      :type="to ? undefined : 'button'"
      :disabled="disabled"
      :aria-label="showPip ? `${label}, ${pip}` : label"
      :class="
        cn(
          'relative grid flex-none place-items-center rounded-md text-ink-muted transition-colors duration-(--dur-1) ease-standard hover:bg-hover hover:text-ink disabled:pointer-events-none disabled:opacity-45',
          size === 'md' ? 'size-[34px]' : 'size-[30px]',
          props.class,
        )
      "
      @click="$emit('click', $event)"
    >
      <component :is="icon" class="size-4" aria-hidden="true" />
      <span
        v-if="showPip"
        aria-hidden="true"
        class="absolute top-px right-0 h-[17px] min-w-[17px] rounded-pill bg-marker px-1 text-center text-[11px] leading-[17px] font-semibold text-marker-ink shadow-[0_0_0_2px_var(--sheet)]"
        >{{ pip }}</span
      >
    </component>
  </UiTooltip>
</template>
