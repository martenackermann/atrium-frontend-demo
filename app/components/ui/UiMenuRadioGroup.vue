<script setup lang="ts">
import { DropdownMenuRadioGroup } from 'reka-ui'

/** Radio list inside a DropdownMenu (PersonaSwitcher, theme choice). */
const model = defineModel<string>()
</script>

<template>
  <DropdownMenuRadioGroup v-model="model">
    <slot />
  </DropdownMenuRadioGroup>
</template>
