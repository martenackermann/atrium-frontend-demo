<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '~/lib/cn'

/**
 * Page content wrapper (DESIGN §4/§7): 44–48px padding on desktop, 40px at 1024–1279px,
 * 16px on mobile (24px top, 96px bottom so the tab bar never covers content); max width 1240px
 * for overview pages (`wide` = full width for tables). Split views don't use it.
 */
const props = defineProps<{ wide?: boolean; class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div
    :class="
      cn(
        'px-4 pt-6 pb-24 md:px-10 md:pt-10 md:pb-16 xl:px-12 xl:pt-11 xl:pb-[72px]',
        !wide && 'max-w-[1240px]',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
