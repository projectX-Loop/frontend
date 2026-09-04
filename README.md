# frontend — Loop 리밸런싱 주기 비교 (9/7 MVP 웹)

Vue 3 + Vite + TypeScript. 화면 3개: **입력 폼 → 결과 화면 → AI 설명 패널**. 상태 관리 라이브러리 없음, 차트는 Chart.js.

작업 브랜치는 **`develop`** (ai-service와 같은 방침). `main`은 초기 커밋, 제출 직전 머지.

## 실행

```bash
npm install
cp .env.example .env.local        # VITE_USE_MOCK=1 → Spring 없이 예시 JSON으로 동작
npm run dev                       # http://localhost:5173
npm run build                     # dist/ → nginx 가 정적 서빙 (도윤 인프라)
```

실서버에 붙일 때: `.env.local`에서 `VITE_USE_MOCK=0`. dev 서버는 `/api` → `http://localhost:8080`(Spring)으로 프록시(`vite.config.ts`, `VITE_PROXY_TARGET`으로 변경).

## 계약은 손으로 쓰지 않는다

| 것 | 원본 | 여기 |
|---|---|---|
| API 타입 | `ai-service/docs/openapi/public-api.openapi.json` (KAN-4, 성종현) | `src/api/types.ts` — `npx openapi-typescript ../ai-service/docs/openapi/public-api.openapi.json -o src/api/types.ts` 로 재생성 |
| 목 데이터 | `ai-service/docs/openapi/examples/*.json` 13개 | `src/mocks/` 사본. 계약이 바뀌면 다시 복사 |
| 경로·상태 코드·화면 매핑 | 노션 「프론트-백엔드 계약 정리」 §1·§2·§4 (도윤) | `src/api/client.ts`, `src/views/ResultView.vue` |
| 입력 검증 코드 이름 | Kan-9 §2 (`GOAL_AMOUNT_RANGE` …) | `src/views/InputForm.vue` — 서버와 같은 이름·범위 |

## 구조

```
src/
  api/client.ts            fetch 래퍼. 오류 봉투 {code,message,retryable,errors[]} → ApiError. VITE_USE_MOCK 이면 mocks/
  api/types.ts             OpenAPI 생성 (수정 금지)
  format.ts                원·만원·% 표기, 기준 구간 조건절
  views/InputForm.vue      Kan-9 8필드 · /universe 자산 선택 · /samples 예시 채우기 · 클라이언트 검증 · 서버 errors[] 필드 매핑
  views/ResultView.vue     목표와의 거리(gap.status·extension_status 분기) · 3주기 표(퇴화 시 1열) · 추이 차트 · 위험 · 데이터 기준(필수)
  components/ExplanationPanel.vue   status OK / REJECTED / UNAVAILABLE 3상태. 실패해도 결과 화면은 유지
  components/TrajectoryChart.vue
  App.vue                  입력 → POST /plans → 결과 → POST /plans/{id}/explanation (별도 호출)
```

## 화면이 지키는 규칙 (계약에서 오는 것)

- 달성 확률 % 없음. 금액엔 "YYYY-MM~YYYY-MM 시장이 그대로 반복된다면" 조건절.
- `meta.window`·`meta.data_basis`는 항상 노출 (Kan-9 §5 "반드시 노출").
- `months_extension`·`extra_monthly_required` 가 `null`인 경우가 정상. `gap.extension_status` 로 문구 분기, 개월 수를 지어내지 않음.
- 세 주기 결과가 같으면(투자 자산 1개·투자 0%) 3열 대신 1열 + 안내.
- 포트폴리오 입력은 클라이언트 상태가 원본. 응답 `assets_used`로 폼을 덮어쓰지 않음 (승준 B-1).
- 오류는 봉투 그대로: `retryable` 이면 재시도 배너, 아니면 `errors[].field` 를 폼 필드에 표시.

## 남은 것

- **아직 실제로 못 본 것** (목 데이터가 성공 응답뿐이라): 서버 `errors[]`가 폼 필드에 붙는 화면 · UNAVAILABLE 배너와 재시도 · 부족 케이스(`shortfall > 0`) 문구 · 모바일 폭 · 새로고침 시 결과 유실(`public_id` 재조회 미구현)
- Stitch 디자인 → `src/style.css` 색·간격 반영
- Spring 연동 (9/5 합숙): `VITE_USE_MOCK=0` 후 `/plans` → `/explanation` 왕복
- (스트레치) 결과 화면 하단 "한 가지 물어보기" 단일 질문 — ai-service `/rag/ask` 합의 후. 대화형 채팅·로그인·사용자 프로필은 MVP 밖(9/2 회의·KAN-4 제외 범위)
