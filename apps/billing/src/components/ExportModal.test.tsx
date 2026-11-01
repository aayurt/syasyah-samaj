/**
 * ExportModal component tests (MISSION.md M6 — mission-critical UI).
 * Network/DOM side-effects mocked; rendering + user flows asserted.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExportModal from './ExportModal'
import { ENTITY_REGISTRY } from '../lib/excel/entities'

const mockFetchAllDocs = vi.hoisted(() => vi.fn())
const mockBuildCsv = vi.hoisted(() => vi.fn())
const mockBuildJson = vi.hoisted(() => vi.fn())
const mockDownload = vi.hoisted(() => vi.fn())
const mockBuildEntityExcel = vi.hoisted(() => vi.fn())
const mockBuildTemplate = vi.hoisted(() => vi.fn())
const mockToast = vi.hoisted(() => vi.fn())

vi.mock('../lib/importExport', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchAllDocs: mockFetchAllDocs,
  buildExportCsv: mockBuildCsv,
  buildExportJson: mockBuildJson,
  downloadBlob: mockDownload,
}))

vi.mock('../lib/excel/entityIo', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  buildEntityExcel: mockBuildEntityExcel,
  buildTemplate: mockBuildTemplate,
}))

vi.mock('../lib/toast', () => ({ pushToast: mockToast }))
vi.mock('../lib/i18n', () => ({ useT: () => (k: string, fb?: string) => fb ?? k }))
vi.mock('../lib/tenant', () => ({
  useTenantQuery: () => ({ tenant: 't1' }),
  useTenant: () => ({ tenantId: 'T-1' }),
}))

const onClose = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchAllDocs.mockResolvedValue([{ id: 1, name: 'Kiran' }])
  mockBuildCsv.mockReturnValue(new Blob(['csv']))
  mockBuildJson.mockReturnValue(new Blob(['{}']))
  mockBuildEntityExcel.mockResolvedValue(new Blob(['xlsx']))
  mockBuildTemplate.mockResolvedValue(new Blob(['template']))
})

describe('ExportModal', () => {
  it('lists every registry entity as an export option', () => {
    render(<ExportModal onClose={onClose} />)
    for (const cfg of ENTITY_REGISTRY) {
      expect(screen.getByText(`${cfg.label} (${cfg.slug})`)).toBeInTheDocument()
    }
  })

  it('offers Excel, CSV, JSON and template formats', () => {
    render(<ExportModal onClose={onClose} />)
    expect(screen.getByText('Excel (.xlsx)')).toBeInTheDocument()
    expect(screen.getByText('CSV (.csv)')).toBeInTheDocument()
    expect(screen.getByText('JSON Backup (.json)')).toBeInTheDocument()
    expect(screen.getByText('Blank template (.xlsx)')).toBeInTheDocument()
  })

  it('exports Excel with depth-1 data through buildEntityExcel', async () => {
    const user = userEvent.setup()
    render(<ExportModal onClose={onClose} />)
    await user.click(screen.getByText('Excel (.xlsx)'))
    await user.click(screen.getByText(/Download/))

    expect(mockFetchAllDocs).toHaveBeenCalledWith('members', { tenant: 't1' }, 500, 1)
    expect(mockBuildEntityExcel).toHaveBeenCalledWith(
      'members',
      [{ id: 1, name: 'Kiran' }],
      { tenantName: 'T-1' },
    )
    expect(mockDownload).toHaveBeenCalledWith(
      expect.stringMatching(/members_T-1_.*\.xlsx$/),
      expect.any(Blob),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('downloads a template WITHOUT fetching any data', async () => {
    const user = userEvent.setup()
    render(<ExportModal onClose={onClose} />)
    await user.click(screen.getByText('Blank template (.xlsx)'))
    await user.click(screen.getByText(/Download/))

    expect(mockBuildTemplate).toHaveBeenCalledWith('members')
    expect(mockFetchAllDocs).not.toHaveBeenCalled()
    expect(mockDownload).toHaveBeenCalledWith(
      expect.stringMatching(/members_template_.*\.xlsx$/),
      expect.any(Blob),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('downloads CSV for the csv format', async () => {
    const user = userEvent.setup()
    render(<ExportModal onClose={onClose} />)
    await user.click(screen.getByText('CSV (.csv)'))
    await user.click(screen.getByText(/Download/))

    expect(mockBuildCsv).toHaveBeenCalledWith([{ id: 1, name: 'Kiran' }])
    expect(mockDownload).toHaveBeenCalledWith(
      expect.stringMatching(/\.csv$/),
      expect.any(Blob),
    )
  })

  it('shows an info toast and downloads nothing when there is no data', async () => {
    const user = userEvent.setup()
    mockFetchAllDocs.mockResolvedValue([])
    render(<ExportModal onClose={onClose} />)
    await user.click(screen.getByText('Excel (.xlsx)'))
    await user.click(screen.getByText(/Download/))

    expect(mockDownload).not.toHaveBeenCalled()
    expect(mockToast).toHaveBeenCalledWith('info', expect.any(String), expect.any(String))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes via the X button without exporting', async () => {
    const user = userEvent.setup()
    render(<ExportModal onClose={onClose} />)
    const closeBtn = screen.getAllByRole('button').find((b) => b.querySelector('svg.lucide-x'))
    expect(closeBtn).toBeDefined()
    await user.click(closeBtn!)
    expect(onClose).toHaveBeenCalled()
    expect(mockDownload).not.toHaveBeenCalled()
  })
})
