import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Toaster from './Toaster'
import { pushToast, dismissToast, subscribeToasts, type ToastItem } from '../lib/toast'

/** The toast store is module-level — clear it between tests. */
function clearToasts() {
  let current: ToastItem[] = []
  const unsub = subscribeToasts((items) => {
    current = items
  })
  for (const t of current) dismissToast(t.id)
  unsub()
}

afterEach(clearToasts)

describe('Toaster', () => {
  it('renders nothing when there are no toasts', () => {
    const { container } = render(<Toaster />)
    expect(container.innerHTML).toBe('')
  })

  it('renders a pushed toast with title and message', () => {
    render(<Toaster />)
    act(() => {
      pushToast('success', 'Saved', 'All changes stored')
    })
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByText('All changes stored')).toBeInTheDocument()
  })

  it('renders toasts without a message', () => {
    render(<Toaster />)
    act(() => {
      pushToast('info', 'Exporting…')
    })
    expect(screen.getByText('Exporting…')).toBeInTheDocument()
  })

  it('dismisses a toast when the Dismiss button is clicked', async () => {
    const user = userEvent.setup()
    render(<Toaster />)
    act(() => {
      pushToast('error', 'Import failed', 'Row 12: name required')
    })
    expect(screen.getByText('Import failed')).toBeInTheDocument()

    await user.click(screen.getAllByLabelText('Dismiss')[0])
    expect(screen.queryByText('Import failed')).not.toBeInTheDocument()
  })
})
