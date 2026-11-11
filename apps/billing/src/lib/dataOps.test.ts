import { describe, it, expect, vi, beforeEach } from 'vitest'

const invalidate = vi.fn()
vi.mock('./api', () => ({
  api: vi.fn(),
  getEngine: () => ({ invalidate }),
}))

import { api, getEngine } from './api'
import { runSeedDemo, runSeedSelective } from './dataOps'

const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runSeedSelective', () => {
  it('rejects empty seeds without calling the API', async () => {
    const res = await runSeedSelective('t1', [])
    expect(res).toEqual({ ok: false, error: 'Select at least one area to seed.' })
    expect(mockedApi).not.toHaveBeenCalled()
  })

  it('posts chosen seeds and invalidates caches on success', async () => {
    mockedApi.mockResolvedValue({
      ok: true,
      tenant: 't1',
      chart: { groups: 6, accounts: 18 },
    })
    const res = await runSeedSelective('t1', ['accountGroups', 'accounts'])
    expect(mockedApi).toHaveBeenCalledWith('/data-ops/seed-demo', {
      method: 'POST',
      immediate: true,
      body: { tenant: 't1', seeds: ['accountGroups', 'accounts'] },
    })
    expect(res).toMatchObject({ ok: true, tenant: 't1' })
    expect(invalidate).toHaveBeenCalled()
  })

  it('returns server errors instead of throwing', async () => {
    mockedApi.mockResolvedValue({
      ok: false,
      error: 'Demo data is disabled in Billing Settings → Features.',
    })
    const res = await runSeedDemo('t1')
    expect(res.ok).toBe(false)
    expect(res.error).toContain('Demo data is disabled')
  })
})

describe('getEngine wiring', () => {
  it('returns the engine used by invalidateCollections', () => {
    expect(getEngine()).toEqual({ invalidate })
  })
})
