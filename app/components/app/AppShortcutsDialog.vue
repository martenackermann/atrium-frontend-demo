<script setup lang="ts">
/** The keyboard shortcut sheet (`?`, SCREENS §1.3). */
const { shortcutsOpen } = useShell()
const groups = [
  {
    title: 'Everywhere',
    keys: [
      { keys: ['Ctrl', 'K'], label: 'Search or jump to (⌘K on a Mac)' },
      { keys: ['G', 'H'], label: 'Go to Home' },
      { keys: ['G', 'I'], label: 'Go to Inbox' },
      { keys: ['G', 'T'], label: 'Go to Training' },
      { keys: ['G', 'V'], label: 'Go to Travel' },
      { keys: ['G', 'A'], label: 'Go to My devices' },
      { keys: ['G', 'P'], label: 'Go to People requests' },
      { keys: ['?'], label: 'Show this list' },
    ],
  },
  {
    title: 'In queues and approvals',
    keys: [
      { keys: ['J'], label: 'Next item' },
      { keys: ['K'], label: 'Previous item' },
      { keys: ['A'], label: 'Approve' },
      { keys: ['D'], label: 'Decline (asks for a reason)' },
      { keys: ['Enter'], label: 'Open the full page' },
      { keys: ['Esc'], label: 'Close the detail' },
    ],
  },
]
</script>

<template>
  <UiDialog v-model:open="shortcutsOpen" title="Keyboard shortcuts" size="md">
    <div class="grid gap-5">
      <section v-for="group in groups" :key="group.title">
        <h3 class="mb-2 text-sm font-semibold text-ink-subtle">{{ group.title }}</h3>
        <dl class="m-0 grid gap-1.5">
          <div
            v-for="item in group.keys"
            :key="item.label"
            class="flex items-center justify-between gap-4"
          >
            <dt class="text-base">{{ item.label }}</dt>
            <dd class="m-0 flex gap-1">
              <UiKbd v-for="key in item.keys" :key="key">{{ key }}</UiKbd>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </UiDialog>
</template>
