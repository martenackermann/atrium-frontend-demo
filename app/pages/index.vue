<script setup lang="ts">
import { Laptop } from '@lucide/vue'
import { useMyDay, useMyPeopleRequests } from '~/modules/home/api'
import { greetingFor } from '~/modules/home/constants'

/**
 * `/` — Home "My day" (SCREENS §3, DESIGN §8.1, comps/home.html; owned by A4): serif greeting and
 * a one-sentence day summary, "Needs your attention" with inline actions, my open requests with
 * routing slips, back-office queue tiles, my devices, and the news + useful links column.
 */
definePageMeta({ title: 'Home', hideMobileTitle: true })

const auth = useAuthStore()
const myDay = useMyDay()
const people = useMyPeopleRequests()
const day = computed(() => myDay.data.value)

const now = useNow({ scheduler: (callback) => useIntervalFn(callback, 60_000) })
const firstName = computed(() => auth.me?.firstName ?? auth.me?.displayName.split(' ')[0] ?? '')
const greeting = computed(() => `${greetingFor(now.value)}, ${firstName.value}.`)
const today = computed(() => formatLongDate(day.value?.date ?? now.value))

/** One more sentence about where the user's own requests stand. */
const followUp = computed<{ text: string; ref: string | null } | null>(() => {
  const waiting = (people.data.value ?? []).find((r) => r.status === 'waiting_on_requester')
  if (waiting) return { text: 'People Ops is waiting for your reply on ', ref: waiting.reference }
  const pending = day.value?.upcoming.find((item) => item.status.startsWith('pending'))
  if (pending) {
    const kind = pending.kind === 'training' ? 'training' : pending.kind
    return { text: `Your ${kind} ${pending.title} is waiting for approval.`, ref: null }
  }
  const soon = day.value?.upcoming[0]
  if (soon) {
    return {
      text: `Next up: ${soon.title}, ${formatRelativeDay(soon.startsAt).toLowerCase()}.`,
      ref: null,
    }
  }
  return null
})
const needs = computed(() => day.value?.inbox.total ?? 0)
</script>

<template>
  <PageBody class="home">
    <header class="greeting" data-testid="greeting">
      <h1>{{ greeting }}</h1>
      <p v-if="day">
        {{ today }}.
        <mark v-if="needs > 0" class="hl"
          >{{ needs }} {{ needs === 1 ? 'thing needs' : 'things need' }} you</mark
        ><template v-if="needs > 0"> today.</template>
        <template v-else>Nothing needs you right now.</template>
        <template v-if="followUp"
          >{{ ' ' + followUp.text
          }}<template v-if="followUp.ref"
            ><span class="mono whitespace-nowrap">{{ followUp.ref }}</span
            >.</template
          ></template
        >
      </p>
      <UiSkeleton v-else class="mt-3 h-6 w-2/3" />
    </header>

    <ProblemAlert v-if="myDay.error.value" :error="myDay.error.value" class="mt-8" />

    <div class="home-grid">
      <div class="home-main">
        <div v-if="myDay.isPending.value" class="grid gap-3" aria-busy="true">
          <UiSkeleton class="h-48 rounded-xl" />
        </div>
        <HomeAttention v-else-if="day" :items="day.inbox.top" :total="day.inbox.total" />

        <HomeQueues />

        <HomeRequests
          :upcoming="day?.upcoming ?? []"
          :people="people.data.value ?? []"
          :loading="myDay.isPending.value || people.isPending.value"
        />

        <section
          v-if="day?.assets"
          aria-labelledby="devices-heading"
          class="flex flex-wrap items-center gap-4 rounded-xl border border-rule px-5 py-4"
          data-testid="home-devices"
        >
          <Laptop class="size-5 text-ink-muted" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <h2 id="devices-heading" class="text-md font-[650]">My devices</h2>
            <p class="text-sm text-ink-muted">
              {{ day.assets.active }} in use<template v-if="day.assets.pendingAcceptance">
                · {{ day.assets.pendingAcceptance }} waiting for you to confirm</template
              >
            </p>
          </div>
          <UiButton v-if="day.assets.pendingAcceptance > 0" variant="primary" size="sm" to="/assets"
            >Confirm now</UiButton
          >
          <UiButton v-else size="sm" to="/assets">View devices</UiButton>
        </section>
      </div>

      <HomeNewsColumn
        :news="day?.news ?? []"
        :links="day?.links ?? []"
        :loading="myDay.isPending.value"
      />
    </div>
  </PageBody>
</template>

<style scoped>
.greeting h1 {
  font-family: var(--face-display);
  font-weight: 400;
  font-size: 44px;
  line-height: 50px;
  letter-spacing: -0.015em;
}
.greeting p {
  margin-top: 12px;
  max-width: 62ch;
  font-size: 16px;
  line-height: 26px;
  color: var(--ink-muted);
}
.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 56px;
  margin-top: 36px;
  align-items: start;
}
.home-main {
  display: grid;
  gap: 48px;
  min-width: 0;
}
@media (max-width: 1279px) {
  .home-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 48px;
  }
}
@media (max-width: 767px) {
  .greeting h1 {
    font-size: 32px;
    line-height: 38px;
  }
  .greeting p {
    font-size: 15px;
    line-height: 23px;
  }
  .home-grid {
    margin-top: 24px;
    gap: 40px;
  }
  .home-main {
    gap: 40px;
  }
}
</style>
