/**
 * ConflictDrawer component tests (MISSION.md M6).
 * Quarantine list: empty state, conflict rows, retry/discard/edit actions, Escape close.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import ConflictDrawer from './ConflictDrawer'
import { renderEn } from '../test/renderEn'
import type { OutboxEntry } from '../lib/offline/types'
import type { SyncState } from '../lib/offline/types'

const listConflicts = vi.hoisted(() => vi.fn())
const retryMock = vi.hoisted(() => vi.fn())
const discardMock = vi.hoisted(() => vi.fn())
const syncAll = vi.hoisted(() => vi.fn())
const navigateMock = vi.hoisted(() => vi.fn())
let syncState: SyncState = {
  online: true,
  pending: 0,
  conflicts: 1,
  lastSyncAt: '2026-10-01T10:00:00.000Z',
  syncingCount: 0,
  reportsStale: false,
  nextSyncAt: null,
} as SyncState

vi.mock('../lib/api', () => ({
  getEngine: () => ({ listConflicts, retry: retryMock, discard: discardMock, syncAll }),
  useSyncState: () => syncState,
  fmt: (n: number | undefined | null) => (n ?? 0).toFixed(2),
  api: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('./ConflictResolutionModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <button onClick={onClose}>mock-resolution-modal</button>
  ),
}))

const onClose = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  syncState = {
    online: true,
    pending: 0,
    conflicts: 1,
    lastSyncAt: '2026-10-01T10:00:00.000Z',
    syncingCount: 0,
    reportsStale: false,
    nextSyncAt: null,
  } as SyncState
})

const docConflict: OutboxEntry = {
  seq: 3,
  method: 'POST',
  path: '/documents',
  queuedAt: '2026-10-01T10:00:00.000Z',
  body: { docType: 'sales-invoice', date: '2026-10-01', narration: 'draft sale', lines: [] },
  conflict: { message: 'Server rejected: missing party', at: '2026-10-01T10:01:00.000Z' },
}

const partyConflict: OutboxEntry = {
  seq: 4,
  method: 'PATCH',
  path: '/parties/9',
  queuedAt: '2026-10-01T11:00:00.000Z',
  body: { name: 'Kiran', address: 'Bhaktapur' },
  conflict: { message: 'Validation failed', at: '2026-10-01T11:01:00.000Z' },
}

describe('ConflictDrawer', () => {
  it('shows the empty state when nothing needs review', async () => {
    listConflicts.mockResolvedValue([])
    renderEn(<ConflictDrawer onClose={onClose} />)
    expect(await screen.findByText('Nothing needs review.')).toBeInTheDocument()
    expect(screen.getByText('Needs review')).toBeInTheDocument()
  })

  it('lists conflicts with queued label, collection and server message', async () => {
    listConflicts.mockResolvedValue([docConflict, partyConflict])
    renderEn(<ConflictDrawer onClose={onClose} />)

    expect(await screen.findByText('Queued create · Transaction')).toBeInTheDocument()
    expect(screen.getByText('Queued update · Party')).toBeInTheDocument()
    expect(screen.getByText('Server rejected: missing party')).toBeInTheDocument()
    expect(screen.getByText('Validation failed')).toBeInTheDocument()
  })

  it('offers Edit only for queued document creates', async () => {
    listConflicts.mockResolvedValue([docConflict, partyConflict])
    renderEn(<ConflictDrawer onClose={onClose} />)
    await screen.findByText('Queued create · Transaction')

    // Edit shows for POST /documents only — one button total
    expect(screen.getAllByRole('button', { name: /Edit/ })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /Resolve/ })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /Retry/ })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /Discard/ })).toHaveLength(2)
  })

  it('navigates to /vouchers and dispatches the resume event when Edit is clicked', async () => {
    listConflicts.mockResolvedValue([docConflict])
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    renderEn(<ConflictDrawer onClose={onClose} />)
    await screen.findByText('Queued create · Transaction')

    fireEvent.click(screen.getByRole('button', { name: /Edit/ }))
    expect(onClose).toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith('/vouchers')
    // The resume event fires after a 100ms delay — wait for it with real timers.
    await waitFor(
      () =>
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'afno:resume-queued',
            detail: { seq: 3 },
          }),
        ),
      { timeout: 1000 },
    )
    dispatchSpy.mockRestore()
  })

  it('retries a conflict through the engine and refreshes the list', async () => {
    listConflicts.mockResolvedValueOnce([partyConflict]).mockResolvedValue([])
    retryMock.mockResolvedValue(undefined)
    renderEn(<ConflictDrawer onClose={onClose} />)
    await screen.findByText('Queued update · Party')

    fireEvent.click(screen.getByRole('button', { name: /Retry/ }))
    await waitFor(() => expect(retryMock).toHaveBeenCalledWith(4))
    expect(await screen.findByText('Nothing needs review.')).toBeInTheDocument()
  })

  it('discards a conflict through the engine', async () => {
    listConflicts.mockResolvedValueOnce([partyConflict]).mockResolvedValue([])
    discardMock.mockResolvedValue(undefined)
    renderEn(<ConflictDrawer onClose={onClose} />)
    await screen.findByText('Queued update · Party')

    fireEvent.click(screen.getByRole('button', { name: /Discard/ }))
    await waitFor(() => expect(discardMock).toHaveBeenCalledWith(4))
  })

  it('closes on Escape', async () => {
    listConflicts.mockResolvedValue([])
    renderEn(<ConflictDrawer onClose={onClose} />)
    await screen.findByText('Nothing needs review.')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('opens the resolution modal from the Resolve button', async () => {
    listConflicts.mockResolvedValue([partyConflict])
    renderEn(<ConflictDrawer onClose={onClose} />)
    await screen.findByText('Queued update · Party')

    fireEvent.click(screen.getByRole('button', { name: /Resolve/ }))
    expect(await screen.findByText('mock-resolution-modal')).toBeInTheDocument()
  })

  it('syncs now through the engine', async () => {
    listConflicts.mockResolvedValue([])
    syncAll.mockResolvedValue(undefined)
    renderEn(<ConflictDrawer onClose={onClose} />)
    await screen.findByText('Nothing needs review.')

    fireEvent.click(screen.getByRole('button', { name: /Sync now/ }))
    await waitFor(() => expect(syncAll).toHaveBeenCalled())
  })

  it('disables sync actions while offline', async () => {
    syncState = { ...syncState, online: false }
    listConflicts.mockResolvedValue([])
    renderEn(<ConflictDrawer onClose={onClose} />)
    await screen.findByText('Nothing needs review.')
    expect(screen.getByRole('button', { name: /Sync now/ })).toBeDisabled()
  })

  it('survives a listConflicts failure by showing the empty state', async () => {
    listConflicts.mockRejectedValue(new Error('idb broken'))
    renderEn(<ConflictDrawer onClose={onClose} />)
    expect(await screen.findByText('Nothing needs review.')).toBeInTheDocument()
  })
})
