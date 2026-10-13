import type { QueryKey } from '@tanstack/vue-query'
import { describeError, isApiError } from '~/lib/api'

export interface WorkflowActionOptions<TDetail> {
  /** Resource path without `/actions`: '/travel/requests/<id>'. */
  resourcePath: MaybeRefOrGetter<string>
  /** Invalidated after success and after a 409 (refetch): usually the module root key. */
  invalidate?: QueryKey[]
  /** Success toast per action — words mirror the action ("Approved."). */
  messages?: Record<string, string | ((detail: TDetail) => string)>
  onSuccess?: (detail: TDetail, action: string) => void
}

/**
 * Run a workflow transition (`POST …/actions/{action}`, API.md §1) with the standard behaviour:
 * success toast, invalidation, 409 `invalid_transition` → "This request changed in the meantime" +
 * refetch, 422 → rethrown so the form can map `fieldErrors`.
 *
 *   const { run, isPending } = useWorkflowAction({ resourcePath: () => `/travel/requests/${id}`,
 *     invalidate: [travelKeys.module], messages: { approve: 'Approved.' } })
 *   await run('decline', { reason })
 */
export function useWorkflowAction<TDetail = unknown>(options: WorkflowActionOptions<TDetail>) {
  const api = useApi()
  const queryClient = useQueryClient()
  const toast = useToast()

  const invalidateAll = () =>
    Promise.all(
      (options.invalidate ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    )

  const mutation = useMutation({
    mutationFn: (input: { action: string; body?: unknown; idempotencyKey?: string }) =>
      api.action<TDetail>(toValue(options.resourcePath), input.action, input.body ?? {}, {
        idempotencyKey: input.idempotencyKey,
      }),
    onSuccess: async (detail, input) => {
      await invalidateAll()
      const message = options.messages?.[input.action]
      if (message) toast.success(typeof message === 'function' ? message(detail) : message)
      options.onSuccess?.(detail, input.action)
    },
    onError: async (error) => {
      if (isApiError(error) && error.code === 'invalid_transition') {
        toast.error(describeError(error))
        await invalidateAll()
        return
      }
      // Validation errors belong to the form (ReasonDialog / page form) — don't double report.
      if (isApiError(error) && error.status === 422) return
      toast.error(describeError(error))
    },
  })

  function run(action: string, body?: unknown, idempotencyKey?: string): Promise<TDetail> {
    return mutation.mutateAsync({ action, body, idempotencyKey })
  }

  return { run, ...mutation }
}
