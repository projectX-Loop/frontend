/**
 * 공개 API 클라이언트 — 계약 원본은 ai-service/docs/openapi/public-api.openapi.json (성종현, KAN-4).
 * 타입은 그 파일에서 생성한 ./types.ts. 손으로 필드를 적지 않는다.
 *
 * VITE_USE_MOCK=1 이면 src/mocks 의 예시 JSON 을 그대로 돌려준다 — Spring 없이 화면 개발용.
 */
import type { components } from './types'

export type PlanInputs = components['schemas']['PlanInputs']
export type PlanResponse = components['schemas']['PlanResponse']
export type Calculation = components['schemas']['Calculation']
export type ExplanationResponse = components['schemas']['ExplanationResponse']
export type Explanation = components['schemas']['Explanation']
export type UniverseResponse = components['schemas']['UniverseResponse']
export type SamplesResponse = components['schemas']['SamplesResponse']
export type ErrorEnvelope = components['schemas']['ErrorEnvelope']
export type Period = 'M' | 'Q' | 'H'

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api/v1'
const USE_MOCK = import.meta.env.VITE_USE_MOCK === '1'
/** 기본 비활성. RAG 배포가 준비된 환경에서만 명시적으로 true로 켠다. */
const RAG_ENABLED = import.meta.env.VITE_ENABLE_RAG === 'true'

/** 오류 봉투 {code, message, retryable, errors[]} 를 그대로 들고 다니는 예외. 폼은 errors[].field 로 매핑한다. */
export class ApiError extends Error {
  status: number
  envelope: ErrorEnvelope
  constructor(status: number, envelope: ErrorEnvelope) {
    super(envelope.message)
    this.status = status
    this.envelope = envelope
  }
  /** field → 메시지. 예: "goal.horizon_months" → "목표 기간은 12~120개월이어야 합니다." */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const e of this.envelope.errors ?? []) if (e.field) out[e.field] = e.message
    return out
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const env: ErrorEnvelope = json?.code
      ? json
      : { code: `HTTP_${res.status}`, message: '요청을 처리하지 못했습니다.', retryable: res.status >= 500, errors: [] }
    throw new ApiError(res.status, env)
  }
  return json as T
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function mock<T>(name: string, ms = 300): Promise<T> {
  const mod = await import(`../mocks/${name}.json`)
  await delay(ms)
  return mod.default as T
}

export const api = {
  universe: (): Promise<UniverseResponse> =>
    USE_MOCK ? mock('universe.response') : request('GET', '/universe'),

  samples: (): Promise<SamplesResponse> =>
    USE_MOCK ? mock('samples.response') : request('GET', '/samples'),

  createPlan: (inputs: PlanInputs): Promise<PlanResponse> =>
    USE_MOCK ? mock('plans.response.P0', 600) : request('POST', '/plans', inputs),

  getPlan: (publicId: string): Promise<PlanResponse> =>
    USE_MOCK ? mock('plans.response.P0') : request('GET', `/plans/${publicId}`),

  /** 항상 200 + status. 생성 20~60초 → 화면은 로딩 상태를 길게 보여줄 것 */
  explain: (publicId: string): Promise<ExplanationResponse> =>
    USE_MOCK ? mock('explanation.response.ok', 1500) : request('POST', `/plans/${publicId}/explanation`),
}

export const isMock = USE_MOCK
export const isRagEnabled = RAG_ENABLED
