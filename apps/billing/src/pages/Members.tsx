import { useCallback, useEffect, useState } from 'react'
import { CreditCard, Download, Edit3, MoreVertical, Plus, X } from 'lucide-react'
import { api, useSyncState, fmt } from '../lib/api'
import SearchSelect from '../components/SearchSelect'
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
  updatedAt?: string
}

export default function Members() {
  const { cacheVersion } = useSyncState()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [paying, setPaying] = useState<number | null>(null)
  const [openMenu, setOpenMenu] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formRoleId, setFormRoleId] = useState('')
  const [formStatus, setFormStatus] = useState('active')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [membershipTypes, setMembershipTypes] = useState<{ id: number; name: string; fee: number }[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editRoleId, setEditRoleId] = useState('')
  const [editStatus, setEditStatus] = useState('active')
  const [editError, setEditError] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)

  useEffect(() => {
    setLoading(true)
    api<{ docs: Member[] }>('/members', {
      query: { limit: 1000, depth: 1, sort: '-updatedAt', ...tenantQuery },
    })
      .then((res) => setMembers(res.docs || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [cacheVersion, tenantId])

  // Load membership types for the create form
  useEffect(() => {
    api<{ docs: { id: number; name: string; fee: number }[] }>('/membership-types', {
      query: { limit: 100, sort: 'name', ...tenantQuery },
    })
      .then((r) => setMembershipTypes(r.docs || []))
      .catch(() => {})
  }, [tenantQuery])

  const refreshMembers = useCallback(async () => {
    const refreshed = await api<{ docs: Member[] }>('/members', {
      query: { limit: 1000, depth: 1, sort: '-updatedAt', ...tenantQuery },
    })
    setMembers(refreshed.docs || [])
  }, [tenantQuery])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!formName.trim()) { setFormError('Name is required.'); return }
    if (!formEmail.trim()) { setFormError('Email is required.'); return }
    setSubmitting(true)
    try {
      await api('/members', {
        method: 'POST',
        body: {
          fullName: formName.trim(),
          email: formEmail.trim(),
          phoneNumber: formPhone || undefined,
          membershipType: formRoleId ? Number(formRoleId) : undefined,
          status: formStatus,
        },
      })
      pushToast('success', 'Member added', formName.trim())
      setShowForm(false)
      setFormName('')
      setFormEmail('')
      setFormPhone('')
      setFormRoleId('')
      setFormStatus('active')
      await refreshMembers()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create member')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (m: Member) => {
    setOpenMenu(null)
    setEditingId(m.id)
    setEditName(m.fullName)
    setEditEmail(m.email)
    setEditPhone('')
    setEditRoleId(m.membershipType ? String(m.membershipType.id) : '')
    setEditStatus('active')
    setEditError('')
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditError('')
    if (!editName.trim()) { setEditError('Name is required.'); return }
    if (!editEmail.trim()) { setEditError('Email is required.'); return }
    setEditSubmitting(true)
    try {
      await api(`/members/${editingId}`, {
        method: 'PATCH',
        body: {
          fullName: editName.trim(),
          email: editEmail.trim(),
          phoneNumber: editPhone || undefined,
          membershipType: editRoleId ? Number(editRoleId) : null,
          status: editStatus,
        },
        immediate: true,
      })
      pushToast('success', 'Member updated', editName.trim())
      setEditingId(null)
      await refreshMembers()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update member')
    } finally {
      setEditSubmitting(false)
    }
  }

  const [searchParams, setSearchParams] = useSearchParams()
  const urlSortKey = searchParams.get('sort') || 'updatedAt'
  const urlSortDir = (searchParams.get('dir') as 'asc' | 'desc') || 'desc'
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
        case 'updatedAt': return (m as Record<string, unknown>).updatedAt as string || ''
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
        { method: 'POST', immediate: true },
      )
      pushToast('success', 'Fee collected', `${res.receiptNumber} — ${fmt(res.amount)} · Renews ${res.renewalDate}`)
      // Refresh the list from server
      await refreshMembers()
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
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 rounded bg-crimson-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-crimson-700"
          >
            <Plus size={14} /> Add Member
          </button>
          <SearchBox value={query} onChange={setQuery} placeholder="Search members…" />
        </div>
      </div>

      {/* ── Create form ─────────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">New Member</h3>
            <button type="button" onClick={() => { setShowForm(false); setFormError('') }} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
          {formError && (
            <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Full Name *</label>
              <input
                value={formName} onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Aayurt Shrestha"
                className="h-[38px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Email *</label>
              <input
                type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                placeholder="e.g. aayurt@example.com"
                className="h-[38px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Phone</label>
              <input
                value={formPhone} onChange={(e) => setFormPhone(e.target.value)}
                placeholder="e.g. +977-9800000000"
                className="h-[38px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Membership Type</label>
              <SearchSelect
                value={formRoleId}
                onChange={setFormRoleId}
                placeholder="— None —"
                options={membershipTypes.map((t) => ({
                  value: t.id,
                  label: t.name,
                  sublabel: fmt(t.fee),
                }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
              <SearchSelect
                value={formStatus}
                onChange={setFormStatus}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'suspended', label: 'Suspended' },
                ]}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit" disabled={submitting}
              className="inline-flex h-[38px] items-center gap-1.5 rounded bg-crimson-600 px-4 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create Member'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setFormError('') }} className="text-sm text-slate-500 hover:text-slate-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Edit form ─────────────────────────────────── */}
      {editingId && (
        <form onSubmit={handleUpdate} className="rounded-lg border border-crimson-200 bg-crimson-50/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Edit Member</h3>
            <button type="button" onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
          {editError && (
            <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Full Name *</label>
              <input
                value={editName} onChange={(e) => setEditName(e.target.value)}
                className="h-[38px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Email *</label>
              <input
                type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                className="h-[38px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Phone</label>
              <input
                value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                placeholder="Leave blank to keep current"
                className="h-[38px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Membership Type</label>
              <SearchSelect
                value={editRoleId}
                onChange={setEditRoleId}
                placeholder="— None —"
                options={membershipTypes.map((t) => ({
                  value: t.id,
                  label: t.name,
                  sublabel: fmt(t.fee),
                }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
              <SearchSelect
                value={editStatus}
                onChange={setEditStatus}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'suspended', label: 'Suspended' },
                ]}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit" disabled={editSubmitting}
              className="inline-flex h-[38px] items-center gap-1.5 rounded bg-crimson-600 px-4 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
            >
              {editSubmitting ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => setEditingId(null)} className="text-sm text-slate-500 hover:text-slate-700">
              Cancel
            </button>
          </div>
        </form>
      )}

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
                <SortableTh label="Updated" sortKey="updatedAt" sort={sort} onSort={toggleSort} />
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
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {(m as Record<string, unknown>).updatedAt ? new Date((m as Record<string, unknown>).updatedAt as string).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
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
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
                          className="rounded border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                          aria-label="Actions"
                        >
                          <MoreVertical size={14} />
                        </button>
                        {openMenu === m.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                              <button
                                onClick={() => startEdit(m)}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <Edit3 size={12} /> Edit Member
                              </button>
                              {m.lastReceipt && (
                                <button
                                  onClick={() => { setOpenMenu(null); window.open(`/print/receipt/${m.lastReceipt!.id}`, '_blank') }}
                                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                                >
                                  <Download size={12} /> View Receipt
                                </button>
                              )}
                              <button
                                onClick={() => { setOpenMenu(null); handlePayFee(m) }}
                                disabled={paying === m.id || m.paymentStatus === 'paid'}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                              >
                                <CreditCard size={12} /> Pay Fee
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
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
