<script setup lang="ts">
/**
 * 흐름: 입력 → POST /plans(계산) → 결과 화면. ?plan=<UUID> 직접 접근은 GET /plans/{id}로 복구한다.
 * RAG 설명은 VITE_ENABLE_RAG=true 환경에서만 별도로 호출한다.
 */
import { onMounted, ref } from 'vue'
import { api, ApiError, isMock, isRagEnabled, type PlanInputs, type PlanResponse, type ExplanationResponse, type Period } from './api/client'
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
const restoring = ref(false)
const retryAction = ref<(() => void) | null>(null)

function setPlanUrl(publicId: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('plan', publicId)
  window.history.pushState({}, '', url)
}

function clearPlanUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete('plan')
  window.history.replaceState({}, '', url)
}

function showError(e: unknown, retry?: () => void, includeFields = false) {
  if (e instanceof ApiError) {
    if (includeFields) fieldErrors.value = e.fieldErrors()
    topError.value = { text: `${e.envelope.message} (${e.envelope.code})`, retryable: e.envelope.retryable }
    retryAction.value = e.envelope.retryable ? retry ?? null : null
  } else {
    topError.value = { text: '서버에 연결할 수 없습니다.', retryable: true }
    retryAction.value = retry ?? null
  }
}

async function calculate(v: PlanInputs) {
  busy.value = true; topError.value = null; fieldErrors.value = {}; retryAction.value = null
  try {
    plan.value = await api.createPlan(v); step.value = 'result'; setPlanUrl(plan.value.plan.public_id); window.scrollTo(0, 0)
    if (isRagEnabled) void explain()
  } catch (e) {
    showError(e, () => void calculate(v), true)
  } finally { busy.value = false }
}
async function explain() {
  if (!plan.value) return
  explState.value = 'loading'; expl.value = null
  try { expl.value = await api.explain(plan.value.plan.public_id) }
  catch (e) { expl.value = { status: 'EXPLANATION_UNAVAILABLE', explanation: null, message: e instanceof ApiError ? e.envelope.message : 'AI 설명을 잠시 사용할 수 없습니다.' } }
  finally { explState.value = 'done' }
}
async function restorePlan(publicId: string) {
  restoring.value = true; topError.value = null; retryAction.value = null
  try {
    plan.value = await api.getPlan(publicId); step.value = 'result'
    if (isRagEnabled) void explain()
  } catch (e) {
    showError(e, () => void restorePlan(publicId))
  } finally { restoring.value = false }
}

function retry() { retryAction.value?.() }
function back() { step.value = 'input'; explState.value = 'idle'; expl.value = null; topError.value = null; retryAction.value = null; clearPlanUrl() }

onMounted(() => {
  const publicId = new URLSearchParams(window.location.search).get('plan')
  if (publicId) void restorePlan(publicId)
})
</script>

<template>
  <div class="topbar">
    <div><h1>Loop — 리밸런싱 주기 비교</h1><div class="sub">목표·자금·포트폴리오를 넣으면 월·분기·반기 리밸런싱을 과거 구간에서 재생해 비교합니다.</div></div>
    <span v-if="isMock" class="tag">목 데이터</span>
  </div>
  <div v-if="topError" class="banner" :class="topError.retryable ? 'warn' : 'bad'">
    {{ topError.text }}
    <button v-if="topError.retryable && retryAction" class="link" @click="retry">다시 시도</button>
  </div>

  <div v-if="restoring" class="card">저장된 계산 결과를 불러오는 중…</div>
  <InputForm v-else-if="step === 'input'" v-model="inputs" :server-errors="fieldErrors" :busy="busy" @submit="calculate" />

  <template v-else-if="plan">
    <div class="actions" style="justify-content:flex-start;margin-bottom:12px"><button @click="back">← 조건 수정</button></div>
    <ResultView :plan="plan" />
    <ExplanationPanel v-if="isRagEnabled" :state="explState" :resp="expl" :focus="(plan.plan.inputs.rebalancing?.focus as Period) ?? 'Q'" @retry="explain" />
  </template>
</template>
