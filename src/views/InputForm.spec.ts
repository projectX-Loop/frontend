import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InputForm from './InputForm.vue'
import { api, type PlanInputs, type UniverseResponse } from '../api/client'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return { ...actual, api: { ...actual.api, universe: vi.fn(), samples: vi.fn() } }
})

const inputs: PlanInputs = {
  goal: { amount: 50_000_000, horizon_months: 60 }, funds: { initial: 10_000_000, monthly: 600_000 },
  alloc: { initial: { invest: 70, safe: 30, other: 0 }, monthly: { invest: 50, safe: 40, other: 10 } },
  portfolio: { assets: [{ code: 'KR_EQ', weight: 100 }] }, rebalancing: { focus: 'Q' },
}

describe('InputForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.universe).mockResolvedValue({
      snapshot: { data_version: 'test', data_hash: 'sha256:test', window: { start: '2020-01', end: '2024-12', months: 60 } },
      assets: [],
    })
    vi.mocked(api.samples).mockResolvedValue({ samples: [] } as never)
  })

  it('shows server field errors next to the matching input', () => {
    const wrapper = mount(InputForm, {
      props: { modelValue: inputs, serverErrors: { 'goal.amount': '목표 금액을 다시 확인하세요.' } },
    })
    expect(wrapper.text()).toContain('목표 금액을 다시 확인하세요.')
  })

  it('renders the current universe contract without group or a snapshot safe rate', async () => {
    const universe: UniverseResponse = {
      snapshot: { data_version: '2026-09-02', data_hash: 'sha256:test', window: { start: '2021-08', end: '2026-07', months: 60 } },
      assets: [{ code: 'KR_EQ', display_name: 'KODEX 200', instrument: '069500', tax_class: 'domestic' }],
    }
    vi.mocked(api.universe).mockResolvedValue(universe)
    vi.mocked(api.samples).mockResolvedValue({ samples: [] } as never)

    const wrapper = mount(InputForm, { props: { modelValue: inputs } })
    await flushPromises()

    expect(wrapper.find('select').findAll('option')).toHaveLength(2)
    expect(wrapper.text()).toContain('데이터 기준 2021-08~2026-07')
    expect(wrapper.text()).not.toContain('안전저축 연')
  })
})
