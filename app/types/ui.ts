/** Shared prop types of the UI kit (app/components). */
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

export interface SelectOption<V extends string | number = string> {
  value: V
  label: string
  description?: string
  disabled?: boolean
}

export interface RadioCardOption<V extends string = string> {
  value: V
  title: string
  /** mono code: "ECMR" */
  code?: string
  description?: string
  /** Side tag: "Standard" (positive) / "Needs approval" (waiting). */
  tag?: { label: string; tone: 'positive' | 'waiting' | 'neutral' }
  disabled?: boolean
}

export interface TabItem<V extends string = string> {
  value: V
  label: string
  /** Count pill; turns marker on the selected tab when `countTone` is 'you'. */
  count?: number | null
  countTone?: 'plain' | 'you'
  disabled?: boolean
}

export interface Crumb {
  label: string
  to?: RouteLocationRaw
}

export interface ReasonChip {
  code: string
  label: string
  icon?: Component
}

/** One stop of a RoutingSlip (DESIGN §9 "LifecycleTimeline (RouteTrack)"). */
export interface RouteStop {
  /** Step name: "Submitted", "Your approval", "Booking". */
  step: string
  /** Who: "Max Manager", "Travel desk". */
  who?: string
  /** Monogram ("MM") or omitted when `icon` is set. */
  initials?: string
  icon?: Component
  /** "today 08:41", "Waiting since 08:41". */
  when?: string
  state: 'done' | 'current' | 'stopped' | 'skipped' | 'future'
  /** Tone of the current stop: waiting (others) / you (viewer acts) / moving (a desk works). */
  tone?: 'waiting' | 'you' | 'moving'
}

export interface FactItem {
  label: string
  value: string | number | null | undefined
  /** Secondary line under the value. */
  detail?: string | null
  /** Render the value in mono (codes, money). */
  mono?: boolean
}

/** ActionBar config per action (label, reason/confirm steps). */
export interface ActionConfig {
  label: string
  icon?: Component
  /** Ask for a reason first (ReasonDialog) and send it as `{ [field]: reason }`. */
  reason?: {
    title: string
    description?: string
    label?: string
    hint?: string
    confirmLabel?: string
    /** Body field name (`reason`, `note`, `question`). Default 'reason'. */
    field?: string
    required?: boolean
  }
  /** Confirm first (destructive consequences). */
  confirm?: { title: string; description?: string; confirmLabel: string; cancelLabel?: string }
  /** Keyboard hint shown in the button. */
  kbd?: string
  /** Force variant. */
  variant?: 'primary' | 'secondary' | 'danger'
}

/** DataTable column (DESIGN §9 DataTable). */
export interface DataTableColumn<T = Record<string, unknown>> {
  key: string
  label: string
  /** API sort field; clicking the header cycles field → -field → default. */
  sort?: string
  align?: 'left' | 'right' | 'center'
  /** CSS width, e.g. '140px'. */
  width?: string
  /** Hidden until chosen in the column menu. */
  hidden?: boolean
  /** Can't be hidden in the column menu. */
  required?: boolean
  /** Value for the default cell (otherwise row[key]). Use a `#cell-<key>` slot for markup. */
  value?: (row: T) => unknown
  /** Default cell formatting: mono (codes), num (bare integers), money, date. */
  format?: 'mono' | 'num' | 'money' | 'date'
  /** Role in the mobile row list. */
  mobile?: 'title' | 'meta' | 'status' | 'hidden'
}
