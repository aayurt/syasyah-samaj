/**
 * FiscalYearSwitcher component tests (MISSION.md M6).
 * Year select, closed/working badges, add-year navigation, cache bump.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FiscalYearSwitcher from './FiscalYearSwitcher'
import { LangContext } from '../lib/i18n'
import type { FiscalYear } from '../lib/types'

const useFiscalYearMock = vi.hoisted(() => vi.fn())
const navigateMock = vi.hoisted(() => vi.fn())
const refreshMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/fiscalYear', () => ({
  useFiscalYear: useFiscalYearMock,
}))

vi.mock('../lib/offline', () => ({
  useSyncState: () => ({ cacheVersion: 1 }),
}))

vi.mock('../lib/toast', () => ({ pushToast: vi.fn() }))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

function renderSwitcher() {
  return render(
    <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
      <FiscalYearSwitcher />
    </LangContext.Provider>,
  )
}

const years: FiscalYear[] = [
  { id: 1, label: 'FY 2082/83', startDate: '2026-04-01', status: 'active', isActive: true },
  { id: 2, label: 'FY 2081/82', startDate: '2025-04-01', status: 'closed', isActive: false },
]

beforeEach(() => {
  vi.clearAllMocks()
  refreshMock.mockResolvedValue(undefined)
  useFiscalYearMock.mockReturnValue({
    years,
    selectedYear: years[0],
    activeYear: years[0],
    selectYear: vi.fn(),
    loading: false,
    refresh: refreshMock,
  })
})

describe('FiscalYearSwitcher', () => {
  it('renders nothing while loading', () => {
    useFiscalYearMock.mockReturnValue({
      years: [],
      selectedYear: null,
      activeYear: null,
      selectYear: vi.fn(),
      loading: true,
      refresh: refreshMock,
    })
    const { container } = renderSwitcher()
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when there are no years', () => {
    useFiscalYearMock.mockReturnValue({
      years: [],
      selectedYear: null,
      activeYear: null,
      selectYear: vi.fn(),
      loading: false,
      refresh: refreshMock,
    })
    const { container } = renderSwitcher()
    expect(container.innerHTML).toBe('')
  })

  it('lists all years and marks closed ones', () => {
    useFiscalYearMock.mockReturnValue({
      years,
      selectedYear: years[1], // closed year → lock badge
      activeYear: years[0],
      selectYear: vi.fn(),
      loading: false,
      refresh: refreshMock,
    })
    renderSwitcher()
    expect(screen.getByRole('option', { name: 'FY 2082/83' })).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'FY 2081/82 · Closed' }),
    ).toBeInTheDocument()
    expect(screen.getByTitle('Closed fiscal year — read-only')).toBeInTheDocument()
  })

  it('marks the working year with the ✓ badge', () => {
    renderSwitcher()
    expect(screen.getByTitle('Working year')).toBeInTheDocument()
  })

  it('calls selectYear and refresh on change', () => {
    const selectYear = vi.fn()
    useFiscalYearMock.mockReturnValue({
      years,
      selectedYear: years[0],
      activeYear: years[0],
      selectYear,
      loading: false,
      refresh: refreshMock,
    })
    renderSwitcher()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } })
    expect(selectYear).toHaveBeenCalledWith(2)
    expect(refreshMock).toHaveBeenCalled()
  })

  it('navigates to the setup wizard when Add Year is clicked', () => {
    renderSwitcher()
    fireEvent.click(screen.getByTitle('Add new fiscal year'))
    expect(refreshMock).toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith('/setup', {
      state: { startStep: 'fiscalYear' },
    })
  })

  it('bumps the cache version on beforeunload', () => {
    localStorage.setItem('billing.cacheVersion', '3')
    renderSwitcher()
    fireEvent(window, new Event('beforeunload'))
    expect(localStorage.getItem('billing.cacheVersion')).toBe('4')
    localStorage.removeItem('billing.cacheVersion')
  })

  it('refreshes when the tab becomes visible again', () => {
    useFiscalYearMock.mockReturnValue({
      years,
      selectedYear: years[1],
      activeYear: years[0],
      selectYear: vi.fn(),
      loading: false,
      refresh: refreshMock,
    })
    renderSwitcher()
    refreshMock.mockClear()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    fireEvent(document, new Event('visibilitychange'))
    expect(refreshMock).toHaveBeenCalled()
  })
})
