<script setup lang="ts">
/**
 * Address fields (API.md Address) bound to the parent form at `prefix` (e.g. `handover.address`):
 * street, number, postal code, city, country code.
 */
const props = defineProps<{ prefix: string; idPrefix: string }>()
const { value: street, errorMessage: streetError } = useField<string>(
  () => `${props.prefix}.street`,
)
const { value: houseNumber, errorMessage: numberError } = useField<string>(
  () => `${props.prefix}.houseNumber`,
)
const { value: postalCode, errorMessage: postalError } = useField<string>(
  () => `${props.prefix}.postalCode`,
)
const { value: city, errorMessage: cityError } = useField<string>(() => `${props.prefix}.city`)
const { value: countryCode, errorMessage: countryError } = useField<string>(
  () => `${props.prefix}.countryCode`,
)
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
    <UiField :id="`${idPrefix}-street`" label="Street" :error="streetError">
      <UiInput v-model="street" autocomplete="address-line1" maxlength="120" />
    </UiField>
    <UiField :id="`${idPrefix}-number`" label="Number" :error="numberError">
      <UiInput v-model="houseNumber" maxlength="20" />
    </UiField>
    <UiField :id="`${idPrefix}-postal`" label="Postal code" :error="postalError">
      <UiInput v-model="postalCode" autocomplete="postal-code" maxlength="12" />
    </UiField>
    <UiField
      :id="`${idPrefix}-country`"
      label="Country"
      hint="Two letters, e.g. DE"
      :error="countryError"
    >
      <UiInput v-model="countryCode" maxlength="2" class="uppercase" />
    </UiField>
    <UiField :id="`${idPrefix}-city`" label="City" :error="cityError" class="sm:col-span-2">
      <UiInput v-model="city" autocomplete="address-level2" maxlength="80" />
    </UiField>
  </div>
</template>
