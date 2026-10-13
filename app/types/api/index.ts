/**
 * API contract types (hand-written from _spec/atrium/API.md until the backend exports its full
 * OpenAPI document). Core types live here; module DTOs live in each module's own `types.ts`.
 */
export * from './shared'
export * from './core'

/** Cross-module enums that core types reference (owned by slices; listed here for typing). */
export type ApprovalReasonCode =
  | 'vehicle_class_upgrade'
  | 'car_estate'
  | 'car_automatic_preferred'
  | 'car_automatic_required'
  | 'car_diesel'
  | 'car_foreign_travel'
  | 'car_delivery'
  | 'car_collection'
  | 'train_saver_fare'
  | 'train_separate_tickets'
  | 'flight'

export type ApprovalExemptionCode = 'executive_traveller'
