<script setup lang="ts">
import { FileQuestion, Lock, TriangleAlert } from '@lucide/vue'
import { TooltipProvider } from 'reka-ui'
import type { NuxtError } from '#app'

/**
 * 404 / 403 / 500 views (SCREENS §1.7/§2), rendered inside the app shell when signed in.
 * 404 "We couldn't find that. It may not exist, or you may not have access." ·
 * 403 "You don't have access to this page." · Back to Home.
 */
const props = defineProps<{ error: NuxtError }>()
const auth = useAuthStore()

const view = computed(() => {
  if (props.error.statusCode === 404) {
    return {
      icon: FileQuestion,
      title: "We couldn't find that",
      text: 'It may not exist, or you may not have access.',
    }
  }
  if (props.error.statusCode === 403) {
    return {
      icon: Lock,
      title: "You don't have access to this page",
      text: 'Ask your manager or IT if you need it for your work.',
    }
  }
  return {
    icon: TriangleAlert,
    title: 'Something went wrong',
    text: 'Try again. If it keeps happening, contact it-support@example.com.',
  }
})

useHead({ title: computed(() => `${view.value.title} · Atrium`) })
const home = () => clearError({ redirect: '/' })
</script>

<template>
  <!-- error.vue replaces app.vue, so it needs its own TooltipProvider. -->
  <TooltipProvider :delay-duration="400">
    <NuxtLayout :name="auth.isAuthenticated ? 'default' : 'blank'">
      <PageBody>
        <EmptyState
          :icon="view.icon"
          :title="view.title"
          :description="view.text"
          data-testid="error-view"
        >
          <UiButton variant="primary" @click="home">Back to Home</UiButton>
        </EmptyState>
      </PageBody>
    </NuxtLayout>
  </TooltipProvider>
</template>
