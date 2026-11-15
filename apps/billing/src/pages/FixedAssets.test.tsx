/**
 * Fixed Assets page tests.
 *
 * The backend (src/collections/FixedAssets/index.ts) is fully implemented —
 * this page is the SPA surface for it. These tests pin the parts that are
 * easy to break: the register fetch, the straight-line depreciation helper
 * (which must mirror the server engine), the depreciation POST, and the
 * create/edit form payload.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import FixedAssetsPage, { monthlyDepreciation } from './FixedAssets'
import { renderWithProviders } from '../test/testUtils'

const apiMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    api: apiMock,
    useSyncState: () => ({ cacheVersion: 0, online: true, syncingCount: 0, lastSyncAt: null }),
  }
})
vi.mock('../lib/toast', () => ({ pushToast: vi.fn() }))
vi.mock('../lib/tenant', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/tenant')>()
  return {
    ...actual,
    useTenant: () => ({
      tenantId: '',
      setTenantId: vi.fn(),
      tenants: [],
      isCentral: false,
      isIllaka: false,
      illakaCode: null,
    }),
    useTenantQuery: () => ({}),
  }
})

const REGISTER = {
  docs: [
    {
      id: 1,
      code: 'FA-001',
      name: 'Projector — Hall A',
      category: 'equipment',
      location: 'Hall A',
      status: 'active',
      purchaseDate: '2026-01-15',
      purchaseCost: 120000,
      salvageValue: 20000,
      usefulLifeYears: 5,
      accumulatedDepreciation: 20000,
      netBookValue: 100000,
      depreciatedPct: 20,
    },
  ],
  totals: {
    cost: 120000,
    accumulatedDepreciation: 20000,
    netBookValue: 100000,
  },
}

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockImplementation(async (url: string, options?: { method?: string }) => {
    if (url === '/fixed-assets/register') return REGISTER
    if (options?.method === 'POST' && url.endsWith('/depreciate')) {
      return {
        postings: 2,
        totalAmount: 3333.33,
        accumulatedDepreciation: 26666.66,
        netBookValue: 93333.34,
      }
    }
    if (options?.method === 'POST') return { id: 2 }
    if (options?.method === 'PATCH') return { id: 1 }
    if (options?.method === 'DELETE') return { id: 1 }
    throw new Error(`unexpected url ${url}`)
  })
})

describe('monthlyDepreciation', () => {
  it('computes straight-line monthly depreciation as (cost - salvage) / (years * 12)', () => {
    // Mirrors the server engine: (120000 - 20000) / (5 * 12) = 1666.67
    expect(monthlyDepreciation(120000, 20000, 5)).toBeCloseTo(1666.6667, 3)
  })

  it('handles a fractional useful life', () => {
    expect(monthlyDepreciation(12000, 0, 0.5)).toBeCloseTo(2000, 6)
  })

  it('returns null when the useful life is zero or negative', () => {
    expect(monthlyDepreciation(100000, 0, 0)).toBeNull()
    expect(monthlyDepreciation(100000, 0, -3)).toBeNull()
  })

  it('returns null when the asset has no depreciable base (cost <= salvage)', () => {
    expect(monthlyDepreciation(10000, 10000, 5)).toBeNull()
    expect(monthlyDepreciation(5000, 10000, 5)).toBeNull()
  })

  it('never depreciates below zero when salvage exceeds cost', () => {
    expect(monthlyDepreciation(5000, 10000, 5)).toBeNull()
  })
})

describe('Fixed Assets page', () => {
  it('loads the register and renders the asset with its book values', async () => {
    renderWithProviders(<FixedAssetsPage />)

    expect(await screen.findByText('Projector — Hall A')).toBeInTheDocument()
    expect(screen.getByText('FA-001')).toBeInTheDocument()
    // Totals card.
    expect(screen.getByText('Total Cost')).toBeInTheDocument()
    expect(screen.getAllByText('Net Book Value').length).toBeGreaterThan(0)
    // 20% depreciated.
    expect(screen.getByText('20.0%')).toBeInTheDocument()

    expect(apiMock).toHaveBeenCalledWith(
      '/fixed-assets/register',
      expect.objectContaining({ query: expect.any(Object) }),
    )
  })

  it('posts depreciation for the asset when the Depreciate action is used', async () => {
    renderWithProviders(<FixedAssetsPage />)
    await screen.findByText('Projector — Hall A')

    fireEvent.click(screen.getByRole('button', { name: 'Depreciate' }))

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/fixed-assets/1/depreciate',
        expect.objectContaining({ method: 'POST', immediate: true }),
      ),
    )
  })

  it('opens the new-asset form and posts the entered values', async () => {
    renderWithProviders(<FixedAssetsPage />)
    await screen.findByText('Projector — Hall A')

    fireEvent.click(screen.getByRole('button', { name: /New asset/i }))

    const nameInput = await screen.findByLabelText(/Name/i)
    fireEvent.change(nameInput, { target: { value: 'Delivery Van' } })

    const costInput = screen.getByLabelText(/Purchase Cost/i)
    fireEvent.change(costInput, { target: { value: '800000' } })

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/fixed-assets',
        expect.objectContaining({
          method: 'POST',
          immediate: true,
          body: expect.objectContaining({ name: 'Delivery Van', purchaseCost: 800000 }),
        }),
      ),
    )
  })

  it('shows an empty state when the register has no assets', async () => {
    apiMock.mockImplementation(async (url: string) => {
      if (url === '/fixed-assets/register') return { docs: [], totals: null }
      throw new Error(`unexpected url ${url}`)
    })

    renderWithProviders(<FixedAssetsPage />)

    expect(await screen.findByText('No fixed assets yet.')).toBeInTheDocument()
  })

  it('surfaces a load failure instead of rendering an empty table silently', async () => {
    apiMock.mockImplementation(async (url: string) => {
      if (url === '/fixed-assets/register') throw new Error('Depreciation accounts are not configured.')
      throw new Error(`unexpected url ${url}`)
    })

    renderWithProviders(<FixedAssetsPage />)

    expect(await screen.findByText(/Depreciation accounts are not configured/)).toBeInTheDocument()
  })
})
