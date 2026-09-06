import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  universe: vi.fn(), samples: vi.fn(), createPlan: vi.fn(), getPlan: vi.fn(), explain: vi.fn(),
}))

vi.mock('./api/client', () => ({
  api,
  ApiError: class ApiError extends Error {},
  isMock: false,
  isRagEnabled: false,
}))

import App from './App.vue'

const plan = {
  plan: {
    public_id: 'e4bf2b5e-11ec-4c4b-a4bf-a9f5344a44c1',
    inputs: { rebalancing: { focus: 'Q' } },
  },
  calculation: {},
}
const stubs = {
  InputForm: { props: ['modelValue'], emits: ['submit'], template: '<button data-test="calculate" @click="$emit(\'submit\', modelValue)">calculate</button>' },
  ResultView: { props: ['plan'], template: '<div data-test="result">{{ plan.plan.public_id }}</div>' },
  ExplanationPanel: { template: '<div data-test="explanation" />' },
}

describe('App result recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('scrollTo', vi.fn())
    window.history.replaceState({}, '', '/')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('loads a result from the plan query parameter', async () => {
    window.history.replaceState({}, '', '/?plan=e4bf2b5e-11ec-4c4b-a4bf-a9f5344a44c1')
    api.getPlan.mockResolvedValue(plan)

    const wrapper = mount(App, { global: { stubs } })
    await flushPromises()

    expect(api.getPlan).toHaveBeenCalledWith('e4bf2b5e-11ec-4c4b-a4bf-a9f5344a44c1')
    expect(wrapper.get('[data-test="result"]').text()).toContain(plan.plan.public_id)
  })

  it('updates the URL after a calculation and does not call RAG while disabled', async () => {
    api.createPlan.mockResolvedValue(plan)
    const wrapper = mount(App, { global: { stubs } })
    await wrapper.get('[data-test="calculate"]').trigger('click')
    await flushPromises()

    expect(window.location.search).toBe(`?plan=${plan.plan.public_id}`)
    expect(api.explain).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="explanation"]').exists()).toBe(false)
  })
})
