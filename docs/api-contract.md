# 공개 API 계약

이 문서는 프런트엔드가 사용하는 공개 API 5개의 요청·응답 계약이다.

- 기본 경로: `/api/v1`
- 요청·응답 콘텐츠 타입: `application/json`
- 정식 타입 원본: [`src/api/types.ts`](../src/api/types.ts) (OpenAPI에서 생성됨)
- `public_id`: `POST /plans`가 반환하는 UUID이며, 이후 조회·AI 설명 요청의 경로 파라미터다.

표기: **필수**는 필드가 항상 존재함을, `null 가능`은 값이 `null`일 수 있음을 뜻한다. `선택` 필드는 응답에서 생략될 수 있다. 금액은 KRW, 비율과 퍼센트는 숫자 `%` 값이다.

## 공통 요청 스키마: `PlanInputs`

`POST /plans`의 본문이며, `/samples`의 `inputs`와 `PlanResponse.plan.inputs`에도 같은 모양으로 사용된다.

| 필드 | 타입 | 필수 | 제약 / 설명 |
| --- | --- | --- | --- |
| `goal.amount` | number | 예 | 목표 금액(KRW), 1,000,000~10,000,000,000 |
| `goal.horizon_months` | number | 예 | 목표 기간(개월), 12~120 |
| `funds.initial` | number | 예 | 초기 투자금(KRW), 음수 불가 |
| `funds.monthly` | number | 예 | 월 납입액(KRW), 음수 불가. `initial`과 동시에 0일 수 없음 |
| `alloc.initial.invest` / `.safe` / `.other` | number | 예 | 초기 자금 배분율. 각 0~100, 합계 100 |
| `alloc.monthly.invest` / `.safe` / `.other` | number | 예 | 월 납입액 배분율. 각 0~100, 합계 100 |
| `portfolio.assets` | `AssetWeight[]` | 예 | 1~3개, 자산 코드 중복 불가, 비중 합계 100 |
| `portfolio.assets[].code` | string | 예 | `/universe`가 제공한 카탈로그 코드 (`KR_EQ`, `US_EQ`, `KR_BOND`, `US_EQ_KR`) |
| `portfolio.assets[].weight` | number | 예 | 정수 %, `0 < weight ≤ 100` |
| `rebalancing.focus` | `"M" \| "Q" \| "H"` | 예 | 각각 월·분기·반기. 계산은 세 주기 모두 수행하고 이 값은 강조 대상만 결정 |

## API

### `GET /universe`

입력 폼에 표시할 자산 카탈로그와 현재 데이터 기준을 조회한다. 요청 본문·쿼리 파라미터는 없다.

| 성공 | 응답: `UniverseResponse` |
| --- | --- |
| `200` | `snapshot`, `assets[]` |

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `snapshot.data_version` | string | 예 | 데이터 버전 |
| `snapshot.data_hash` | string | 예 | 데이터 해시 |
| `snapshot.window` | object | 예 | `{ start: string, end: string, months: number }` |
| `snapshot.safe_rate_annual_pct` | number | 예 | 안전 버킷 연 금리(%) |
| `assets[]` | `UniverseAsset[]` | 예 | 선택 가능한 자산 |
| `assets[].code` | string | 예 | `PlanInputs.portfolio.assets[].code`에 전달할 코드 |
| `assets[].display_name` / `.instrument` / `.group` / `.tax_class` | string | 예 | 표시명, 종목코드, `base` 또는 `optional`, 세금 분류 |

### `GET /samples`

대표 페르소나 입력값을 조회한다. 요청 본문·쿼리 파라미터는 없다.

| 성공 | 응답: `SamplesResponse` |
| --- | --- |
| `200` | `{ samples: Sample[] }` |

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `samples[].id` | string | 예 | 샘플 식별자 (`P0` 등) |
| `samples[].label` | string | 예 | 화면 표시용 이름 |
| `samples[].inputs` | `PlanInputs` | 예 | 그대로 `POST /plans`에 보낼 수 있는 입력값 |

### `POST /plans`

입력을 저장하고 월·분기·반기 리밸런싱 시뮬레이션을 계산한다.

| 요청 본문 | 성공 | 성공 응답 |
| --- | --- | --- |
| `PlanInputs` | `201` | `PlanResponse` |

오류: `400`(입력 검증·지원하지 않는 필드·데이터 의존 오류), `500`(스냅샷 불일치), `502`(계산 실패). 본문은 모두 [공통 오류 응답](#공통-오류-응답)이다. `502 CALCULATION_FAILED`는 `public_id`를 포함하며, 해당 ID로 `GET /plans/{public_id}`를 호출해 재계산할 수 있다.

### `GET /plans/{public_id}`

저장된 입력으로 결과를 재계산한다. 요청 본문·쿼리 파라미터는 없다.

| 경로 파라미터 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `public_id` | string (UUID) | 예 | `POST /plans` 응답의 `plan.public_id` |

| 성공 | 성공 응답 | 오류 |
| --- | --- | --- |
| `200` | `PlanResponse` | `404 PLAN_NOT_FOUND`, `502 CALCULATION_FAILED` (`ErrorEnvelope`) |

### `POST /plans/{public_id}/explanation`

계산 결과를 바탕으로 AI 설명을 생성한다. 요청 본문·쿼리 파라미터는 없다.

| 경로 파라미터 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `public_id` | string (UUID) | 예 | `POST /plans` 응답의 `plan.public_id` |

| 성공 | 성공 응답 | 오류 |
| --- | --- | --- |
| `200` | `ExplanationResponse` | `404 PLAN_NOT_FOUND`, `502 EXPLANATION_UNAVAILABLE` (`ErrorEnvelope`) |

완료 처리된 AI 요청은 상태와 관계없이 `200`을 반환한다. 따라서 HTTP 상태만으로 성공을 판단하지 않는다.

| `ExplanationResponse.status` | `explanation` | `message` | 처리 |
| --- | --- | --- | --- |
| `OK` | `Explanation` | `null` | 설명을 표시 |
| `EXPLANATION_REJECTED` | `null` | string | 설명 생성 거절 문구를 표시 |
| `EXPLANATION_UNAVAILABLE` | `null` | string | 설명 불가 문구를 표시 |

## 공통 성공 응답

### `PlanResponse`

`POST /plans`와 `GET /plans/{public_id}`의 공통 성공 응답이다.

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `plan.public_id` | string (UUID) | 예 | 공개 식별자 |
| `plan.data_snapshot_id` | number | 예 | 생성 시점 데이터 스냅샷 ID |
| `plan.created_at` | string (ISO 8601) | 예 | 생성 시각 |
| `plan.inputs` | `PlanInputs` | 예 | 저장된 원본 입력 |
| `calculation.status` | string | 예 | 계산 상태 |
| `calculation.meta` | `Meta` | 예 | 데이터·가정·생성 기준 |
| `calculation.derived` | `Derived` | 선택 | 파생 지표 |
| `calculation.per_period` | `Record<"M" \| "Q" \| "H", PeriodResult>` | 예 | 주기별 계산 결과 |

`Meta`의 필수 필드는 `assumptions_version`, `data_version`, `data_hash`, `window`, `data_basis`, `generated_at`, `safe_rate_annual_pct`, `start_month`, `target_month`, `cashflow_source`, `options`다. `assets_used`, `warnings`, `series_used`는 선택이다. `safe_rate_annual_pct`와 `options`는 `null 가능`이다. `window`는 `{ start: string, end: string, months: number }`이다.

`Derived`는 `propensity_label: string`, `invest_share_overall_pct: number | null`, `plan_excluded_amount: number | null`으로 구성된다.

| `PeriodResult` 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `trajectory` | `TrajectoryPoint[]` | 선택 | 월별 자산 추이 |
| `cum_cost` | number | 예 | 누적 거래 비용 |
| `risk` | `Risk` | 예 | 위험 지표 |
| `gap` | `Gap` | 예 | 목표와의 차이 |
| `tax` | `Tax \| null` | 예 | 세금 계산 결과 |

- `TrajectoryPoint`: `month: number`, `invest: number`, `safe: number`, `total: number`
- `Risk`: `mdd_pct: number`, `vol_annual_pct: number`, `worst_month_pct: number | null`, `max_drift_pct: number | null`
- `Gap`: `fv_total`, `shortfall`은 number; `extra_monthly_required`, `months_extension`, `months_extension_raw`, `extension_status`, `extra_monthly_ratio`, `status`, `basis`, `delta_m_model`은 모두 `null 가능`
- `Tax`: `realized_cum: number | null`, `fv_after_tax: number | null`

### `Explanation`

`ExplanationResponse.status`가 `OK`일 때만 non-null이다.

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `summary` / `assumptions_note` | `Claim` | 예 | 각각 전체 요약과 가정 안내 |
| `per_period_pros_cons` | `Record<Period, ProsCons>` | 예 | M/Q/H별 장단점 |
| `risks` | `RiskClaim[]` | 예 | 위험 요인 |
| `next_actions` | `NextAction[]` | 예 | 조정 가능한 다음 행동 |
| `highlighted_period` | `Period \| null` | 예 | 요청 입력의 강조 주기 |
| `retrieved_refs` | string[] | 예 | 참조 지식 청크 목록 |

- `Claim`: `{ text: string, evidence: string[] }`
- `ProsCons`: `{ pros: Claim[], cons: Claim[] }`
- `RiskClaim`: `{ title: string, detail: string, evidence: string[] }`
- `NextAction`: `{ adjustable_input: "MONTHLY_CONTRIBUTION" | "GOAL_HORIZON" | "GOAL_AMOUNT" | "ALLOC_MONTHLY" | "ALLOC_INITIAL" | "REBALANCING_FOCUS", text: string, evidence: string[] }`

## 공통 오류 응답

모든 4xx/5xx 응답은 `ErrorEnvelope`다.

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `code` | string | 예 | `VALIDATION_ERROR`, `PLAN_NOT_FOUND`, `CALCULATION_FAILED`, `EXPLANATION_UNAVAILABLE`, `SNAPSHOT_MISMATCH` 등 |
| `message` | string | 예 | 사용자에게 표시 가능한 메시지 |
| `retryable` | boolean | 예 | `true`면 재시도 UI, `false`면 입력 수정 UI |
| `field` | string \| null | 예 | 단일 필드 오류의 점 표기 경로 |
| `errors` | `ErrorDetail[]` | 선택 | `VALIDATION_ERROR`의 세부 오류 목록 |
| `public_id` | string \| null | 예 | 계산 실패 후 재시도할 plan 식별자 |
| `max_months` | number \| null | 예 | `INSUFFICIENT_HISTORY`에서 가능한 최대 기간 |

`ErrorDetail`은 `{ code: string, field: string | null, message: string }`이다. 폼은 `errors[].field`를 입력 경로에 매핑한다.
