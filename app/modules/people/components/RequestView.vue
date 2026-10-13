<script setup lang="ts">
import { MessageCircleQuestion } from '@lucide/vue'
import type { PeopleRequestDetail } from '../api/types'
import { peopleRoute, routeSummary } from '../constants'

/**
 * Body of a people request (SCREENS §7.3/§7.4), shared by the detail page and the People Ops
 * split view: the "waiting for your reply" banner, the route, person and organisation, personal
 * data (or the redacted notice), documents, People Ops controls and the conversation.
 */
const props = defineProps<{ request: PeopleRequestDetail; compact?: boolean }>()

const auth = useAuthStore()
const viewerIsRequester = computed(() => auth.me?.id === props.request.requester.id)
const stops = computed(() => peopleRoute(props.request, viewerIsRequester.value))
const showOps = computed(() => props.request.availableActions.includes('edit_internal'))

function focusReply() {
  document.getElementById('people-comment')?.focus()
}
</script>

<template>
  <div class="grid gap-10">
    <div
      v-if="request.status === 'waiting_on_requester' && request.openQuestion"
      class="region-marker grid gap-2 rounded-xl px-5 py-4"
      role="status"
      data-testid="waiting-banner"
    >
      <p class="flex items-center gap-2 text-md font-[650] text-ink">
        <MessageCircleQuestion class="size-4" aria-hidden="true" />
        {{
          viewerIsRequester
            ? 'People Ops is waiting for your reply'
            : 'People Ops is waiting for the requester'
        }}
      </p>
      <p class="font-display text-[17px] leading-[25px] text-ink">
        “{{ request.openQuestion.body }}”
      </p>
      <p class="text-sm text-ink-muted">
        Asked by {{ request.openQuestion.author.displayName }},
        {{ formatDateTime(request.openQuestion.createdAt) }}.
        <template v-if="viewerIsRequester">
          Your reply moves the request back to People Ops.
          <button type="button" class="link font-semibold text-ink" @click="focusReply">
            Reply now
          </button>
        </template>
      </p>
    </div>

    <section aria-label="Route" class="grid gap-2">
      <RoutingSlip
        :stops="stops"
        :variant="compact ? 'compact' : 'full'"
        :summary="routeSummary(request, viewerIsRequester)"
      />
      <p
        v-if="
          request.statusReason && ['rejected', 'cancelled', 'reopened'].includes(request.status)
        "
        class="text-sm text-ink-muted"
      >
        Reason: <span class="text-ink">{{ request.statusReason }}</span>
      </p>
    </section>

    <PeopleOpsPanel v-if="showOps" :request="request" />
    <PeopleFacts :request="request" />
    <PeoplePersonalData :request="request" />

    <section
      v-if="!request.personalDataRedacted"
      aria-labelledby="documents-heading"
      class="grid gap-3"
    >
      <h2 id="documents-heading" class="text-lg font-[650] tracking-heading">Documents</h2>
      <div class="border-t border-ink">
        <FileList :files="request.attachments" />
        <p v-if="!request.attachments.length" class="py-4 text-base text-ink-muted">
          No documents attached.
        </p>
      </div>
    </section>

    <PeopleConversation :request="request" />
  </div>
</template>
