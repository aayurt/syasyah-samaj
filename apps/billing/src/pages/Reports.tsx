import { useCallback, useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { api, fmt } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import type {
  BalanceSheetResponse,
  BsRow,
  PnlResponse,
  PnlRow,
} from '../lib/types'

type SectionRow = (PnlRow | BsRow) & {
  account: { id: number | null; code?: string; name: string }
}

type Tab = 'pnl' | 'bs'

export default function Reports() {
  const [tab, setTab] = useState<Tab>('pnl')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [pnl, setPnl] = useState<PnlResponse | null>(null)
  const [bs, setBs] = useState<BalanceSheetResponse | null>(null)
  const [error, setError] = useState('')

  const q = useCallback(
    () => ({ from: from || undefined, to: to || undefined }),
    [from, to],
  )

  useEffect(() => {
    if (tab === 'pnl') {
      api<PnlResponse>('/journal-entries/profit-loss', { query: q() })
        .then(setPnl)
        .catch((err: unknown) =>
          setError(err instanceof Error ? err.message : 'Failed to load P&L'),
        )
    } else {
      api<BalanceSheetResponse>('/journal-entries/balance-sheet', {
        query: q(),
      })
        .then(setBs)
        .catch((err: unknown) =>
          setError(
            err instanceof Error ? err.message : 'Failed to load balance sheet',
          ),
        )
    }
  }, [tab, from, to])

  const pnlCsv = () =>
    downloadCsv(
      'profit-and-loss.csv',
      ['Section', 'Account', 'Amount'],
      [
        ...pnl!.income.map((r) => ['Income', r.account.name, r.amount]),
        ...pnl!.expense.map((r) => ['Expense', r.account.name, r.amount]),
        ['', 'Net profit', pnl!.totals.netProfit],
      ],
    )

  const bsCsv = () =>
    downloadCsv(
      'balance-sheet.csv',
      ['Section', 'Account', 'Balance'],
      [
        ...bs!.assets.map((r) => ['Assets', r.account.name, r.balance]),
        ...bs!.liabilities.map((r) => ['Liabilities', r.account.name, r.balance]),
        ...bs!.equity.map((r) => ['Equity', r.account.name, r.balance]),
      ],
    )

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Reports</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-slate-300 bg-white p-0.5">
            {(
              [
                ['pnl', 'Profit & Loss'],
                ['bs', 'Balance Sheet'],
              ] as [Tab, string][]
            ).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded px-3 py-1 text-sm font-medium ${
                  tab === t
                    ? 'bg-crimson-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={tab === 'pnl' ? pnlCsv : bsCsv}
            disabled={tab === 'pnl' ? !pnl : !bs}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download size={14} />
            CSV
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm text-slate-700">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500"
          />
        </label>
        <label className="text-sm text-slate-700">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500"
          />
        </label>
        <span className="text-xs text-slate-400">
          Leave empty for all posted entries.
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {tab === 'pnl' && pnl && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white">
          <Section title="Income" rows={pnl.income} total={pnl.totals.income} />
          <Section
            title="Expenses"
            rows={pnl.expense}
            total={pnl.totals.expense}
          />
          <div
            className={`flex justify-between px-4 py-3 text-sm font-semibold ${
              pnl.totals.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            <span>Net profit</span>
            <span className="font-mono">{fmt(pnl.totals.netProfit)}</span>
          </div>
        </div>
      )}

      {tab === 'bs' && bs && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white">
          <Section title="Assets" rows={bs.assets} total={bs.totals.assets} />
          <Section
            title="Liabilities"
            rows={bs.liabilities}
            total={bs.totals.liabilities}
          />
          <Section title="Equity" rows={bs.equity} total={bs.totals.equity} />
          <div className="flex justify-between border-t border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">
            <span>
              Total liabilities &amp; equity
            </span>
            <span className="font-mono">{fmt(bs.totals.liabilitiesEquity)}</span>
          </div>
          <div
            className={`px-4 py-2 text-xs font-medium ${
              bs.balanced ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {bs.balanced
              ? '✓ Assets = Liabilities + Equity'
              : `✗ Out of balance — assets ${fmt(bs.totals.assets)} vs ${fmt(
                  bs.totals.liabilitiesEquity,
                )}`}
          </div>
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  rows,
  total,
}: {
  title: string
  rows: SectionRow[]
  total: number
}) {
  return (
    <div className="border-b border-slate-100 last:border-0">
      <div className="flex justify-between bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">
        <span>{title}</span>
        <span className="font-mono">{fmt(total)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-slate-400">None.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.account.id ?? 'retained'}
                className="border-b border-slate-50 last:border-0"
              >
                <td className="px-4 py-2 text-slate-700">
                  {r.account.code ? `${r.account.code} · ` : ''}
                  {r.account.name}
                </td>
                <td className="px-4 py-2 text-right font-mono text-slate-800">
                  {fmt('amount' in r ? (r.amount ?? 0) : (r.balance ?? 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
