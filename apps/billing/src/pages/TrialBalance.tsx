import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { api, fmt, list, useSyncState } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { ReportSkeleton } from '../components/Skeleton'
import type { Account, LedgerRow, TrialBalanceRow } from '../lib/types'

const TYPE_ORDER = ['asset', 'liability', 'equity', 'income', 'expense']
const TYPE_LABELS: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
}

export default function TrialBalance() {
  const { cacheVersion, online } = useSyncState()
  const [rows, setRows] = useState<TrialBalanceRow[]>([])
  const [totals, setTotals] = useState({ debit: 0, credit: 0 })
  const [balanced, setBalanced] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [ledgerAccount, setLedgerAccount] = useState('')
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null)
  const [ledgerName, setLedgerName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [tb, a] = await Promise.all([
        api<{
          docs: TrialBalanceRow[]
          totals: { debit: number; credit: number }
          balanced: boolean
        }>('/journal-entries/trial-balance'),
        list<Account>('gl-accounts', { depth: 0, sort: 'name' }),
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
  }, [cacheVersion, online])

  const showLedger = async (accountId: string, name: string) => {
    setLedgerAccount(accountId)
    setLedgerName(name)
    setLedger(null)
    try {
      const res = await api<{ docs: LedgerRow[]; closingBalance: number }>(
        '/journal-entries/ledger',
        { query: { account: accountId } },
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

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Trial Balance</h1>
        <button
          onClick={() =>
            downloadCsv(
              'trial-balance.csv',
              ['Type', 'Account', 'Debit', 'Credit', 'Balance'],
              rows.map((r) => [
                TYPE_LABELS[r.account.type] || r.account.type,
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
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
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
          ? '✓ Debits and credits are in balance.'
          : `✗ Out of balance — debits ${fmt(totals.debit)} vs credits ${fmt(
              totals.credit,
            )}.`}
      </div>

      <div data-tour="trial-report" className="mt-4 rounded-lg border border-slate-200 bg-white">
        {grouped.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            No posted entries yet.
          </p>
        )}
        {grouped.map((g) => (
          <div key={g.type} className="border-b border-slate-100 last:border-0">
            <div className="bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
              {TYPE_LABELS[g.type]}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2 text-right">Debit</th>
                  <th className="px-4 py-2 text-right">Credit</th>
                  <th className="px-4 py-2 text-right">Balance</th>
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
          <span>Totals</span>
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
              Ledger — {ledgerName}
            </div>
            <button
              onClick={() => setLedgerAccount('')}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              close
            </button>
          </div>
          {ledger === null ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              Loading…
            </p>
          ) : ledger.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              No postings for this account.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Narration</th>
                  <th className="px-4 py-2 text-right">Debit</th>
                  <th className="px-4 py-2 text-right">Credit</th>
                  <th className="px-4 py-2 text-right">Running</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50">
                    <td className="px-4 py-2 text-slate-600">
                      {l.date?.slice(0, 10)}
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
          Tip: click an account to open its ledger.
        </p>
      )}
    </div>
  )
}
