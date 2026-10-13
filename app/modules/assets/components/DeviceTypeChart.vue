<script setup lang="ts">
import {
  BarElement,
  CategoryScale,
  Chart,
  type ChartData,
  type ChartOptions,
  LinearScale,
  type Plugin,
  Tooltip,
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import type { AssetDashboard } from '../api/types'

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip)

/**
 * "By device type" (SCREENS §6.3, DESIGN §2.5): horizontal bars, in use vs in stock per device type,
 * direct value labels at the bar ends, 1px grid, no borders or legends (a text key instead).
 * Colours are the status tone `fg` tokens because the bars encode status. A table equivalent
 * follows for screen readers.
 */
const props = defineProps<{ rows: AssetDashboard['byDeviceType'] }>()
const theme = useTheme()

const colours = ref({ inUse: '#2b6745', inStock: '#57524a', grid: '#e9e5dc', ink: '#57524a' })
function readColours() {
  if (!import.meta.client) return
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  colours.value = {
    inUse: read('--st-positive-fg', colours.value.inUse),
    inStock: read('--st-neutral-fg', colours.value.inStock),
    grid: read('--viz-grid', colours.value.grid),
    ink: read('--ink-muted', colours.value.ink),
  }
}
onMounted(readColours)
watch(
  () => theme.resolved.value,
  () => nextTick(readColours),
)

const data = computed<ChartData<'bar'>>(() => ({
  labels: props.rows.map((row) => row.deviceType.name),
  datasets: [
    {
      label: 'In use',
      data: props.rows.map((row) => row.inUse),
      backgroundColor: colours.value.inUse,
      borderRadius: 2,
      maxBarThickness: 11,
      barPercentage: 0.85,
      categoryPercentage: 0.72,
    },
    {
      label: 'In stock',
      data: props.rows.map((row) => row.inStock),
      backgroundColor: colours.value.inStock,
      borderRadius: 2,
      maxBarThickness: 11,
      barPercentage: 0.85,
      categoryPercentage: 0.72,
    },
  ],
}))

/** Direct labels: the value at the end of each bar (DESIGN: no legends where a label fits). */
const valueLabels: Plugin<'bar'> = {
  id: 'assetValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    ctx.save()
    ctx.font = '500 12px "Schibsted Grotesk Variable", "Schibsted Grotesk", sans-serif'
    ctx.fillStyle = colours.value.ink
    ctx.textBaseline = 'middle'
    chart.data.datasets.forEach((dataset, index) => {
      chart.getDatasetMeta(index).data.forEach((bar, i) => {
        const value = dataset.data[i] as number
        const { x, y } = bar.getProps(['x', 'y'], true) as { x: number; y: number }
        ctx.fillText(String(value), x + 6, y)
      })
    })
    ctx.restore()
  },
}

const options = computed<ChartOptions<'bar'>>(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  layout: { padding: { right: 28 } },
  plugins: { legend: { display: false }, tooltip: { enabled: true } },
  scales: {
    x: {
      beginAtZero: true,
      grid: { color: colours.value.grid, lineWidth: 1 },
      border: { display: false },
      ticks: { color: colours.value.ink, precision: 0 },
    },
    y: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: colours.value.ink, font: { size: 13 } },
    },
  },
}))
const height = computed(() => `${Math.max(180, props.rows.length * 46 + 40)}px`)
</script>

<template>
  <div class="grid gap-3">
    <ul class="m-0 flex list-none gap-4 p-0 text-sm text-ink-muted" aria-hidden="true">
      <li class="inline-flex items-center gap-1.5">
        <span class="size-2.5 rounded-xs bg-st-positive" /> In use
      </li>
      <li class="inline-flex items-center gap-1.5">
        <span class="size-2.5 rounded-xs bg-st-neutral" /> In stock
      </li>
    </ul>
    <div :style="{ height }" aria-hidden="true">
      <ClientOnly>
        <Bar :data="data" :options="options" :plugins="[valueLabels]" />
      </ClientOnly>
    </div>
    <table class="sr">
      <caption>
        Devices by type: in use and in stock
      </caption>
      <thead>
        <tr>
          <th scope="col">Device type</th>
          <th scope="col">Total</th>
          <th scope="col">In use</th>
          <th scope="col">In stock</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.deviceType.id">
          <th scope="row">{{ row.deviceType.name }}</th>
          <td>{{ row.total }}</td>
          <td>{{ row.inUse }}</td>
          <td>{{ row.inStock }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
