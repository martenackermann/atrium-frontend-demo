<script setup lang="ts">
/**
 * One stepper step (DESIGN §8.2): one question in serif, a one-sentence lede, then the fields.
 *
 *   <StepperStep question="Which car do you need?" lede="The standard class with a manual gearbox
 *     goes straight to the travel desk. Anything more is approved by your manager first.">
 *     …fields…
 *   </StepperStep>
 */
defineProps<{ question: string; lede?: string }>()
</script>

<template>
  <section class="grid gap-[30px]">
    <header class="max-w-[60ch]">
      <h2
        class="font-display text-[26px] leading-8 font-normal tracking-display md:text-display-md"
      >
        {{ question }}
      </h2>
      <p
        v-if="lede"
        class="mt-2.5 text-[14.5px] leading-[22px] text-ink-muted md:text-md md:leading-[23px]"
      >
        {{ lede }}
      </p>
    </header>
    <slot />
  </section>
</template>
