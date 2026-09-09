import { useEffect, useState } from 'react'
import { Download, FileText, Printer } from 'lucide-react'
import { api, fmt, list, useSyncState } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { exportReportPdf } from '../lib/pdf'
import { ReportSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useCalendar } from '../lib/calendar'
import { useT } from '../lib/i18n'
import { useTenant, useTenantQuery } from '../lib/tenant'
import type { Account, Document, LedgerRow, TrialBalanceRow } from '../lib/types'
import VoucherViewModal from '../components/VoucherViewModal'

const TYPE_ORDER = ['asset', 'liability', 'equity', 'income', 'expense']
const TYPE_LABELS: Record<string, string> = {
  asset: 'trialBalance.typeAssets',
  liability: 'trialBalance.typeLiabilities',
  equity: 'trialBalance.typeEquity',
  income: 'trialBalance.typeIncome',
  expense: 'trialBalance.typeExpenses',
}

export default function TrialBalance() {
  const t = useT()
  const { cacheVersion, online } = useSyncState()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const [rows, setRows] = useState<TrialBalanceRow[]>([])
  const [totals, setTotals] = useState({ debit: 0, credit: 0 })
  const [balanced, setBalanced] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [ledgerAccount, setLedgerAccount] = useState('')
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null)
  const [ledgerName, setLedgerName] = useState('')
  const [voucher, setVoucher] = useState<Document | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { formatDate } = useCalendar()

  const load = async () => {
    setLoading(true)
    try {
      const [tb, a] = await Promise.all([
        api<{
          docs: TrialBalanceRow[]
          totals: { debit: number; credit: number }
          balanced: boolean
        }>('/journal-entries/trial-balance', { query: { ...tenantQuery } }),
        list<Account>('gl-accounts', { depth: 0, sort: 'name', ...tenantQuery }),
      ])
      setRows(tb.docs)
      setTotals(tb.totals)
      setBalanced(tb.balanced)
      setAccounts(a.docs)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load trial balance')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [cacheVersion, online, tenantId])

  const openVoucher = async (docId: number | string | null | undefined) => {
    if (!docId) return
    try {
      const d = await api<Document>(`/documents/${docId}`, {
        query: { ...tenantQuery },
      })
      setVoucher(d)
    } catch {
      setError('Could not load the source transaction.')
    }
  }

  const showLedger = async (accountId: string, name: string) => {
    setLedgerAccount(accountId)
    setLedgerName(name)
    setLedger(null)
    try {
      const res = await api<{ docs: LedgerRow[]; closingBalance: number }>(
        '/journal-entries/ledger',
        { query: { account: accountId, ...tenantQuery } },
      )
      setLedger(res.docs)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load ledger')
    }
  }

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    rows: rows.filter((r) => r.account.type === type),
  })).filter((g) => g.rows.length > 0)

  const pdf = () =>
    exportReportPdf({
      filename: 'trial-balance.pdf',
      title: t('trialBalance.title', 'Trial Balance'),
      subtitle: balanced
        ? 'Debits and credits are in balance'
        : 'Out of balance — verify your postings',
      meta: [['Generated', new Date().toLocaleString()]],
      tables: grouped.map((g) => ({
        title: t(TYPE_LABELS[g.type] as any, g.type),
        columns: ['Account', 'Debit', 'Credit', 'Balance'],
        rows: g.rows.map((r) => [
          r.account.code ? `${r.account.code} · ${r.account.name}` : r.account.name,
          r.debit || '',
          r.credit || '',
          r.balance,
        ]),
        totals: ['Totals', totals.debit, totals.credit, ''],
      })),
    })

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">{t('trialBalance.title', 'Trial Balance')}</h1>
        <div className="print:hidden flex items-center gap-2">
          <button
            onClick={() =>
              downloadCsv(
                'trial-balance.csv',
                ['Type', 'Account', 'Debit', 'Credit', 'Balance'],
                rows.map((r) => [
                  t(TYPE_LABELS[r.account.type] as any, r.account.type),
                  r.account.name,
                  r.debit,
                  r.credit,
                  r.balance,
                ]),
              )
            }
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Download size={14} />
            CSV
          </button>
          <button
            onClick={pdf}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <FileText size={14} />
            PDF
          </button>
          <button
            onClick={() => window.print()}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <Printer size={14} />
            {t('common.print', 'Print')}
          </button>
        </div>
      </div>

      <div className="mt-2">
        <DataStatus />
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && rows.length === 0 ? (
        <ReportSkeleton />
      ) : (
        <>
      <div
        className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${
          balanced
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}
      >
        {balanced
          ? t('trialBalance.balanceInBalance', '✓ Debits and credits are in balance.')
          : t('trialBalance.balanceOutOfBalance', '✗ Out of balance — debits {debit} vs credits {credit}.')
              .replace('{debit}', fmt(totals.debit))
              .replace('{credit}', fmt(totals.credit))}
      </div>

      <div data-tour="trial-report" className="mt-4 rounded-lg border border-slate-200 bg-white">
        {grouped.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            {t('trialBalance.noPostedEntries', 'No posted entries yet.')}
          </p>
        )}
        {grouped.map((g) => (
          <div key={g.type} className="border-b border-slate-100 last:border-0">
            <div className="bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
              {t(TYPE_LABELS[g.type] as any, g.type)}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">{t('reports.columnAccount', 'Account')}</th>
                  <th className="px-4 py-2 text-right">{t('reports.columnDebit', 'Debit')}</th>
                  <th className="px-4 py-2 text-right">{t('reports.columnCredit', 'Credit')}</th>
                  <th className="px-4 py-2 text-right">{t('reports.columnBalance', 'Balance')}</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr
                    key={r.account.id}
                    className="border-b border-slate-50 hover:bg-slate-50"
                  >
                    <td className="px-4 py-2">
                      <button
                        onClick={() =>
                          showLedger(String(r.account.id), r.account.name)
                        }
                        className="text-left text-slate-800 hover:text-blue-700 hover:underline"
                      >
                        {r.account.code ? `${r.account.code} · ` : ''}
                        {r.account.name}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-700">
                      {r.debit ? fmt(r.debit) : ''}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-700">
                      {r.credit ? fmt(r.credit) : ''}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-800">
                      {fmt(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <div className="flex justify-between px-4 py-3 text-sm font-semibold text-amber-700">
          <span>{t('reports.total', 'Totals')}</span>
          <span className="flex gap-8">
            <span className="font-mono">{fmt(totals.debit)}</span>
            <span className="font-mono">{fmt(totals.credit)}</span>
            <span className="w-24 text-right"></span>
          </span>
        </div>
      </div>
        </>
      )}

      {ledgerAccount && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-medium text-slate-700">
              {t('trialBalance.ledger', 'Ledger — {name}').replace('{name}', ledgerName)}
            </div>
            <button
              onClick={() => setLedgerAccount('')}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              {t('trialBalance.close', 'close')}
            </button>
          </div>
          {ledger === null ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              Loading…
            </p>
          ) : ledger.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              {t('trialBalance.noPostings', 'No postings for this account.')}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">{t('trialBalance.columnNumber', 'Number')}</th>
                  <th className="px-4 py-2">{t('common.date', 'Date')}</th>
                  <th className="px-4 py-2">{t('common.memo', 'Narration')}</th>
                  <th className="px-4 py-2 text-right">{t('common.debit', 'Debit')}</th>
                  <th className="px-4 py-2 text-right">{t('common.credit', 'Credit')}</th>
                  <th className="px-4 py-2 text-right">{t('trialBalance.columnRunning', 'Running')}</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50">
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">
                      {l.docNumber ? (
                        <button
                          type="button"
                          onClick={() => openVoucher(l.docId)}
                          className="text-blue-600 hover:underline"
                          title="Open source transaction"
                        >
                          {l.docNumber}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {formatDate(l.date)}
                    </td>
                    <td className="px-4 py-2 text-slate-800">
                      {l.narration || '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-700">
                      {l.debit ? fmt(l.debit) : ''}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-700">
                      {l.credit ? fmt(l.credit) : ''}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-800">
                      {fmt(l.runningBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!ledgerAccount && accounts.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          {t('trialBalance.tip', 'Tip: click an account to open its ledger.')}
        </p>
      )}

      <VoucherViewModal voucher={voucher} onClose={() => setVoucher(null)} />
    </div>
  )
}
