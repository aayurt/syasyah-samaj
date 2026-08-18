import { useEffect, useState } from 'react'
import { CreditCard, Search } from 'lucide-react'
import { api, useSyncState, fmt } from '../lib/api'
import { useTenantQuery } from '../lib/tenant'
import { pushToast } from '../lib/toast'
import SortableTh from '../components/SortableTh'
import { useSortSearch } from '../lib/useSortSearch'
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
  const tenantQuery = useTenantQuery()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    api<{ docs: Member[] }>('/members', {
      query: { limit: 1000, depth: 1, ...tenantQuery },
    })
      .then((res) => setMembers(res.docs || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [cacheVersion, tenantQuery])

  const { sorted, requestSort, key } = useSortSearch(members)
  const [search, setSearch] = useState('')
  const filtered = search
    ? sorted.filter(
        (m) =>
          m.fullName?.toLowerCase().includes(search.toLowerCase()) ||
          m.email?.toLowerCase().includes(search.toLowerCase()),
      )
    : sorted

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
        <SearchBox value={search} onChange={setSearch} placeholder="Search members…" />
      </div>
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-400">
          {search ? 'No members match your search.' : 'No members yet.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <tr>
                <SortableTh field="fullName" label="Name" sortKey={key} requestSort={requestSort} />
                <SortableTh field="email" label="Email" sortKey={key} requestSort={requestSort} />
                <SortableTh field="membershipType" label="Type" sortKey={key} requestSort={requestSort} />
                <SortableTh field="paymentStatus" label="Status" sortKey={key} requestSort={requestSort} />
                <SortableTh field="renewalDate" label="Renewal" sortKey={key} requestSort={requestSort} />
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
