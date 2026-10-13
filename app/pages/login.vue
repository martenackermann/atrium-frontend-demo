<script setup lang="ts">
import { z } from 'zod'
import { describeError, isApiError } from '~/lib/api'
import { coreKeys } from '~/lib/query/core'
import type { Persona, PersonaKey } from '~/types/api'

/**
 * Sign in (SCREENS §2 /login). Demo: a grid of the 9 personas ("Sign in as Emma") above the
 * email + password form ("Demo password: demo1234"). Without demo mode: the form only.
 */
definePageMeta({ public: true, layout: 'blank', title: 'Sign in' })

const auth = useAuthStore()
const api = useApi()
const route = useRoute()
const demo = useDemoMode()

const personas = useQuery({
  queryKey: coreKeys.personas,
  queryFn: ({ signal }) => api.get<Persona[]>('/auth/personas', undefined, { signal }),
  enabled: demo.enabled,
  staleTime: Number.POSITIVE_INFINITY,
  retry: false,
})

const schema = toTypedSchema(
  z.object({
    email: z.email('Enter your work email, like emma.employee@example.com.'),
    password: z.string().min(1, 'Enter your password.'),
  }),
)
const { defineField, errors, handleSubmit, isSubmitting, setErrors } = useForm({
  validationSchema: schema,
  initialValues: { email: '', password: '' },
})
const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')
const formError = ref<string | null>(null)
const signingInAs = ref<PersonaKey | null>(null)

const goOn = () => navigateTo(safeRedirect(route.query.redirect))

function explain(error: unknown) {
  if (isApiError(error) && error.status === 401) return 'Email or password is incorrect.'
  if (isApiError(error) && error.status === 429)
    return describeError(error).detail ?? 'Too many attempts. Try again in a few minutes.'
  return describeError(error).title
}

const onSubmit = handleSubmit(async (values) => {
  formError.value = null
  try {
    await auth.login(values)
    await goOn()
  } catch (error) {
    if (isApiError(error) && error.isValidationError) setErrors(error.fieldErrors)
    formError.value = explain(error)
  }
})

async function signInAs(persona: Persona) {
  formError.value = null
  signingInAs.value = persona.key
  try {
    await auth.demoLogin(persona.key)
    await goOn()
  } catch (error) {
    formError.value = explain(error)
  } finally {
    signingInAs.value = null
  }
}
</script>

<template>
  <main
    id="main"
    class="mx-auto outline-none grid max-w-[1180px] gap-10 px-4 pt-10 pb-16 md:px-10 md:pt-14"
  >
    <header class="flex items-start gap-3">
      <AppBrandMark class="mt-[3px] size-8" />
      <div>
        <h1 class="font-display text-display-md font-normal tracking-display">Sign in to Atrium</h1>
        <p class="mt-1 text-md text-ink-muted">
          Training, travel, devices and people requests in one place.
        </p>
      </div>
    </header>

    <section v-if="demo.enabled.value" aria-labelledby="personas-heading" class="grid gap-4">
      <div class="flex flex-wrap items-baseline gap-x-3">
        <h2 id="personas-heading" class="text-lg font-[650] tracking-heading">Try it as someone</h2>
        <p class="text-sm text-ink-muted">
          Nine people at Acme IT Services, each with something waiting for them.
        </p>
      </div>
      <div v-if="personas.isPending.value" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <UiSkeleton v-for="index in 6" :key="index" class="h-56 rounded-lg" />
      </div>
      <ul
        v-else-if="personas.data.value?.length"
        class="m-0 grid list-none gap-3 p-0 md:grid-cols-2 xl:grid-cols-3"
      >
        <li v-for="persona in personas.data.value" :key="persona.key" class="grid">
          <PersonaCard
            :persona="persona"
            :loading="signingInAs === persona.key"
            :disabled="Boolean(signingInAs) && signingInAs !== persona.key"
            @select="signInAs"
          />
        </li>
      </ul>
    </section>

    <section aria-labelledby="form-heading" class="max-w-md">
      <h2 id="form-heading" class="mb-4 text-lg font-[650] tracking-heading">
        {{ demo.enabled.value ? 'Or sign in with email' : 'Sign in with your work email' }}
      </h2>
      <form
        class="grid gap-4 rounded-xl border border-rule bg-sheet p-5 shadow-sheet"
        novalidate
        @submit="onSubmit"
      >
        <UiField label="Email" :error="errors.email">
          <UiInput v-model="email" v-bind="emailAttrs" type="email" autocomplete="username" />
        </UiField>
        <UiField
          label="Password"
          :hint="demo.enabled.value ? 'Demo password: demo1234' : undefined"
          :error="errors.password"
        >
          <UiInput
            v-model="password"
            v-bind="passwordAttrs"
            type="password"
            autocomplete="current-password"
          />
        </UiField>
        <p v-if="formError" role="alert" class="text-sm text-st-negative">{{ formError }}</p>
        <UiButton type="submit" variant="primary" block :loading="isSubmitting">Sign in</UiButton>
      </form>
    </section>
  </main>
</template>
