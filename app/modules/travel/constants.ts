import {
  Ban,
  CarFront,
  CircleX,
  Plane,
  RotateCcw,
  Stamp,
  TicketCheck,
  TrainFront,
  TriangleAlert,
  Undo2,
  X,
} from '@lucide/vue'
import type { Component } from 'vue'
import type { ActionConfig } from '~/types/ui'
import type { TravelKind, TravelRequestDetail } from './api/types'

/** Kind presentation (DESIGN §6 request-type icons). */
export const KIND_META: Record<
  TravelKind,
  { label: string; noun: string; icon: Component; newLabel: string; to: string }
> = {
  car: {
    label: 'Car or van',
    noun: 'Car rental',
    icon: CarFront,
    newLabel: 'Rental car or van',
    to: '/travel/new/car',
  },
  train: {
    label: 'Train',
    noun: 'Train journey',
    icon: TrainFront,
    newLabel: 'Train',
    to: '/travel/new/train',
  },
  flight: {
    label: 'Flight',
    noun: 'Flight',
    icon: Plane,
    newLabel: 'Flight',
    to: '/travel/new/flight',
  },
}

/**
 * ActionBar config for travel requests (API.md §5.3 bodies). `book` opens the booking dialog
 * (booking number, PIN, confirmation PDFs) — pages intercept it.
 */
export const TRAVEL_ACTION_CONFIG: Record<string, ActionConfig> = {
  approve: { label: 'Approve', icon: Stamp, kbd: 'A', variant: 'primary' },
  decline: {
    label: 'Decline',
    icon: X,
    kbd: 'D',
    reason: {
      title: 'Decline this trip?',
      description: 'The traveller is told why and can duplicate the request with changes.',
      label: 'Tell them why',
      hint: 'The traveller and the requester see this reason in their email.',
      confirmLabel: 'Decline request',
    },
  },
  withdraw: {
    label: 'Withdraw',
    icon: Undo2,
    reason: {
      title: 'Withdraw this request?',
      description: 'Nobody needs to act on it any more. The approver is told.',
      label: 'Reason',
      hint: 'Optional. The approver sees it in their email.',
      confirmLabel: 'Withdraw request',
      required: false,
    },
  },
  request_cancellation: {
    label: 'Request cancellation',
    icon: Ban,
    variant: 'secondary',
    reason: {
      title: 'Cancel this trip?',
      description: 'The travel desk cancels the booking and lets you know.',
      label: 'Why cancel?',
      hint: 'The travel desk reads this before they cancel the booking.',
      confirmLabel: 'Request cancellation',
    },
  },
  confirm_cancellation: {
    label: 'Confirm cancellation',
    icon: CircleX,
    variant: 'primary',
    confirm: {
      title: 'Confirm the cancellation?',
      description: 'The trip is cancelled and the traveller is told. This cannot be undone.',
      confirmLabel: 'Confirm cancellation',
      cancelLabel: 'Keep the trip',
    },
  },
  reject_cancellation: {
    label: 'Reject cancellation',
    icon: X,
    reason: {
      title: 'Keep this trip?',
      description: 'The trip stays as it was. The traveller is told why.',
      label: 'Why it cannot be cancelled',
      hint: 'The traveller sees this reason in their email.',
      confirmLabel: 'Reject cancellation',
    },
  },
  book: { label: 'Book', icon: TicketCheck, variant: 'primary' },
  mark_booking_impossible: {
    label: 'Booking impossible',
    icon: TriangleAlert,
    reason: {
      title: 'Booking not possible?',
      description: 'The traveller is told why. You can retry later.',
      label: 'What went wrong',
      hint: 'The traveller and the requester see this reason.',
      confirmLabel: 'Mark booking impossible',
    },
  },
  retry_booking: { label: 'Retry booking', icon: RotateCcw, variant: 'primary' },
  close: {
    label: 'Close request',
    icon: Ban,
    reason: {
      title: 'Close this request?',
      description: 'The request is cancelled because it cannot be booked.',
      label: 'Reason',
      hint: 'The traveller and the requester see this reason.',
      confirmLabel: 'Close request',
    },
  },
}

/** Success toasts — words mirror the action (DESIGN §10). */
export const TRAVEL_ACTION_MESSAGES: Record<
  string,
  string | ((detail: TravelRequestDetail) => string)
> = {
  approve: (d) =>
    `Approved. The travel desk books ${firstName(d.traveller.displayName)}'s trip next.`,
  decline: 'Declined. The traveller has been told why.',
  withdraw: 'Request withdrawn.',
  request_cancellation: 'Cancellation requested. The travel desk takes it from here.',
  confirm_cancellation: 'Cancellation confirmed.',
  reject_cancellation: 'Cancellation rejected. The trip stays as it was.',
  book: (d) => `Booked. ${firstName(d.traveller.displayName)} gets the confirmation by email.`,
  mark_booking_impossible: 'Marked as impossible. The traveller has been told.',
  retry_booking: 'Back in the booking queue.',
  close: 'Request closed.',
}

export function firstName(name: string): string {
  return name.split(' ')[0] ?? name
}

/** Equipment flags in display order (SCREENS §5.3 car step 2). */
export const EQUIPMENT_OPTIONS = [
  { key: 'navigation', label: 'Navigation system', reason: null },
  {
    key: 'winterTyres',
    label: 'Winter tyres',
    description: 'Recommended from November',
    reason: null,
  },
  {
    key: 'estate',
    label: 'Estate car',
    description: 'More boot space for equipment',
    reason: 'car_estate',
  },
  {
    key: 'diesel',
    label: 'Diesel engine',
    description: 'For long distances',
    reason: 'car_diesel',
  },
  {
    key: 'foreignTravel',
    label: 'Foreign travel',
    description: 'You name the countries below',
    reason: 'car_foreign_travel',
  },
  {
    key: 'childSeat',
    label: 'Child seat',
    description: 'Seat or booster, agreed with the travel desk',
    reason: null,
  },
] as const

/** Countries for the foreign-travel multi-select (ISO 3166-1 alpha-2). */
export const COUNTRY_OPTIONS = [
  { value: 'AT', label: 'Austria' },
  { value: 'BE', label: 'Belgium' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'CZ', label: 'Czechia' },
  { value: 'DE', label: 'Germany' },
  { value: 'DK', label: 'Denmark' },
  { value: 'ES', label: 'Spain' },
  { value: 'FR', label: 'France' },
  { value: 'IT', label: 'Italy' },
  { value: 'LU', label: 'Luxembourg' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'PL', label: 'Poland' },
] as const

export const countryName = (code: string) =>
  COUNTRY_OPTIONS.find((option) => option.value === code)?.label ?? code

/** Fictional regions (WORKSPACE) for stations, airports and branches. */
export const PLACES = [
  'Riverton',
  'Hillford',
  'Eastgate',
  'Northport',
  'Westbay',
  'Southmere',
  'Lakeside',
  'Highmoor',
  'Oakridge',
] as const
