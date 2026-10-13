<script setup lang="ts">
import type { RadioCardOption } from '~/types/ui'
import type { AssetDto } from '../api/types'

/**
 * Accept dialog (SCREENS §6.1): the user picks the platform installed on the device when its
 * type requires one (SPEC §5.3 guard). Emits the platform id; the caller runs `accept`.
 */
const props = defineProps<{ asset: AssetDto; loading?: boolean; error?: string | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: [platformId: string] }>()

const platformId = ref<string | undefined>()
const touched = ref(false)
watch(open, (value) => {
  if (value) {
    platformId.value = props.asset.platform?.id ?? undefined
    touched.value = false
  }
})
const noun = computed(() => props.asset.deviceType.name.toLowerCase())
const options = computed<RadioCardOption[]>(() =>
  props.asset.applicablePlatforms.map((platform) => ({ value: platform.id, title: platform.name })),
)
const localError = computed(() =>
  touched.value && !platformId.value ? 'Choose the platform installed on the device.' : null,
)

function submit() {
  touched.value = true
  if (platformId.value) emit('submit', platformId.value)
}
</script>

<template>
  <UiDialog
    v-model:open="open"
    :title="`Accept your ${noun}`"
    :description="`${asset.model.name} · ${asset.assetTag}. Check the screen or the settings to see which platform it runs.`"
    size="sm"
  >
    <form :id="`accept-${asset.id}`" class="grid gap-3" novalidate @submit.prevent="submit">
      <UiField label="Installed platform" group :error="localError ?? error">
        <UiRadioCards
          v-model="platformId"
          :options="options"
          :columns="1"
          aria-label="Installed platform"
        />
      </UiField>
    </form>
    <template #footer>
      <UiButton variant="secondary" @click="open = false">Cancel</UiButton>
      <UiButton type="submit" :form="`accept-${asset.id}`" variant="primary" :loading="loading"
        >Accept {{ noun }}</UiButton
      >
    </template>
  </UiDialog>
</template>
