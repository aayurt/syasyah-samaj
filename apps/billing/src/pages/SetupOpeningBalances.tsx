import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, fmt, useSyncState } from '../lib/api'
import { useCalendar } from '../lib/calendar'
import { useFiscalYear } from '../lib/fiscalYear'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { pushToast } from '../lib/toast'
import type { Account, AccountType, OpeningBalance } from '../lib/types'
import DataStatus from '../components/DataStatus'
import { TableSkeleton } from '../components/Skeleton'
import SearchBox from '../components/SearchBox'

const TYPES: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense']
const TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
}

/**
 * P4 Opening Balances setup wizard — company-level opening balances tied to
 * a fiscal year.
 *
 * Distinct from per-party opening balances (entered when a party is created,
 * on the Parties page). This screen captures what the whole chart of accounts
 * opened with at the start of the selected fiscal year. Nothing here touches
 * parties; nothing on the Parties page touches this grid.
 */
export default function SetupOpeningBalances() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { cacheVersion } = useSyncState()
    const { years, selectedYear, selectYear, loading: yearsLoading } = useFiscalYear()
  const { formatDate } = useCalendar()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsLoaded, setAccountsLoaded] = useState(false)
  const [balances, setBalances] = useState<Record<number, string>>({})
  const [errors, setErrors] = useState<Record<number, boolean>>({})
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)
  // Map accountId → existing record id already saved for the selected year,
  // so re-saving updates in place instead of creating duplicates.
  const existingIds = useRef<Record<number, number>>({})

  // The fiscal year this wizard edits. Defaults to the selected (working)
  // year; never null once a year exists.
  const year = selectedYear
  const selectedYearId = year ? String(year.id) : ''

  const loadAccounts = useCallback(async () => {
    try {
      const res = await api<{ docs: Account[] }>('/gl-accounts', {
        query: { depth: 1, sort: 'name', limit: 500, ...tenantQuery },
      })
      setAccounts(res.docs || [])
    } catch {
      /* offline — keep cached */
    } finally {
      setAccountsLoaded(true)
    }
  }, [tenantQuery.tenant])

  // Load the existing opening balances for the selected fiscal year.
  const loadBalances = useCallback(async () => {
    if (!selectedYearId) {
      setBalances({})
      return
    }
    try {
      const res = await api<{ docs: OpeningBalance[] }>('/opening-balances/for-year', {
        query: { fiscalYear: selectedYearId, ...tenantQuery },
      })
      const map: Record<number, string> = {}
      const ids: Record<number, number> = {}
      for (const b of res.docs || []) {
        const acctId = typeof b.account === 'object' ? b.account.id : b.account
        const amount = Number(b.amount || 0)
        map[acctId] = Number.isFinite(amount) ? String(amount) : ''
        ids[acctId] = b.id
      }
      existingIds.current = ids
      setBalances(map)
      setErrors({})
    } catch {
      /* offline — keep cached */
    }
  }, [selectedYearId, tenantQuery.tenant])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts, cacheVersion])

  useEffect(() => {
    loadBalances()
  }, [loadBalances, cacheVersion])

  const setAmount = (accountId: number, raw: string) => {
    setBalances((prev) => ({ ...prev, [accountId]: raw }))
    setErrors((prev) => {
      const next = { ...prev }
      const v = Number(raw)
      if (raw !== '' && (!Number.isFinite(v) || v < 0)) next[accountId] = true
      else delete next[accountId]
      return next
    })
  }

  const groupName = (a: Account) => {
    const g = a.group && typeof a.group === 'object' ? a.group : undefined
    return g ? `${g.name}` : '—'
  }

  const filterAccounts = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return accounts
    return accounts.filter((a) =>
      [a.name, a.code || '', groupName(a), a.type].join(' ').toLowerCase().includes(needle),
    )
  }, [accounts, q])

  const enteredCount = Object.keys(balances).length
  // Consider a year "set" when at least one account has a non-zero / filled value.
  const filledCount = Object.values(balances).filter((v) => v !== '' && Number(v) !== 0).length

  const save = async () => {
    if (!selectedYearId) return
    const bad = Object.keys(errors).length > 0
    if (bad) return
    setSaving(true)
    try {
      const tenantBody = tenantId ? { tenant: tenantId } : {}
      // Records whose value was cleared to 0/blank should be removed.
      for (const [accountIdStr, raw] of Object.entries(balances)) {
        const recordId = existingIds.current[Number(accountIdStr)]
        const zero = raw === '' || Number(raw) === 0
        if (zero && recordId) {
          await api(`/opening-balances/${recordId}`, { method: 'DELETE' })
          delete existingIds.current[Number(accountIdStr)]
        }
      }
      // Upsert each entered balance for this fiscal year.
      for (const [accountIdStr, raw] of Object.entries(balances)) {
        if (raw === '' || Number(raw) === 0) continue
        const accountId = Number(accountIdStr)
        const body = {
          account: accountId,
          fiscalYear: Number(selectedYearId),
          amount: Number(raw),
          ...tenantBody,
        }
        const recordId = existingIds.current[accountId]
        if (recordId) {
          await api(`/opening-balances/${recordId}`, { method: 'PATCH', body })
        } else {
          await api('/opening-balances', { method: 'POST', body })
        }
      }
      pushToast('success', 'Opening balances saved')
      await loadBalances()
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to save opening balances')
    } finally {
      setSaving(false)
    }
  }

  if (yearsLoading || (!accountsLoaded && accounts.length === 0)) {
    return <div className="mx-auto max-w-4xl"><TableSkeleton rows={8} /></div>
  }

  if (!year) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="text-lg font-semibold text-slate-900">Opening Balances</h1>
        <p className="mt-4 text-sm text-slate-500">
          Create a fiscal year in Settings before setting opening balances.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold text-slate-900">Opening Balances</h1>
        </div>
      </div>

      <p className="mt-1 text-sm text-slate-500">
        Company-level opening balance for each account at the start of the selected fiscal year.
        For per-party opening balances, edit the party in <span className="font-medium">Parties</span>.
      </p>

      <div className="mt-3"><DataStatus /></div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <label className="text-sm text-slate-700">
          Fiscal year
          <select
            value={selectedYearId}
            disabled={years.length <= 1}
            onChange={(e) => {
              const id = Number(e.target.value)
              selectYear(id)
            }}
            className="ml-2 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-amber-500 focus:outline-none"
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label} {y.isActive ? '(working)' : y.status === 'closed' ? '(closed)' : ''}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-slate-400">
          {year.label}
          {year.status === 'closed' && <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-red-600">Closed</span>}
        </span>
        <span className="ml-auto text-xs text-slate-400">
          start {formatDate(year.startDate)}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">
          {filterAccounts.length} account{filterAccounts.length === 1 ? '' : 's'} · {filledCount} with opening balance
        </span>
        <SearchBox value={q} onChange={setQ} placeholder="Search by name, code, type…" />
      </div>

      <div className="mt-2 space-y-4">
        {TYPES.map((type) => {
          const rows = filterAccounts.filter((a) => a.type === type)
          if (rows.length === 0) return null
          return (
            <div key={type} className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700">
                {TYPE_LABELS[type]}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {rows.length}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2">Code</th>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Group</th>
                    <th className="px-4 py-2 text-right">Opening balance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const invalid = !!errors[a.id]
                    const value = balances[a.id] ?? ''
                    return (
                      <tr key={a.id} className="border-b border-slate-50">
                        <td className="px-4 py-2 font-mono text-slate-500">{a.code || '—'}</td>
                        <td className="px-4 py-2 text-slate-800">{a.name}</td>
                        <td className="px-4 py-2 text-slate-500">{groupName(a)}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={value}
                            placeholder="0.00"
                            onChange={(e) => setAmount(a.id, e.target.value)}
                            className={`ml-auto block w-40 rounded border px-3 py-1.5 text-right font-mono text-sm outline-none focus:border-amber-500 ${
                              invalid
                                ? 'border-red-300 bg-red-50 text-red-700'
                                : 'border-slate-300 text-slate-700 focus:border-slate-500'
                            }`}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}

        {accounts.length === 0 && (
          <p className="mt-6 text-center text-sm text-slate-400">
            No accounts yet. Set up your chart of accounts first.
          </p>
        )}
      </div>

      <div className="sticky bottom-4 mt-6 flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-100/80 py-3 backdrop-blur">
        <span className="text-xs text-slate-500">{enteredCount} entered</span>
        <button
          onClick={save}
          disabled={saving || !selectedYearId || Object.keys(errors).length > 0}
          className="flex items-center gap-1.5 rounded bg-crimson-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-40"
        >
          <Save size={14} /> {saving ? 'Saving…' : 'Save Opening Balances'}
        </button>
      </div>
    </div>
  )
}