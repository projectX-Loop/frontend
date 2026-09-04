<script setup lang="ts">
/**
 * 흐름: 입력 → POST /plans(계산) → 결과 화면 → POST /plans/{id}/explanation(설명, 별도 호출).
 * 계산과 설명을 분리하는 이유: LLM 이 죽어도 결과 화면은 떠야 한다 (KAN-4 결정).
 */
import { ref } from 'vue'
import { api, ApiError, isMock, type PlanInputs, type PlanResponse, type ExplanationResponse, type Period } from './api/client'
import InputForm from './views/InputForm.vue'
import ResultView from './views/ResultView.vue'
import ExplanationPanel from './components/ExplanationPanel.vue'

const inputs = ref<PlanInputs>({
  goal: { amount: 50_000_000, horizon_months: 60 }, funds: { initial: 10_000_000, monthly: 600_000 },
  alloc: { initial: { invest: 70, safe: 30, other: 0 }, monthly: { invest: 50, safe: 40, other: 10 } },
  portfolio: { assets: [{ code: 'KR_EQ', weight: 40 }, { code: 'US_EQ', weight: 40 }, { code: 'KR_BOND', weight: 20 }] },
  rebalancing: { focus: 'Q' },
})
const step = ref<'input' | 'result'>('input')
const busy = ref(false)
const topError = ref<{ text: string; retryable: boolean } | null>(null)
const fieldErrors = ref<Record<string, string>>({})
const plan = ref<PlanResponse | null>(null)
const expl = ref<ExplanationResponse | null>(null)
const explState = ref<'idle' | 'loading' | 'done'>('idle')

async function calculate(v: PlanInputs) {
  busy.value = true; topError.value = null; fieldErrors.value = {}
  try {
    plan.value = await api.createPlan(v); step.value = 'result'; window.scrollTo(0, 0)
    void explain()
  } catch (e) {
    if (e instanceof ApiError) { fieldErrors.value = e.fieldErrors(); topError.value = { text: `${e.envelope.message} (${e.envelope.code})`, retryable: e.envelope.retryable } }
    else topError.value = { text: '서버에 연결할 수 없습니다.', retryable: true }
  } finally { busy.value = false }
}
async function explain() {
  if (!plan.value) return
  explState.value = 'loading'; expl.value = null
  try { expl.value = await api.explain(plan.value.plan.public_id) }
  catch (e) { expl.value = { status: 'EXPLANATION_UNAVAILABLE', explanation: null, message: e instanceof ApiError ? e.envelope.message : 'AI 설명을 잠시 사용할 수 없습니다.' } }
  finally { explState.value = 'done' }
}
function back() { step.value = 'input'; explState.value = 'idle'; expl.value = null }
</script>

<template>
  <div class="topbar">
    <div><h1>Loop — 리밸런싱 주기 비교</h1><div class="sub">목표·자금·포트폴리오를 넣으면 월·분기·반기 리밸런싱을 과거 구간에서 재생해 비교합니다.</div></div>
    <span v-if="isMock" class="tag">목 데이터</span>
  </div>
  <div v-if="topError" class="banner" :class="topError.retryable ? 'warn' : 'bad'">{{ topError.text }}</div>

  <InputForm v-if="step === 'input'" v-model="inputs" :server-errors="fieldErrors" :busy="busy" @submit="calculate" />

  <template v-else-if="plan">
    <div class="actions" style="justify-content:flex-start;margin-bottom:12px"><button @click="back">← 조건 수정</button></div>
    <ResultView :plan="plan" />
    <ExplanationPanel :state="explState" :resp="expl" :focus="(plan.plan.inputs.rebalancing?.focus as Period) ?? 'Q'" @retry="explain" />
  </template>
</template>
