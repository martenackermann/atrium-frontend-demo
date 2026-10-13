import { coreKeys } from '~/lib/query/core'
import { sentenceCase } from '~/lib/status'
import type {
  EnumCatalog,
  EnumName,
  EnumOption,
  PublicConfig,
  WorkflowDefinition,
} from '~/types/api'

/** `/meta/enums` (labels + API tones), cached for the session. */
export function useEnums() {
  const api = useApi()
  const auth = useAuthStore()
  const query = useQuery({
    queryKey: coreKeys.enums,
    queryFn: ({ signal }) => api.get<EnumCatalog>('/meta/enums', undefined, { signal }),
    enabled: computed(() => auth.isAuthenticated),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })

  function options(name: EnumName | string): EnumOption[] {
    return (query.data.value as Record<string, EnumOption[]> | undefined)?.[name] ?? []
  }

  function label(name: EnumName | string, value: string | number | null | undefined): string {
    if (value === null || value === undefined) return ''
    return (
      options(name).find((option) => String(option.value) === String(value))?.label ??
      sentenceCase(String(value))
    )
  }

  return { ...query, options, label }
}

/** `/meta/config` (thresholds, upload limits, demo flag). */
export function usePublicConfig() {
  const api = useApi()
  const auth = useAuthStore()
  return useQuery({
    queryKey: coreKeys.config,
    queryFn: ({ signal }) => api.get<PublicConfig>('/meta/config', undefined, { signal }),
    enabled: computed(() => auth.isAuthenticated),
    staleTime: Number.POSITIVE_INFINITY,
  })
}

/** `/meta/workflows/{name}` for WorkflowDiagram. */
export function useWorkflowDefinition(name: MaybeRefOrGetter<string | null | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => coreKeys.workflow(toValue(name) ?? '')),
    queryFn: ({ signal }) =>
      api.get<WorkflowDefinition>(`/meta/workflows/${toValue(name)}`, undefined, { signal }),
    enabled: computed(() => Boolean(toValue(name))),
    staleTime: Number.POSITIVE_INFINITY,
  })
}
