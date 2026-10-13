<script setup lang="ts">
import type { NavBadgeValue, NavItem } from '~/types/navigation'

/**
 * The navigation list (DESIGN §7, SCREENS §1.2): groups with labels, items with icons and
 * counts, indented sub-items without icons. Only the Inbox count is a marker pill; module counts
 * are plain tabular numerals. The active item is a sheet row with the label marker-highlighted.
 * `rail` = icons only (768–1023px), with tooltips and the Inbox count as a pip.
 */
defineProps<{ rail?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()

const { sidebarGroups, isCurrent, isActive } = useNavigation()
// Badge sources run once in setup: the Inbox (foundation) + every module badge (registry).
const { badge } = useNavBadges(['inbox', ...Object.keys(navBadgeSources)])

function badgeLabel(item: NavItem, value: NavBadgeValue) {
  return value.label ?? `${value.count} for ${item.label}`
}
</script>

<template>
  <div class="grid gap-0.5">
    <template v-for="(group, groupIndex) in sidebarGroups" :key="group.id">
      <span
        v-if="group.label && !rail"
        class="block px-2.5 pt-[18px] pb-1.5 text-meta font-semibold text-ink-subtle"
        >{{ group.label }}</span
      >
      <span
        v-else-if="groupIndex > 0 && rail"
        class="mx-auto my-3 block w-6 border-t border-rule-strong"
        aria-hidden="true"
      />
      <nav :aria-label="group.label ?? 'My work'" class="grid gap-0.5">
        <template v-for="item in group.items" :key="item.id">
          <UiTooltip :content="item.label" :disabled="!rail" side="right">
            <NuxtLink
              :to="item.to"
              :aria-current="isCurrent(item.id) ? 'page' : undefined"
              class="nav-link relative flex h-[34px] items-center gap-2.5 rounded-md px-2.5 font-medium text-ink-muted no-underline transition-colors duration-(--dur-1) ease-standard hover:bg-hover hover:text-ink"
              :class="[
                rail && 'w-11 justify-center px-0',
                isActive(item.id) && !isCurrent(item.id) && 'text-ink',
              ]"
              @click="emit('navigate')"
            >
              <component
                :is="item.icon"
                v-if="item.icon"
                class="nav-icon size-4 text-ink-subtle"
                aria-hidden="true"
              />
              <span v-if="!rail" class="nav-label">{{ item.label }}</span>
              <span v-else class="sr">{{ item.label }}</span>
              <template v-if="badge(item.id)">
                <span
                  v-if="badge(item.id)!.tone === 'you'"
                  class="num grid h-5 min-w-5 place-items-center rounded-pill bg-marker px-1.5 text-meta font-semibold text-marker-ink"
                  :class="
                    rail
                      ? 'absolute -top-0 -right-0.5 h-[17px] min-w-[17px] px-1 text-[11px]'
                      : 'ml-auto'
                  "
                  :aria-label="badgeLabel(item, badge(item.id)!)"
                  >{{ badge(item.id)!.count }}</span
                >
                <span
                  v-else-if="!rail"
                  class="num ml-auto text-meta font-medium"
                  :class="
                    badge(item.id)!.tone === 'urgent'
                      ? 'font-semibold text-st-negative'
                      : 'text-ink-subtle'
                  "
                  :aria-label="badgeLabel(item, badge(item.id)!)"
                  >{{ badge(item.id)!.count }}</span
                >
              </template>
            </NuxtLink>
          </UiTooltip>
          <div v-if="item.children?.length && !rail" class="mt-px mb-1 grid gap-px">
            <NuxtLink
              v-for="child in item.children"
              :key="child.id"
              :to="child.to"
              :aria-current="isCurrent(child.id) ? 'page' : undefined"
              class="nav-link relative flex h-[30px] items-center gap-2.5 rounded-md pr-2.5 pl-9 text-sm font-medium text-ink-muted no-underline transition-colors duration-(--dur-1) ease-standard hover:bg-hover hover:text-ink"
              @click="emit('navigate')"
            >
              <span class="nav-label">{{ child.label }}</span>
              <span
                v-if="badge(child.id)"
                class="num ml-auto text-meta font-medium"
                :class="
                  badge(child.id)!.tone === 'urgent'
                    ? 'font-semibold text-st-negative'
                    : 'text-ink-subtle'
                "
                :aria-label="badgeLabel(child, badge(child.id)!)"
                >{{ badge(child.id)!.count }}</span
              >
            </NuxtLink>
          </div>
        </template>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.nav-link[aria-current='page'] {
  color: var(--ink);
  font-weight: 600;
  background: var(--sheet);
  box-shadow:
    0 0 0 1px var(--rule),
    0 1px 2px rgb(40 32 20 / 0.04);
}
.nav-link[aria-current='page'] .nav-icon {
  color: var(--ink);
}
.nav-link:hover .nav-icon {
  color: var(--ink-muted);
}
/* The marker swipe behind the active label (the authored motion moment, DESIGN §5). */
.nav-link[aria-current='page'] .nav-label {
  color: var(--marker-ink);
  background-image: linear-gradient(var(--marker), var(--marker));
  background-repeat: no-repeat;
  background-position: 0 60%;
  background-size: 100% 1.1em;
  padding: 0 3px;
  margin: 0 -3px;
  border-radius: 2px;
  animation: atrium-swipe var(--dur-4) var(--curve-out) both;
}
</style>
