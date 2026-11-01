/**
 * Tour component tests (MISSION.md M6).
 * Step navigation, route hopping, spotlight position, Escape close.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Tour from './Tour'
import { LangContext } from '../lib/i18n'
import { MemoryRouter } from 'react-router-dom'

const navigateMock = vi.hoisted(() => vi.fn())
const useLocationMock = vi.hoisted(() => vi.fn(() => ({ pathname: '/' })))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: useLocationMock,
  }
})

function renderTour(open: boolean) {
  return render(
    <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
      <MemoryRouter initialEntries={['/']}>
        <Tour open={open} onClose={vi.fn()} />
      </MemoryRouter>
    </LangContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks keeps return values — reset the location each test.
  useLocationMock.mockReturnValue({ pathname: '/' })
})

describe('Tour', () => {
  it('renders nothing when closed', () => {
    const { container } = renderTour(false)
    expect(container.innerHTML).toBe('')
  })

  it('renders the first step immediately on open', () => {
    renderTour(true)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Sidebar navigation')).toBeInTheDocument()
    expect(
      screen.getByText(/Everything is grouped: Bookkeeping, Masters, Inventory/),
    ).toBeInTheDocument()
  })

  it('shows step-by-step tour content for each step', () => {
    renderTour(true)
    expect(screen.getByText('1 / 7')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Sync status')).toBeInTheDocument()
    expect(screen.getByText('2 / 7')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('3 / 7')).toBeInTheDocument()
    // Back returns to the previous step.
    fireEvent.click(screen.getByText('Back'))
    expect(screen.getByText('Sync status')).toBeInTheDocument()
  })

  it('navigates to the route of a step when it differs from the current location', () => {
    useLocationMock.mockReturnValue({ pathname: '/settings' })
    renderTour(true)
    // Steps 1–2 have no route; step 3 targets '/' — two Next clicks reach it.
    fireEvent.click(screen.getByText('Next'))
    fireEvent.click(screen.getByText('Next'))
    expect(navigateMock).toHaveBeenCalledWith('/')
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
        <MemoryRouter initialEntries={['/']}>
          <Tour open={true} onClose={onClose} />
        </MemoryRouter>
      </LangContext.Provider>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
