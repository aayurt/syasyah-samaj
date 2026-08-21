import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, Download, FileText, Upload, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, fmt, list } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import type { Account } from '../lib/types'

/* ── Types ─────────────────────────────────────────────────────── */

interface StatementRow {
  date: string
  description?: string
  reference?: string
  amount: number
  matchedEntry?: number | null
  matched?: boolean
}

interface BankStatement {
  id: number
  account: number | Account
  periodStart?: string
  periodEnd?: string
  openingBalance: number
  closingBalance: number
  rows: StatementRow[]
  tenant?: number | null
  createdAt: string
  updatedAt: string
}

interface ReconcileResult {
  statementId: number
  matchedRows: number
  unmatchedRows: number
  matchedAmount: number
  unmatchedAmount: number
  clearedEntries: number
  unmatched: { date: string; description: string; reference: string; amount: number }[]
  rows: StatementRow[]
}

/* ── Component ─────────────────────────────────────────────────── */

export default function BankReconciliation() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()

  // Data
  const [bankAccounts, setBankAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [statements, setStatements] = useState<BankStatement[]>([])
  const [selectedStatement, setSelectedStatement] = useState<BankStatement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Import
  const [importing, setImporting] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [openingBal, setOpeningBal] = useState('')
  const [closingBal, setClosingBal] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [importResult, setImportResult] = useState<{ importedRows: number } | null>(null)

  // Reconcile
  const [reconciling, setReconciling] = useState(false)
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null)

  /* ── Load bank accounts ─────────────────────────────────────── */
  useEffect(() => {
    ;(async () => {
      try {
        const res = await list<Account>('gl-accounts', {
          depth: 0,
          sort: 'name',
          ...tenantQuery,
        })
        setBankAccounts(res.docs.filter((a) => a.class === 'bank'))
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load accounts')
      } finally {
        setLoading(false)
      }
    })()
  }, [tenantId])

  /* ── Load statements for selected account ───────────────────── */
  const loadStatements = useCallback(async () => {
    if (!selectedAccount) {
      setStatements([])
      return
    }
    try {
      const where = JSON.stringify({ account: { equals: Number(selectedAccount) } })
      const res = await api<{ docs: BankStatement[] }>('bank-statements', {
        query: {
          where,
          sort: '-createdAt',
          depth: 1,
          ...tenantQuery,
        },
      })
      setStatements(res.docs || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load statements')
    }
  }, [selectedAccount, tenantId])

  useEffect(() => {
    loadStatements()
    setSelectedStatement(null)
    setReconcileResult(null)
  }, [loadStatements])

  /* ── Import CSV ─────────────────────────────────────────────── */
  const handleImport = async () => {
    if (!selectedAccount || !csvText.trim()) return
    setImporting(true); setError('')
    try {
      const res = await api<{ statement: BankStatement; importedRows: number }>(
        'bank-statements/import',
        {
          method: 'POST',
          body: {
            account: Number(selectedAccount),
            csv: csvText,
            openingBalance: openingBal ? Number(openingBal) : 0,
            closingBalance: closingBal ? Number(closingBal) : 0,
            periodStart: periodStart || undefined,
            periodEnd: periodEnd || undefined,
            ...tenantQuery,
          },
        },
      )
      setImportResult({ importedRows: res.importedRows })
      setCsvText(''); setOpeningBal(''); setClosingBal('')
      setPeriodStart(''); setPeriodEnd('')
      await loadStatements()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  /* ── Reconcile ──────────────────────────────────────────────── */
  const handleReconcile = async (stmtId: number) => {
    setReconciling(true); setError(''); setReconcileResult(null)
    try {
      const res = await api<ReconcileResult>(
        `bank-statements/${stmtId}/reconcile`,
        { method: 'POST' },
      )
      setReconcileResult(res)
      await loadStatements()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reconciliation failed')
    } finally {
      setReconciling(false)
    }
  }

  /* ── Derived ────────────────────────────────────────────────── */
  const stmtRows = selectedStatement?.rows || []
  const matchedCount = stmtRows.filter((r) => r.matchedEntry || r.matched).length
  const unmatchedCount = stmtRows.length - matchedCount
  const matchedAmt = stmtRows
    .filter((r) => r.matchedEntry || r.matched)
    .reduce((s, r) => s + Math.abs(r.amount), 0)
  const unmatchedAmt = stmtRows
    .filter((r) => !r.matchedEntry && !r.matched)
    .reduce((s, r) => s + Math.abs(r.amount), 0)

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold text-slate-900">
            Bank Reconciliation
          </h1>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* ── Account selector ───────────────────────────────────── */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium text-slate-700">
          Select Bank Account
        </label>
        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="mt-1 w-full max-w-sm rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500"
        >
          <option value="">— select bank account —</option>
          {bankAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code ? `${a.code} · ` : ''}
              {a.name}
            </option>
          ))}
        </select>
        {bankAccounts.length === 0 && !loading && (
          <p className="mt-2 text-xs text-slate-400">
            No bank accounts found. Create a GL account with class "bank" first.
          </p>
        )}
      </div>

      {selectedAccount && (
        <>
          {/* ── Import section ─────────────────────────────────── */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-3">
              <Upload size={16} className="text-slate-400" />
              <h3 className="text-sm font-medium text-slate-700">
                Import Bank Statement
              </h3>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Upload a CSV with columns: date, description, amount (signed: +deposit, −withdrawal).
              Alternatively use credit/debit columns.
            </p>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`date,description,reference,amount\n2026-08-01,Cash deposit,REF001,50000\n2026-08-05,Rent payment,CHQ042,-25000\n2026-08-10,Utility bill,UTL-789,-3500`}
              className="w-full rounded border border-slate-300 px-3 py-2.5 font-mono text-xs outline-none focus:border-slate-500"
            />
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="text-xs text-slate-600">
                Opening Balance
                <input
                  type="number"
                  step="0.01"
                  value={openingBal}
                  onChange={(e) => setOpeningBal(e.target.value)}
                  className="mt-1 block w-full rounded border border-slate-300 px-2 min-h-[36px] py-1.5 text-sm outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-xs text-slate-600">
                Closing Balance
                <input
                  type="number"
                  step="0.01"
                  value={closingBal}
                  onChange={(e) => setClosingBal(e.target.value)}
                  className="mt-1 block w-full rounded border border-slate-300 px-2 min-h-[36px] py-1.5 text-sm outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-xs text-slate-600">
                Period Start
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="mt-1 block w-full rounded border border-slate-300 px-2 min-h-[36px] py-1.5 text-sm outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-xs text-slate-600">
                Period End
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="mt-1 block w-full rounded border border-slate-300 px-2 min-h-[36px] py-1.5 text-sm outline-none focus:border-slate-500"
                />
              </label>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={handleImport}
                disabled={importing || !csvText.trim()}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                {importing ? 'Importing…' : 'Import Statement'}
              </button>
              {importResult && (
                <span className="text-sm text-emerald-600">
                  ✓ Imported {importResult.importedRows} rows
                </span>
              )}
            </div>
          </div>

          {/* ── Statements list ────────────────────────────────── */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
              Imported Statements ({statements.length})
            </div>
            {statements.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">
                No statements imported yet. Paste CSV data above and click Import.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2">Period</th>
                    <th className="px-4 py-2">Rows</th>
                    <th className="px-4 py-2 text-right">Opening</th>
                    <th className="px-4 py-2 text-right">Closing</th>
                    <th className="px-4 py-2">Imported</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {statements.map((s) => (
                    <tr
                      key={s.id}
                      className={`border-b border-slate-50 cursor-pointer hover:bg-slate-50 ${selectedStatement?.id === s.id ? 'bg-blue-50' : ''}`}
                      onClick={() => {
                        setSelectedStatement(s)
                        setReconcileResult(null)
                      }}
                    >
                      <td className="px-4 py-2 text-slate-700">
                        {s.periodStart || '—'} to {s.periodEnd || '—'}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {s.rows?.length || 0}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-slate-700">
                        {fmt(s.openingBalance)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-slate-700">
                        {fmt(s.closingBalance)}
                      </td>
                      <td className="px-4 py-2 text-slate-500">
                        {formatDate(s.createdAt)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReconcile(s.id)
                          }}
                          disabled={reconciling}
                          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                        >
                          {reconciling ? 'Matching…' : 'Reconcile'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Selected statement detail ──────────────────────── */}
          {selectedStatement && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <h3 className="text-sm font-medium text-slate-700">
                    Statement Detail
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedStatement.periodStart || '—'} to{' '}
                    {selectedStatement.periodEnd || '—'} ·{' '}
                    {stmtRows.length} rows
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      downloadCsv(
                        'bank-statement.csv',
                        ['Date', 'Description', 'Reference', 'Amount', 'Matched'],
                        stmtRows.map((r) => [
                          r.date,
                          r.description || '',
                          r.reference || '',
                          r.amount,
                          r.matchedEntry ? 'Yes' : 'No',
                        ]),
                      )
                    }
                    className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    <Download size={12} /> CSV
                  </button>
                </div>
              </div>

              {/* Summary bar */}
              <div className="grid grid-cols-4 gap-px border-b border-slate-200 bg-slate-200">
                <div className="bg-white px-4 py-3 text-center">
                  <div className="text-xs text-slate-500">Total Rows</div>
                  <div className="font-mono text-sm font-semibold text-slate-800">
                    {stmtRows.length}
                  </div>
                </div>
                <div className="bg-white px-4 py-3 text-center">
                  <div className="text-xs text-slate-500">Matched</div>
                  <div className="font-mono text-sm font-semibold text-emerald-700">
                    {matchedCount} ({fmt(matchedAmt)})
                  </div>
                </div>
                <div className="bg-white px-4 py-3 text-center">
                  <div className="text-xs text-slate-500">Unmatched</div>
                  <div className="font-mono text-sm font-semibold text-red-600">
                    {unmatchedCount} ({fmt(unmatchedAmt)})
                  </div>
                </div>
                <div className="bg-white px-4 py-3 text-center">
                  <div className="text-xs text-slate-500">Cleared</div>
                  <div className="font-mono text-sm font-semibold text-blue-700">
                    {reconcileResult?.clearedEntries || 0} entries
                  </div>
                </div>
              </div>

              {/* Rows table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2">Reference</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {stmtRows.map((r, i) => {
                    const isMatched = !!(r.matchedEntry || r.matched)
                    return (
                      <tr
                        key={i}
                        className={`border-b border-slate-50 last:border-0 ${isMatched ? 'bg-emerald-50/50' : 'bg-red-50/30'}`}
                      >
                        <td className="px-4 py-2">
                          {isMatched ? (
                            <CheckCircle2
                              size={16}
                              className="text-emerald-500"
                            />
                          ) : (
                            <XCircle size={16} className="text-red-400" />
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-600">
                          {formatDate(r.date)}
                        </td>
                        <td className="px-4 py-2 text-slate-800">
                          {r.description || '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-500">
                          {r.reference || '—'}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-mono ${r.amount >= 0 ? 'text-emerald-700' : 'text-red-600'}`}
                        >
                          {r.amount >= 0 ? '+' : ''}
                          {fmt(r.amount)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Reconciliation result ──────────────────────────── */}
          {reconcileResult && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3">
                Reconciliation Result
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg bg-emerald-50 p-3 text-center">
                  <div className="text-xs text-slate-500">Matched</div>
                  <div className="font-mono text-lg font-semibold text-emerald-700">
                    {reconcileResult.matchedRows}
                  </div>
                  <div className="text-xs text-slate-400">
                    {fmt(reconcileResult.matchedAmount)}
                  </div>
                </div>
                <div className="rounded-lg bg-red-50 p-3 text-center">
                  <div className="text-xs text-slate-500">Unmatched</div>
                  <div className="font-mono text-lg font-semibold text-red-600">
                    {reconcileResult.unmatchedRows}
                  </div>
                  <div className="text-xs text-slate-400">
                    {fmt(reconcileResult.unmatchedAmount)}
                  </div>
                </div>
                <div className="rounded-lg bg-blue-50 p-3 text-center">
                  <div className="text-xs text-slate-500">Entries Cleared</div>
                  <div className="font-mono text-lg font-semibold text-blue-700">
                    {reconcileResult.clearedEntries}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <div className="text-xs text-slate-500">Difference</div>
                  <div
                    className={`font-mono text-lg font-semibold ${Math.abs(reconcileResult.matchedAmount - reconcileResult.unmatchedAmount) < 0.01 ? 'text-emerald-700' : 'text-red-600'}`}
                  >
                    {fmt(
                      Math.abs(
                        reconcileResult.matchedAmount - reconcileResult.unmatchedAmount,
                      ),
                    )}
                  </div>
                </div>
              </div>

              {/* Unmatched items */}
              {reconcileResult.unmatched.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-medium text-slate-500 mb-2">
                    Unmatched Statement Rows (need manual review)
                  </h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2">Reference</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconcileResult.unmatched.map((r, i) => (
                        <tr key={i} className="border-b border-slate-50 last:border-0">
                          <td className="px-3 py-2 text-slate-600">
                            {formatDate(r.date)}
                          </td>
                          <td className="px-3 py-2 text-slate-800">
                            {r.description || '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-500">
                            {r.reference || '—'}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-mono ${r.amount >= 0 ? 'text-emerald-700' : 'text-red-600'}`}
                          >
                            {r.amount >= 0 ? '+' : ''}
                            {fmt(r.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {reconcileResult.unmatched.length === 0 && (
                <div className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  ✓ All statement rows matched — reconciliation complete!
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
