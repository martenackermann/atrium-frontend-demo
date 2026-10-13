/**
 * The Atrium API client:
 *
 *   const api = useApi()
 *   const page = await api.get<Page<TravelRequestSummary>>('/travel/requests', { scope: 'mine' })
 *   const detail = await api.action<TravelRequestDetail>(`/travel/requests/${id}`, 'approve', {})
 *   const file = await api.upload(file, 'training_document', { onProgress })
 *
 * Errors are thrown as ApiError (problem+json normalised). Every POST carries an Idempotency-Key.
 * Call useApi() synchronously in setup / at the top of a composable, not after an await.
 */
export function useApi() {
  return useNuxtApp().$api
}

export type AtriumApi = ReturnType<typeof useApi>
