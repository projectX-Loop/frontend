import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ResultView from './ResultView.vue'
import planFixture from '../mocks/plans.response.P0.json'
import type { PlanResponse } from '../api/client'

const render = (plan: PlanResponse) => mount(ResultView, { props: { plan }, global: { stubs: { TrajectoryChart: true } } })

describe('ResultView', () => {
  it('does not render an invalid safe rate when calculation meta omits it', () => {
    const plan = structuredClone(planFixture) as unknown as PlanResponse
    delete (plan.calculation.meta as { safe_rate_annual_pct?: number | null }).safe_rate_annual_pct

    expect(render(plan).text()).not.toContain('undefined%')
  })
})
