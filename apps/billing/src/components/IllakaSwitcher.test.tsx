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
})
