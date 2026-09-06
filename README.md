# frontend — Loop 리밸런싱 주기 비교 (9/7 MVP 웹)

Vue 3 + Vite + TypeScript. 기본 화면 흐름은 **입력 폼 → 결과 화면**이며, AI 설명은 feature flag로 제어한다. 상태 관리 라이브러리 없음, 차트는 Chart.js.

작업 브랜치는 **`develop`** (ai-service와 같은 방침). `main`은 초기 커밋, 제출 직전 머지.

## 실행

```bash
npm install
cp .env.example .env.local        # VITE_USE_MOCK=1 → Spring 없이 예시 JSON으로 동작
npm run dev                       # http://localhost:5173
npm run test
npm run build                     # dist/ → OCI Compute의 nginx가 정적 서빙
```

개발 서버는 `/api`를 `http://localhost:8080`으로 프록시한다(`VITE_PROXY_TARGET`으로 변경). 운영 빌드는 `.env.production`을 사용하며 mock을 끄고 브라우저가 같은 origin의 `/api/v1`만 호출한다.

## 운영 배포 (OCI Free Tier)

OCI Compute 한 대에서 nginx가 `dist/`를 제공하고 같은 VM의 Spring 백엔드로 `/api/`를 프록시한다. `deploy/nginx.conf.template`의 `__WEB_ROOT__`와 `__BACKEND_PORT__`를 실제 값으로 치환한 뒤 nginx 설정으로 설치한다.

```bash
npm ci
npm run test
npm run build
# dist/를 __WEB_ROOT__에 배치
# nginx -t && systemctl reload nginx
```

- `index.html`은 항상 재검증하도록 no-cache/no-store 헤더를 보낸다.
- Vite의 `/assets/`는 해시된 파일만 포함하므로 1년 `immutable` 캐시를 적용한다.
- `/api/` 응답은 nginx에서 `no-cache, no-store`로 제공한다. 백엔드는 `127.0.0.1:__BACKEND_PORT__`에서 실행해야 한다.
- 롤백은 이전 `dist/` 디렉터리와 이전 nginx 설정을 복원한 뒤 `nginx -t`와 reload를 다시 실행한다.

CloudFront를 앞단에 추가하는 경우 `/api/*` behavior는 GET/HEAD/OPTIONS/PUT/POST/PATCH/DELETE를 origin으로 전달하고 API 캐싱을 끈다. `Content-Type` 등 요청 헤더 전달 및 API의 `no-cache` 응답 헤더 유지도 배포 전 확인한다.

## Feature flags

| 변수 | 기본값 | 용도 |
| --- | --- | --- |
| `VITE_USE_MOCK` | `0` (production) | `1`일 때 API 대신 `src/mocks/` 응답을 사용한다. |
| `VITE_API_BASE` | `/api/v1` | 브라우저 API 기본 경로. 운영에서는 relative URL을 유지한다. |
| `VITE_ENABLE_RAG` | `false` | 정확히 `true`일 때만 AI 설명 패널과 설명 API 호출을 활성화한다. |

## 계약은 손으로 쓰지 않는다

| 것 | 원본 | 여기 |
|---|---|---|
| API 타입 | `ai-service/docs/openapi/public-api.openapi.json` (KAN-4, 성종현) | `src/api/types.ts` — `npx openapi-typescript ../ai-service/docs/openapi/public-api.openapi.json -o src/api/types.ts` 로 재생성 |
| 목 데이터 | `ai-service/docs/openapi/examples/*.json` 13개 | `src/mocks/` 사본. 계약이 바뀌면 다시 복사 |
| 경로·상태 코드·화면 매핑 | 노션 「프론트-백엔드 계약 정리」 §1·§2·§4 (도윤) | `src/api/client.ts`, `src/views/ResultView.vue` |
| 입력 검증 코드 이름 | Kan-9 §2 (`GOAL_AMOUNT_RANGE` …) | `src/views/InputForm.vue` — 서버와 같은 이름·범위 |

## 프론트가 요구하는 공개 API

기본 경로는 `/api/v1`이며, 개발 환경에서는 Vite가 `/api`를 Spring 서버로 프록시한다.

요청·성공/오류 응답의 필드, 타입, nullable 여부와 상태 코드는 [공개 API 계약](docs/api-contract.md)에서 관리한다. 정식 계약 기준은 OpenAPI에서 생성한 `src/api/types.ts`다.

| 메서드·경로 | 용도 | 프론트 사용 시점 |
|---|---|---|
| `GET /universe` | 선택 가능한 자산 목록과 데이터 기준 제공 | 입력 폼 로드 시 |
| `GET /samples` | 대표 페르소나 입력 샘플 제공 | “예시 값 채우기” 선택 시 |
| `POST /plans` | 입력 저장 및 월·분기·반기 리밸런싱 시뮬레이션 계산 | “시뮬레이션 계산” 버튼 시 |
| `GET /plans/{public_id}` | 저장된 입력으로 재계산 | 새로고침·공유 링크 대응용 (현재 UI 흐름에는 미연결) |
| `POST /plans/{public_id}/explanation` | 계산 결과 기반 AI 설명 생성 | 결과 화면 진입 후 별도 비동기 호출 |

`POST /plans` 요청 본문은 `goal`, `funds`, `alloc`, `portfolio`, `rebalancing`으로 구성한다. 오류 응답은 모두 `ErrorEnvelope`(`code`, `message`, `retryable`, `errors[]`)을 사용하며, 입력 오류의 `errors[].field`는 폼 필드에 표시한다. AI 설명 API는 HTTP 200이어도 `status`(`OK`, `EXPLANATION_REJECTED`, `EXPLANATION_UNAVAILABLE`)로 성패를 판단한다.

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
  App.vue                  입력 → POST /plans → 결과, ?plan=<UUID> → GET /plans/{id} 복구
```

## 화면이 지키는 규칙 (계약에서 오는 것)

- 달성 확률 % 없음. 금액엔 "YYYY-MM~YYYY-MM 시장이 그대로 반복된다면" 조건절.
- `meta.window`·`meta.data_basis`는 항상 노출 (Kan-9 §5 "반드시 노출").
- `months_extension`·`extra_monthly_required` 가 `null`인 경우가 정상. `gap.extension_status` 로 문구 분기, 개월 수를 지어내지 않음.
- 세 주기 결과가 같으면(투자 자산 1개·투자 0%) 3열 대신 1열 + 안내.
- 포트폴리오 입력은 클라이언트 상태가 원본. 응답 `assets_used`로 폼을 덮어쓰지 않음 (승준 B-1).
- 오류는 봉투 그대로: `retryable` 이면 재시도 배너, 아니면 `errors[].field` 를 폼 필드에 표시.

## 남은 것

- **실백엔드 확인 필요**: 서버 `errors[]`가 폼 필드에 붙는 화면 · 부족 케이스(`shortfall > 0`) 문구 · 모바일 폭 · `?plan=<UUID>` 새로고침 복구
- Stitch 디자인 → `src/style.css` 색·간격 반영
- RAG는 `VITE_ENABLE_RAG=true`와 백엔드 준비 후 별도 배포
- (스트레치) 결과 화면 하단 "한 가지 물어보기" 단일 질문 — ai-service `/rag/ask` 합의 후. 대화형 채팅·로그인·사용자 프로필은 MVP 밖(9/2 회의·KAN-4 제외 범위)
