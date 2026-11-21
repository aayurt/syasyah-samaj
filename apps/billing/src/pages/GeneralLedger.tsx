/* ================================================================
 * General Ledger — transaction detail for each account.
 *
 * Source of truth: posted journal entries (GET /journal-entries/ledger).
 * Draft/pending entries never appear here.
 * ================================================================ */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, fmt, list } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { exportReportPdf } from '../lib/pdf'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import ReportLayout, { DateFilter, ReportTableHeader, ReportTableRow } from '../components/ReportLayout'
import { ReportSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useT } from '../lib/i18n'
import type { Account, LedgerRow } from '../lib/types'
import { ReportBreakdownBar, ReportMetricGauge } from '../components/ReportCharts'

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
  const [searchParams] = useSearchParams()
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

  const rowsList = Array.isArray(rows) ? rows : []
  const totalDebit = useMemo(() => rowsList.reduce((s, r) => s + (r.debit || 0), 0), [rowsList])
  const totalCredit = useMemo(() => rowsList.reduce((s, r) => s + (r.credit || 0), 0), [rowsList])
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
        const docs = res.docs || []
        setAccounts(docs)
        const accountParam = searchParams.get('account')
        if (accountParam) {
          const matched = docs.find((a) => String(a.id) === accountParam || a.code === accountParam)
          if (matched) setSelectedAccount(matched)
        }
      } catch {
        // Non-fatal: account selector will be empty until data loads.
      }
    })()
  }, [tenantId, searchParams])

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
      const res = await api<any>('/journal-entries/ledger', { query: q })
      const list = Array.isArray(res) ? res : res?.docs || []
      setRows(list)
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
      <div className="flex items-center gap-2 px-2 pt-2 text-xs text-slate-500">
        <button
          type="button"
          onClick={() => navigate('/trial-balance')}
          className="hover:text-crimson-600 hover:underline flex items-center gap-1 font-medium"
        >
          ← Back to Trial Balance
        </button>
        <span>·</span>
        <span className="text-slate-700 font-semibold">
          {selectedAccount ? `${selectedAccount.code ? selectedAccount.code + ' · ' : ''}${selectedAccount.name}` : 'All Accounts'}
        </span>
      </div>
      <div className="mt-3">
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
              className="min-w-[240px] w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
              disabled={loading || accounts.length === 0}
            >
              <option value="">{t('reports.selectAccount', 'Select an account')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.code ? `${a.code} · ` : ''}{a.name}
                </option>
              ))}
            </select>
          </div>
          <DateFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
        </div>

        {!selectedAccount && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
            <Search size={18} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-500">{t('reports.selectAccountToView', 'Select an account to view its ledger.')}</p>
          </div>
        )}

        {selectedAccount && (
          <>
            {/* Visual Movement Chart */}
            {(totalDebit > 0 || totalCredit > 0) && (
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <ReportBreakdownBar
                    title={t('reports.activityVolume', 'Account Transaction Activity')}
                    totalLabel={t('reports.grossTurnover', 'Gross Turnover')}
                    segments={[
                      { label: t('vouchers.debit', 'Total Debits (Dr)'), value: totalDebit, color: 'bg-blue-500' },
                      { label: t('vouchers.credit', 'Total Credits (Cr)'), value: totalCredit, color: 'bg-emerald-500' },
                    ]}
                  />
                </div>
                <div>
                  <ReportMetricGauge
                    label={t('reports.netMovement', 'Net Period Movement')}
                    value={fmt(Math.abs(totalDebit - totalCredit))}
                    percentage={totalDebit + totalCredit > 0 ? (Math.abs(totalDebit - totalCredit) / (totalDebit + totalCredit)) * 100 : 0}
                    statusColor={totalDebit >= totalCredit ? 'text-blue-700' : 'text-emerald-700'}
                    barColor={totalDebit >= totalCredit ? 'bg-blue-500' : 'bg-emerald-500'}
                    description={totalDebit >= totalCredit ? 'Net Debit activity expansion' : 'Net Credit activity expansion'}
                  />
                </div>
              </div>
            )}

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
