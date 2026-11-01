/**
 * ImportPreviewModal component tests (MISSION.md M6 — mission-critical UI).
 * classifyRecords stays REAL (dedup logic is the point); fetch/execute mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImportPreviewModal from './ImportPreviewModal'

const mockFetchAllDocs = vi.hoisted(() => vi.fn())
const mockExecuteImport = vi.hoisted(() => vi.fn())
const mockToast = vi.hoisted(() => vi.fn())

vi.mock('../lib/importExport', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchAllDocs: mockFetchAllDocs,
  executeImport: mockExecuteImport,
}))

vi.mock('../lib/toast', () => ({ pushToast: mockToast }))
// MUST be a stable reference — the modal's effect depends on tenantQuery.
const mockTenantQuery = vi.hoisted(() => ({ tenant: 't1' }))
vi.mock('../lib/tenant', () => ({ useTenantQuery: () => mockTenantQuery }))

const DICT = vi.hoisted(() => ({
  'importPreview.title': 'Import preview',
  'importPreview.analyzing': 'Analyzing…',
  'importPreview.newWillBeCreated': '{n} new records will be created',
  'importPreview.similarReview': '{n} similar records need review',
  'importPreview.exactDuplicatesSkip': '{n} exact duplicates will be skipped',
  'importPreview.recordsWillBeImported': '{n} records will be imported',
  'importPreview.importRecords': 'Import {n} records',
  'importPreview.recordsCreated': '{n} records created',
  'importPreview.recordsUpdated': '{n} records updated',
  'importPreview.recordsSkipped': '{n} records skipped',
  'importPreview.importing': 'Importing {done} of {total}…',
  'importPreview.skip': 'Skip',
  'importPreview.update': 'Update',
  'importPreview.createNew': 'Create new',
  'importPreview.willCreate': 'will be created',
  'importPreview.newRecords': '{n} new records',
  'importPreview.similarRecords': '{n} similar records',
  'importPreview.exactDuplicates': '{n} exact duplicates',
  'importPreview.duplicateSkip': 'will be skipped',
  'common.cancel': 'Cancel',
}))

vi.mock('../lib/i18n', () => ({
  useT: () => (k: string, fb?: string) => (DICT as Record<string, string>)[k] ?? fb ?? k,
}))

const onClose = vi.fn()
const onImported = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchAllDocs.mockResolvedValue([])
  mockExecuteImport.mockResolvedValue({ created: 1, updated: 0, skipped: 1, errors: [] })
})

const newMember = { fullName: 'नयाँ सदस्य', phone: '9800000000' }
const existingMember = { id: 1, fullName: 'रत्नकाजी शाक्य', phone: '9841234567' }
/** Same business key as existingMember but WITHOUT an id → tier-2 similar match. */
const similarMember = { fullName: 'रत्नकाजी शाक्य', phone: '9841234567' }

function renderModal(docs: Record<string, unknown>[] = [newMember]) {
  return render(
    <ImportPreviewModal collection="members" docs={docs} onClose={onClose} onImported={onImported} />,
  )
}

describe('ImportPreviewModal', () => {
  it('shows analyzing then the review summary for all-new records', async () => {
    renderModal()
    expect(screen.getByText('Analyzing…')).toBeInTheDocument()

    expect(
      await screen.findByText('1 new records will be created'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Import preview — members (1 records)'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import 1 records' })).toBeEnabled()
  })

  it('classifies duplicates against fetched existing docs', async () => {
    mockFetchAllDocs.mockResolvedValue([existingMember])
    renderModal([similarMember, newMember])

    expect(await screen.findByText('1 new records will be created')).toBeInTheDocument()
    expect(screen.getByText('1 similar records need review')).toBeInTheDocument()
    // Similar record defaults to skip → only the new one counts
    expect(screen.getByText('1 records will be imported')).toBeInTheDocument()
    // The three conflict-rule buttons render for the similar row
    expect(screen.getAllByRole('button', { name: 'Skip' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Update' }).length).toBeGreaterThan(0)
  })

  it('executes with per-record actions and shows the done summary', async () => {
    const user = userEvent.setup()
    mockFetchAllDocs.mockResolvedValue([existingMember])
    renderModal([similarMember, newMember])

    await screen.findByText('1 new records will be created')
    await user.click(screen.getByRole('button', { name: 'Import 1 records' }))

    await waitFor(() => expect(mockExecuteImport).toHaveBeenCalledTimes(1))
    const [collection, records] = mockExecuteImport.mock.calls[0] as [
      string,
      { doc: Record<string, unknown>; action: string }[],
    ]
    expect(collection).toBe('members')
    expect(records).toHaveLength(2)
    expect(records[0]).toEqual({ doc: newMember, action: 'create' })
    expect(records[1]).toEqual({ doc: similarMember, action: 'skip' })

    expect(await screen.findByText('1 records created')).toBeInTheDocument()
    expect(screen.getByText('1 records skipped')).toBeInTheDocument()
    expect(mockToast).toHaveBeenCalledWith('success', 'Import complete', expect.any(String))
    expect(onImported).toHaveBeenCalled()
  })

  it('surfaces import errors in the done view and error toast', async () => {
    mockExecuteImport.mockResolvedValue({
      created: 0,
      updated: 0,
      skipped: 0,
      errors: ["accountCode: '9999' not found in gl-accounts"],
    })
    const user = userEvent.setup()
    renderModal()

    await screen.findByText('1 new records will be created')
    await user.click(screen.getByRole('button', { name: 'Import 1 records' }))

    expect(
      await screen.findByText("accountCode: '9999' not found in gl-accounts"),
    ).toBeInTheDocument()
    expect(mockToast).toHaveBeenCalledWith(
      'error',
      'Import completed with errors',
      '1 errors',
    )
  })

  it('cancels without executing', async () => {
    const user = userEvent.setup()
    renderModal()
    await screen.findByText('1 new records will be created')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(mockExecuteImport).not.toHaveBeenCalled()
  })
})
