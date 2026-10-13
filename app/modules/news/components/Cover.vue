<script setup lang="ts">
import type { SignedImage } from '~/types/api'

/**
 * A news cover from its signed URL. The image is fetched in CORS mode and shown as a blob URL:
 * the API serves files with `Cross-Origin-Resource-Policy: same-origin`, which blocks a plain
 * cross-origin `<img src>` when the app and the API run on different origins.
 */
const props = defineProps<{ image: SignedImage; alt?: string; class?: string }>()

const src = ref<string | null>(null)
let current: string | null = null

function release() {
  if (current) URL.revokeObjectURL(current)
  current = null
}

watch(
  () => props.image.url,
  async (url, _old, onCleanup) => {
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    try {
      const response = await fetch(url, { mode: 'cors', credentials: 'omit' })
      if (!response.ok) throw new Error(String(response.status))
      const blob = await response.blob()
      if (cancelled) return
      release()
      current = URL.createObjectURL(blob)
      src.value = current
    } catch {
      if (!cancelled) src.value = null
    }
  },
  { immediate: true },
)

onBeforeUnmount(release)
</script>

<template>
  <img v-if="src" :src="src" :alt="alt ?? ''" :class="props.class" />
  <div v-else :class="[props.class, 'bg-well']" role="presentation" />
</template>
