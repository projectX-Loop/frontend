import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import InputForm from './InputForm.vue'
import type { PlanInputs } from '../api/client'

vi.mock('../api/client', () => ({
  api: {
    universe: vi.fn().mockResolvedValue({
      assets: [],
      snapshot: { window: { start: '2020-01', end: '2024-12', months: 60 }, safe_rate_annual_pct: 3.5 },
    }),
    samples: vi.fn().mockResolvedValue({ samples: [] }),
  },
}))

const inputs: PlanInputs = {
  goal: { amount: 50_000_000, horizon_months: 60 }, funds: { initial: 10_000_000, monthly: 600_000 },
  alloc: { initial: { invest: 70, safe: 30, other: 0 }, monthly: { invest: 50, safe: 40, other: 10 } },
  portfolio: { assets: [{ code: 'KR_EQ', weight: 100 }] }, rebalancing: { focus: 'Q' },
}

describe('InputForm', () => {
  it('shows server field errors next to the matching input', () => {
    const wrapper = mount(InputForm, {
      props: { modelValue: inputs, serverErrors: { 'goal.amount': '목표 금액을 다시 확인하세요.' } },
    })
    expect(wrapper.text()).toContain('목표 금액을 다시 확인하세요.')
  })
})
