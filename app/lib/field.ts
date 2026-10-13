import type { ComputedRef, InjectionKey } from 'vue'

/** Provided by <UiField>, consumed by controls for id / aria-describedby / aria-invalid. */
export interface FieldContext {
  id: string
  invalid: ComputedRef<boolean>
  describedBy: ComputedRef<string | undefined>
}

export const FIELD_CONTEXT: InjectionKey<FieldContext> = Symbol('atrium-field')

export function useFieldContext(): FieldContext | undefined {
  return inject(FIELD_CONTEXT, undefined)
}

/** First message of a vee-validate / ApiError value (string | string[] | undefined). */
export function firstError(
  value: string | readonly string[] | null | undefined,
): string | undefined {
  if (!value) return undefined
  return typeof value === 'string' ? value : value[0]
}
