<script setup lang="ts">
import { isApiError } from '~/lib/api'
import { usePeopleRequest, usePeopleTimeline } from '~/modules/people/api'
import { TYPE_META } from '~/modules/people/constants'

/**
 * `/people-requests/[id]` (SCREENS §7.3, owned by A4): header with reference, type, status,
 * priority and actions (Cancel, Reopen, Edit while open); the request body; side column with
 * "How this request moves" and the timeline.
 */
definePageMeta({ title: 'People request' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const auth = useAuthStore()
const request = usePeopleRequest(id)
const timeline = usePeopleTimeline(id)
const detail = computed(() => request.data.value)

useBreadcrumbTail(() => detail.value?.reference)

watch(
  () => request.error.value,
  (error) => {
    if (isApiError(error) && error.status === 404) {
      showError(createError({ statusCode: 404, statusMessage: 'Not found', fatal: false }))
    }
  },
)

const viewerIsRequester = computed(() => auth.me?.id === detail.value?.requester.id)
const visited = computed(() => [
  ...new Set(
    (timeline.data.value ?? []).flatMap((entry) =>
      [entry.fromState, entry.toState].filter((state): state is string => Boolean(state)),
    ),
  ),
])
</script>

<template>
  <PageBody>
    <div v-if="request.isPending.value" class="grid gap-4" aria-busy="true">
      <UiSkeleton class="h-10 w-2/3" />
      <UiSkeleton class="h-5 w-1/3" />
      <UiSkeleton class="mt-6 h-40" />
    </div>
    <ProblemAlert v-else-if="request.error.value" :error="request.error.value" />
    <template v-else-if="detail">
      <PageHeader :title="detail.title">
        <template #meta>
          <span>{{ TYPE_META[detail.type].label }}</span>
          <span aria-hidden="true">·</span>
          <span class="mono">{{ detail.reference }}</span>
          <span aria-hidden="true">·</span>
          <span
            >{{ TYPE_META[detail.type].effectiveLabel }}
            {{ formatDate(detail.effectiveDate) }}</span
          >
        </template>
        <template #status>
          <StatusBadge
            enum="peopleRequestStatus"
            :value="detail.status"
            :available-actions="detail.availableActions"
            :actor="
              detail.status === 'waiting_on_requester' && viewerIsRequester ? true : undefined
            "
          />
          <PriorityFlag :level="detail.priority" show-label />
        </template>
        <template #actions>
          <PeopleActions :request="detail" sticky-mobile />
        </template>
      </PageHeader>

      <div class="mt-10 grid gap-12 xl:grid-cols-[minmax(0,1fr)_320px]">
        <PeopleRequestView :request="detail" />
        <aside class="grid content-start gap-8" aria-label="History">
          <WorkflowDiagram
            name="people_request"
            :current="detail.status"
            :visited="visited"
            :default-open="true"
          />
          <LifecycleTimeline :entries="timeline.data.value" :loading="timeline.isPending.value" />
        </aside>
      </div>
    </template>
  </PageBody>
</template>
