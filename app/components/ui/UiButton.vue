<script setup lang="ts">
import { NuxtLink } from '#components'
import { cva, type VariantProps } from 'class-variance-authority'
import type { Component, HTMLAttributes } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { cn } from '~/lib/cn'
import { useControlSize } from '~/lib/field'

/**
 * Button (DESIGN §9). Labels are verb + noun ("Accept laptop"); one primary per region.
 * Renders a NuxtLink with `to`, an <a> with `href`, otherwise a <button>.
 */
const button = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent font-semibold leading-none no-underline transition-[background-color,border-color,color,transform] duration-(--dur-1) ease-standard active:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-ink hover:bg-primary-hover',
        secondary:
          'border-rule-strong bg-sheet text-ink shadow-[0_1px_0_rgb(40_32_20/0.04)] hover:border-field hover:bg-raised',
        ghost: 'text-ink-muted hover:bg-hover hover:text-ink',
        danger: 'border-st-negative-line bg-sheet text-st-negative hover:bg-st-negative-bg',
        'danger-solid': 'bg-st-negative text-sheet hover:opacity-90',
      },
      size: {
        // Phones: every tap target is at least 40px (DESIGN §7).
        sm: 'h-[30px] gap-1.5 rounded-[7px] px-2.5 text-sm max-md:h-10',
        md: 'h-9 px-3.5 text-base max-md:h-10',
        lg: 'h-[42px] px-[18px] text-md max-md:h-11',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'secondary', size: 'md', block: false },
  },
)

type ButtonVariants = VariantProps<typeof button>

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariants['variant']
    size?: ButtonVariants['size']
    block?: boolean
    type?: 'button' | 'submit' | 'reset'
    to?: RouteLocationRaw
    href?: string
    /** Leading icon (replaced by a spinner while loading). */
    icon?: Component
    iconRight?: Component
    /** Keyboard hint, e.g. "A". */
    kbd?: string
    loading?: boolean
    disabled?: boolean
    class?: HTMLAttributes['class']
  }>(),
  { variant: 'secondary', size: 'md', type: 'button', block: false },
)

// Small buttons in a list toolbar (FilterBar) match the 36px filter controls.
const inFilterBar = useControlSize() === 'filter'

const tag = computed(() => {
  if (props.to) return NuxtLink
  if (props.href) return 'a'
  return 'button'
})

const attrs = computed(() => {
  if (props.to) return { to: props.to, 'aria-disabled': props.disabled || undefined }
  if (props.href) return { href: props.href, 'aria-disabled': props.disabled || undefined }
  return { type: props.type, disabled: props.disabled || props.loading }
})
</script>

<template>
  <component
    :is="tag"
    v-bind="attrs"
    :aria-busy="loading || undefined"
    :aria-keyshortcuts="kbd"
    :class="
      cn(button({ variant, size, block }), inFilterBar && size === 'sm' && 'h-9', props.class)
    "
  >
    <UiSpinner v-if="loading" class="size-4" />
    <component :is="icon" v-else-if="icon" class="size-4" aria-hidden="true" />
    <slot />
    <component :is="iconRight" v-if="iconRight" class="size-4" aria-hidden="true" />
    <!-- Key hint for keyboards only: hidden on phones and touch screens; announced via aria-keyshortcuts. -->
    <UiKbd
      v-if="kbd"
      :inverse="variant === 'primary'"
      aria-hidden="true"
      class="ml-0.5 h-[18px] text-[11px] max-md:hidden pointer-coarse:hidden"
      >{{ kbd }}</UiKbd
    >
  </component>
</template>
