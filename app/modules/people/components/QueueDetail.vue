<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'
import { usePeopleRequest, usePeopleTimeline } from '../api'

/**
 * Detail pane of the People Ops queue (SCREENS §7.4): "Why you're seeing this", everything incl.
 * personal data, the People Ops controls, the conversation with internal comments, a collapsed
 * diagram and the timeline.
 */
const props = defineProps<{ id: string }>()

const auth = useAuthStore()
const request = usePeopleRequest(() => props.id)
const timeline = usePeopleTimeline(() => props.id)
const detail = computed(() => request.data.value)

const why = computed(() => {
  const d = detail.value
  if (!d) return ''
  if (d.assignee?.id === auth.me?.id) return "You're working on this request."
  if (!d.assignee) return 'Nobody in People Ops has picked this up yet.'
  return auth.is('people_ops')
    ? `${d.assignee.displayName} is working on it. Your desk handles this queue.`
    : 'You supervise the People Ops queue (IT admin). Personal data stays hidden from you.'
})
</script>

<template>
  <div v-if="request.isPending.value" class="grid gap-3" aria-busy="true">
    <UiSkeleton class="h-5 w-1/2" />
    <UiSkeleton class="h-32" />
  </div>
  <ProblemAlert v-else-if="request.error.value" :error="request.error.value" />
  <div v-else-if="detail" class="grid gap-8">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <WhySeeing :text="why" />
      <UiButton
        variant="ghost"
        size="sm"
        :icon-right="ArrowUpRight"
        :to="`/people-requests/${detail.id}`"
        >Open full page</UiButton
      >
    </div>
    <PeopleRequestView :request="detail" compact />
    <WorkflowDiagram name="people_request" :current="detail.status" />
    <LifecycleTimeline :entries="timeline.data.value" :loading="timeline.isPending.value" />
  </div>
</template>
