<script setup lang="ts">
import { ExternalLink, FlaskConical, RotateCcw } from '@lucide/vue'

/**
 * Demo ribbon (DESIGN §7, SCREENS §1.1): "Demo environment · data resets daily · password demo1234
 * · Open demo mailbox ↗". In the offline (MSW) demo there is no mailbox; it offers "Reset demo
 * data" instead. Shortened on mobile.
 */
const demo = useDemoMode()
const toast = useToast()
const resetting = ref(false)

async function reset() {
  resetting.value = true
  try {
    await demo.reset()
    toast.success('Demo data reset.', { description: 'Everything is back to the start of today.' })
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <div
    role="note"
    class="flex min-h-8 items-center justify-start gap-2 border-b border-rule bg-desk px-4 py-2 text-[12px] leading-4 text-ink-muted md:justify-center md:text-[12.5px]"
  >
    <FlaskConical class="size-3.5 text-ink-subtle" aria-hidden="true" />
    <span>
      <b class="font-semibold text-ink">Demo environment</b
      ><span class="max-md:hidden">
        · data resets daily · password <span class="mono text-ink">demo1234</span></span
      >
    </span>
    <a
      v-if="demo.mailpitUrl.value"
      :href="demo.mailpitUrl.value"
      target="_blank"
      rel="noopener"
      class="link ml-auto inline-flex items-center gap-1 font-medium text-ink md:ml-2"
      >Open demo mailbox<ExternalLink class="size-3.5 text-ink-subtle" aria-hidden="true"
    /></a>
    <button
      v-else-if="demo.isMsw.value"
      type="button"
      class="link ml-auto inline-flex items-center gap-1 font-medium text-ink md:ml-2"
      :disabled="resetting"
      @click="reset"
    >
      <RotateCcw class="size-3.5 text-ink-subtle" aria-hidden="true" />Reset demo data
    </button>
  </div>
</template>
