/** 표기 규칙 — 계약(Kan-9 §7)과 같다: 금액은 원 단위 정수, 큰 금액은 만원 병기. 확률·예측 표현 없음. */
export const won = (n: number | null | undefined): string =>
  n == null ? '—' : `${Math.round(n).toLocaleString('ko-KR')}원`

export const manwon = (n: number | null | undefined): string => {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs < 1_000_000) return won(n)
  const eok = Math.floor(abs / 100_000_000)
  const man = Math.round((abs % 100_000_000) / 10_000)
  const sign = n < 0 ? '-' : ''
  return eok > 0 ? `${sign}${eok}억 ${man.toLocaleString('ko-KR')}만원` : `${sign}${man.toLocaleString('ko-KR')}만원`
}

export const pct = (n: number | null | undefined, digits = 2): string =>
  n == null ? '—' : `${n.toFixed(digits)}%`

export const PERIOD_LABEL: Record<'M' | 'Q' | 'H', string> = { M: '월별', Q: '분기별', H: '반기별' }

/** 기준 구간 조건절. 금액을 말할 때 항상 붙인다 (Kan-9 규칙 5·6). */
export const conditional = (start: string, end: string) => `${start}~${end} 시장이 그대로 반복된다면`
