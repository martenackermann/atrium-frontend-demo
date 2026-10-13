<script setup lang="ts">
/**
 * "Skip to content" (WCAG 2.4.1): the first tab stop on every layout, hidden until focused.
 * Moves focus to the page's <main id="main"> itself (a hash link alone doesn't move focus here).
 */
function skip() {
  const main = document.getElementById('main')
  if (!main) return
  if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1')
  main.focus()
}
</script>

<template>
  <a href="#main" class="skip-link" @click.prevent="skip">Skip to content</a>
</template>
