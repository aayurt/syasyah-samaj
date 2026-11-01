/**
 * DataStatus component tests (MISSION.md M6).
 * Inline data-source hint: offline / refreshing / online-idle states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DataStatus from './DataStatus'

const useSyncStateMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', () => ({
  useSyncState: useSyncStateMock,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DataStatus', () => {
  it('renders nothing when online and idle', () => {
    useSyncStateMock.mockReturnValue({
      online: true,
      syncingCount: 0,
      lastSyncAt: '2026-10-01T10:00:00.000Z',
    })
    const { container } = render(<DataStatus />)
    expect(container.innerHTML).toBe('')
  })

  it('shows the offline banner with last-synced time', () => {
    useSyncStateMock.mockReturnValue({
      online: false,
      syncingCount: 0,
      lastSyncAt: '2026-10-01T10:00:00.000Z',
    })
    render(<DataStatus />)
    expect(screen.getByText(/Offline · showing saved data/)).toBeInTheDocument()
  })

  it('shows the offline banner without a time when never synced', () => {
    useSyncStateMock.mockReturnValue({
      online: false,
      syncingCount: 0,
      lastSyncAt: null,
    })
    render(<DataStatus />)
    expect(screen.getByText('Offline · showing saved data')).toBeInTheDocument()
  })

  it('shows the refreshing state while syncing', () => {
    useSyncStateMock.mockReturnValue({
      online: true,
      syncingCount: 2,
      lastSyncAt: null,
    })
    render(<DataStatus />)
    expect(screen.getByText('Refreshing…')).toBeInTheDocument()
  })
})
