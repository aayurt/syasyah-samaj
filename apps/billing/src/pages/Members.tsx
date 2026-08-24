import { useCallback, useEffect, useState } from 'react'
import { CreditCard, Download } from 'lucide-react'
import { api, useSyncState, fmt } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { useSearchParams } from 'react-router-dom'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { pushToast } from '../lib/toast'
import SortableTh from '../components/SortableTh'
import { TableSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { type SortState, useSortSearch } from '../lib/useSortSearch'
import SearchBox from '../components/SearchBox'

type Member = {
  id: number
  fullName: string
  email: string
  membershipType?: { id: number; name: string; fee: number } | null
  paymentStatus?: string
  renewalDate?: string | null
  lastReceipt?: { id: number; number: string } | null
  tenant?: { id: number; name: string; code?: string } | null
}

export default function Members() {
  const { cacheVersion } = useSyncState()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [paying, setPaying] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    api<{ docs: Member[] }>('/members', {
      query: { limit: 1000, depth: 1, ...tenantQuery },
    })
      .then((res) => setMembers(res.docs || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [cacheVersion, tenantId])

  const [searchParams, setSearchParams] = useSearchParams()
  const urlSortKey = searchParams.get('sort') || 'fullName'
  const urlSortDir = (searchParams.get('dir') as 'asc' | 'desc') || 'asc'
  const urlQuery = searchParams.get('q') || ''

  const syncToUrl = useCallback((_q: string, s: SortState) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (_q) params.set('q', _q); else params.delete('q')
      if (s.key && s.key !== 'fullName') params.set('sort', s.key); else params.delete('sort')
      if (s.key && s.dir !== 'asc') params.set('dir', s.dir); else params.delete('dir')
      return params
    }, { replace: true })
  }, [setSearchParams])

  const { visible, setQuery, toggleSort, sort, query } = useSortSearch<Member>(members, {
    searchable: (m) => `${m.fullName || ''} ${m.email || ''} ${m.membershipType?.name || ''}`,
    valueOf: (m, key) => {
      switch (key) {
        case 'fullName': return m.fullName || ''
        case 'email': return m.email || ''
        case 'membershipType': return m.membershipType?.name || ''
        case 'paymentStatus': return m.paymentStatus || ''
        case 'renewalDate': return m.renewalDate || ''
        default: return (m as unknown as Record<string, unknown>)[key] as string | number | undefined
      }
    },
    initialQuery: urlQuery,
    initialSort: { key: urlSortKey, dir: urlSortDir },
    onChange: syncToUrl,
  })
  const filtered = visible

  const handlePayFee = async (member: Member) => {
    if (!member.membershipType) {
      pushToast('error', 'No membership type', 'Assign a membership type before collecting payment.')
      return
    }
    setPaying(member.id)
    try {
      const res = await api<{ message: string; receiptNumber: string; amount: number; renewalDate: string }>(
        `/members/${member.id}/pay-fee`,
        { method: 'POST' },
      )
      pushToast('success', 'Fee collected', `${res.receiptNumber} — ${fmt(res.amount)} · Renews ${res.renewalDate}`)
      // Refresh the list
      const refreshed = await api<{ docs: Member[] }>('/members', {
        query: { limit: 1000, depth: 1, ...tenantQuery },
      })
      setMembers(refreshed.docs || [])
    } catch (err) {
      pushToast('error', 'Payment failed', err instanceof Error ? err.message : String(err))
    } finally {
      setPaying(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Members</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCsv('members.csv', ['Name', 'Email', 'Membership Type', 'Payment Status', 'Renewal Date'],
              filtered.map((m) => [m.fullName, m.email, m.membershipType?.name || '', m.paymentStatus || '', m.renewalDate || '']))
            }
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download size={14} /> CSV
          </button>
          <SearchBox value={query} onChange={setQuery} placeholder="Search members…" />
        </div>
      </div>
      <DataStatus />
      {loading && members.length === 0 ? (
        <TableSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">
          {query ? 'No members match your search.' : 'No members yet.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <tr>
                <SortableTh label="Name" sortKey="fullName" sort={sort} onSort={toggleSort} />
                <SortableTh label="Email" sortKey="email" sort={sort} onSort={toggleSort} />
                <SortableTh label="Type" sortKey="membershipType" sort={sort} onSort={toggleSort} />
                <SortableTh label="Status" sortKey="paymentStatus" sort={sort} onSort={toggleSort} />
                <SortableTh label="Renewal" sortKey="renewalDate" sort={sort} onSort={toggleSort} />
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{m.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{m.email}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {m.membershipType?.name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.paymentStatus === 'paid'
                          ? 'bg-emerald-100 text-emerald-700'
                          : m.paymentStatus === 'overdue'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {m.paymentStatus || 'unpaid'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.renewalDate || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {m.paymentStatus !== 'paid' && m.membershipType && (
                      <button
                        onClick={() => handlePayFee(m)}
                        disabled={paying === m.id}
                        className="inline-flex items-center gap-1.5 rounded bg-crimson-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
                      >
                        <CreditCard size={12} />
                        {paying === m.id ? 'Processing…' : 'Pay Fee'}
                      </button>
                    )}
                    {m.lastReceipt && (
                      <span className="ml-2 text-xs text-slate-400" title={m.lastReceipt.number}>
                        ✓
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
