<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import type { UserRef } from '~/types/api'
import type { TrainingRatingBrief } from '../api/types'
import { ROUND_LABEL } from '../constants'

/**
 * Feedback rounds of a participation (SCREENS §4.3 "Ratings"): one card per loop with state,
 * due date and "Rate now" for the viewer's due rounds. Loop-3 answers are never shown to the
 * attendee (the API hides them); the card only says who gives that view.
 */
const props = defineProps<{ ratings: readonly TrainingRatingBrief[]; attendee: UserRef }>()
const auth = useAuthStore()

const loops = computed(() =>
  ([1, 2, 3] as const).map((loop) => ({
    loop,
    rating: props.ratings.find((r) => r.loop === loop) ?? null,
  })),
)
const canRate = (rating: TrainingRatingBrief | null) =>
  Boolean(
    rating &&
    rating.rater.id === auth.me?.id &&
    (rating.state === 'due' || rating.state === 'overdue'),
  )
</script>

<template>
  <ol class="grid gap-3 md:grid-cols-3">
    <li
      v-for="{ loop, rating } in loops"
      :key="loop"
      class="grid content-start gap-2 rounded-md border border-rule bg-sheet p-4"
      :class="!rating && 'opacity-70'"
    >
      <div class="flex items-center justify-between gap-2">
        <span class="text-meta font-semibold tracking-wide text-ink-subtle uppercase"
          >Round {{ loop }}</span
        >
        <StatusBadge
          v-if="rating"
          enum="ratingState"
          :value="rating.state"
          :actor="canRate(rating)"
        />
      </div>
      <p class="font-medium">{{ ROUND_LABEL[loop] }}</p>
      <p class="text-sm text-ink-muted">
        <template v-if="!rating">
          {{
            loop === 1 ? 'Opens once the training is booked.' : 'Opens after the previous round.'
          }}
        </template>
        <template v-else-if="rating.submittedAt">
          Submitted {{ formatDate(rating.submittedAt) }} by {{ rating.rater.displayName }}
        </template>
        <template v-else>
          {{ rating.state === 'upcoming' ? 'Due' : 'Due since' }} {{ formatDate(rating.dueAt) }} ·
          {{ rating.rater.id === attendee.id ? attendee.displayName : rating.rater.displayName }}
        </template>
      </p>
      <UiButton
        v-if="canRate(rating)"
        variant="primary"
        size="sm"
        :to="`/training/ratings/${rating!.id}`"
        :icon-right="ArrowRight"
        class="justify-self-start"
        >Rate now</UiButton
      >
      <NuxtLink
        v-else-if="rating && rating.submittedAt && rating.rater.id === auth.me?.id"
        :to="`/training/ratings/${rating.id}`"
        class="link text-sm font-medium"
        >View your answers</NuxtLink
      >
    </li>
  </ol>
</template>
