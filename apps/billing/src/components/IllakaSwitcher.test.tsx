/**
 * IllakaSwitcher component tests (MISSION.md M6).
 * Central dropdown vs illaka locked chip vs viewer null.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import IllakaSwitcher from './IllakaSwitcher'
import { LangContext } from '../lib/i18n'

const useTenantMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/tenant', () => ({
  useTenant: useTenantMock,
  getParentCompanies: (list: any[]) => list.filter((t: any) => t.type === 'central' || !t.parentId),
  getSubCompaniesForParent: (pId: string, list: any[]) =>
    list.filter((t: any) => String(t.parentId) === String(pId)),
}))

function renderSwitcher() {
  return render(
    <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
      <IllakaSwitcher />
    </LangContext.Provider>,
  )
}

const tenants = [
  { id: 'C00', code: 'C00', name: 'Central', type: 'central' as const },
  { id: 'IL01', code: 'IL01', name: 'Yala Illaka', type: 'illaka' as const },
]

const setTenantId = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  useTenantMock.mockReturnValue({
    tenantId: '',
    setTenantId,
    tenants,
    isCentral: true,
    isIllaka: false,
    illakaCode: null,
  })
})

describe('IllakaSwitcher', () => {
  it('renders nothing for non-central, non-illaka roles (viewer)', () => {
    useTenantMock.mockReturnValue({
      tenantId: '',
      setTenantId,
      tenants,
      isCentral: false,
      isIllaka: false,
      illakaCode: null,
    })
    const { container } = renderSwitcher()
    expect(container.innerHTML).toBe('')
  })

  it('shows the All Illakas default option for central users', () => {
    renderSwitcher()
    expect(screen.getByRole('option', { name: /All Illakas/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Central/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Yala Illaka/i })).toBeInTheDocument()
  })

  it('emits setTenantId on change', () => {
    renderSwitcher()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'IL01' } })
    expect(setTenantId).toHaveBeenCalledWith('IL01')
  })

  it('shows the locked chip for illaka-scoped users', () => {
    useTenantMock.mockReturnValue({
      tenantId: 'IL01',
      setTenantId,
      tenants,
      isCentral: false,
      isIllaka: true,
      illakaCode: 'IL01',
    })
    renderSwitcher()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByText('Yala Illaka')).toBeInTheDocument()
  })

  it('falls back to the All option when the tenant id is unknown', () => {
    useTenantMock.mockReturnValue({
      tenantId: 'GONE',
      setTenantId,
      tenants,
      isCentral: true,
      isIllaka: false,
      illakaCode: null,
    })
    renderSwitcher()
    // No option matches → DOM value falls back to the first option
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument()
  })

  it('renders nothing when multiCompanyEnabled is explicitly false for central users', () => {
    useTenantMock.mockReturnValue({
      tenantId: '',
      setTenantId,
      tenants,
      isCentral: true,
      isIllaka: false,
      illakaCode: null,
      multiCompanyEnabled: false,
    })
    const { container } = renderSwitcher()
    expect(container.firstChild).toBeNull()
  })

  it('renders hierarchical parent and sub-companies correctly', () => {
    const multiTenants = [
      { id: '10', code: 'ABC', name: 'ABC company', type: 'central' as const },
      { id: '11', code: 'ABC-1', name: 'ABC sub-company -1', type: 'illaka' as const, parentId: '10' },
      { id: '12', code: 'ABC-2', name: 'ABC sub-company -2', type: 'illaka' as const, parentId: '10' },
      { id: '20', code: 'DEF', name: 'DEF company', type: 'central' as const },
      { id: '21', code: 'DEF-1', name: 'DEF sub-company -1', type: 'illaka' as const, parentId: '20' },
      { id: '22', code: 'DEF-2', name: 'DEF sub-company -2', type: 'illaka' as const, parentId: '20' },
    ]
    useTenantMock.mockReturnValue({
      tenantId: '10',
      setTenantId,
      tenants: multiTenants,
      isCentral: true,
      isIllaka: false,
      illakaCode: null,
      multiCompanyEnabled: true,
    })

    const { rerender } = renderSwitcher()

    expect(screen.getAllByText(/ABC company/).length).toBeGreaterThan(0)
    expect(screen.getByText(/ABC sub-company -1/)).toBeInTheDocument()
    expect(screen.getByText(/ABC sub-company -2/)).toBeInTheDocument()

    // Switch company to DEF
    useTenantMock.mockReturnValue({
      tenantId: '20',
      setTenantId,
      tenants: multiTenants,
      isCentral: true,
      isIllaka: false,
      illakaCode: null,
      multiCompanyEnabled: true,
    })
    rerender(
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
        <IllakaSwitcher />
      </LangContext.Provider>,
    )
    expect(screen.getAllByText(/DEF company/).length).toBeGreaterThan(0)
    expect(screen.getByText(/DEF sub-company -1/)).toBeInTheDocument()
    expect(screen.getByText(/DEF sub-company -2/)).toBeInTheDocument()
  })
})
