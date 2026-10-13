<script setup lang="ts">
import type { Address } from '~/types/api'
import type { FactItem } from '~/types/ui'
import type { TravelRequestDetail } from '../api/types'
import { countryName } from '../constants'

/**
 * The kind sections of a travel request (SCREENS §5.4): car (vehicle, equipment, countries,
 * handover/drop-off, driver or the privacy note, special-equipment reason), train (journey,
 * travellers, tickets) or flight (legs), then costs. Fact grids with an ink top rule (DESIGN §8.3).
 */
const props = defineProps<{
  request: TravelRequestDetail
  columns?: 2 | 3
  /** Hide the quoted special-equipment reason (already shown in a reasons box). */
  hideQuote?: boolean
}>()

const addressLine = (address: Address | null) =>
  address
    ? `${address.street} ${address.houseNumber}, ${address.postalCode} ${address.city} (${address.countryCode})`
    : null

const carFacts = computed<FactItem[]>(() => {
  const car = props.request.car
  if (!car) return []
  const gearbox = car.equipment.automaticRequired
    ? 'automatic guaranteed'
    : car.equipment.automaticPreferred
      ? 'automatic preferred'
      : 'manual gearbox'
  const extras = [
    car.equipment.estate && 'estate',
    car.equipment.diesel && 'diesel',
    car.equipment.navigation && 'navigation',
    car.equipment.winterTyres && 'winter tyres',
    car.equipment.childSeat && 'child seat',
  ].filter(Boolean) as string[]
  const facts: FactItem[] = [
    {
      label: 'Pick-up',
      value: formatDateTime(car.pickupAt),
      detail: `Return ${formatDateTime(car.returnAt)}`,
    },
    {
      label: 'Handover',
      value:
        car.handover.mode === 'branch'
          ? `${car.handover.branch} branch`
          : 'Delivered to an address',
      detail: car.handover.mode === 'delivery' ? addressLine(car.handover.address) : null,
    },
    {
      label: 'Drop-off',
      value:
        car.dropOff.mode === 'branch'
          ? car.dropOff.branch === car.handover.branch && car.handover.mode === 'branch'
            ? 'Same branch'
            : `${car.dropOff.branch} branch`
          : 'Collected from an address',
      detail: car.dropOff.mode === 'collection' ? addressLine(car.dropOff.address) : null,
    },
    {
      label: car.vehicleType === 'van' ? 'Van' : 'Vehicle',
      value: `${car.carClass.name} ${car.carClass.code}, ${gearbox}`,
      detail: extras.length
        ? extras.join(', ').replace(/^./, (c) => c.toUpperCase())
        : car.carClass.isDefault
          ? 'Standard class'
          : 'Above the standard class',
    },
    { label: 'Destination', value: car.destination },
  ]
  if (car.foreignCountries.length) {
    facts.push({ label: 'Abroad', value: car.foreignCountries.map(countryName).join(', ') })
  }
  if (car.expectedKmPerDay) {
    facts.push({ label: 'Distance', value: `About ${car.expectedKmPerDay} km a day` })
  }
  if (car.minPayloadKg) facts.push({ label: 'Min. payload', value: `${car.minPayloadKg} kg` })
  return facts
})

const driverFacts = computed<FactItem[]>(() => {
  const driver = props.request.car?.driver
  if (!driver) return []
  return [
    {
      label: 'Driver',
      value: `${driver.firstName} ${driver.lastName}`,
      detail: driver.email,
    },
    { label: 'Phone', value: driver.phone },
    {
      label: 'Born',
      value: formatDate(driver.birthDate, { weekday: false, year: 'always' }),
      detail: driver.licenceNumber ? `Licence ${driver.licenceNumber}` : null,
    },
    ...(driver.additionalDrivers
      ? [{ label: 'Additional drivers', value: driver.additionalDrivers }]
      : []),
  ]
})

const trainFacts = computed<FactItem[]>(() => {
  const train = props.request.train
  if (!train) return []
  const stations = [train.fromStation, train.viaStation, train.toStation]
    .filter(Boolean)
    .join(' → ')
  return [
    { label: 'Outbound', value: formatDateTime(train.outboundAt), detail: stations },
    {
      label: 'Return',
      value: train.returnAt ? formatDateTime(train.returnAt) : 'One way',
      detail: train.returnAt
        ? [train.toStation, train.viaStation, train.fromStation].filter(Boolean).join(' → ')
        : null,
    },
    {
      label: 'Fare',
      value: train.fareType === 'saver' ? 'Saver fare (non-refundable)' : 'Flex fare',
      detail: train.separateTickets ? 'Separate tickets per traveller' : 'One ticket',
    },
    {
      label: 'Seats',
      value: train.seatReservations ? `${train.seatReservations} reserved` : 'No seat reservation',
      detail: train.localTransportTicket ? 'With local transport ticket' : null,
    },
    {
      label: 'Travellers',
      value: [props.request.traveller, ...train.companions].map((u) => u.displayName).join(', '),
      detail: train.companions.length
        ? `${train.companions.length + 1} people on one booking`
        : null,
    },
    ...(train.notes ? [{ label: 'Notes', value: train.notes }] : []),
  ]
})

const flightFacts = computed<FactItem[]>(() => {
  const flight = props.request.flight
  if (!flight) return []
  return [
    {
      label: 'Outbound',
      value: formatDateTime(flight.outboundDepartureAt),
      detail: `${flight.outboundFrom} → ${flight.outboundTo}`,
    },
    {
      label: 'Return',
      value: flight.returnDepartureAt ? formatDateTime(flight.returnDepartureAt) : 'One way',
      detail: flight.returnDepartureAt ? `${flight.returnFrom} → ${flight.returnTo}` : null,
    },
    {
      label: 'Luggage',
      value: flight.handLuggageOnly ? 'Hand luggage only' : 'Checked baggage allowed',
    },
    ...(flight.notes ? [{ label: 'Notes', value: flight.notes }] : []),
  ]
})

const costFacts = computed<FactItem[]>(() => [
  {
    label: 'Cost centre',
    value: props.request.costCenter.code,
    mono: true,
    detail: props.request.costCenterReason
      ? `${props.request.costCenter.name} · ${props.request.costCenterReason}`
      : props.request.costCenter.name,
  },
  {
    label: 'Recharge',
    value: props.request.recharge ? props.request.recharge.customer : 'No recharge',
    detail: props.request.recharge ? `Project ${props.request.recharge.projectNumber}` : null,
  },
  {
    label: 'Requested by',
    value: props.request.requester.displayName,
    detail: `${formatDate(props.request.createdAt)}, ${formatTime(props.request.createdAt)}`,
  },
])
</script>

<template>
  <div class="grid gap-8">
    <section v-if="request.car" aria-labelledby="facts-car">
      <h2 id="facts-car" class="mb-3 text-lg font-[650]">
        {{ request.car.vehicleType === 'van' ? 'Van rental' : 'Car rental' }}
      </h2>
      <FactGrid :items="carFacts" :columns="columns ?? 3" />
      <blockquote
        v-if="request.car.specialEquipmentReason && !hideQuote"
        class="mt-4 border-l-0 font-display text-[17px] leading-[25px] text-ink"
      >
        <span class="mb-1 block font-sans text-[12.5px] text-ink-subtle">Why this equipment</span>
        “{{ request.car.specialEquipmentReason }}”
      </blockquote>
    </section>

    <section v-if="request.car" aria-labelledby="facts-driver">
      <h2 id="facts-driver" class="mb-3 text-lg font-[650]">Driver</h2>
      <FactGrid v-if="driverFacts.length" :items="driverFacts" :columns="columns ?? 3" />
      <p v-else class="border-t border-ink pt-3 text-sm text-ink-muted">
        Driver details are only visible to the traveller, requester, approver and travel desk.
      </p>
    </section>

    <section v-if="request.train" aria-labelledby="facts-train">
      <h2 id="facts-train" class="mb-3 text-lg font-[650]">Journey and tickets</h2>
      <FactGrid :items="trainFacts" :columns="columns ?? 3" />
    </section>

    <section v-if="request.flight" aria-labelledby="facts-flight">
      <h2 id="facts-flight" class="mb-3 text-lg font-[650]">Flights</h2>
      <FactGrid :items="flightFacts" :columns="columns ?? 3" />
    </section>

    <section aria-labelledby="facts-costs">
      <h2 id="facts-costs" class="mb-3 text-lg font-[650]">Costs</h2>
      <FactGrid :items="costFacts" :columns="columns ?? 3" />
      <p v-if="request.comment" class="mt-4 text-sm text-ink-muted">
        <span class="font-semibold text-ink">Comment:</span> {{ request.comment }}
      </p>
    </section>
  </div>
</template>
