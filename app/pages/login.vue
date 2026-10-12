<script setup lang="ts">
import { z } from 'zod'
import { isApiError, unwrap } from '~/lib/api'

// PLACEHOLDER (phase 2a): functional but unstyled. Phase 2b builds the real sign-in screen.
definePageMeta({ public: true, layout: false })

const auth = useAuthStore()
const api = useApi()
const route = useRoute()
const { enabled: demoMode } = useDemoMode()

const personas = useQuery({
  queryKey: ['auth', 'personas'],
  queryFn: ({ signal }) => unwrap(api.GET('/auth/personas', { signal })),
  enabled: demoMode,
})

const schema = toTypedSchema(
  z.object({
    email: z.email('Enter a valid email address.'),
    password: z.string().min(1, 'Enter your password.'),
  }),
)

const { defineField, errors, handleSubmit, isSubmitting, setErrors, setValues } = useForm({
  validationSchema: schema,
  initialValues: { email: '', password: '' },
})
const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')
const formError = ref<string | null>(null)

const onSubmit = handleSubmit(async (values) => {
  formError.value = null
  try {
    await auth.login(values)
    await navigateTo(safeRedirect(route.query.redirect))
  } catch (error) {
    if (isApiError(error)) {
      setErrors(error.fieldErrors)
      formError.value = error.detail ?? error.title
    } else {
      formError.value = 'Sign-in failed.'
    }
  }
})

function signInAs(personaEmail: string) {
  setValues({ email: personaEmail, password: 'demo1234' })
  return onSubmit()
}
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
    <h1 class="text-2xl font-semibold">Sign in to Atrium</h1>

    <form class="space-y-4" novalidate @submit="onSubmit">
      <div class="space-y-1">
        <label for="email" class="block text-sm font-medium">Email</label>
        <input
          id="email"
          v-model="email"
          v-bind="emailAttrs"
          type="email"
          autocomplete="username"
          class="w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <p v-if="errors.email" class="text-sm text-red-600">{{ errors.email }}</p>
      </div>
      <div class="space-y-1">
        <label for="password" class="block text-sm font-medium">Password</label>
        <input
          id="password"
          v-model="password"
          v-bind="passwordAttrs"
          type="password"
          autocomplete="current-password"
          class="w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <p v-if="errors.password" class="text-sm text-red-600">{{ errors.password }}</p>
      </div>
      <p v-if="formError" role="alert" class="text-sm text-red-600">{{ formError }}</p>
      <button
        type="submit"
        :disabled="isSubmitting"
        class="w-full rounded bg-neutral-900 px-3 py-2 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
      >
        Sign in
      </button>
    </form>

    <section v-if="demoMode" class="space-y-3" aria-labelledby="personas-heading">
      <h2 id="personas-heading" class="text-sm font-semibold">Demo personas (password demo1234)</h2>
      <p v-if="personas.isPending.value" class="text-sm">Loading personas...</p>
      <ul v-else class="space-y-2">
        <li v-for="persona in personas.data.value" :key="persona.email">
          <button
            type="button"
            class="w-full rounded border border-neutral-200 px-3 py-2 text-left hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
            :data-testid="`persona-${persona.email}`"
            @click="signInAs(persona.email)"
          >
            <span class="block font-medium">{{ persona.displayName }}</span>
            <span class="block text-sm text-neutral-600 dark:text-neutral-400">
              {{ persona.description }}
            </span>
          </button>
        </li>
      </ul>
    </section>
  </main>
</template>
