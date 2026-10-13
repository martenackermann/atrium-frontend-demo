import { coreKeys } from '~/lib/query/core'
import type { CostCenterDto, DepartmentDto, Ref } from '~/types/api'
import type { SelectOption } from '~/types/ui'

/**
 * Org reference data (`/org/departments`, `/org/sites`, `/org/cost-centers`) as cached queries and
 * ready-made select options. Long stale time: the org changes rarely.
 *
 *   const org = useOrg()
 *   <UiSelect v-model="departmentId" :options="org.departmentOptions.value" />
 */
export function useOrg() {
  const api = useApi()
  const staleTime = 10 * 60_000

  const departments = useQuery({
    queryKey: coreKeys.departments,
    queryFn: ({ signal }) => api.get<DepartmentDto[]>('/org/departments', undefined, { signal }),
    staleTime,
  })
  const sites = useQuery({
    queryKey: coreKeys.sites,
    queryFn: ({ signal }) => api.get<Ref[]>('/org/sites', undefined, { signal }),
    staleTime,
  })
  const costCenters = useQuery({
    queryKey: coreKeys.costCenters,
    queryFn: ({ signal }) => api.get<CostCenterDto[]>('/org/cost-centers', undefined, { signal }),
    staleTime,
  })

  const toOptions = (rows: readonly Ref[] | undefined, withCode = false): SelectOption<string>[] =>
    (rows ?? []).map((row) => ({
      value: row.id,
      label: withCode ? `${row.code} · ${row.name}` : row.name,
    }))

  return {
    departments,
    sites,
    costCenters,
    departmentOptions: computed(() => toOptions(departments.data.value)),
    siteOptions: computed(() => toOptions(sites.data.value)),
    costCenterOptions: computed(() =>
      toOptions(
        costCenters.data.value?.filter((row) => row.active),
        true,
      ),
    ),
  }
}
