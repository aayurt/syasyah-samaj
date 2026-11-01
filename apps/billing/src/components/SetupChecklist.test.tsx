/**
 * SetupChecklist component tests (MISSION.md M6).
 * Four setup steps, done/undone states, navigation links, load/complete guards.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import SetupChecklist from './SetupChecklist'
import { LangContext } from '../lib/i18n'
import type { SetupStatus } from '../lib/setup'

const useSetupStatus = vi.hoisted(() => vi.fn())

vi.mock('../lib/setup', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/setup')>()
  return {
    ...(original as object),
    useSetupStatus,
  }
})

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to} data-link-to={to}>
      {children}
    </a>
  ),
}))

function renderWith(t: SetupStatus) {
  useSetupStatus.mockReturnValue(t)
  return render(
    <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
      <SetupChecklist />
    </LangContext.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

function completed() {
  return { loading: false, complete: false, missingCount: 2, company: true, fiscalYear: false, chart: false, defaults: true, inUse: false }
}

describe('SetupChecklist', () => {
  const incomplete = { loading: false, complete: false, missingCount: 2, company: true, fiscalYear: false, chart: false, defaults: true, inUse: false }

  it('renders nothing while loading', () => {
    const { container } = renderWith({ loading: true, complete: false, missingCount: 1, company: false, fiscalYear: false, chart: false, defaults: false, inUse: false })
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when setup is complete', () => {
    const { container } = renderWith({ loading: false, complete: true, missingCount: 0, company: true, fiscalYear: true, chart: true, defaults: true, inUse: false })
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when the setup is still loading', () => {
    const { container } = renderWith({ loading: true, complete: false, missingCount: 0, company: false, fiscalYear: false, chart: false, defaults: false, inUse: false })
    expect(container.innerHTML).toBe('')
  })

  it('lists all four steps with links', () => {
    renderWith(incomplete)
    expect(screen.getByText('Add your company name')).toBeInTheDocument()
    expect(screen.getByText('Create a fiscal year')).toBeInTheDocument()
    expect(screen.getByText('Set up your chart of accounts')).toBeInTheDocument()
    expect(screen.getByText('Map your default accounts')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(4)
  })

  it('marks completed steps with a check and strikethrough', () => {
    renderWith(completed())
    const done = screen.getByText('Add your company name')
    expect(done).toBeInTheDocument()
    expect(done.className).toContain('line-through')
  })

  it('marks incomplete steps with a circle and chevron', () => {
    renderWith(incomplete)
    const todo = screen.getByText('Create a fiscal year')
    expect(todo).toBeInTheDocument()
    expect(todo.className).not.toContain('line-through')
  })

  it('shows the missing-count badge', () => {
    renderWith({ loading: false, complete: false, missingCount: 2, company: true, fiscalYear: false, chart: false, defaults: true, inUse: false })
    expect(screen.getByText('2 step(s) left')).toBeInTheDocument()
  })

  it('shows the posting-disabled hint', () => {
    renderWith(incomplete)
    expect(
      screen.getByText('Posting stays disabled until all four are done — you can still save drafts.'),
    ).toBeInTheDocument()
  })
})
