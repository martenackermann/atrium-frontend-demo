<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { cn } from '~/lib/cn'

/**
 * Switch (DESIGN §9): 36×20 track; on = ink track + paper thumb. For single yes/no facts
 * ("Recharge to a customer"); lists of options use checkboxes.
 */
const props = defineProps<{
  label?: string
  description?: string
  disabled?: boolean
  id?: string
  class?: HTMLAttributes['class']
}>()
const model = defineModel<boolean>({ default: false })
const generated = useId()
const id = computed(() => props.id ?? `switch-${generated}`)
</script>

<template>
  <div :class="cn('flex items-start gap-3', props.class)">
    <SwitchRoot
      :id="id"
      v-model="model"
      :disabled="disabled"
      class="relative mt-px h-5 w-9 flex-none rounded-pill bg-rule-strong shadow-[inset_0_0_0_1px_var(--field)] transition-colors duration-(--dur-1) ease-standard data-[state=checked]:bg-primary data-[state=checked]:shadow-none data-disabled:opacity-45"
    >
      <SwitchThumb
        class="absolute top-0.5 left-0.5 block size-4 rounded-full bg-sheet shadow-[0_1px_2px_rgb(40_32_20/0.25)] transition-transform duration-(--dur-2) ease-out data-[state=checked]:translate-x-4 data-[state=checked]:bg-primary-ink"
      />
    </SwitchRoot>
    <label v-if="label || $slots.default" :for="id" class="grid cursor-pointer leading-5">
      <span class="font-medium"
        ><slot>{{ label }}</slot></span
      >
      <span v-if="description" class="text-sm leading-[18px] text-ink-muted">{{
        description
      }}</span>
    </label>
  </div>
</template>
