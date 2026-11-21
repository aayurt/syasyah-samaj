/* ================================================================
 * General Ledger — transaction detail for each account.
 *
 * Source of truth: posted journal entries (GET /journal-entries/ledger).
 * Draft/pending entries never appear here.
 * ================================================================ */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, list } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { exportReportPdf } from '../lib/pdf'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import ReportLayout, { DateFilter, ReportTableHeader, ReportTableRow } from '../components/ReportLayout'
import { ReportSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useT } from '../lib/i18n'
import type { Account, LedgerRow } from '../lib/types'

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

const TABLE_COLS = [
  { label: 'Date', key: 'date', align: 'left' as const },
  { label: 'Doc Type', key: 'docType', align: 'left' as const },
  { label: 'No.', key: 'docNumber', align: 'left' as const },
  { label: 'Narration', key: 'narration', align: 'left' as const },
  { label: 'Debit', key: 'debit', align: 'right' as const },
  { label: 'Credit', key: 'credit', align: 'right' as const },
  { label: 'Balance', key: 'balance', align: 'right' as const },
] as const

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
    <ReportLayout
      title={t('reports.generalLedger', 'General Ledger')}
      titleKey="reports.generalLedger"
      description={t('reports.generalLedgerDesc', 'Posted journal entries by account. Drill down to source vouchers.')}
      descriptionKey="reports.generalLedgerDesc"
      backTo="/reports"
      loading={loading}
      error={error}
      hasData={rows.length > 0 || !!selectedAccount}
      onExportCsv={exportCsv}
      onExportPdf={exportPdf}
      pdfTitle="General Ledger"
      pdfSubtitle={selectedAccount ? `${selectedAccount.code ? selectedAccount.code + ' · ' : ''}${selectedAccount.name}` : ''}
      pdfMeta={[
        ['Account', selectedAccount ? `${selectedAccount.code ? selectedAccount.code + ' - ' : ''}${selectedAccount.name}` : ''],
        ['Period', `${from || 'Earliest'} to ${to || 'Latest'}`],
      ]}
    >
      <div className="mt-4">
        {/* ── Account selector + filters ── */}
        <div className="flex flex-wrap items-end gap-4 px-2">
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
              disabled={loading || !rows.length && !selectedAccount}
            >
              <option value="">{t('reports.selectAccount', 'Select an account')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.code ? `${a.code} · ` : ''}{a.name}
                </option>
              ))}
            </select>
          </div>
          <DateFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} quickRanges={QUICK_RANGES} />
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
              <table className="w-full text-sm min-w-[700px]">
                {ReportTableHeader(TABLE_COLS.map((c) => ({ label: t(`vouchers.${c.key}` as any, c.label), key: c.key, align: c.align })))}
                <tbody className="divide-y divide-slate-50">
                  {rows.map((r) => (
                    <React.Fragment key={r.id}>
                      {ReportTableRow(TABLE_COLS.map((c) => ({ key: c.key, align: c.align })), {
                        date: formatDate ? formatDate(r.date) : r.date,
                        docType: r.docType || '—',
                        docNumber: r.docNumber || '—',
                        narration: r.narration,
                        debit: r.debit,
                        credit: r.credit,
                        balance: r.balance,
                      })}
                    </React.Fragment>
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
      </div>

      <div className="mt-2">
        <DataStatus />
      </div>
    </ReportLayout>
  )
}
