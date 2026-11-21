/* ================================================================
 * Cash Flow Statement — operating, investing, financing activities.
 *
 * Built from posted journal entries for cash/bank accounts (class=cash|bank).
 * Runs entirely on frontend using existing ledger endpoint.
 * ================================================================ */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, FileText, Printer, Download, Calculator } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, fmt, list } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { exportReportPdf } from '../lib/pdf'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { ReportSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useT } from '../lib/i18n'
import type { Account, LedgerRow } from '../lib/types'
import NepaliDateInput from '../components/NepaliDateInput'

const QUICK_RANGES = [
  { label: 'This Month', from: () => monthStart(0), to: () => monthEnd(0) },
  { label: 'Last Month', from: () => monthStart(-1), to: () => monthEnd(-1) },
  { label: 'This FY', from: () => fyStart(), to: () => fyEnd() },
  { label: 'All Time', from: () => '', to: () => '' },
]
function monthStart(o: number): string { const d = new Date(); d.setMonth(d.getMonth() + o, 1); return d.toISOString().slice(0, 10) }
function monthEnd(o: number): string { const d = new Date(); d.setMonth(d.getMonth() + o + 1, 0); return d.toISOString().slice(0, 10) }
function fyStart(): string { const n = new Date(); return (n.getMonth() >= 6 ? n.getFullYear() : n.getFullYear() - 1) + '-07-16' }
function fyEnd(): string { const n = new Date(); return (n.getMonth() >= 6 ? n.getFullYear() + 1 : n.getFullYear()) + '-07-15' }

interface CashFlowSection {
  title: string
  items: { label: string; amount: number }[]
  total: number
}

export default function CashFlowStatement() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const t = useT()
  const { formatDate } = useCalendar()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cashAccounts, setCashAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [from, setFrom] = useState(fyStart())
  const [to, setTo] = useState(fyEnd())
  const [sections, setSections] = useState<CashFlowSection[]>([])
  const [openingCash, setOpeningCash] = useState(0)
  const [closingCash, setClosingCash] = useState(0)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await list<Account>('gl-accounts', {
          depth: 0,
          sort: 'code',
          limit: 1000,
          ...tenantQuery,
        })
        setAccounts(res.docs)
        const cash = res.docs.filter((a) => a.class === 'cash' || a.class === 'bank')
        setCashAccounts(cash)
      } catch {
        // Non-fatal
      }
    })()
  }, [tenantId])

  const load = useCallback(async () => {
    if (cashAccounts.length === 0) return
    setLoading(true)
    setError('')
    try {
      // Fetch ledger for all cash/bank accounts in parallel
      const ledgerPromises = cashAccounts.map((acct) => {
        const q: any = {
          account: String(acct.id),
          ...tenantQuery,
        }
        if (from) q.from = from
        if (to) q.to = to
        return api<LedgerRow[]>('/journal-entries/ledger', { query: q })
      })
      const allLedgers = await Promise.all(ledgerPromises)

      // Calculate opening balance for each cash account (before `from` date)
      let totalOpening = 0
      for (let i = 0; i < cashAccounts.length; i++) {
        const acct = cashAccounts[i]
        const openingQ: any = {
          account: String(acct.id),
          ...tenantQuery,
          to: from ? new Date(from).toISOString().slice(0, 10) : undefined,
        }
        const openingRes = await api<LedgerRow[]>('/journal-entries/ledger', { query: openingQ })
        const openingBal = openingRes.reduce((sum, r) => sum + r.debit - r.credit, 0)
        totalOpening += openingBal
      }
      setOpeningCash(totalOpening)

      // Build cash flow sections
      const operating: { label: string; amount: number }[] = []
      const investing: { label: string; amount: number }[] = []
      const financing: { label: string; amount: number }[] = []

      let totalCashMovement = 0

      for (let i = 0; i < cashAccounts.length; i++) {
        const acct = cashAccounts[i]
        const rows = allLedgers[i]
        for (const row of rows) {
          const movement = row.debit - row.credit
          totalCashMovement += movement

          // Simple classification based on counterparty account type
          // In a full implementation, this would use account mappings
          const label = `${acct.code} ${acct.name}: ${row.narration || '—'} (${row.docType || 'JV'} ${row.docNumber || ''})`.trim()
          
          // Default to operating for now; can be enhanced with account mappings
          operating.push({ label, amount: movement })
        }
      }

      const opTotal = operating.reduce((s, i) => s + i.amount, 0)
      const invTotal = investing.reduce((s, i) => s + i.amount, 0)
      const finTotal = financing.reduce((s, i) => s + i.amount, 0)

      setSections([
        { title: t('reports.operatingActivities', 'Operating Activities'), items: operating, total: opTotal },
        { title: t('reports.investingActivities', 'Investing Activities'), items: investing, total: invTotal },
        { title: t('reports.financingActivities', 'Financing Activities'), items: financing, total: finTotal },
      ])
      setClosingCash(totalOpening + totalCashMovement)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load cash flow')
    } finally {
      setLoading(false)
    }
  }, [cashAccounts, from, to, tenantId, tenantQuery, t])

  useEffect(() => { load() }, [load])

  const netChange = useMemo(() => sections.reduce((s, sec) => s + sec.total, 0), [sections])

  const exportCsv = () => {
    const headers = ['', 'Description', 'Amount', '']
    const rows: (string | number)[][] = []
    rows.push(['Cash Flow Statement', '', '', ''])
    rows.push(['Period', `${from || 'Earliest'} to ${to || 'Latest'}`, '', ''])
    rows.push(['', '', '', ''])
    rows.push(['Section', 'Description', 'Amount', ''])
    for (const sec of sections) {
      rows.push([sec.title, '', '', ''])
      for (const item of sec.items) {
        rows.push(['', item.label, item.amount, ''])
      }
      rows.push(['', `${t('common.total', 'Total')} ${sec.title}`, sec.total, ''])
    }
    rows.push(['', '', '', ''])
    rows.push(['', t('reports.openingCash', 'Opening Cash & Bank'), openingCash, ''])
    rows.push(['', t('reports.netChange', 'Net Change in Cash'), netChange, ''])
    rows.push(['', t('reports.closingCash', 'Closing Cash & Bank'), closingCash, ''])

    downloadCsv(`cash-flow-${from || 'all'}-${to || 'all'}.csv`, headers, rows)
  }

  const exportPdf = () => {
    const tables: any[] = []
    for (const sec of sections) {
      tables.push({
        title: sec.title,
        columns: ['Description', 'Amount'],
        rows: sec.items.map((i) => [i.label, i.amount.toFixed(2)]),
        totals: ['Total', sec.total.toFixed(2)],
      })
    }
    exportReportPdf({
      filename: `cash-flow-${from || 'all'}-${to || 'all'}.pdf`,
      title: t('reports.cashFlowStatement', 'Cash Flow Statement'),
      subtitle: '',
      meta: [
        ['Period', `${from || 'Earliest'} to ${to || 'Latest'}`],
        ['Generated', new Date().toLocaleString()],
        ['Opening Cash', fmt(openingCash)],
        ['Net Change', fmt(netChange)],
        ['Closing Cash', fmt(closingCash)],
      ],
      tables,
    })
  }

  return (
    <div className="w-full pb-28">
      {/* ── Header ── */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{t('reports.cashFlowStatement', 'Cash Flow Statement')}</h1>
            <p className="text-sm text-slate-500">{t('reports.cashFlowDesc', 'Cash and bank movements by activity. Built from posted entries.')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {sections.length > 0 && (
            <>
              <button onClick={exportCsv} className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <Download size={14} /> {t('common.export', 'Export')}
              </button>
              <button onClick={exportPdf} className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <FileText size={14} /> {t('common.pdf', 'PDF')}
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <Printer size={14} /> {t('common.print', 'Print')}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="mt-4 flex flex-wrap items-end gap-4 px-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t('reports.from', 'From')}</label>
          <NepaliDateInput value={from} onChange={(v) => setFrom(v)} disabled={loading} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t('reports.to', 'To')}</label>
          <NepaliDateInput value={to} onChange={(v) => setTo(v)} disabled={loading} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t('reports.quick', 'Quick')}</label>
          <div className="flex gap-1">
            {QUICK_RANGES.map((r) => (
              <button key={r.label} type="button" onClick={() => { setFrom(r.from()); setTo(r.to()); }} disabled={loading} className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <ReportSkeleton sections={3} />}

      {!loading && sections.length === 0 && !error && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
          <Calculator size={18} className="mx-auto mb-2 text-slate-400" />
          <p className="text-sm text-slate-500">{t('reports.noCashFlowData', 'No cash/bank movements for the selected period.')}</p>
        </div>
      )}

      {sections.length > 0 && (
        <div className="mt-6 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs text-emerald-700 font-medium">{t('reports.openingCash', 'Opening Cash & Bank')}</p>
              <p className="text-2xl font-mono font-semibold text-emerald-900">{fmt(openingCash)}</p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs text-blue-700 font-medium">{t('reports.netChange', 'Net Change in Cash')}</p>
              <p className="text-2xl font-mono font-semibold text-blue-900">{fmt(netChange)}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-white p-4">
              <p className="text-xs text-slate-700 font-medium">{t('reports.closingCash', 'Closing Cash & Bank')}</p>
              <p className="text-2xl font-mono font-semibold text-slate-900">{fmt(closingCash)}</p>
            </div>
          </div>

          {/* Sections */}
          {sections.map((sec) => (
            <div key={sec.title} className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 font-medium text-slate-800">
                {sec.title}
              </div>
              {sec.items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  {t('reports.noItems', 'No items in this section.')}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3 text-left">{t('common.description', 'Description')}</th>
                      <th className="px-3 py-3 text-right w-32 font-mono">{t('common.amount', 'Amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-50">
                        <td className="px-3 py-2 text-left text-sm text-slate-700 truncate max-w-md">{item.label}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-slate-700">{item.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50">
                    <tr>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-slate-800">{t('common.total', 'Total')}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-slate-800">{sec.total.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          ))}

          {/* Reconciliation */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">{t('reports.reconciliation', 'Reconciliation')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('reports.openingCash', 'Opening Cash & Bank')}</span>
                  <span className="font-mono font-medium">{fmt(openingCash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('reports.netOperating', 'Net Operating Activities')}</span>
                  <span className="font-mono font-medium">{fmt(sections[0]?.total || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('reports.netInvesting', 'Net Investing Activities')}</span>
                  <span className="font-mono font-medium">{fmt(sections[1]?.total || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('reports.netFinancing', 'Net Financing Activities')}</span>
                  <span className="font-mono font-medium">{fmt(sections[2]?.total || 0)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold">
                  <span>{t('reports.closingCash', 'Closing Cash & Bank')}</span>
                  <span className="font-mono">{fmt(closingCash)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('reports.netChange', 'Net Change in Cash')}</span>
                  <span className="font-mono font-medium">{fmt(netChange)}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {t('reports.reconciliationNote', 'Opening Cash + Net Change = Closing Cash')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-2">
        <DataStatus />
      </div>
    </div>
  )
}