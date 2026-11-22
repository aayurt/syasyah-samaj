import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, FileText, Loader2, Printer } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, fmt, list } from '../../lib/api'
import { downloadCsv } from '../../lib/csv'
import { exportReportPdf } from '../../lib/pdf'
import { useCalendar } from '../../lib/calendar'
import { useTenant, useTenantQuery } from '../../lib/tenant'
import DataStatus from '../../components/DataStatus'
import { useT } from '../../lib/i18n'
import SearchBox from '../../components/SearchBox'
import ReportFilterBar from '../../components/ReportFilterBar'
import { ReportBreakdownBar } from '../../components/ReportCharts'
import {
  DOC_TYPE_LABELS,
  baseCurrencyOf,
  effectiveAmount,
  toBaseCurrency,
  type BillingSettings,
  type Currency,
  type Document,
  type Party,
} from '../../lib/types'

interface PartyDoc extends Document {
  partyName?: string
  debit?: number
  credit?: number
  runningBalance?: number
}

export default function PartyStatement() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const t = useT()
  const { formatDate } = useCalendar()
  const [parties, setParties] = useState<Party[]>([])
  const [selectedParty, setSelectedParty] = useState(searchParams.get('party') || '')
  const [docs, setDocs] = useState<PartyDoc[]>([])
  const [base, setBase] = useState<Currency>('NPR')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const loadParties = useCallback(async () => {
    try {
      const p = await list<Party>('parties', { depth: 0, sort: 'name', ...tenantQuery })
      setParties(p.docs || [])
    } catch {
      /* ignore */
    }
  }, [tenantId])

  useEffect(() => {
    loadParties()
  }, [loadParties])

  const loadDocs = useCallback(async () => {
    if (!selectedParty) {
      setDocs([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const partyIdNum = Number(selectedParty)
      const res = await list<Document>('documents', {
        depth: 1,
        sort: 'date',
        ...tenantQuery,
        where: { party: { equals: partyIdNum } },
      })
      const s = await api<BillingSettings>('/globals/billing-settings', {
        query: { depth: 1 },
      }).catch(() => ({} as BillingSettings))
      setBase(baseCurrencyOf(s))

      // Filter by partyId explicitly to guarantee isolation
      const partyDocs = (res?.docs || []).filter((d: any) => {
        const pid = typeof d.party === 'object' && d.party !== null ? d.party.id : Number(d.party)
        return pid === partyIdNum
      })

      const partyObj = parties.find((p) => p.id === partyIdNum)
      setDocs(
        partyDocs.map((d: any) => ({
          ...d,
          partyName: (typeof d.party === 'object' && d.party?.name) || partyObj?.name || '',
        })),
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load party statement')
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [selectedParty, tenantId, parties])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  const party = parties.find((p) => String(p.id) === selectedParty)
  const isVendor = party?.type === 'vendor'

  // Sort documents chronologically
  const sortedDocs = useMemo(() => {
    return [...docs].sort(
      (a, b) => (a.date || '').localeCompare(b.date || '') || (Number(a.id) || 0) - (Number(b.id) || 0),
    )
  }, [docs])

  // Partition into Opening Balance (before `from`) and Period Docs
  const { openingBalance, periodDocs } = useMemo(() => {
    let opening = 0
    const period: PartyDoc[] = []

    for (const d of sortedDocs) {
      const dDate = (d.date || '').slice(0, 10)
      const amt = effectiveAmount(d)
      let debit = 0
      let credit = 0

      if (isVendor) {
        // Vendor accounting:
        // Purchase invoices and credit notes increase payable (Credit)
        // Payments and debit notes decrease payable (Debit)
        if (d.docType === 'payment-voucher' || d.docType === 'debit-note') debit = amt
        else credit = amt
        const change = credit - debit
        if (from && dDate && dDate < from) {
          opening += change
        } else if (!to || !dDate || dDate <= to) {
          period.push(d)
        }
      } else {
        // Customer accounting:
        // Sales invoices and debit notes increase receivable (Debit)
        // Receipts and credit notes decrease receivable (Credit)
        if (d.docType === 'sales-invoice' || d.docType === 'debit-note') debit = amt
        else credit = amt
        const change = debit - credit
        if (from && dDate && dDate < from) {
          opening += change
        } else if (!to || !dDate || dDate <= to) {
          period.push(d)
        }
      }
    }
    return { openingBalance: opening, periodDocs: period }
  }, [sortedDocs, from, to, isVendor])

  // Compute running balance across period docs
  const running = useMemo(() => {
    let bal = openingBalance
    return periodDocs.map((d) => {
      const amt = effectiveAmount(d)
      let debit = 0
      let credit = 0

      if (isVendor) {
        if (d.docType === 'payment-voucher' || d.docType === 'debit-note') debit = amt
        else credit = amt
        bal += credit - debit
      } else {
        if (d.docType === 'sales-invoice' || d.docType === 'debit-note') debit = amt
        else credit = amt
        bal += debit - credit
      }

      return {
        ...d,
        debit,
        credit,
        runningBalance: bal,
      }
    })
  }, [periodDocs, openingBalance, isVendor])

  const filtered = useMemo(() => {
    return running.filter((d) => {
      if (!query) return true
      return `${d.number || ''} ${d.narration || ''} ${DOC_TYPE_LABELS[d.docType] || d.docType}`
        .toLowerCase()
        .includes(query.toLowerCase())
    })
  }, [running, query])

  const totalDebit = running.reduce((s, d) => s + (d.debit || 0), 0)
  const totalCredit = running.reduce((s, d) => s + (d.credit || 0), 0)
  const closingBalance = running.length > 0 ? (running[running.length - 1].runningBalance || 0) : openingBalance

  const totalDebitBase = running.reduce(
    (s, d) => s + toBaseCurrency(d.debit || 0, d, base),
    0,
  )
  const totalCreditBase = running.reduce(
    (s, d) => s + toBaseCurrency(d.credit || 0, d, base),
    0,
  )

  const csv = () =>
    downloadCsv(
      `${party?.name || 'party'}-statement.csv`,
      ['Date', 'Type', 'Number', 'Narration', 'Debit', 'Credit', 'Running Balance'],
      filtered.map((d) => [
        formatDate(d.date),
        DOC_TYPE_LABELS[d.docType] || d.docType,
        d.number || '',
        d.narration || '',
        d.debit || 0,
        d.credit || 0,
        d.runningBalance ?? 0,
      ]),
    )

  const pdf = () =>
    exportReportPdf({
      filename: `${party?.name || 'party'}-statement.pdf`,
      title: `Party Statement — ${party?.name || ''} (${party?.type ? party.type.toUpperCase() : 'PARTY'})`,
      meta: [
        ['Party Type', (party?.type || 'Customer').toUpperCase()],
        ['From', from || 'Earliest'],
        ['To', to || 'Latest'],
        ['Opening Balance', fmt(openingBalance)],
        ['Total Debit', fmt(totalDebit)],
        ['Total Credit', fmt(totalCredit)],
        ['Closing Balance', fmt(closingBalance)],
      ],
      tables: [
        {
          columns: ['Date', 'Type', 'Number', 'Narration', 'Debit', 'Credit', 'Balance'],
          rows: [
            ...(from && openingBalance !== 0
              ? [[formatDate(from), 'Opening', '—', 'Balance Brought Forward', '—', '—', fmt(openingBalance)]]
              : []),
            ...filtered.map((d) => [
              formatDate(d.date),
              DOC_TYPE_LABELS[d.docType] || d.docType,
              d.number || '',
              d.narration || '',
              d.debit ? fmt(d.debit) : '—',
              d.credit ? fmt(d.credit) : '—',
              fmt(d.runningBalance ?? 0),
            ]),
          ],
          totals: ['Totals', '', '', '', fmt(totalDebit), fmt(totalCredit), fmt(closingBalance)],
        },
      ],
    })

  return (
    <div className="w-full">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/reports')}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Back to Reports"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {t('reports.partyStatement', 'Party Statement')}
            </h1>
            {party && (
              <p className="text-xs text-slate-500">
                {party.name} · <span className="capitalize">{party.type}</span>
                {party.taxId ? ` · PAN: ${party.taxId}` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={csv}
            disabled={!selectedParty || loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download size={14} /> {t('common.csv', 'CSV')}
          </button>
          <button
            onClick={pdf}
            disabled={!selectedParty || loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <FileText size={14} /> {t('common.pdf', 'PDF')}
          </button>
          <button
            onClick={() => window.print()}
            disabled={!selectedParty || loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <Printer size={14} /> {t('common.print', 'Print')}
          </button>
        </div>
      </div>

      <div className="mt-2">
        <DataStatus />
      </div>

      {/* Filter Bar with Party Selector & Date Filters */}
      <ReportFilterBar
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        className="mt-4"
        extraControls={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label htmlFor="party-select" className="text-xs font-medium text-slate-600">
                Party:
              </label>
              <select
                id="party-select"
                value={selectedParty}
                onChange={(e) => {
                  setSelectedParty(e.target.value)
                  setDocs([])
                }}
                className="h-8 min-w-[200px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              >
                <option value="">— select party —</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
            </div>

            {loading && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600">
                <Loader2 size={14} className="animate-spin text-blue-600" />
                <span>Loading…</span>
              </span>
            )}

            {selectedParty && (
              <SearchBox value={query} onChange={setQuery} placeholder="Filter transactions…" />
            )}
          </div>
        }
      />

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Loading Spinner View */}
      {loading ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 shadow-xs">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="mt-4 text-sm font-medium text-slate-700">
            {t('reports.loadingPartyStatement', 'Loading party statement…')}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {party?.name ? `Fetching transactions for ${party.name}` : 'Please wait…'}
          </p>
        </div>
      ) : selectedParty ? (
        <>
          {/* Visual Activity Breakdown Bar */}
          {(totalDebit > 0 || totalCredit > 0) && (
            <div className="mt-4">
              <ReportBreakdownBar
                title={`${party?.name || 'Party'} — Activity Turnover`}
                totalLabel="Total Period Volume"
                segments={[
                  {
                    label: isVendor ? 'Payments Made (Debit)' : 'Billed Invoices (Debit)',
                    value: totalDebit,
                    color: 'bg-blue-500',
                  },
                  {
                    label: isVendor ? 'Vendor Bills (Credit)' : 'Receipts Collected (Credit)',
                    value: totalCredit,
                    color: 'bg-emerald-500',
                  },
                ]}
              />
            </div>
          )}

          {/* Metric Summary Cards */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {isVendor ? 'Total Paid / Debits' : 'Total Billed / Debits'}
              </div>
              <div className="mt-1 font-mono text-xl font-semibold text-slate-800">
                {fmt(totalDebit)}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">{fmt(totalDebitBase)} base</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="text-xs uppercase tracking-wide text-slate-500">
                {isVendor ? 'Total Invoiced / Credits' : 'Total Received / Credits'}
              </div>
              <div className="mt-1 font-mono text-xl font-semibold text-slate-800">
                {fmt(totalCredit)}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">{fmt(totalCreditBase)} base</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  {isVendor ? 'Closing Payable' : 'Closing Receivable'}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    closingBalance > 0
                      ? isVendor
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                      : closingBalance < 0
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {closingBalance > 0
                    ? isVendor
                      ? 'Payable to Vendor'
                      : 'Receivable from Customer'
                    : closingBalance < 0
                      ? isVendor
                        ? 'Advance Paid'
                        : 'Advance Received'
                      : 'Settled'}
                </span>
              </div>
              <div
                className={`mt-1 font-mono text-xl font-semibold ${
                  closingBalance > 0
                    ? isVendor
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                    : closingBalance < 0
                      ? 'text-purple-700'
                      : 'text-slate-700'
                }`}
              >
                {fmt(Math.abs(closingBalance))}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">
                {from ? `As of ${formatDate(to || new Date().toISOString().slice(0, 10))}` : 'Net outstanding balance'}
              </div>
            </div>
          </div>

          {/* Transactions Statement Table */}
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Number</th>
                    <th className="px-4 py-2.5">Narration</th>
                    <th className="px-4 py-2.5 text-right">Debit</th>
                    <th className="px-4 py-2.5 text-right">Credit</th>
                    <th className="px-4 py-2.5 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {from && openingBalance !== 0 && (
                    <tr className="bg-slate-50/80 font-medium text-slate-700">
                      <td className="px-4 py-2.5">{formatDate(from)}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                          Opening
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-400">—</td>
                      <td className="px-4 py-2.5 italic text-slate-600">
                        Opening Balance Brought Forward
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-400">—</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-400">—</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-800">
                        {fmt(openingBalance)}
                      </td>
                    </tr>
                  )}

                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                        No transactions for this party.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((d) => (
                      <tr key={d.id} className="transition-colors hover:bg-slate-50/60">
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                          {formatDate(d.date)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {DOC_TYPE_LABELS[d.docType] || d.docType}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-medium text-slate-700">
                          {d.number || '—'}
                        </td>
                        <td className="max-w-xs truncate px-4 py-2.5 text-slate-800" title={d.narration || ''}>
                          {d.narration || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-slate-800">
                          {d.debit ? fmt(d.debit) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-slate-800">
                          {d.credit ? fmt(d.credit) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono font-semibold text-slate-900">
                          {fmt(d.runningBalance ?? 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <p className="text-sm font-medium text-slate-600">Select a party to view its transaction statement.</p>
          <p className="mt-1 text-xs text-slate-400">Choose a customer or vendor from the dropdown above.</p>
        </div>
      )}
    </div>
  )
}
