import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TenantSelector from '../TenantSelector'
import { TenantProvider } from '../../lib/tenant'
import { LangProvider } from '../../lib/i18n'

// Simple mock for useTenant
const mockUseTenant = vi.fn()
vi.mock('../../lib/tenant', () => ({
  useTenant: () => mockUseTenant(),
  TenantProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('../../lib/i18n', () => ({
  useT: vi.fn(() => (key: string, fallback?: string) => fallback || key),
  LangProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const mockTenants = [
  { id: 'C00', code: 'C00', name: 'Syasha Samaj Central', type: 'central' as const },
  { id: 'IL01', code: 'IL01', name: 'Illaka 1', type: 'illaka' as const },
  { id: 'IL02', code: 'IL02', name: 'Illaka 2', type: 'illaka' as const },
]

const renderWithProviders = (ui: React.ReactElement, options: { isCentral?: boolean; isIllaka?: boolean; tenantId?: string } = {}) => {
  const { isCentral = true, isIllaka = false, tenantId = '' } = options
  
  mockUseTenant.mockReturnValue({
    tenantId,
    setTenantId: vi.fn(),
    tenants: mockTenants,
    isCentral,
    isIllaka,
    illakaCode: isIllaka ? 'IL01' : null,
  })
  
  return render(
    <MemoryRouter>
      <LangProvider>
        <TenantProvider>
          {ui}
        </TenantProvider>
      </LangProvider>
    </MemoryRouter>
  )
}

describe('TenantSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Central User', () => {
    it('renders dropdown with current tenant', () => {
      renderWithProviders(<TenantSelector />, { isCentral: true, tenantId: 'C00' })
      
      expect(screen.getByTestId('tenant-selector')).toBeInTheDocument()
      expect(screen.getByText('Syasha Samaj Central')).toBeInTheDocument()
    })

    it('opens dropdown on click when tenant selected', async () => {
      renderWithProviders(<TenantSelector />, { isCentral: true, tenantId: 'IL01' })
      
      const button = screen.getByRole('button', { name: /illaka 1/i })
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(screen.getByRole('option', { name: /all \(consolidated\)/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /illaka 1/i })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /illaka 2/i })).toBeInTheDocument()
      })
    })

    it('closes dropdown when clicking outside', async () => {
      renderWithProviders(<TenantSelector />, { isCentral: true, tenantId: 'IL01' })
      
      fireEvent.click(screen.getByRole('button', { name: /illaka 1/i }))
      await waitFor(() => expect(screen.getByRole('option', { name: /illaka 1/i })).toBeInTheDocument())
      
      // Click backdrop - the dropdown has a backdrop div
      const backdrop = screen.getByTestId('dropdown-backdrop')
      fireEvent.click(backdrop)
      
      await waitFor(() => {
        expect(screen.queryByRole('option', { name: /illaka 1/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('Illaka User', () => {
    it('renders locked chip with illaka code', () => {
      renderWithProviders(<TenantSelector />, { isCentral: false, isIllaka: true, tenantId: 'IL01' })
      
      expect(screen.getByTestId('tenant-chip')).toBeInTheDocument()
      expect(screen.getByText(/current:.*il01/i)).toBeInTheDocument()
      expect(screen.getByText(/locked/i)).toBeInTheDocument()
    })

    it('does not show dropdown', () => {
      renderWithProviders(<TenantSelector />, { isCentral: false, isIllaka: true })
      
      expect(screen.queryByTestId('tenant-selector')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderWithProviders(<TenantSelector />, { isCentral: true, tenantId: 'IL01' })
      
      const button = screen.getByRole('button', { name: /illaka 1/i })
      expect(button).toHaveAttribute('aria-haspopup', 'listbox')
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })

    it('updates aria-expanded when open', async () => {
      renderWithProviders(<TenantSelector />, { isCentral: true, tenantId: 'IL01' })
      
      const button = screen.getByRole('button', { name: /illaka 1/i })
      expect(button).toHaveAttribute('aria-expanded', 'false')
      
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'true')
      })
    })

    it('options have role="option" and aria-selected', async () => {
      renderWithProviders(<TenantSelector />, { isCentral: true, tenantId: 'IL01' })
      
      fireEvent.click(screen.getByRole('button', { name: /illaka 1/i }))
      
      await waitFor(() => {
        const illaka1 = screen.getByRole('option', { name: /illaka 1/i })
        expect(illaka1).toHaveAttribute('aria-selected', 'true')
        
        const illaka2 = screen.getByRole('option', { name: /illaka 2/i })
        expect(illaka2).toHaveAttribute('aria-selected', 'false')
      })
    })
  })
})