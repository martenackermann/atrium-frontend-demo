<script setup lang="ts">
import { BellRing } from '@lucide/vue'
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import { trainingKeys, useRating } from '~/modules/training/api'
import type { Likert, RatingSubmission } from '~/modules/training/api/types'
import {
  GRADE_WORDS,
  IMPROVEMENT_OPTIONS,
  LIKERT_OPTIONS,
  ROUND_LABEL,
} from '~/modules/training/constants'

/**
 * Feedback form (SCREENS §4.6): loop 1 "Did you take part?" + three school grades; loop 2 three
 * statements A–D; loop 3 the manager's view (improvement, certification). Submitted rounds are
 * read-only. Submit → toast "Thanks for your feedback" → list.
 */
definePageMeta({ title: 'Rating' })

const route = useRoute()
const api = useApi()
const toast = useToast()
const queryClient = useQueryClient()
const id = computed(() => String(route.params.id))
const query = useRating(id)
const r = computed(() => query.data.value)
watchEffect(() => {
  const error = query.error.value
  if (isApiError(error) && error.status === 404)
    throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
})
useBreadcrumbTail(() => (r.value ? `Round ${r.value.loop}` : undefined))

const readOnly = computed(() => !r.value?.availableActions.includes('submit'))
const STATEMENTS = [
  { key: 'appliesLearned', label: 'I apply what I learned in my daily work.' },
  { key: 'supervisorSupported', label: 'My manager supported me in putting it into practice.' },
  { key: 'worthwhileForOrganization', label: 'The training was worthwhile for the organisation.' },
] as const

const schema = toTypedSchema(
  z
    .object({
      participated: z.boolean(),
      overallGrade: z.number().int().min(1).max(6).nullable(),
      trainerGrade: z.number().int().min(1).max(6).nullable(),
      expectationsGrade: z.number().int().min(1).max(6).nullable(),
      appliesLearned: z.enum(['A', 'B', 'C', 'D']).nullable(),
      supervisorSupported: z.enum(['A', 'B', 'C', 'D']).nullable(),
      worthwhileForOrganization: z.enum(['A', 'B', 'C', 'D']).nullable(),
      improvementObserved: z.string().nullable(),
      certificationGained: z.boolean(),
      certificationComment: z.string().max(1000).nullable(),
      comment: z.string().max(2000, 'Keep the comment under 2,000 characters.').nullable(),
    })
    .superRefine((values, ctx) => {
      const loop = r.value?.loop
      const need = (field: string, message: string, ok: boolean) => {
        if (!ok) ctx.addIssue({ code: 'custom', path: [field], message })
      }
      if (loop === 1 && values.participated) {
        need('overallGrade', 'Pick a grade for the training overall.', values.overallGrade !== null)
        need('trainerGrade', 'Pick a grade for the trainer.', values.trainerGrade !== null)
        need(
          'expectationsGrade',
          'Pick how well it met your expectations.',
          values.expectationsGrade !== null,
        )
      }
      if (loop === 2)
        for (const s of STATEMENTS)
          need(s.key, 'Pick one of the four answers.', values[s.key] !== null)
      if (loop === 3)
        need(
          'improvementObserved',
          'Pick how visible the improvement is.',
          values.improvementObserved !== null,
        )
    }),
)
const { defineField, errors, handleSubmit, isSubmitting, setErrors, resetForm } = useForm({
  validationSchema: schema,
  initialValues: {
    participated: true,
    overallGrade: null,
    trainerGrade: null,
    expectationsGrade: null,
    appliesLearned: null,
    supervisorSupported: null,
    worthwhileForOrganization: null,
    improvementObserved: null,
    certificationGained: false,
    certificationComment: null,
    comment: null,
  },
})
const [participated] = defineField('participated')
const [overallGrade] = defineField('overallGrade')
const [trainerGrade] = defineField('trainerGrade')
const [expectationsGrade] = defineField('expectationsGrade')
const [appliesLearned] = defineField('appliesLearned')
const [supervisorSupported] = defineField('supervisorSupported')
const [worthwhileForOrganization] = defineField('worthwhileForOrganization')
const [improvementObserved] = defineField('improvementObserved')
const [certificationGained] = defineField('certificationGained')
const [certificationComment] = defineField('certificationComment')
const [comment] = defineField('comment')
/** Segmented controls take `undefined` for "nothing chosen"; the form keeps `null`. */
const optional = <T,>(model: Ref<T | null | undefined>) =>
  computed<T | undefined>({
    get: () => model.value ?? undefined,
    set: (value) => (model.value = value ?? null),
  })
const overall = optional(overallGrade)
const trainer = optional(trainerGrade)
const expectations = optional(expectationsGrade)
const improvement = optional(improvementObserved)
const likertModels = {
  appliesLearned: optional(appliesLearned),
  supervisorSupported: optional(supervisorSupported),
  worthwhileForOrganization: optional(worthwhileForOrganization),
}

// Read-only view shows the submitted answers.
watch(
  () => r.value?.answers,
  (answers) => {
    if (!answers) return
    resetForm({
      values: {
        participated: answers.loop === 1 ? answers.participated : true,
        overallGrade: answers.loop === 1 ? answers.overallGrade : null,
        trainerGrade: answers.loop === 1 ? answers.trainerGrade : null,
        expectationsGrade: answers.loop === 1 ? answers.expectationsGrade : null,
        appliesLearned: answers.loop === 2 ? answers.appliesLearned : null,
        supervisorSupported: answers.loop === 2 ? answers.supervisorSupported : null,
        worthwhileForOrganization: answers.loop === 2 ? answers.worthwhileForOrganization : null,
        improvementObserved: answers.loop === 3 ? String(answers.improvementObserved) : null,
        certificationGained: answers.loop === 3 ? answers.certificationGained : false,
        certificationComment: answers.loop === 3 ? answers.certificationComment : null,
        comment: answers.comment,
      },
    })
  },
  { immediate: true },
)

const formError = ref<string | null>(null)
const submit = handleSubmit(async (values) => {
  if (!r.value) return
  formError.value = null
  const loop = r.value.loop
  const body: Record<string, unknown> =
    loop === 1
      ? {
          loop,
          participated: values.participated,
          overallGrade: values.participated ? values.overallGrade : null,
          trainerGrade: values.participated ? values.trainerGrade : null,
          expectationsGrade: values.participated ? values.expectationsGrade : null,
          comment: values.comment?.trim() || null,
        }
      : loop === 2
        ? {
            loop,
            appliesLearned: values.appliesLearned,
            supervisorSupported: values.supervisorSupported,
            worthwhileForOrganization: values.worthwhileForOrganization,
            comment: values.comment?.trim() || null,
          }
        : {
            loop,
            improvementObserved: Number(values.improvementObserved),
            certificationGained: values.certificationGained,
            certificationComment: values.certificationGained
              ? values.certificationComment?.trim() || null
              : null,
            comment: values.comment?.trim() || null,
          }
  try {
    await api.post<RatingSubmission>(`/training/ratings/${r.value.id}/submit`, body)
    await queryClient.invalidateQueries({ queryKey: trainingKeys.module })
    toast.success('Thanks for your feedback.')
    await navigateTo('/training/ratings')
  } catch (error) {
    if (isApiError(error) && error.isValidationError) {
      setErrors(error.fieldErrors)
      return
    }
    formError.value = describeError(error).detail ?? describeError(error).title
  }
})

const gradeOptions = [1, 2, 3, 4, 5, 6].map((value) => ({ value, label: String(value) }))
const likertOptions = LIKERT_OPTIONS.map((option) => ({
  value: option.value as Likert,
  label: option.label,
}))
const improvementOptions = IMPROVEMENT_OPTIONS.map((option) => ({
  value: option.value,
  title: option.label,
}))
</script>

<template>
  <PageBody>
    <div v-if="query.isPending.value" class="grid gap-4" aria-busy="true">
      <UiSkeleton class="h-10 w-2/3" />
      <UiSkeleton class="h-64 w-full" />
    </div>
    <ProblemAlert
      v-else-if="query.error.value"
      :error="query.error.value"
      :retry="() => query.refetch()"
    />

    <template v-else-if="r">
      <PageHeader
        :title="r.loop === 3 ? `${r.attendee.user.displayName}'s progress` : r.training.topic"
      >
        <template #meta>
          <span>Round {{ r.loop }} of 3 · {{ ROUND_LABEL[r.loop] }}</span>
          <span aria-hidden="true">·</span>
          <span class="mono">{{ r.training.reference }}</span>
          <span aria-hidden="true">·</span>
          <span
            >{{ r.loop === 3 ? r.training.topic : r.training.provider }},
            {{ formatDateRange(r.training.startsOn, r.training.endsOn) }}</span
          >
        </template>
        <template #status>
          <StatusBadge
            enum="ratingState"
            :value="r.state"
            :available-actions="r.availableActions"
          />
          <span v-if="!r.submittedAt" class="text-sm text-ink-muted">
            {{ r.state === 'upcoming' ? 'Due' : 'Due since' }} {{ formatDate(r.dueAt) }}
          </span>
          <span v-if="r.reminderCount > 0" class="flex items-center gap-1 text-sm text-ink-muted">
            <BellRing class="size-3.5" aria-hidden="true" /> Reminder {{ r.reminderCount }} of 4
          </span>
        </template>
      </PageHeader>

      <p v-if="r.state === 'upcoming'" class="mt-6 max-w-[640px] text-ink-muted">
        This round opens on {{ formatDate(r.dueAt) }}. You'll get an email then.
      </p>
      <p v-else-if="r.submittedAt" class="mt-6 text-ink-muted">
        Submitted {{ formatDate(r.submittedAt) }}. Your answers:
      </p>

      <form
        v-if="r.state !== 'upcoming'"
        class="mt-8 grid max-w-[720px] gap-7"
        @submit.prevent="submit"
      >
        <fieldset :disabled="readOnly" class="contents">
          <template v-if="r.loop === 1">
            <UiSwitch
              v-model="participated"
              label="I took part in the training"
              description="Switch off if you could not attend; the grades are then left out."
            />
            <template v-if="participated">
              <UiField
                label="The training overall"
                :error="errors.overallGrade"
                hint="1 excellent … 6 insufficient (school grades)"
              >
                <UiSegmented v-model="overall" :options="gradeOptions" label="Overall grade" />
              </UiField>
              <UiField label="The trainer" :error="errors.trainerGrade">
                <UiSegmented v-model="trainer" :options="gradeOptions" label="Trainer grade" />
              </UiField>
              <UiField label="How well it met your expectations" :error="errors.expectationsGrade">
                <UiSegmented
                  v-model="expectations"
                  :options="gradeOptions"
                  label="Expectations grade"
                />
              </UiField>
              <p v-if="overallGrade" class="-mt-4 text-sm text-ink-muted">
                Overall: {{ GRADE_WORDS[overallGrade] }}
              </p>
            </template>
          </template>

          <template v-else-if="r.loop === 2">
            <UiField
              v-for="statement in STATEMENTS"
              :key="statement.key"
              :label="statement.label"
              :error="errors[statement.key]"
            >
              <UiSegmented
                v-model="likertModels[statement.key].value"
                :options="likertOptions"
                :label="statement.label"
                stack-on-mobile
              />
            </UiField>
          </template>

          <template v-else>
            <UiField
              :label="`How visible is ${r.attendee.user.displayName.split(' ')[0]}'s improvement since the training?`"
              group
              :error="errors.improvementObserved"
            >
              <UiRadioCards
                v-model="improvement"
                :options="improvementOptions"
                :columns="2"
                aria-label="Improvement observed"
              />
            </UiField>
            <UiSwitch v-model="certificationGained" label="A certification was gained" />
            <UiField
              v-if="certificationGained"
              label="Which certification?"
              optional
              :error="errors.certificationComment"
            >
              <UiInput v-model="certificationComment" maxlength="1000" />
            </UiField>
          </template>

          <UiField label="Comment" optional :error="errors.comment">
            <UiTextarea v-model="comment" :rows="3" :maxlength="2000" />
          </UiField>
        </fieldset>

        <p v-if="formError" role="alert" class="text-sm text-st-negative">{{ formError }}</p>
        <div v-if="!readOnly" class="flex gap-2">
          <UiButton type="submit" variant="primary" :loading="isSubmitting">Send feedback</UiButton>
          <UiButton variant="ghost" to="/training/ratings">Later</UiButton>
        </div>
        <UiButton v-else variant="secondary" to="/training/ratings" class="justify-self-start"
          >Back to feedback</UiButton
        >
      </form>
    </template>
  </PageBody>
</template>
