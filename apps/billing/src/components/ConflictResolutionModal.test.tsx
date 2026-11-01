/**
 * ConflictResolutionModal component tests (MISSION.md M6).
 * Server-vs-offline field comparison, quick picks, apply resolution.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import ConflictResolutionModal from './ConflictResolutionModal'
import { renderEn } from '../test/renderEn'
import type { OutboxEntry } from '../lib/offline/types'

const fetchServerVersion = vi.hoisted(() => vi.fn())
const forceApply = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', () => ({
  getEngine: () => ({ fetchServerVersion, forceApply }),
}))

const onClose = vi.fn()
const onResolved = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
})

const entry: OutboxEntry = {
  seq: 5,
  method: 'PATCH',
  path: '/documents/10',
  queuedAt: '2026-10-01T10:00:00.000Z',
  body: {
    docType: 'sales-invoice',
    narration: 'Offline narration',
    grossTotal: 1130,
    status: 'draft',
    localId: 'loc-1',
    _pendingSync: true,
  },
  conflict: { message: 'Version conflict', at: '2026-10-01T10:01:00.000Z' },
}

const serverDoc = {
  id: 10,
  docType: 'sales-invoice',
  narration: 'Server narration',
  grossTotal: 999,
  status: 'posted',
  tenant: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-10-01T09:59:00.000Z',
}

describe('ConflictResolutionModal', () => {
  it('shows a loading state while fetching the server version', () => {
    fetchServerVersion.mockReturnValue(new Promise(() => {})) // never resolves
    renderEn(
      <ConflictResolutionModal entry={entry} onClose={onClose} onResolved={onResolved} />,
    )
    expect(screen.getByText('Fetching server version…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Apply Resolution/ })).toBeDisabled()
  })

  it('renders the header with doc-type label, method, path and conflict message', async () => {
    fetchServerVersion.mockResolvedValue(serverDoc)
    renderEn(
      <ConflictResolutionModal entry={entry} onClose={onClose} onResolved={onResolved} />,
    )
    expect(await screen.findByText('Resolve Conflict — Sales Invoice')).toBeInTheDocument()
    expect(screen.getByText(/PATCH \/documents\/10/)).toBeInTheDocument()
    expect(screen.getByText('Version conflict')).toBeInTheDocument()
  })

  it('lists all comparable fields and highlights only the differing rows', async () => {
    fetchServerVersion.mockResolvedValue(serverDoc)
    renderEn(
      <ConflictResolutionModal entry={entry} onClose={onClose} onResolved={onResolved} />,
    )
    await screen.findByText('Offline narration')

    // Differing values shown side by side
    expect(screen.getAllByText('Offline narration').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Server narration').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('1,130')).toBeInTheDocument()
    expect(screen.getByText('999')).toBeInTheDocument()

    // Only differing fields get Mine/Server pick buttons
    // (diffs: narration, grossTotal, status — docType matches)
    expect(screen.getAllByRole('button', { name: 'Mine' })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: 'Server' })).toHaveLength(3)
  })

  it('skips internal server fields (id/createdAt/updatedAt/tenant)', async () => {
    fetchServerVersion.mockResolvedValue(serverDoc)
    renderEn(
      <ConflictResolutionModal entry={entry} onClose={onClose} onResolved={onResolved} />,
    )
    await screen.findByText('Offline narration')
    expect(screen.queryByText('Id')).not.toBeInTheDocument()
    expect(screen.queryByText('Created At')).not.toBeInTheDocument()
    expect(screen.queryByText('Tenant')).not.toBeInTheDocument()
    // _pendingSync is skipped from the offline side
    expect(screen.queryByText('Pending Sync')).not.toBeInTheDocument()
  })

  it('applies the offline version when "Keep All Mine" is chosen', async () => {
    fetchServerVersion.mockResolvedValue(serverDoc)
    forceApply.mockResolvedValue({ status: 'pushed' })
    renderEn(
      <ConflictResolutionModal entry={entry} onClose={onClose} onResolved={onResolved} />,
    )
    await screen.findByText('Offline narration')

    fireEvent.click(screen.getByRole('button', { name: /Keep All Mine/ }))
    fireEvent.click(screen.getByRole('button', { name: /Apply Resolution/ }))

    await waitFor(() => expect(onResolved).toHaveBeenCalled())
    const [, merged] = forceApply.mock.calls[0]
    expect(merged.narration).toBe('Offline narration')
    expect(merged.grossTotal).toBe(1130)
  })

  it('applies the server version when "Keep All Server" is chosen', async () => {
    fetchServerVersion.mockResolvedValue(serverDoc)
    forceApply.mockResolvedValue({ status: 'pushed' })
    renderEn(
      <ConflictResolutionModal entry={entry} onClose={onClose} onResolved={onResolved} />,
    )
    await screen.findByText('Offline narration')

    fireEvent.click(screen.getByRole('button', { name: /Keep All Server/ }))
    fireEvent.click(screen.getByRole('button', { name: /Apply Resolution/ }))

    await waitFor(() => expect(onResolved).toHaveBeenCalled())
    const [, merged] = forceApply.mock.calls[0]
    expect(merged.narration).toBe('Server narration')
    expect(merged.grossTotal).toBe(999)
  })

  it('merges individual fields via the per-row pick buttons', async () => {
    fetchServerVersion.mockResolvedValue(serverDoc)
    forceApply.mockResolvedValue({ status: 'pushed' })
    renderEn(
      <ConflictResolutionModal entry={entry} onClose={onClose} onResolved={onResolved} />,
    )
    await screen.findByText('Offline narration')

    // Take the server's narration but keep my grossTotal
    const serverBtns = screen.getAllByRole('button', { name: 'Server' })
    fireEvent.click(serverBtns[0])
    fireEvent.click(screen.getByRole('button', { name: /Apply Resolution/ }))

    await waitFor(() => expect(onResolved).toHaveBeenCalled())
    const [, merged] = forceApply.mock.calls[0]
    expect(merged.narration).toBe('Server narration')
    expect(merged.grossTotal).toBe(1130)
  })

  it('shows an error and never resolves when the server rejects the merge', async () => {
    fetchServerVersion.mockResolvedValue(serverDoc)
    forceApply.mockResolvedValue({ status: 'rejected', message: 'Stale document' })
    renderEn(
      <ConflictResolutionModal entry={entry} onClose={onClose} onResolved={onResolved} />,
    )
    await screen.findByText('Offline narration')

    fireEvent.click(screen.getByRole('button', { name: /Apply Resolution/ }))

    expect(await screen.findByText('Stale document')).toBeInTheDocument()
    expect(onResolved).not.toHaveBeenCalled()
  })

  it('shows the fetch error when the server version cannot be loaded', async () => {
    fetchServerVersion.mockRejectedValue(new Error('offline'))
    renderEn(
      <ConflictResolutionModal entry={entry} onClose={onClose} onResolved={onResolved} />,
    )
    expect(
      (await screen.findAllByText('Could not fetch server version')).length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: /Apply Resolution/ })).toBeDisabled()
  })

  it('closes via Cancel', async () => {
    fetchServerVersion.mockResolvedValue(serverDoc)
    renderEn(
      <ConflictResolutionModal entry={entry} onClose={onClose} onResolved={onResolved} />,
    )
    await screen.findByText('Offline narration')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })
})
