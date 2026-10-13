<script setup lang="ts">
import type { SignedImage } from '~/types/api'

/**
 * A news cover from its signed URL. The API serves `/files/{token}` with
 * `Cross-Origin-Resource-Policy: cross-origin`, so a plain `<img>` works when the app and the API
 * run on different origins (the expiring token is the access control).
 */
const props = defineProps<{ image: SignedImage; alt?: string; class?: string }>()
</script>

<template>
  <img :src="props.image.url" :alt="alt ?? ''" :class="props.class" loading="lazy" />
</template>
