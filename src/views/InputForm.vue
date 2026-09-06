<script setup lang="ts">
/**
 * 입력 폼 — Kan-9 §2 8필드. 검증 코드 이름은 엔진·Spring 과 같게 (GOAL_AMOUNT_RANGE …).
 * 서버 오류 봉투 errors[].field 를 그대로 필드에 붙인다.
 * 포트폴리오는 이 컴포넌트(클라이언트) 상태가 원본 — 응답의 assets_used 로 덮어쓰지 않는다 (승준 B-1).
 */
import { computed, onMounted, ref, watch } from 'vue'
/** Vue reactive 프록시는 DataCloneError 가 나므로 JSON 딥카피를 쓴다 */
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
import { api, type PlanInputs, type UniverseResponse, type SamplesResponse, type Period } from '../api/client'

const props = defineProps<{ modelValue: PlanInputs; serverErrors?: Record<string, string>; busy?: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: PlanInputs): void; (e: 'submit', v: PlanInputs): void }>()

const form = ref<PlanInputs>(clone(props.modelValue))
watch(form, (v) => emit('update:modelValue', clone(v)), { deep: true })

const universe = ref<UniverseResponse | null>(null)
const samples = ref<SamplesResponse | null>(null)
const samplesState = ref<'loading' | 'ready' | 'error'>('loading')
onMounted(() => {
  void api.universe().then((response) => { universe.value = response }).catch(() => { /* 폼은 유니버스 없이도 그려진다 */ })
  void api.samples()
    .then((response) => { samples.value = response; samplesState.value = 'ready' })
    .catch(() => { samplesState.value = 'error' })
})

/** 클라이언트 검증 — 서버(Kan-9 정적 검증)와 같은 코드·범위. 왕복 전에 잡는다. */
const errors = computed<Record<string, string>>(() => {
  const f = form.value; const e: Record<string, string> = {}
  if (!(f.goal.amount >= 1_000_000 && f.goal.amount <= 10_000_000_000)) e['goal.amount'] = '목표 금액은 100만 ~ 100억 원 (GOAL_AMOUNT_RANGE)'
  if (!(f.goal.horizon_months >= 12 && f.goal.horizon_months <= 120)) e['goal.horizon_months'] = '목표 기간은 12~120개월 (GOAL_HORIZON_RANGE)'
  if (f.funds.initial < 0) e['funds.initial'] = '0 이상 (FUNDS_INITIAL_RANGE)'
  if (f.funds.monthly < 0) e['funds.monthly'] = '0 이상 (FUNDS_MONTHLY_RANGE)'
  if (f.funds.initial === 0 && f.funds.monthly === 0) e['funds'] = '초기 자금과 월 납입이 모두 0이면 계산할 수 없습니다 (NO_FUNDS)'
  for (const k of ['initial', 'monthly'] as const) {
    const a = f.alloc[k]; const sum = a.invest + a.safe + a.other
    if ([a.invest, a.safe, a.other].some((x) => x < 0 || x > 100) || sum !== 100) e[`alloc.${k}`] = `배분율 합이 100이어야 합니다 (현재 ${sum}) (ALLOC_SUM_${k.toUpperCase()})`
  }
  const assets = f.portfolio.assets
  const investUsed = f.alloc.initial.invest > 0 || f.alloc.monthly.invest > 0
  if (investUsed) {
    if (assets.length < 1 || assets.length > 3) e['portfolio.assets'] = '자산은 1~3개 (PORTFOLIO_REQUIRED)'
    else {
      const sum = assets.reduce((s, a) => s + a.weight, 0)
      if (sum !== 100) e['portfolio.assets'] = `비중 합이 100이어야 합니다 (현재 ${sum}) (WEIGHTS_SUM)`
      if (assets.some((a) => a.weight <= 0 || a.weight > 100)) e['portfolio.assets'] = '비중은 1~100 (PORTFOLIO_WEIGHT_RANGE)'
      if (new Set(assets.map((a) => a.code)).size !== assets.length) e['portfolio.assets'] = '같은 자산을 두 번 고를 수 없습니다 (PORTFOLIO_ASSET_DUP)'
      if (assets.some((a) => !a.code)) e['portfolio.assets'] = '자산을 선택하세요'
    }
  }
  if (!['M', 'Q', 'H'].includes(f.rebalancing.focus)) e['rebalancing.focus'] = '강조 주기를 고르세요 (FOCUS_INVALID)'
  return e
})
const err = (k: string) => props.serverErrors?.[k] ?? errors.value[k]
const canSubmit = computed(() => Object.keys(errors.value).length === 0 && !props.busy)
function submit() { if (canSubmit.value) emit('submit', clone(form.value)) }

function applySample() {
  const s = samples.value?.samples?.[0]
  if (s) form.value = clone(s.inputs as PlanInputs)
}
function addAsset() { if (form.value.portfolio.assets.length < 3) form.value.portfolio.assets.push({ code: '', weight: 0 }) }
function removeAsset(i: number) { form.value.portfolio.assets.splice(i, 1) }
const periods: { v: Period; label: string; desc: string }[] = [
  { v: 'M', label: '월별', desc: '매달 목표 비중으로 복귀' }, { v: 'Q', label: '분기별', desc: '3개월마다' }, { v: 'H', label: '반기별', desc: '6개월마다' },
]
</script>

<template>
  <form @submit.prevent="submit">
    <div class="card">
      <div class="topbar">
        <h2 style="margin:0">목표와 자금</h2>
        <button type="button" class="link" @click="applySample" :disabled="samplesState !== 'ready'">
          {{ samplesState === 'ready' ? '예시 값 채우기' : samplesState === 'error' ? '예시 값을 불러오지 못했습니다' : '예시 값 불러오는 중' }}
        </button>
      </div>
      <div class="grid2">
        <div class="field"><label>목표 금액 (원)</label><input type="number" v-model.number="form.goal.amount" min="1000000" max="10000000000" step="1000000" /><div class="err" v-if="err('goal.amount')">{{ err('goal.amount') }}</div></div>
        <div class="field"><label>목표 기간 (개월, 12~120)</label><input type="number" v-model.number="form.goal.horizon_months" min="12" max="120" /><div class="err" v-if="err('goal.horizon_months')">{{ err('goal.horizon_months') }}</div></div>
        <div class="field"><label>초기 자금 (원)</label><input type="number" v-model.number="form.funds.initial" min="0" step="100000" /><div class="err" v-if="err('funds.initial')">{{ err('funds.initial') }}</div></div>
        <div class="field"><label>월 납입액 (원)</label><input type="number" v-model.number="form.funds.monthly" min="0" step="10000" /><div class="err" v-if="err('funds.monthly') || err('funds')">{{ err('funds.monthly') || err('funds') }}</div></div>
      </div>
    </div>

    <div class="card">
      <h2>자금 배분 (%)</h2>
      <p class="muted">투자 성향을 묻지 않습니다. 투자·안전·기타 배분율이 성향을 대신하고, 결과의 성향 라벨은 여기서 파생됩니다.</p>
      <div class="grid2">
        <div v-for="k in (['initial','monthly'] as const)" :key="k" class="field">
          <label>{{ k === 'initial' ? '초기 자금 배분' : '월 납입 배분' }} — 투자 / 안전(예금) / 기타</label>
          <div class="row">
            <input type="number" v-model.number="form.alloc[k].invest" min="0" max="100" placeholder="투자" />
            <input type="number" v-model.number="form.alloc[k].safe" min="0" max="100" placeholder="안전" />
            <input type="number" v-model.number="form.alloc[k].other" min="0" max="100" placeholder="기타" />
          </div>
          <div class="err" v-if="err(`alloc.${k}`)">{{ err(`alloc.${k}`) }}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>투자 포트폴리오 (최대 3개, 비중 합 100%)</h2>
      <div v-for="(a, i) in form.portfolio.assets" :key="i" class="row" style="margin-bottom:8px">
        <select v-model="a.code" style="flex:2">
          <option value="" disabled>자산 선택</option>
          <option v-for="u in universe?.assets ?? []" :key="u.code" :value="u.code">{{ u.display_name }} ({{ u.instrument }})</option>
        </select>
        <input type="number" v-model.number="a.weight" min="1" max="100" placeholder="비중 %" />
        <button type="button" @click="removeAsset(i)" style="flex:0">삭제</button>
      </div>
      <button type="button" @click="addAsset" :disabled="form.portfolio.assets.length >= 3">+ 자산 추가</button>
      <div class="err" v-if="err('portfolio.assets')">{{ err('portfolio.assets') }}</div>
      <p class="muted small" v-if="universe">데이터 기준 {{ universe.snapshot.window.start }}~{{ universe.snapshot.window.end }}</p>
    </div>

    <div class="card">
      <h2>강조할 리밸런싱 주기</h2>
      <p class="muted">세 주기는 항상 모두 계산됩니다. 고른 주기는 결과와 AI 설명에서 먼저 보여줍니다.</p>
      <div class="grid3">
        <label v-for="p in periods" :key="p.v" class="card" style="cursor:pointer;margin:0" :style="form.rebalancing.focus === p.v ? 'border-color:var(--accent);background:var(--accent-bg)' : ''">
          <input type="radio" :value="p.v" v-model="form.rebalancing.focus" style="width:auto;margin-right:6px" />{{ p.label }}<div class="small muted">{{ p.desc }}</div>
        </label>
      </div>
      <div class="err" v-if="err('rebalancing.focus')">{{ err('rebalancing.focus') }}</div>
    </div>

    <div class="actions">
      <button type="submit" class="primary" :disabled="!canSubmit">{{ busy ? '계산 중…' : '시뮬레이션 계산' }}</button>
    </div>
  </form>
</template>
