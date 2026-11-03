import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import { LangProvider, useLang } from '../lib/i18n'
import { TenantProvider, useTenant } from '../lib/tenant'

/**
 * Test wrapper that provides all necessary context providers.
 * Usage:
 *   renderWithProviders(<MyComponent />)
 *   renderWithProviders(<MyComponent />, { initialPath: '/accounts' })
 */
interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  initialPath?: string
  tenantId?: string
  lang?: 'en' | 'ne'
  mockAuth?: boolean
}

const AllProviders: React.FC<{
  children: React.ReactNode
  initialPath?: string
  tenantId?: string
  lang?: 'en' | 'ne'
}> = ({ children, initialPath = '/', tenantId = '', lang = 'en' }) => (
  <LangProvider>
    <TenantProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        {children}
      </MemoryRouter>
    </TenantProvider>
  </LangProvider>
)

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {}
) {
  const { initialPath = '/', tenantId = '', lang = 'en', ...renderOptions } = options

  // Pre-set localStorage for tenant and language
  if (typeof window !== 'undefined') {
    localStorage.setItem('billing.tenant', tenantId)
    localStorage.setItem('ui-lang', lang)
  }

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders initialPath={initialPath} tenantId={tenantId} lang={lang}>
        {children}
      </AllProviders>
    ),
    ...renderOptions,
  })
}

/**
 * Mock MSW server for API mocking in tests.
 * Add handlers in individual test files using `server.use()`.
 */
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

export const testServer = setupServer(
  // Default handlers - override in tests
  http.get('*/api/gl-accounts', () => HttpResponse.json({ docs: [], totalDocs: 0 })),
  http.get('*/api/account-groups', () => HttpResponse.json({ docs: [], totalDocs: 0 })),
  http.get('*/api/members', () => HttpResponse.json({ docs: [], totalDocs: 0 })),
  http.get('*/api/parties', () => HttpResponse.json({ docs: [], totalDocs: 0 })),
  http.get('*/api/items', () => HttpResponse.json({ docs: [], totalDocs: 0 })),
  http.get('*/api/vouchers', () => HttpResponse.json({ docs: [], totalDocs: 0 })),
  http.get('*/api/journal-entries', () => HttpResponse.json({ docs: [], totalDocs: 0 })),
  http.get('*/api/tenants', () => HttpResponse.json({ docs: [] })),
  http.get('*/api/fiscal-years', () => HttpResponse.json({ docs: [] })),
  http.get('*/api/billing-settings', () => HttpResponse.json({ docs: [] })),
  http.get('*/api/opening-balances/for-year', () => HttpResponse.json({ docs: [] })),
)

export function startTestServer() {
  testServer.listen()
}

export function stopTestServer() {
  testServer.close()
}

export function resetTestServer() {
  testServer.resetHandlers()
}

/**
 * Mock authentication for tests.
 * Usage:
 *   const { user } = mockAuth({ role: 'super-admin', tenant: 'C00' })
 */
export function mockAuth(overrides: {
  role?: string
  tenant?: string
  illakaCode?: string
  userId?: number
} = {}) {
  const { role = 'super-admin', tenant = 'C00', illakaCode = 'C00', userId = 1 } = overrides

  // This would be set up with MSW handlers in actual tests
  return {
    user: {
      id: userId,
      role,
      tenants: tenant ? [{ tenant: { id: tenant, code: illakaCode, name: tenant } }] : [],
    },
  }
}

/**
 * Test utilities for async operations
 */
export async function waitFor(condition: () => boolean, timeout = 1000): Promise<void> {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor timeout')
    }
    await new Promise((r) => setTimeout(r, 10))
  }
}

export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}