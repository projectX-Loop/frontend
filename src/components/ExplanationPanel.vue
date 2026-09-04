<script setup lang="ts">
/**
 * AI 설명 패널 — POST /plans/{id}/explanation. 항상 200 + status.
 * 결과 화면은 이 패널 없이도 완성돼야 한다(PRD 수용기준 2). 여기서 실패해도 위 결과는 그대로.
 */
import type { ExplanationResponse, Period } from '../api/client'
import { PERIOD_LABEL } from '../format'
const props = defineProps<{ state: 'idle' | 'loading' | 'done'; resp: ExplanationResponse | null; focus: Period }>()
const emit = defineEmits<{ (e: 'retry'): void }>()
const ADJ: Record<string, string> = {
  MONTHLY_CONTRIBUTION: '월 납입액', GOAL_HORIZON: '목표 기간', GOAL_AMOUNT: '목표 금액',
  ALLOC_MONTHLY: '월 배분율', ALLOC_INITIAL: '초기 배분율', REBALANCING_FOCUS: '리밸런싱 주기',
}
const periods: Period[] = ['M', 'Q', 'H']
</script>

<template>
  <div class="card">
    <div class="topbar" style="margin-bottom:8px">
      <h2 style="margin:0">AI 설명</h2>
      <span class="tag" v-if="state === 'loading'">생성 중 (20~60초)</span>
      <span class="tag" v-else-if="resp?.status === 'OK'">가드레일 통과</span>
    </div>

    <div v-if="state === 'loading'"><div class="skeleton" style="width:90%"></div><div class="skeleton" style="width:70%"></div><div class="skeleton" style="width:80%"></div>
      <p class="muted small">계산 결과에 있는 수치만 근거로 설명을 만들고, 근거 없는 숫자나 투자 권유는 기계가 걸러냅니다.</p></div>

    <div v-else-if="state === 'done' && resp && resp.status !== 'OK'" class="banner" :class="resp.status === 'EXPLANATION_UNAVAILABLE' ? 'warn' : 'info'">
      {{ resp.message ?? 'AI 설명을 생성하지 못했습니다. 분석 결과는 정상입니다.' }}
      <button v-if="resp.status === 'EXPLANATION_UNAVAILABLE'" class="link" @click="emit('retry')">다시 시도</button>
    </div>

    <template v-else-if="state === 'done' && resp?.explanation">
      <p style="line-height:1.6">{{ resp.explanation.summary.text }}</p>

      <h3>주기별 장단점 <span class="tag" v-if="resp.explanation.highlighted_period">강조: {{ PERIOD_LABEL[resp.explanation.highlighted_period as Period] }}</span></h3>
      <div class="pc">
        <div v-for="p in periods" :key="p" class="col" :class="{ hl: p === (resp.explanation.highlighted_period ?? focus) }">
          <strong>{{ PERIOD_LABEL[p] }}</strong>
          <ul class="clean small" style="margin-top:6px">
            <li v-for="(c, i) in resp.explanation.per_period_pros_cons[p]?.pros ?? []" :key="'p'+i" class="plus">+ {{ c.text }}</li>
            <li v-for="(c, i) in resp.explanation.per_period_pros_cons[p]?.cons ?? []" :key="'c'+i" class="minus">− {{ c.text }}</li>
          </ul>
        </div>
      </div>

      <h3 style="margin-top:14px">위험</h3>
      <ul class="clean"><li v-for="(r, i) in resp.explanation.risks" :key="i"><strong>{{ r.title }}</strong> — {{ r.detail }}</li></ul>

      <h3 style="margin-top:14px">조정해볼 수 있는 입력</h3>
      <ul class="clean"><li v-for="(a, i) in resp.explanation.next_actions" :key="i"><span class="tag">{{ ADJ[a.adjustable_input] ?? a.adjustable_input }}</span> {{ a.text }}</li></ul>

      <p class="muted small" style="margin-top:14px;line-height:1.5">{{ resp.explanation.assumptions_note.text }}</p>
    </template>
  </div>
</template>
