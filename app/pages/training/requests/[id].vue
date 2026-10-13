<script setup lang="ts">
import { ExternalLink, FilePlus2, Hotel, Pencil, UserPlus } from '@lucide/vue'
import { describeError, isApiError } from '~/lib/api'
import type { AttachmentDto } from '~/types/api'
import type { FactItem } from '~/types/ui'
import { trainingKeys, useRequestTimeline, useTrainingRequest } from '~/modules/training/api'
import { FORMAT_LABEL } from '~/modules/training/constants'

/**
 * Training request detail (SCREENS §4.4): header with Edit / Add attendee / Add documents;
 * facts; the attendees the viewer may see (status, approver + reason, hotel, row actions,
 * link to the participation); documents; the back-office panel for the training office;
 * the timeline of the request and its attendees.
 */
definePageMeta({ title: 'Training request' })

const route = useRoute()
const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const enums = useEnums()
const id = computed(() => String(route.params.id))
const query = useTrainingRequest(id)
const timeline = useRequestTimeline(id)
const r = computed(() => query.data.value)

watchEffect(() => {
  const error = query.error.value
  if (isApiError(error) && error.status === 404)
    throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
})
useBreadcrumbTail(() => r.value?.reference)

const can = (action: string) => r.value?.availableActions.includes(action as never) ?? false
const editOpen = ref(false)
const addOpen = ref(false)
const docsOpen = ref(false)
const newDocs = ref<AttachmentDto[]>([])
const savingDocs = ref(false)

const facts = computed<FactItem[]>(() => {
  const x = r.value
  if (!x) return []
  return [
    { label: 'Provider', value: x.provider },
    { label: 'Dates', value: formatDateRange(x.startsOn, x.endsOn, { weekday: true }) },
    { label: 'Format', value: FORMAT_LABEL[x.format], detail: x.location },
    {
      label: 'Cost per attendee',
      value: formatMoney(x.cost),
      mono: true,
      detail: x.executiveStepRequired
        ? `Executive step: ${x.executiveApprover?.displayName ?? '—'}`
        : null,
    },
    { label: 'Cost centre', value: x.costCenter.code, detail: x.costCenter.name, mono: true },
    { label: 'Requested by', value: x.requester.displayName, detail: formatDate(x.createdAt) },
    { label: 'Certificate', value: x.certificateExpected ? 'Expected' : 'Not expected' },
    {
      label: 'Reimbursement agreement',
      value: x.reimbursementAgreement ? 'Required' : 'Not required',
    },
  ]
})

async function addDocuments() {
  if (!r.value || !newDocs.value.length) return
  savingDocs.value = true
  try {
    await api.post(`/training/requests/${r.value.id}/attachments`, {
      attachmentIds: newDocs.value.map((file) => file.id),
    })
    await queryClient.invalidateQueries({ queryKey: trainingKeys.requests.all })
    toast.success('Documents added.')
    newDocs.value = []
    docsOpen.value = false
  } catch (error) {
    toast.error(describeError(error))
  } finally {
    savingDocs.value = false
  }
}

async function removeDocument(file: AttachmentDto) {
  if (!r.value) return
  try {
    await api.delete(`/training/requests/${r.value.id}/attachments/${file.id}`)
    await queryClient.invalidateQueries({ queryKey: trainingKeys.requests.all })
    toast.success(`${file.originalName} removed.`)
  } catch (error) {
    toast.error(describeError(error))
  }
}
</script>

<template>
  <PageBody>
    <div v-if="query.isPending.value" class="grid gap-4" aria-busy="true">
      <UiSkeleton class="h-10 w-2/3" />
      <UiSkeleton class="h-48 w-full" />
    </div>
    <ProblemAlert
      v-else-if="query.error.value"
      :error="query.error.value"
      :retry="() => query.refetch()"
    />

    <template v-else-if="r">
      <PageHeader :title="r.topic">
        <template #meta>
          <span class="mono">{{ r.reference }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ formatDateRange(r.startsOn, r.endsOn) }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ r.attendeeCount }} {{ r.attendeeCount === 1 ? 'attendee' : 'attendees' }}</span>
        </template>
        <template #status>
          <TrainingStatusBar :counts="r.statusCounts" :total="r.attendeeCount" />
        </template>
        <template #actions>
          <UiButton v-if="can('add_attachment')" :icon="FilePlus2" @click="docsOpen = true"
            >Add documents</UiButton
          >
          <UiButton v-if="can('add_attendee')" :icon="UserPlus" @click="addOpen = true"
            >Add attendee</UiButton
          >
          <UiButton v-if="can('edit')" variant="primary" :icon="Pencil" @click="editOpen = true"
            >Edit</UiButton
          >
        </template>
      </PageHeader>

      <div class="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div class="grid content-start gap-10">
          <section aria-labelledby="facts-title">
            <h2 id="facts-title" class="sr-only">Facts</h2>
            <FactGrid :items="facts" />
            <p v-if="r.registrationUrl" class="mt-3 text-sm">
              <a
                :href="r.registrationUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="link inline-flex items-center gap-1 font-medium"
              >
                Registration page <ExternalLink class="size-3.5" aria-hidden="true" />
              </a>
            </p>
            <p v-if="r.registrationDetails" class="mt-2 text-sm text-ink-muted">
              {{ r.registrationDetails }}
            </p>
            <blockquote
              v-if="r.requesterComment"
              class="mt-4 font-display text-[17px] leading-[25px]"
            >
              “{{ r.requesterComment }}”
            </blockquote>
          </section>

          <section aria-labelledby="attendees-title">
            <h2 id="attendees-title" class="text-lg font-[650] tracking-heading">Attendees</h2>
            <p v-if="r.attendees.length < r.attendeeCount" class="mt-1 text-sm text-ink-muted">
              You see {{ r.attendees.length }} of {{ r.attendeeCount }} attendees — the others are
              not in your team.
            </p>
            <ul class="mt-3 grid border-t border-ink">
              <li
                v-for="a in r.attendees"
                :key="a.id"
                class="grid gap-3 border-b border-rule py-3.5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)_auto] md:items-center"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <UiAvatar :initials="a.user.initials" :name="a.user.displayName" />
                  <div class="min-w-0">
                    <NuxtLink :to="`/training/participations/${a.id}`" class="link font-medium">{{
                      a.user.displayName
                    }}</NuxtLink>
                    <p class="text-meta text-ink-subtle">
                      {{ a.costCenter.code }}
                      <template v-if="a.hotel">
                        · <Hotel class="inline size-3" aria-hidden="true" /> hotel
                        {{ formatDateRange(a.hotel.checkInOn, a.hotel.checkOutOn) }}
                      </template>
                    </p>
                  </div>
                </div>
                <div class="grid gap-1">
                  <span class="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      enum="attendeeStatus"
                      :value="a.status"
                      :available-actions="a.availableActions"
                    />
                    <PriorityFlag v-if="a.isHighPriority" high :starts-at="r.startsOn" />
                  </span>
                  <span class="text-sm text-ink-muted">
                    {{ a.approver?.displayName ?? '—' }} ·
                    {{ enums.label('approverReason', a.approverReason) }}
                    <template v-if="a.escalatedFrom">
                      (past {{ a.escalatedFrom.displayName }})</template
                    >
                  </span>
                </div>
                <TrainingParticipationActions
                  :participation-id="a.id"
                  :actions="a.availableActions"
                  :subject="`${a.user.displayName} on ${r.topic}`"
                  :max="1"
                />
              </li>
            </ul>
          </section>

          <section aria-labelledby="docs-title">
            <h2 id="docs-title" class="text-lg font-[650] tracking-heading">Documents</h2>
            <FileList
              class="mt-3"
              :files="r.attachments"
              :removable="can('add_attachment')"
              empty="No documents yet."
              @remove="removeDocument"
            />
          </section>

          <TrainingBackOfficePanel v-if="r.backOffice && can('edit_back_office')" :request="r" />
        </div>

        <aside class="grid content-start gap-8">
          <WorkflowDiagram name="training_attendee" />
          <LifecycleTimeline
            :entries="timeline.data.value"
            :loading="timeline.isPending.value"
            :limit="8"
          />
        </aside>
      </div>

      <TrainingRequestEditDialog v-model:open="editOpen" :request="r" />
      <TrainingAddAttendeeDialog v-model:open="addOpen" :request="r" />
      <UiDialog
        v-model:open="docsOpen"
        title="Add documents"
        description="Agenda, offer or joining instructions. PDF, Word or images, up to 10 files."
      >
        <div class="grid gap-4">
          <FileDrop v-model="newDocs" purpose="training_document" :max="10" />
          <div class="flex justify-end gap-2">
            <UiButton variant="ghost" @click="docsOpen = false">Cancel</UiButton>
            <UiButton
              variant="primary"
              :loading="savingDocs"
              :disabled="!newDocs.length"
              @click="addDocuments"
              >Add documents</UiButton
            >
          </div>
        </div>
      </UiDialog>
    </template>
  </PageBody>
</template>
