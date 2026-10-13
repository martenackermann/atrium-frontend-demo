<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/vue'
import type { DateRange } from 'reka-ui'
import {
  DateRangePickerCalendar,
  DateRangePickerCell,
  DateRangePickerCellTrigger,
  DateRangePickerContent,
  DateRangePickerField,
  DateRangePickerGrid,
  DateRangePickerGridBody,
  DateRangePickerGridHead,
  DateRangePickerGridRow,
  DateRangePickerHeadCell,
  DateRangePickerHeader,
  DateRangePickerHeading,
  DateRangePickerInput,
  DateRangePickerNext,
  DateRangePickerPrev,
  DateRangePickerRoot,
  DateRangePickerTrigger,
} from 'reka-ui'
import { calendarDateToIso, isoToCalendarDate } from '~/lib/dates'
import { useControlSize, useFieldContext } from '~/lib/field'
import { cn } from '~/lib/cn'

/**
 * DateRange (DESIGN §9): the selected range is filled ink with a hover-tinted middle.
 * v-model is `{ start, end }` as IsoDates (either may be null).
 */
const props = withDefaults(
  defineProps<{
    invalid?: boolean
    disabled?: boolean
    id?: string
    /** Accessible name when there is no UiField label (e.g. a list filter). */
    ariaLabel?: string
    class?: HTMLAttributes['class']
  }>(),
  // `invalid` stays undefined when absent so the field context decides (Vue casts to false).
  { invalid: undefined },
)
const model = defineModel<{ start: string | null; end: string | null }>({
  default: () => ({ start: null, end: null }),
})
const field = useFieldContext()
const filterSize = useControlSize() === 'filter'
const isInvalid = computed(() => props.invalid ?? field?.invalid.value ?? false)

const value = computed<DateRange>({
  get: () => ({
    start: isoToCalendarDate(model.value.start),
    end: isoToCalendarDate(model.value.end),
  }),
  set: (range) => {
    model.value = { start: calendarDateToIso(range?.start), end: calendarDateToIso(range?.end) }
  },
})
</script>

<template>
  <DateRangePickerRoot
    :id="id ?? field?.id"
    v-model="value"
    locale="en-GB"
    :week-starts-on="1"
    :disabled="disabled"
    fixed-weeks
  >
    <DateRangePickerField
      v-slot="{ segments }"
      :aria-label="ariaLabel"
      :aria-invalid="isInvalid || undefined"
      :aria-describedby="field?.describedBy.value"
      :class="
        cn(
          'flex w-full items-center gap-1 rounded-md border bg-sheet pr-1 pl-3 text-base text-ink',
          'focus-within:border-ink focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--focus)_28%,transparent)] hover:border-ink-muted',
          filterSize ? 'h-9' : 'h-[38px]',
          'max-md:h-10',
          isInvalid ? 'border-st-negative' : 'border-field',
          props.class,
        )
      "
    >
      <template v-for="part in ['start', 'end'] as const" :key="part">
        <div class="flex items-center">
          <template v-for="item in segments[part]" :key="item.part">
            <DateRangePickerInput
              v-if="item.part === 'literal'"
              :part="item.part"
              :type="part"
              class="text-ink-subtle"
              >{{ item.value }}</DateRangePickerInput
            >
            <DateRangePickerInput
              v-else
              :part="item.part"
              :type="part"
              class="rounded-xs px-0.5 tabular-nums outline-none focus:bg-marker-tint data-placeholder:text-ink-subtle"
              >{{ item.value }}</DateRangePickerInput
            >
          </template>
        </div>
        <span v-if="part === 'start'" class="px-1 text-ink-subtle" aria-hidden="true">–</span>
      </template>
      <DateRangePickerTrigger
        class="ml-auto grid size-8 place-items-center rounded-md text-ink-subtle hover:bg-hover hover:text-ink"
        aria-label="Open calendar"
      >
        <CalendarDays class="size-4" aria-hidden="true" />
      </DateRangePickerTrigger>
    </DateRangePickerField>

    <DateRangePickerContent
      :side-offset="4"
      align="start"
      class="z-[60] rounded-lg border border-rule bg-raised p-3 shadow-pop"
    >
      <DateRangePickerCalendar v-slot="{ weekDays, grid }">
        <DateRangePickerHeader class="mb-2 flex items-center justify-between">
          <DateRangePickerPrev
            class="grid size-8 place-items-center rounded-md hover:bg-hover"
            aria-label="Previous month"
          >
            <ChevronLeft class="size-4" aria-hidden="true" />
          </DateRangePickerPrev>
          <DateRangePickerHeading class="text-base font-semibold" />
          <DateRangePickerNext
            class="grid size-8 place-items-center rounded-md hover:bg-hover"
            aria-label="Next month"
          >
            <ChevronRight class="size-4" aria-hidden="true" />
          </DateRangePickerNext>
        </DateRangePickerHeader>
        <DateRangePickerGrid v-for="month in grid" :key="month.value.toString()">
          <DateRangePickerGridHead>
            <DateRangePickerGridRow class="grid grid-cols-7">
              <DateRangePickerHeadCell
                v-for="day in weekDays"
                :key="day"
                class="pb-1 text-center text-meta font-semibold text-ink-subtle"
                >{{ day }}</DateRangePickerHeadCell
              >
            </DateRangePickerGridRow>
          </DateRangePickerGridHead>
          <DateRangePickerGridBody>
            <DateRangePickerGridRow
              v-for="(weekDates, index) in month.rows"
              :key="`week-${index}`"
              class="grid grid-cols-7"
            >
              <DateRangePickerCell
                v-for="weekDate in weekDates"
                :key="weekDate.toString()"
                :date="weekDate"
              >
                <DateRangePickerCellTrigger
                  :day="weekDate"
                  :month="month.value"
                  class="grid size-9 place-items-center rounded-md text-base tabular-nums outline-none hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus data-highlighted:bg-hover data-outside-view:text-ink-disabled data-selected:bg-hover data-selection-end:bg-primary data-selection-end:text-primary-ink data-selection-start:bg-primary data-selection-start:text-primary-ink data-today:shadow-[inset_0_0_0_1px_var(--ink)]"
                />
              </DateRangePickerCell>
            </DateRangePickerGridRow>
          </DateRangePickerGridBody>
        </DateRangePickerGrid>
      </DateRangePickerCalendar>
    </DateRangePickerContent>
  </DateRangePickerRoot>
</template>
