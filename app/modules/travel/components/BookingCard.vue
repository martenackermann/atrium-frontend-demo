<script setup lang="ts">
import { Eye, EyeOff, KeyRound, TicketCheck } from '@lucide/vue'
import { describeError } from '~/lib/api'
import type { TravelRequestDetail } from '../api/types'

/**
 * Booking card (SCREENS §5.4, D12): booking number, confirmation PDFs (signed downloads),
 * booked by/at and the **Show PIN** action. The PIN comes from the audited
 * `GET …/booking/pin` (only with `view_pin`) and disappears again after 30 seconds.
 */
const props = defineProps<{
  request: TravelRequestDetail
  /** 2 on the request page, 3 inside a split-view detail (whose title is the h2). */
  headingLevel?: 2 | 3
}>()
const api = useApi()
const toast = useToast()

const pin = ref<string | null>(null)
const loading = ref(false)
const remaining = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

function hide() {
  pin.value = null
  remaining.value = 0
  if (timer) clearInterval(timer)
  timer = null
}

async function reveal() {
  loading.value = true
  try {
    const result = await api.get<{ pin: string }>(
      `/travel/requests/${props.request.id}/booking/pin`,
    )
    pin.value = result.pin
    remaining.value = 30
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      remaining.value -= 1
      if (remaining.value <= 0) hide()
    }, 1000)
  } catch (error) {
    toast.error(describeError(error))
  } finally {
    loading.value = false
  }
}

watch(() => props.request.id, hide)
onBeforeUnmount(hide)

const canViewPin = computed(() => props.request.availableActions.includes('view_pin'))
</script>

<template>
  <section
    v-if="request.booking"
    class="grid gap-4 rounded-xl border border-rule bg-sheet p-5"
    aria-labelledby="booking-title"
  >
    <component
      :is="`h${headingLevel ?? 2}`"
      id="booking-title"
      class="flex items-center gap-2 text-[14.5px] font-[650]"
    >
      <TicketCheck class="size-4 text-st-positive" aria-hidden="true" />Booking
    </component>
    <dl class="grid gap-4 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
      <div>
        <dt class="text-[12.5px] text-ink-subtle">Booking number</dt>
        <dd class="mono mt-0.5 text-md">{{ request.booking.bookingNumber }}</dd>
      </div>
      <div>
        <dt class="text-[12.5px] text-ink-subtle">PIN</dt>
        <dd class="mt-0.5 flex flex-wrap items-center gap-2">
          <template v-if="!request.booking.pinAvailable">
            <span class="text-ink-muted">No PIN for this booking</span>
          </template>
          <template v-else-if="pin">
            <span class="mono text-md tracking-[0.12em]" aria-live="polite">{{ pin }}</span>
            <span class="text-meta text-ink-subtle">hides in {{ remaining }} s</span>
            <UiButton size="sm" variant="ghost" :icon="EyeOff" @click="hide">Hide</UiButton>
          </template>
          <template v-else-if="canViewPin">
            <span class="mono text-ink-subtle" aria-hidden="true">••••</span>
            <UiButton size="sm" :icon="Eye" :loading="loading" @click="reveal">Show PIN</UiButton>
          </template>
          <template v-else>
            <span class="inline-flex items-center gap-1.5 text-sm text-ink-muted">
              <KeyRound class="size-3.5" aria-hidden="true" />Only the traveller, the requester and
              the travel desk can see it
            </span>
          </template>
        </dd>
      </div>
      <div>
        <dt class="text-[12.5px] text-ink-subtle">Booked</dt>
        <dd class="mt-0.5">
          {{ request.booking.bookedBy.displayName }}
          <span class="block text-sm text-ink-muted">{{
            formatDateTime(request.booking.bookedAt)
          }}</span>
        </dd>
      </div>
    </dl>
    <p v-if="request.booking.comment" class="text-sm text-ink-muted">
      <b class="font-semibold text-ink">Note from the travel desk:</b>
      {{ request.booking.comment }}
    </p>
    <div>
      <component :is="`h${(headingLevel ?? 2) + 1}`" class="mb-1.5 text-[13.5px] font-[650]">
        Confirmations
      </component>
      <FileList :files="request.booking.attachments" empty="No confirmation attached." />
    </div>
    <p class="text-meta text-ink-subtle">
      The PIN is never sent by email. Each time it is shown, Atrium records who looked at it.
    </p>
  </section>
</template>
