import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SetupWizard from './SetupWizard'
import { LangContext } from '../lib/i18n'

const useTenantMock = vi.hoisted(() => vi.fn())
const useFiscalYearMock = vi.hoisted(() => vi.fn())
const apiMock = vi.hoisted(() => vi.fn())
const listMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/tenant', () => ({
  useTenant: useTenantMock,
  isParentCompany: (t: any) => t.type !== 'illaka' && (t.type === 'central' || !t.parentId),
  getParentCompanies: (list: any[]) =>
    list.filter((t: any) => t.type !== 'illaka' && (t.type === 'central' || !t.parentId)),
  getSubCompaniesForParent: (pId: string, list: any[]) =>
    list.filter((t: any) => String(t.parentId) === String(pId)),
}))

vi.mock('../lib/fiscalYear', () => ({
  useFiscalYear: useFiscalYearMock,
}))

vi.mock('../lib/api', () => ({
  api: apiMock,
  list: listMock,
  getEngine: () => ({ syncAll: vi.fn().mockResolvedValue({}) }),
}))

vi.mock('../lib/dataOps', () => ({
  useDataEpochWatcher: vi.fn(),
  runSeedSelective: vi.fn(),
}))

vi.mock('../lib/toast', () => ({
  pushToast: vi.fn(),
}))

function renderWizard() {
  return render(
    <MemoryRouter initialEntries={['/setup']}>
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
        <SetupWizard />
      </LangContext.Provider>
    </MemoryRouter>,
  )
}

describe('SetupWizard - Company Creator & Multi-Company Onboarding', () => {
  const setTenantId = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useFiscalYearMock.mockReturnValue({
      years: [],
      loading: false,
      refresh: vi.fn(),
    })
    apiMock.mockResolvedValue({})
    listMock.mockResolvedValue({ docs: [], totalDocs: 0 })
  })

  it('renders the Company Creator form when starting fresh with no companies', async () => {
    useTenantMock.mockReturnValue({
      tenantId: '',
      setTenantId,
      tenants: [],
      isCentral: true,
      isIllaka: false,
      illakaCode: null,
      multiCompanyEnabled: true,
    })

    renderWizard()

    await waitFor(() => {
      expect(screen.getByText(/Create Your Organization \/ Parent Company/i)).toBeInTheDocument()
    })

    expect(screen.getByPlaceholderText(/e\.g\. ABC Company or Syasyah Samaj/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/e\.g\. ABC or SYASYA/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create Company & Continue/i })).toBeInTheDocument()
  })

  it('renders company cards and Add Parent Company button when parent companies exist in consolidated mode', async () => {
    const existingTenants = [
      { id: '1', code: 'SYASYA', name: 'Syasyah Samaj', type: 'central' as const },
      { id: '2', code: 'ABC', name: 'ABC Company', type: 'central' as const },
      { id: '3', code: 'ABC-01', name: 'ABC sub-company -1', type: 'illaka' as const, parentId: '2' },
    ]

    useTenantMock.mockReturnValue({
      tenantId: '',
      setTenantId,
      tenants: existingTenants,
      isCentral: true,
      isIllaka: false,
      illakaCode: null,
      multiCompanyEnabled: true,
    })
    listMock.mockResolvedValue({ docs: existingTenants, totalDocs: existingTenants.length })

    renderWizard()

    await waitFor(() => {
      expect(screen.getByText(/Select Company to Onboard & Configure/i)).toBeInTheDocument()
    })

    expect(screen.getByText('Syasyah Samaj')).toBeInTheDocument()
    expect(screen.getByText('ABC Company')).toBeInTheDocument()
    expect(screen.getByText(/ABC sub-company -1/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add Parent Company/i })).toBeInTheDocument()

    // Clicking configure company triggers setTenantId
    const configBtn = screen.getByRole('button', { name: /Configure ABC Company/i })
    fireEvent.click(configBtn)
    expect(setTenantId).toHaveBeenCalledWith('2')
  })

  it('renders Active Organization context bar and Sub-companies table when tenant is selected', async () => {
    const existingTenants = [
      { id: '2', code: 'ABC', name: 'ABC Company', type: 'central' as const },
      { id: '3', code: 'ABC-01', name: 'ABC sub-company -1', type: 'illaka' as const, parentId: '2' },
    ]

    useTenantMock.mockReturnValue({
      tenantId: '2',
      setTenantId,
      tenants: existingTenants,
      isCentral: true,
      isIllaka: false,
      isSuperAdmin: true,
      illakaCode: null,
      multiCompanyEnabled: true,
    })
    listMock.mockResolvedValue({ docs: existingTenants, totalDocs: existingTenants.length })
    apiMock.mockImplementation((endpoint: string) => {
      if (endpoint === '/tenants') return Promise.resolve({ docs: existingTenants })
      return Promise.resolve({ multiCompanyEnabled: true })
    })

    renderWizard()

    await waitFor(() => {
      expect(screen.getByText('ABC Company')).toBeInTheDocument()
      expect(screen.getByText('Parent Company')).toBeInTheDocument()
    })

    expect(screen.getByText(/Switch \/ All Companies/i)).toBeInTheDocument()
    expect(screen.getByText('Children Companies')).toBeInTheDocument()
    expect(screen.getByText(/Child Companies & Illakas under ABC Company/i)).toBeInTheDocument()
    expect(screen.getByText('ABC sub-company -1')).toBeInTheDocument()
  })

  it('allows Super-Admin to toggle Children Companies OFF and shows confirmation warning', async () => {
    const existingTenants = [
      { id: '2', code: 'ABC', name: 'ABC Company', type: 'central' as const },
      { id: '3', code: 'ABC-01', name: 'ABC sub-company -1', type: 'illaka' as const, parentId: '2' },
    ]

    useTenantMock.mockReturnValue({
      tenantId: '2',
      setTenantId,
      tenants: existingTenants,
      isCentral: true,
      isIllaka: false,
      isSuperAdmin: true,
      illakaCode: null,
      multiCompanyEnabled: true,
    })
    listMock.mockResolvedValue({ docs: existingTenants, totalDocs: existingTenants.length })
    apiMock.mockImplementation((endpoint: string) => {
      if (endpoint === '/tenants') return Promise.resolve({ docs: existingTenants })
      return Promise.resolve({ multiCompanyEnabled: true })
    })

    renderWizard()

    await waitFor(() => {
      expect(screen.getByText('Children Companies')).toBeInTheDocument()
    })

    const toggle = screen.getByLabelText(/Toggle Children Companies/i)
    fireEvent.click(toggle)

    // Confirmation dialog appears
    await waitFor(() => {
      expect(screen.getByText(/Collapse Child Companies\?/i)).toBeInTheDocument()
    })

    // Click Proceed with Parent Only
    fireEvent.click(screen.getByRole('button', { name: /Proceed with Parent Only/i }))

    await waitFor(() => {
      expect(screen.getByText(/Operating as a standalone organization/i)).toBeInTheDocument()
    })
  })

  it('prompts post-save setup flow modal when saving company with children enabled', async () => {
    const existingTenants = [
      { id: '2', code: 'ABC', name: 'ABC Company', type: 'central' as const },
      { id: '3', code: 'ABC-01', name: 'ABC sub-company -1', type: 'illaka' as const, parentId: '2' },
    ]

    useTenantMock.mockReturnValue({
      tenantId: '2',
      setTenantId,
      tenants: existingTenants,
      isCentral: true,
      isIllaka: false,
      isSuperAdmin: true,
      illakaCode: null,
      multiCompanyEnabled: true,
    })
    listMock.mockResolvedValue({ docs: existingTenants, totalDocs: existingTenants.length })
    apiMock.mockImplementation((endpoint: string) => {
      if (endpoint === '/tenants') return Promise.resolve({ docs: existingTenants })
      if (endpoint === '/globals/billing-settings') return Promise.resolve({ companyName: 'ABC Company' })
      return Promise.resolve({ success: true })
    })

    renderWizard()

    await waitFor(() => {
      expect(screen.getByText('Children Companies')).toBeInTheDocument()
    })

    const saveBtn = screen.getByRole('button', { name: /Save & continue/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('Company Profile Saved')).toBeInTheDocument()
      expect(screen.getByText(/Continue Parent Company Setup/i)).toBeInTheDocument()
      expect(screen.getByText(/OR ONBOARD A CHILD COMPANY/i)).toBeInTheDocument()
    })
  })

  it('renders Sub-Company profile and parent badge when a sub-company is selected', async () => {
    const existingTenants = [
      { id: '2', code: 'ABC', name: 'ABC Company', type: 'central' as const },
      { id: '3', code: 'ABC-01', name: 'ABC sub-company -1', type: 'illaka' as const, parentId: '2' },
    ]

    useTenantMock.mockReturnValue({
      tenantId: '3',
      setTenantId,
      tenants: existingTenants,
      isCentral: true,
      isIllaka: false,
      illakaCode: null,
      multiCompanyEnabled: true,
    })
    listMock.mockResolvedValue({ docs: existingTenants, totalDocs: existingTenants.length })
    apiMock.mockResolvedValue({
      multiCompanyEnabled: true,
    })

    renderWizard()

    await waitFor(() => {
      expect(screen.getAllByText('ABC sub-company -1').length).toBeGreaterThan(0)
      expect(screen.getByText('Sub-Company')).toBeInTheDocument()
    })

    expect(screen.getByText(/Operating branch under ABC Company/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Switch to Parent \(ABC Company\)/i })).toBeInTheDocument()
  })

  it('allows editing a parent company from consolidated view', async () => {
    const existingTenants = [
      { id: '2', code: 'ABC', name: 'ABC Company', type: 'central' as const, pan: '123456789' },
    ]

    useTenantMock.mockReturnValue({
      tenantId: '',
      setTenantId,
      tenants: existingTenants,
      isCentral: true,
      isIllaka: false,
      illakaCode: null,
      multiCompanyEnabled: true,
    })
    listMock.mockResolvedValue({ docs: existingTenants, totalDocs: existingTenants.length })

    renderWizard()

    await waitFor(() => {
      expect(screen.getByText('ABC Company')).toBeInTheDocument()
    })

    const editBtn = screen.getByTitle('Edit ABC Company')
    fireEvent.click(editBtn)

    expect(screen.getByText(/Edit Parent Company: ABC Company/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('ABC Company')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ABC')).toBeInTheDocument()
  })
})
