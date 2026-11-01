/**
 * Payroll Settings page tests — statute toggles load from the global,
 * flip, and persist back via POST /globals/payroll-settings.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PayrollSettingsPage from './PayrollSettingsPage'

const apiMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', () => ({ api: apiMock }))
vi.mock('../lib/toast', () => ({ pushToast: vi.fn() }))

const SETTINGS = {
  epfEnabled: true,
  esicEnabled: false,
  professionalTaxEnabled: false,
  lwfEnabled: false,
  tdsEnabled: false,
  pfNumber: 'MH/BOM/12345',
  defaultEmploymentState: 'Maharashtra',
  epfPayableAccount: 210,
}

beforeEach(() => {
  apiMock.mockReset()
  apiMock.mockImplementation(async (url: string) => {
    if (url === '/globals/payroll-settings') return SETTINGS
    if (url === '/gl-accounts') return { docs: [{ id: 210, name: 'PF Payable' }] }
    throw new Error(`unexpected url ${url}`)
  })
})

describe('Payroll Settings page', () => {
  it('loads the global into the form', async () => {
    render(<PayrollSettingsPage />)
    const epf = await screen.findByRole('checkbox', { name: /Provident Fund/i })
    expect(epf).toBeChecked()
    expect(screen.getByDisplayValue('MH/BOM/12345')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Maharashtra')).toBeInTheDocument()
  })

  it('toggling a statute and saving posts the whole settings object', async () => {
    render(<PayrollSettingsPage />)
    const esic = await screen.findByRole('checkbox', { name: /Employee State Insurance/i })
    fireEvent.click(esic)
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        '/globals/payroll-settings',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            epfEnabled: true,
            esicEnabled: true,
            professionalTaxEnabled: false,
          }),
        }),
      ),
    )
  })
})
