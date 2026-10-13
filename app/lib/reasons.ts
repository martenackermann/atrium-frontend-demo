/**
 * Approval-reason icons (DESIGN §6) keyed by API reason code (SPEC §6.3) plus the two training
 * flags. Labels always come from the API (ReasonDto.label / /meta/enums approvalReason).
 */
import {
  Banknote,
  CarFront,
  Cog,
  Fuel,
  Globe,
  MapPin,
  Package,
  Plane,
  Stamp,
  Ticket,
  Truck,
  UsersRound,
} from '@lucide/vue'
import type { Component } from 'vue'

export const REASON_ICONS: Record<string, Component> = {
  vehicle_class_upgrade: CarFront,
  car_estate: Package,
  car_automatic_preferred: Cog,
  car_automatic_required: Cog,
  car_diesel: Fuel,
  car_foreign_travel: Globe,
  car_delivery: Truck,
  car_collection: MapPin,
  train_saver_fare: Ticket,
  train_separate_tickets: UsersRound,
  flight: Plane,
  over_threshold: Banknote,
  executive_step: Stamp,
}
