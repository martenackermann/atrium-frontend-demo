<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/vue'
import type { DateValue } from '@internationalized/date'
import {
  DatePickerCalendar,
  DatePickerCell,
  DatePickerCellTrigger,
  DatePickerContent,
  DatePickerField,
  DatePickerGrid,
  DatePickerGridBody,
  DatePickerGridHead,
  DatePickerGridRow,
  DatePickerHeadCell,
  DatePickerHeader,
  DatePickerHeading,
  DatePickerInput,
  DatePickerNext,
  DatePickerPrev,
  DatePickerRoot,
  DatePickerTrigger,
} from 'reka-ui'
import {
  calendarDateTimeToIso,
  calendarDateToIso,
  isoToCalendarDate,
  isoToCalendarDateTime,
} from '~/lib/dates'
import { useFieldContext } from '~/lib/field'
import { cn } from '~/lib/cn'

/**
 * DatePicker (DESIGN §9): segmented field (day month year, 24h time) + calendar popover; today
 * ringed, weekends muted, en-GB order. v-model is an IsoDate ('2026-10-21'), or an IsoDateTime
 * (UTC) with `time`.
 */
const props = defineProps<{
  time?: boolean
  min?: string | null
  max?: string | null
  invalid?: boolean
  disabled?: boolean
  id?: string
  class?: HTMLAttributes['class']
}>()
const model = defineModel<string | null | undefined>()
const field = useFieldContext()
const isInvalid = computed(() => props.invalid ?? field?.invalid.value ?? false)

const value = computed<DateValue | undefined>({
  get: () => (props.time ? isoToCalendarDateTime(model.value) : isoToCalendarDate(model.value)),
  set: (next) => {
    model.value = props.time ? calendarDateTimeToIso(next) : calendarDateToIso(next)
  },
})
const minValue = computed(() => isoToCalendarDate(props.min))
const maxValue = computed(() => isoToCalendarDate(props.max))
</script>

<template>
  <DatePickerRoot
    :id="id ?? field?.id"
    v-model="value"
    locale="en-GB"
    :hour-cycle="24"
    :granularity="time ? 'minute' : 'day'"
    :week-starts-on="1"
    :min-value="minValue"
    :max-value="maxValue"
    :disabled="disabled"
    fixed-weeks
  >
    <DatePickerField
      v-slot="{ segments }"
      :aria-invalid="isInvalid || undefined"
      :aria-describedby="field?.describedBy.value"
      :class="
        cn(
          'flex h-[38px] w-full items-center rounded-md border bg-sheet pr-1 pl-3 text-base text-ink',
          'transition-[border-color,box-shadow] duration-(--dur-1) ease-standard hover:border-ink-muted',
          'focus-within:border-ink focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--focus)_28%,transparent)]',
          'data-disabled:bg-well data-disabled:text-ink-disabled',
          isInvalid ? 'border-st-negative' : 'border-field',
          props.class,
        )
      "
    >
      <div class="flex flex-1 items-center">
        <template v-for="item in segments" :key="item.part">
          <DatePickerInput
            v-if="item.part === 'literal'"
            :part="item.part"
            class="text-ink-subtle"
            >{{ item.value }}</DatePickerInput
          >
          <DatePickerInput
            v-else
            :part="item.part"
            class="rounded-xs px-0.5 tabular-nums outline-none focus:bg-marker-tint focus:text-ink data-placeholder:text-ink-subtle"
            >{{ item.value }}</DatePickerInput
          >
        </template>
      </div>
      <DatePickerTrigger
        class="grid size-8 place-items-center rounded-md text-ink-subtle hover:bg-hover hover:text-ink"
        aria-label="Open calendar"
      >
        <CalendarDays class="size-4" aria-hidden="true" />
      </DatePickerTrigger>
    </DatePickerField>

    <DatePickerContent
      :side-offset="4"
      align="start"
      class="z-[60] rounded-lg border border-rule bg-raised p-3 shadow-pop data-[state=open]:animate-[atrium-menu-in_var(--dur-2)_var(--curve-out)]"
    >
      <DatePickerCalendar v-slot="{ weekDays, grid }">
        <DatePickerHeader class="mb-2 flex items-center justify-between">
          <DatePickerPrev
            class="grid size-8 place-items-center rounded-md hover:bg-hover"
            aria-label="Previous month"
          >
            <ChevronLeft class="size-4" aria-hidden="true" />
          </DatePickerPrev>
          <DatePickerHeading class="text-base font-semibold" />
          <DatePickerNext
            class="grid size-8 place-items-center rounded-md hover:bg-hover"
            aria-label="Next month"
          >
            <ChevronRight class="size-4" aria-hidden="true" />
          </DatePickerNext>
        </DatePickerHeader>
        <DatePickerGrid v-for="month in grid" :key="month.value.toString()" class="border-collapse">
          <DatePickerGridHead>
            <DatePickerGridRow class="grid grid-cols-7">
              <DatePickerHeadCell
                v-for="day in weekDays"
                :key="day"
                class="pb-1 text-center text-meta font-semibold text-ink-subtle"
                >{{ day }}</DatePickerHeadCell
              >
            </DatePickerGridRow>
          </DatePickerGridHead>
          <DatePickerGridBody>
            <DatePickerGridRow
              v-for="(weekDates, index) in month.rows"
              :key="`week-${index}`"
              class="grid grid-cols-7"
            >
              <DatePickerCell
                v-for="weekDate in weekDates"
                :key="weekDate.toString()"
                :date="weekDate"
              >
                <DatePickerCellTrigger
                  :day="weekDate"
                  :month="month.value"
                  class="grid size-9 place-items-center rounded-md text-base tabular-nums outline-none hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus data-disabled:text-ink-disabled data-outside-view:text-ink-disabled data-selected:bg-primary data-selected:text-primary-ink data-today:shadow-[inset_0_0_0_1px_var(--ink)] data-unavailable:line-through"
                />
              </DatePickerCell>
            </DatePickerGridRow>
          </DatePickerGridBody>
        </DatePickerGrid>
      </DatePickerCalendar>
    </DatePickerContent>
  </DatePickerRoot>
</template>
