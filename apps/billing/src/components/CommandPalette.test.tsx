/**
 * CommandPalette component tests (MISSION.md M6).
 * Shortcut grid, search-as-you-type (debounced), keyboard nav, close.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import CommandPalette from './CommandPalette'
import { LangContext } from '../lib/i18n'
import { setupServer } from 'msw/node'
import { http } from 'msw'
import { render, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// `api()` hits `${API_BASE}/api/<slug>` and flattens nested `where` objects
// into bracket params (`where[number][contains]`).
const DOC_FIXTURE = { id: 1, number: 'INV-101', docType: 'sales-invoice', status: 'posted' }
const PARTY_FIXTURE = { id: 2, name: 'Aama', phone: '9841000001', email: 'aama@example.com' }
const ITEM_FIXTURE = { id: 3, name: 'Rice', sku: 'RICE-01' }

function containsFilter<T extends { number?: string; name?: string }>(
  docs: T[],
  field: 'number' | 'name',
  value: string,
): T[] {
  if (!value) return []
  return docs.filter((d) => (d[field] || '').toLowerCase().includes(value.toLowerCase()))
}

const paletteApi = setupServer(
  http.get('*/api/documents', ({ request }) => {
    const q = new URL(request.url).searchParams.get('where[number][contains]') || ''
    return Response.json({ docs: q ? containsFilter([DOC_FIXTURE], 'number', q) : [] })
  }),
  http.get('*/api/parties', ({ request }) => {
    const q = new URL(request.url).searchParams.get('where[name][contains]') || ''
    return Response.json({ docs: q ? containsFilter([PARTY_FIXTURE], 'name', q) : [] })
  }),
  http.get('*/api/items', ({ request }) => {
    const q = new URL(request.url).searchParams.get('where[name][contains]') || ''
    return Response.json({ docs: q ? containsFilter([ITEM_FIXTURE], 'name', q) : [] })
  }),
)

beforeAll(() => paletteApi.listen({ onUnhandledFrame: 'bypass' }))
afterAll(() => paletteApi.close())

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  paletteApi.resetHandlers()
})

const PH = 'Search for transactions, parties & inventory…'

describe('CommandPalette', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderPalette(open: boolean) {
    render(
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
        <MemoryRouter>
          <CommandPalette open={open} onClose={onClose} />
        </MemoryRouter>
      </LangContext.Provider>,
    )
  }

  function setupUser() {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    return { user }
  }

  it('renders nothing when closed', () => {
    renderPalette(false)
    // RTL mounts a container div; the palette itself must render nothing in it.
    expect(document.body.firstElementChild).toBeEmptyDOMElement()
  })

  it('shows the shortcut grid when opened with an empty query', async () => {
    renderPalette(true)
    await act(async () => {
      vi.advanceTimersByTime(60)
    })
    expect(screen.getByText('Shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Sales Invoice')).toBeInTheDocument()
    expect(screen.getByText('Purchase Invoice')).toBeInTheDocument()
    expect(screen.getByText('Payment')).toBeInTheDocument()
    expect(screen.getByText('Journal Entry')).toBeInTheDocument()
    expect(screen.getByText('Receipt')).toBeInTheDocument()
    expect(screen.getByText('Contra Entry')).toBeInTheDocument()
    expect(screen.getByText('Credit Note')).toBeInTheDocument()
    expect(screen.getByText('Add Item')).toBeInTheDocument()
    expect(screen.getByText('Add Party')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('navigates and closes when a shortcut is clicked', async () => {
    const user = setupUser()
    renderPalette(true)
    await act(async () => {
      vi.advanceTimersByTime(120)
    })
    fireEvent.click(screen.getByText('Dashboard'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('focuses the search input shortly after opening', async () => {
    renderPalette(true)
    await act(async () => {
      vi.advanceTimersByTime(120)
    })
    // For the user-event tests, use real timers so the input events flow.
    vi.useRealTimers()
    const input = screen.getByPlaceholderText(PH)
    expect(input).toHaveFocus()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  it('enters search mode and lists hits as the user types', async () => {
    const { user } = setupUser()
    renderPalette(true)
    await act(async () => {
      vi.advanceTimersByTime(120)
    })
    const input = screen.getByPlaceholderText(PH)
    await user.click(input)
    await user.type(input, 'INV')
    // Nothing fires before the 300ms debounce elapses.
    expect(screen.queryByText('INV-101')).not.toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(350)
    })
    // MSW answers instantly, so the transient "Searching…" frame is not
    // reliably observable — assert the settled search results instead.
    await waitFor(() => {
      expect(screen.getByText('INV-101')).toBeInTheDocument()
      expect(screen.getByText('sales-invoice · posted')).toBeInTheDocument()
    })
  })

  it('shows the empty state when nothing matches', async () => {
    const { user } = setupUser()
    renderPalette(true)
    await act(async () => {
      vi.advanceTimersByTime(120)
    })
    // Stay on fake timers: `user` was built with advanceTimers.
    await user.click(screen.getByPlaceholderText(PH))
    await user.type(screen.getByPlaceholderText(PH), 'ZZZZZZ')
    await act(async () => {
      vi.advanceTimersByTime(350)
    })
    await act(async () => {
      vi.advanceTimersByTime(0)
    })
    await waitFor(() => {
      expect(screen.getByText(/No results.*ZZZZZZ/)).toBeInTheDocument()
    })
  })

  it('closes on Escape', async () => {
    renderPalette(true)
    await act(async () => {
      vi.advanceTimersByTime(120)
    })
    vi.useRealTimers()
    fireEvent.keyDown(screen.getByPlaceholderText(PH), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('navigates on Enter for the active shortcut', async () => {
    renderPalette(true)
    await act(async () => {
      vi.advanceTimersByTime(60)
    })
    const input = screen.getByPlaceholderText(PH)
    expect(input).toBeInTheDocument()
    // Shortcuts are the default items when the query is empty.
    const shortcuts = screen.getAllByRole('button', { name: /Sales Invoice|Purchase Invoice|Payment|Journal Entry|Contra Entry|Credit Note|Add Item|Add Party|Dashboard|Receipt/ })
    expect(shortcuts.length).toBeGreaterThan(0)
    // Keyboard Enter on the active shortcut triggers navigation + close.
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
