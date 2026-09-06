<script setup lang="ts">
/**
 * 결과 화면 — POST /plans 응답의 calculation (Kan-9 §5) 을 그대로 그린다. 계산·가공 없음.
 * 화면 매핑은 노션 「프론트-백엔드 계약 정리」 §2. 달성 확률 표기 금지, 금액엔 기준 구간 조건절.
 */
import { computed } from 'vue'
import type { PlanResponse, Period } from '../api/client'
import { won, manwon, pct, PERIOD_LABEL, conditional } from '../format'
import TrajectoryChart from '../components/TrajectoryChart.vue'

const props = defineProps<{ plan: PlanResponse }>()
const calc = computed(() => props.plan.calculation)
const focus = computed<Period>(() => (props.plan.plan.inputs.rebalancing?.focus as Period) ?? 'Q')
const goal = computed(() => props.plan.plan.inputs.goal.amount)
const win = computed(() => calc.value.meta.window)
const safeRate = computed(() => calc.value.meta.safe_rate_annual_pct)
const periods: Period[] = ['M', 'Q', 'H']
const pp = (p: Period) => calc.value.per_period[p]!
const gap = computed(() => pp(focus.value).gap)

/** 투자 자산 1개·투자 0% 면 M/Q/H 가 완전히 같다 → 3열 대신 1열 + 안내 (승준 D·KAN-11 유의) */
const degenerate = computed(() => {
  const fv = new Set(periods.map((p) => pp(p).gap.fv_total)); const cost = new Set(periods.map((p) => pp(p).cum_cost))
  return fv.size === 1 && cost.size === 1
})

/** 간극 문구 — gap.status · extension_status 로 분기. 개월 수를 지어내지 않는다 (승준 변경점 A) */
const gapText = computed(() => {
  const g = gap.value; const c = conditional(win.value.start, win.value.end)
  if (g.shortfall <= 0) return `${c} 목표 ${manwon(goal.value)}을 ${manwon(-g.shortfall)} 초과합니다.`
  let s = `${c} 목표 ${manwon(goal.value)}에 ${manwon(g.shortfall)} 부족합니다.`
  if (g.extra_monthly_required != null) s += ` 월 납입을 ${won(g.extra_monthly_required)} 늘리면 도달합니다.`
  if (g.extra_monthly_ratio != null && g.extra_monthly_ratio > 1) s += ` (여유자금의 ${g.extra_monthly_ratio.toFixed(1)}배라 실행이 어려울 수 있어 기간·목표 조정을 함께 보세요.)`
  return s
})
const extensionText = computed(() => {
  const g = gap.value
  if (g.shortfall <= 0) return null
  switch (g.extension_status) {
    case 'OK': return g.months_extension != null ? `납입을 유지하면 ${g.months_extension}개월 더 걸려 도달합니다.` : null
    case 'BEYOND_INPUT_LIMIT': return `데이터상 ${g.months_extension_raw}개월이면 도달하나 입력 가능 범위(12~120개월)를 넘습니다.`
    case 'BEYOND_DATA_WINDOW': return '보유 데이터 구간 내에서는 목표 도달 시점을 확인할 수 없습니다.'
    case 'SERIES_NOT_AVAILABLE': return '이 옵션 조합에서는 연장 시점을 계산할 수 없습니다.'
    default: return null
  }
})
const foreign = computed(() => (calc.value.meta.assets_used ?? []).some((a) => a.code.startsWith('US_') || a.tax_class === 'foreign_listed'))
</script>

<template>
  <div class="card">
    <div class="topbar" style="margin-bottom:6px">
      <h2 style="margin:0">목표와의 거리 <span class="tag">{{ PERIOD_LABEL[focus] }} 기준</span></h2>
      <span class="muted small">{{ calc.derived?.propensity_label }} · 전체 투자 비중 {{ pct(calc.derived?.invest_share_overall_pct, 1) }} (배분율에서 파생)</span>
    </div>
    <div class="grid3" style="margin:12px 0">
      <div class="kpi"><span class="v">{{ manwon(gap.fv_total) }}</span><span class="k">만기 총자산 ({{ win.months }}개월 뒤)</span></div>
      <div class="kpi"><span class="v" :style="gap.shortfall > 0 ? 'color:var(--bad)' : 'color:var(--good)'">{{ gap.shortfall > 0 ? '−' : '+' }}{{ manwon(Math.abs(gap.shortfall)) }}</span><span class="k">{{ gap.shortfall > 0 ? '부족' : '초과' }} (목표 {{ manwon(goal) }})</span></div>
      <div class="kpi"><span class="v">{{ won(pp(focus).cum_cost) }}</span><span class="k">누적 거래비용</span></div>
    </div>
    <p style="line-height:1.6;margin:6px 0">{{ gapText }}</p>
    <p v-if="extensionText" class="muted">{{ extensionText }}</p>
  </div>

  <div class="card">
    <h2>리밸런싱 주기 비교</h2>
    <div v-if="degenerate" class="banner info">리밸런싱할 상대 자산이 없어(투자 자산 1개 또는 투자 배분 0%) 주기를 바꿔도 결과가 같습니다.</div>
    <div class="table-wrap">
    <table>
      <thead><tr><th>주기</th><th>만기 총자산</th><th>{{ gap.shortfall > 0 ? '부족' : '초과' }}액</th><th>누적 거래비용</th><th>최대 낙폭</th><th>연환산 변동성</th><th>최대 비중 이탈</th></tr></thead>
      <tbody>
        <tr v-for="p in (degenerate ? [focus] : periods)" :key="p" :class="{ focus: p === focus }">
          <td>{{ degenerate ? '월·분기·반기 동일' : PERIOD_LABEL[p] }}</td>
          <td>{{ won(pp(p).gap.fv_total) }}</td><td>{{ won(Math.abs(pp(p).gap.shortfall)) }}</td><td>{{ won(pp(p).cum_cost) }}</td>
          <td>{{ pct(pp(p).risk.mdd_pct) }}</td><td>{{ pct(pp(p).risk.vol_annual_pct) }}</td><td>{{ pct(pp(p).risk.max_drift_pct) }}</td>
        </tr>
      </tbody>
    </table>
    </div>
    <p class="muted small" style="margin-top:8px">비교 축은 비용·이탈·낙폭입니다. 어느 주기가 낫다고 판정하지 않습니다. 주기와 비용의 관계는 목표 기간·초기 자금·납입 형태에 따라 달라집니다.</p>
    <div style="margin-top:14px"><TrajectoryChart :calc="calc" :focus="focus" :goal="goal" /></div>
  </div>

  <div class="card">
    <h2>위험 요약 <span class="muted small">({{ PERIOD_LABEL[focus] }} 기준)</span></h2>
    <div class="grid3">
      <div class="kpi"><span class="v">{{ pct(pp(focus).risk.mdd_pct) }}</span><span class="k">최대 낙폭 — 고점 대비 가장 크게 떨어진 폭</span></div>
      <div class="kpi"><span class="v">{{ pct(pp(focus).risk.worst_month_pct) }}</span><span class="k">최악의 달 수익률</span></div>
      <div class="kpi"><span class="v">{{ pct(pp(focus).risk.vol_annual_pct) }}</span><span class="k">연환산 변동성 (목표 비중 포트폴리오 기준)</span></div>
    </div>
  </div>

  <div class="card">
    <h3>데이터 기준</h3>
    <p style="margin:0 0 6px;line-height:1.6">기준 구간 <strong>{{ win.start }}~{{ win.end }}</strong> ({{ win.months }}개월)의 실제 월간 총수익률을 재생한 결과입니다. 미래 예측이나 달성 확률이 아닙니다.</p>
    <p class="muted small" style="margin:0 0 6px">{{ calc.meta.data_basis }}</p>
    <p class="muted small" style="margin:0">
      자산: <span v-for="a in calc.meta.assets_used ?? []" :key="a.code">{{ a.display_name }}<template v-if="a.instrument"> ({{ a.instrument }})</template> · </span>
      <template v-if="safeRate != null">안전저축 연 {{ safeRate.toFixed(2) }}% · </template>데이터 버전 {{ calc.meta.data_version }}
      <template v-if="foreign"> · 해외 자산은 환노출(무헤지)</template>
      <template v-if="calc.meta.options?.account == null"> · 세금 미반영</template>
    </p>
  </div>
</template>
