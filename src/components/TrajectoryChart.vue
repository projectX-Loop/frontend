<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import { Chart, LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip, Filler } from 'chart.js'
import type { Calculation, Period } from '../api/client'
Chart.register(LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip, Filler)

const props = defineProps<{ calc: Calculation; focus: Period; goal: number }>()
const COLOR: Record<Period, string> = { M: '#94a3b8', Q: '#2563eb', H: '#f59e0b' }
const LABEL: Record<Period, string> = { M: '월별', Q: '분기별', H: '반기별' }

const data = computed(() => {
  const periods = (['M', 'Q', 'H'] as Period[])
  const n = props.calc.per_period[props.focus]?.trajectory?.length ?? 0
  return {
    labels: Array.from({ length: n }, (_, i) => `${i + 1}`),
    datasets: [
      ...periods.map((p) => ({
        label: LABEL[p], data: (props.calc.per_period[p]?.trajectory ?? []).map((t) => t.total),
        borderColor: COLOR[p], borderWidth: p === props.focus ? 2.5 : 1.2, pointRadius: 0, tension: 0.2,
      })),
      { label: '목표', data: Array(n).fill(props.goal), borderColor: '#b91c1c', borderDash: [6, 4], borderWidth: 1, pointRadius: 0 },
    ],
  }
})
const options = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' as const }, tooltip: { callbacks: { label: (c: any) => `${c.dataset.label}: ${Math.round(c.parsed.y).toLocaleString('ko-KR')}원` } } },
  scales: { x: { title: { display: true, text: '경과 개월' }, ticks: { maxTicksLimit: 12 } }, y: { ticks: { callback: (v: any) => `${Math.round(v / 10000).toLocaleString('ko-KR')}만` } } },
}
</script>
<template><div style="height:280px"><Line :data="data" :options="options" /></div></template>
