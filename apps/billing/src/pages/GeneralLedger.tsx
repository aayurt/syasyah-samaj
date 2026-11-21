/* ================================================================
 * General Ledger — transaction detail for each account.
 *
 * Source of truth: posted journal entries (GET /journal-entries/ledger).
 * Draft/pending entries never appear here.
 * ================================================================ */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, FileText, Printer, Search, Download } from 'lucide-react'
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

export default function GeneralLedger() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const t = useT()
  const { formatDate } = useCalendar()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const totalDebit = useMemo(() => rows.reduce((s, r) => s + r.debit, 0), [rows])
  const totalCredit = useMemo(() => rows.reduce((s, r) => s + r.credit, 0), [rows])
  const closing = useMemo(() => totalDebit - totalCredit, [totalDebit, totalCredit])

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
      } catch {
        // Non-fatal: account selector will be empty until data loads.
      }
    })()
  }, [tenantId])

  const load = useCallback(async () => {
    if (!selectedAccount) return
    setLoading(true)
    setError('')
    try {
      const q: any = {
        account: String(selectedAccount.id),
        ...tenantQuery,
      }
      if (from) q.from = from
      if (to) q.to = to
      const res = await api<LedgerRow[]>('/journal-entries/ledger', { query: q })
      setRows(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load ledger')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [selectedAccount, from, to, tenantId])

  useEffect(() => { load() }, [load])

  const handleSelect = (acct: Account) => {
    setSelectedAccount(acct)
    setRows([])
  }

  const exportCsv = () => {
    if (!selectedAccount) return
    downloadCsv(`ledger-${selectedAccount.code || selectedAccount.id}.csv`, [
      'Date', 'Doc Type', 'Doc No.', 'Narration', 'Debit', 'Credit', 'Balance',
    ], rows.map((r) => [
      r.date,
      r.docType || '',
      r.docNumber || '',
      r.narration,
      r.debit,
      r.credit,
      r.balance,
    ]))
  }

  const exportPdf = () => {
    if (!selectedAccount) return
    exportReportPdf({
      filename: `ledger-${selectedAccount.code || selectedAccount.id}.pdf`,
      title: 'General Ledger',
      subtitle: `${selectedAccount.code ? selectedAccount.code + ' · ' : ''}${selectedAccount.name}`,
      meta: [
        ['Account', `${selectedAccount.code ? selectedAccount.code + ' - ' : ''}${selectedAccount.name}`],
        ['Period', `${from || 'Earliest'} to ${to || 'Latest'}`],
        ['Generated', new Date().toLocaleString()],
      ],
      tables: [
        {
          title: `Ledger — ${selectedAccount.name}`,
          columns: ['Date', 'Doc Type', 'Doc No.', 'Narration', 'Debit', 'Credit', 'Balance'],
          rows: rows.map((r) => [
            r.date,
            r.docType || '',
            r.docNumber || '',
            r.narration,
            r.debit.toFixed(2),
            r.credit.toFixed(2),
            r.balance.toFixed(2),
          ]),
          totals: ['Total', '', '', '', totalDebit.toFixed(2), totalCredit.toFixed(2), closing.toFixed(2)],
        },
      ],
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
            <h1 className="text-lg font-semibold text-slate-900">{t('reports.generalLedger', 'General Ledger')}</h1>
            <p className="text-sm text-slate-500">{t('reports.generalLedgerDesc', 'Posted journal entries by account. Drill down to source vouchers.')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {rows.length > 0 && (
            <>
              <button
                type="button"
                onClick={exportCsv}
                className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Download size={14} /> {t('common.export', 'Export')}
              </button>
              <button
                type="button"
                onClick={exportPdf}
                className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <FileText size={14} /> {t('common.pdf', 'PDF')}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
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

      {/* ── Account selector + filters ── */}
      <div className="mt-4 flex flex-wrap items-end gap-4 px-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t('reports.account', 'Account')}</label>
          <select
            value={selectedAccount ? String(selectedAccount.id) : ''}
            onChange={(e) => {
              const id = Number(e.target.value)
              const acct = accounts.find((a) => a.id === id)
              if (acct) handleSelect(acct)
            }}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
            disabled={loading}
          >
            <option value="">{t('reports.selectAccount', 'Select an account')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.code ? `${a.code} · ` : ''}{a.name}
              </option>
            ))}
          </select>
        </div>
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
              <button
                key={r.label}
                type="button"
                onClick={() => {
                  setFrom(r.from())
                  setTo(r.to())
                }}
                disabled={loading}
                className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!selectedAccount && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
          <Search size={18} className="mx-auto mb-2 text-slate-400" />
          <p className="text-sm text-slate-500">{t('reports.selectAccountToView', 'Select an account to view its ledger.')}</p>
        </div>
      )}

      {selectedAccount && (
        <>
          {/* ── Ledger table ── */}
          <div className="mt-6 rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 text-left w-20">{t('common.date', 'Date')}</th>
                  <th className="px-3 py-3 text-left w-16">{t('vouchers.docType', 'Doc Type')}</th>
                  <th className="px-3 py-3 text-left w-24">{t('common.number', 'No.')}</th>
                  <th className="px-3 py-3 text-left">{t('common.narration', 'Narration')}</th>
                  <th className="px-3 py-3 text-right w-24">{t('vouchers.debit', 'Debit')}</th>
                  <th className="px-3 py-3 text-right w-24">{t('vouchers.credit', 'Credit')}</th>
                  <th className="px-3 py-3 text-right w-24">{t('vouchers.balance', 'Balance')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="px-3 py-2 text-left text-sm text-slate-700">{formatDate ? formatDate(r.date) : r.date}</td>
                    <td className="px-3 py-2 text-left text-sm text-slate-500">{r.docType || '—'}</td>
                    <td className="px-3 py-2 text-left text-sm text-slate-700">{r.docNumber || '—'}</td>
                    <td className="px-3 py-2 text-left text-sm text-slate-700">{r.narration}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-700">{r.debit.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-700">{r.credit.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-900">{r.balance.toFixed(2)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-sm text-slate-500">
                      {t('reports.noEntries', 'No posted entries for this period.')}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right text-sm font-semibold text-slate-800">
                    {t('vouchers.total', 'Total')}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-slate-800">{totalDebit.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-slate-800">{totalCredit.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-slate-800">{closing.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      <div className="mt-2">
        <DataStatus />
      </div>
    </div>
  )
}
