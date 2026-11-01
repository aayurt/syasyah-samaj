/**
 * PrintVoucher component tests (MISSION.md M6).
 * Prints the voucher: doc label, number, in-words text, local-id offline badge.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrintVoucher from './PrintVoucher'
import { LangContext } from '../lib/i18n'
import type { Document, Account } from '../lib/types'

const apiMock = vi.hoisted(() => vi.fn<() => Promise<{ nepaliWordsOnPrintEnabled?: boolean }>>())
const getEngineMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/api', () => ({
  api: apiMock,
  getEngine: vi.fn(() => ({ resolveLocalId: vi.fn(() => Promise.resolve(null)), readDoc: vi.fn(() => Promise.resolve({})) })),
}))

vi.mock('../lib/nepaliNumbers', () => ({
  numberToNepaliWords: (n: number) => `Nepali Words ${n}`,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const baseDoc: Document = {
  id: 7,
  docType: 'sales-invoice',
  number: 'INV-007',
  date: '2026-01-15',
  status: 'posted',
  narration: 'Weekly sale',
  lines: [{ id: 'l1', description: 'Rice', qty: 2, rate: 500, amount: 1000 }],
  grossTotal: 1000,
  netTotal: 1000,
  taxTotal: 0,
  party: { id: 1, name: 'Aama', type: 'customer' } as const,
}

const accounts: Account[] = [
  { id: 1, code: '1000', name: 'Cash in Hand', type: 'asset' },
]

describe('PrintVoucher', () => {
  it('renders the doc type label and number', () => {
    apiMock.mockResolvedValue({ nepaliWordsOnPrintEnabled: false })
    render(
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
        <PrintVoucher doc={baseDoc} accounts={accounts} partyName="Aama Gurung" />
      </LangContext.Provider>,
    )
    expect(screen.getByText('Sales Invoice')).toBeInTheDocument()
    expect(screen.getByText('INV-007')).toBeInTheDocument()
  })

  it('renders the amount in words (English) when nepaliWordsOnPrintEnabled is off', async () => {
    apiMock.mockResolvedValue({ nepaliWordsOnPrintEnabled: false })
    render(
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
        <PrintVoucher doc={{ ...baseDoc, grossTotal: 1000 }} accounts={accounts} partyName="Aama" />
      </LangContext.Provider>,
    )
    // numToWords(1000) = "One Thousand Only"
    expect(screen.getByText(/One Thousand Only/)).toBeInTheDocument()
  })

  it('renders the Nepali in-words text when the setting is on', async () => {
    apiMock.mockResolvedValue({ nepaliWordsOnPrintEnabled: true })
    render(
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
        <PrintVoucher doc={{ ...baseDoc, grossTotal: 1000 }} accounts={accounts} partyName="Aama" />
      </LangContext.Provider>,
    )
    // The setting arrives from the cache-first globals read — wait for it.
    // Mocked Nepali words helper returns "Nepali Words 1000".
    expect(await screen.findByText('Nepali Words 1000')).toBeInTheDocument()
  })

  it('renders the local-id offline badge when the doc id starts with "local-"', () => {
    render(
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
        <PrintVoucher
          doc={{ ...baseDoc, id: 'local-000000000007' as any, number: undefined }}
          accounts={accounts}
          partyName="Aama"
        />
      </LangContext.Provider>,
    )
    expect(screen.getByText('LOCAL-000000000007')).toBeInTheDocument()
  })

  it('does not show the offline badge for a server (numeric) id', () => {
    render(
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
        <PrintVoucher
          doc={{ ...baseDoc, id: 123, number: undefined }}
          accounts={accounts}
          partyName="Aama"
        />
      </LangContext.Provider>,
    )
    // Numeric ids are already synced — no LOCAL- prefix, just the draft mark.
    expect(screen.queryByText(/LOCAL-/)).not.toBeInTheDocument()
    expect(screen.getByText('— draft —')).toBeInTheDocument()
  })

  it('renders a draft number fallback when the document has no number and is not local', () => {
    render(
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
        <PrintVoucher doc={{ ...baseDoc, number: undefined, id: 999 }} accounts={accounts} partyName="Aama" />
      </LangContext.Provider>,
    )
    // Non-local docs with no number show "— draft —"
    expect(screen.getByText('— draft —')).toBeInTheDocument()
  })

  it('renders the party name', () => {
    render(
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
        <PrintVoucher doc={baseDoc} accounts={accounts} partyName="Aama Gurung" />
      </LangContext.Provider>,
    )
    expect(screen.getByText('Aama Gurung')).toBeInTheDocument()
  })

  it('renders the narration', () => {
    render(
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
        <PrintVoucher doc={baseDoc} accounts={accounts} partyName="Aama" />
      </LangContext.Provider>,
    )
    expect(screen.getByText('Weekly sale')).toBeInTheDocument()
  })

  it('renders the item line table', () => {
    render(
      <LangContext.Provider value={{ lang: 'en', setLang: () => {} }}>
        <PrintVoucher doc={baseDoc} accounts={accounts} partyName="Aama" />
      </LangContext.Provider>,
    )
    expect(screen.getByText('Rice')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    // Rate and amount cells include the "Rs. " prefix.
    expect(screen.getByText('Rs. 500')).toBeInTheDocument()
    expect(screen.getAllByText(/Rs\. 1,000/).length).toBeGreaterThan(0)
  })
})
