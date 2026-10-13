import type { AppCommand } from '~/lib/registry'

/** Every app/modules/<module>/commands.ts — adding commands needs no change here. */
const commandFiles = import.meta.glob<{ default: AppCommand[] }>('~/modules/*/commands.ts', {
  eager: true,
})

export const moduleCommands: AppCommand[] = Object.keys(commandFiles)
  .sort()
  .flatMap((path) => commandFiles[path]?.default ?? [])

const byOrder = (a: AppCommand, b: AppCommand) =>
  (a.order ?? 100) - (b.order ?? 100) || a.label.localeCompare(b.label)

/** Module commands the user may run (⌘K "Create", sidebar "New request", mobile "New"). */
export function useCommands() {
  const auth = useAuthStore()
  const commands = computed(() => moduleCommands.filter((command) => auth.can(command.access)))
  const createCommands = computed(() =>
    commands.value.filter((command) => command.group === 'create').sort(byOrder),
  )
  const newRequestCommands = computed(() =>
    createCommands.value.filter((command) => command.newRequest),
  )
  return { commands, createCommands, newRequestCommands }
}
