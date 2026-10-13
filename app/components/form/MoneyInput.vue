<script setup lang="ts">
import type { Money } from '~/types/api'

/**
 * MoneyInput (SCREENS §1.6): euros typed as "1,890.50", stored as `Money` (integer cents, EUR).
 * Mono figures; the € prefix sits inside the field.
 */
withDefaults(
  defineProps<{ invalid?: boolean; disabled?: boolean; placeholder?: string; id?: string }>(),
  // `invalid` stays undefined when absent so the field context decides (Vue casts to false).
  { invalid: undefined },
)
const model = defineModel<Money | null | undefined>()

const format = (cents: number) =>
  new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)

const text = ref(model.value ? format(model.value.amountCents) : '')
watch(model, (value) => {
  const current = parse(text.value)
  if ((value?.amountCents ?? null) !== current) text.value = value ? format(value.amountCents) : ''
})

function parse(value: string): number | null {
  const cleaned = value.replace(/[€\s,]/g, '')
  if (!cleaned) return null
  const number = Number(cleaned)
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null
}

function onInput(value: string | number | null | undefined) {
  text.value = String(value ?? '')
  const cents = parse(text.value)
  model.value = cents === null ? null : { amountCents: cents, currency: 'EUR' }
}

function onBlur() {
  if (model.value) text.value = format(model.value.amountCents)
}
</script>

<template>
  <UiInput
    :id="id"
    :model-value="text"
    prefix="€"
    mono
    inputmode="decimal"
    autocomplete="off"
    :invalid="invalid"
    :disabled="disabled"
    :placeholder="placeholder ?? '890'"
    @update:model-value="onInput"
    @blur="onBlur"
  />
</template>
