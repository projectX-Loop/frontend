import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlanInputs } from './client'

const inputs: PlanInputs = {
  goal: { amount: 50_000_000, horizon_months: 60 }, funds: { initial: 10_000_000, monthly: 600_000 },
  alloc: { initial: { invest: 70, safe: 30, other: 0 }, monthly: { invest: 50, safe: 40, other: 10 } },
  portfolio: { assets: [{ code: 'KR_EQ', weight: 100 }] }, rebalancing: { focus: 'Q' },
}

describe('public API client', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_USE_MOCK', '0')
    vi.stubEnv('VITE_API_BASE', '/api/v1')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })))
  })

  afterEach(() => vi.unstubAllEnvs())

  it('uses the same-origin base path for the four completed APIs', async () => {
    const { api } = await import('./client')
    await api.universe()
    await api.samples()
    await api.createPlan(inputs)
    await api.getPlan('plan-uuid')

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/universe', expect.objectContaining({ method: 'GET' }))
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/samples', expect.objectContaining({ method: 'GET' }))
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/v1/plans', expect.objectContaining({ method: 'POST', body: JSON.stringify(inputs) }))
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/v1/plans/plan-uuid', expect.objectContaining({ method: 'GET' }))
  })
})
