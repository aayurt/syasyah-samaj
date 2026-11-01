/**
 * SyncStatus component tests (MISSION.md M6).
 * Header pill: synced / pending / offline / resync-scheduled states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SyncStatus from './SyncStatus'
import { LangContext } from '../lib/i18n'

const useSyncStateMock = vi.hoisted(() => vi.fn())
const syncAll = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', () => ({
  useSyncState: useSyncStateMock,
  getEngine: () => ({ syncAll }),
}))

vi.mock('./ConflictDrawer', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <button onClick={onClose}>mock-drawer</button>
  ),
}))

function renderStatus() {
  return render(
    <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
      <SyncStatus />
    </LangContext.Provider>,
  )
}

const base = {
  online: true,
  pending: 0,
  conflicts: 0,
  lastSyncAt: '2026-10-01T10:00:00.000Z',
  banners: [],
  cacheVersion: 1,
  reportsStale: false,
  lastReportSyncAt: Date.now(),
  syncingCount: 0,
  nextSyncAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  useSyncStateMock.mockReturnValue({ ...base })
  syncAll.mockResolvedValue(undefined)
})

describe('SyncStatus', () => {
  it('shows the Synced pill when idle', () => {
    renderStatus()
    expect(screen.getByText('Synced')).toBeInTheDocument()
    // Pill + resync button both carry the synced title
    expect(screen.getAllByTitle('All changes synced').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the pending count when writes are queued', () => {
    useSyncStateMock.mockReturnValue({ ...base, pending: 3 })
    renderStatus()
    expect(screen.getByText('3 pending sync')).toBeInTheDocument()
  })

  it('shows the offline pill with pending count', () => {
    useSyncStateMock.mockReturnValue({ ...base, online: false, pending: 2 })
    renderStatus()
    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(screen.getByText('· 2 pending sync')).toBeInTheDocument()
  })

  it('shows the syncing state while a background pull runs', () => {
    useSyncStateMock.mockReturnValue({ ...base, syncingCount: 1 })
    renderStatus()
    expect(screen.getByText('Syncing…')).toBeInTheDocument()
  })

  it('shows a resync countdown when the next sync is scheduled', () => {
    useSyncStateMock.mockReturnValue({ ...base, nextSyncAt: Date.now() + 15_000 })
    renderStatus()
    expect(screen.getByText(/Resync in \d+s/)).toBeInTheDocument()
  })

  it('shows the review badge and opens the drawer when conflicts exist', async () => {
    useSyncStateMock.mockReturnValue({ ...base, conflicts: 4 })
    renderStatus()
    expect(screen.getByText('4 to review')).toBeInTheDocument()

    fireEvent.click(screen.getByText('4 to review'))
    expect(await screen.findByText('mock-drawer')).toBeInTheDocument()
  })

  it('triggers syncAll when Resync is clicked', async () => {
    useSyncStateMock.mockReturnValue({ ...base, pending: 1 })
    renderStatus()
    fireEvent.click(screen.getByLabelText(/Resync/))
    await waitFor(() => expect(syncAll).toHaveBeenCalled())
  })

  it('disables Resync when synced and nothing is stale', () => {
    renderStatus()
    expect(screen.getByLabelText(/Resync/)).toBeDisabled()
  })
})
