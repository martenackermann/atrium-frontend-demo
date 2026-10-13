<script setup lang="ts">
import { Check, Target } from '@lucide/vue'
import { describeError, isApiError } from '~/lib/api'
import { trainingKeys } from '../api'
import type { TrainingParticipationDetail } from '../api/types'

/**
 * Learning goals (SCREENS §4.3 `#goals`): two short goals the attendee writes before the
 * training starts (`PUT /training/participations/{id}/goals`, while `edit_goals`).
 */
const props = defineProps<{ participation: TrainingParticipationDetail }>()

const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const editable = computed(() => props.participation.availableActions.includes('edit_goals'))
const goal1 = ref(props.participation.goals.goal1 ?? '')
const goal2 = ref(props.participation.goals.goal2 ?? '')
watch(
  () => props.participation.goals,
  (goals) => {
    goal1.value = goals.goal1 ?? ''
    goal2.value = goals.goal2 ?? ''
  },
)
const dirty = computed(
  () =>
    goal1.value.trim() !== (props.participation.goals.goal1 ?? '') ||
    goal2.value.trim() !== (props.participation.goals.goal2 ?? ''),
)
const saving = ref(false)
const savedAt = ref<string | null>(props.participation.goals.updatedAt)
const errors = ref<Record<string, string | undefined>>({})

async function save() {
  saving.value = true
  errors.value = {}
  try {
    const detail = await api.put<TrainingParticipationDetail>(
      `/training/participations/${props.participation.id}/goals`,
      { goal1: goal1.value.trim() || null, goal2: goal2.value.trim() || null },
    )
    savedAt.value = detail.goals.updatedAt
    queryClient.setQueryData(trainingKeys.participations.detail(detail.id), detail)
    await queryClient.invalidateQueries({ queryKey: trainingKeys.participations.lists() })
    toast.success('Goals saved. Your manager sees them next to your feedback.')
  } catch (error) {
    if (isApiError(error) && error.isValidationError) {
      errors.value = { goal1: error.fieldError('goal1'), goal2: error.fieldError('goal2') }
      return
    }
    toast.error(describeError(error))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section id="goals" class="scroll-mt-24" aria-labelledby="goals-title">
    <div class="flex flex-wrap items-baseline gap-x-3">
      <h2 id="goals-title" class="flex items-center gap-2 text-lg font-[650] tracking-heading">
        <Target class="size-4 text-ink-muted" aria-hidden="true" /> Learning goals
      </h2>
      <span v-if="savedAt" class="flex items-center gap-1 text-meta text-ink-subtle">
        <Check class="size-3.5" aria-hidden="true" /> Saved {{ formatAge(savedAt) }}
      </span>
    </div>
    <p class="mt-1 text-sm text-ink-muted">
      What should be different after the training? Two short sentences are enough. Your manager sees
      them next to your feedback later.
    </p>
    <form v-if="editable" class="mt-4 grid gap-4" @submit.prevent="save">
      <UiField label="Goal 1" :error="errors.goal1" optional>
        <UiTextarea v-model="goal1" :rows="2" :maxlength="500" />
      </UiField>
      <UiField label="Goal 2" :error="errors.goal2" optional>
        <UiTextarea v-model="goal2" :rows="2" :maxlength="500" />
      </UiField>
      <div>
        <UiButton type="submit" variant="primary" :loading="saving" :disabled="!dirty">
          Save goals
        </UiButton>
      </div>
    </form>
    <ol
      v-else-if="participation.goals.goal1 || participation.goals.goal2"
      class="mt-3 grid list-decimal gap-1.5 pl-5"
    >
      <li v-if="participation.goals.goal1">{{ participation.goals.goal1 }}</li>
      <li v-if="participation.goals.goal2">{{ participation.goals.goal2 }}</li>
    </ol>
    <p v-else class="mt-3 text-sm text-ink-subtle">No goals were written down.</p>
  </section>
</template>
