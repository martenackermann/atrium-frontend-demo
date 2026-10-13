<script setup lang="ts">
import { usePeopleRequest } from '../api'

/** Actions of the selected request in the People Ops queue header (uses the cached detail). */
const props = defineProps<{ id: string }>()
const request = usePeopleRequest(() => props.id)
</script>

<template>
  <PeopleActions v-if="request.data.value" :request="request.data.value" :max="2" />
</template>
