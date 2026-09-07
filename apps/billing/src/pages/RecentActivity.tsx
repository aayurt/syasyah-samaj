import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Boxes,
  CalendarDays,
  FileText,
  Tag,
  UserRound,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, list, useSyncState } from '../lib/api'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { ReportSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'

const DOC_LABELS: Record<string, string> = {
  'journal-voucher': 'Journal Entry',
  'payment-voucher': 'Payment',
  'receipt-voucher': 'Receipt',
  'sales-invoice': 'Sales Invoice',
  'purchase-invoice': 'Purchase Invoice',
  contra: 'Contra Entry',
  'credit-note': 'Credit Note',
  'debit-note': 'Debit Note',
  'petty-cash-voucher': 'Petty Cash',
  grn: 'Goods Received (GRN)',
  'delivery-challan': 'Delivery Challan',
}

interface Activity {
  key: string
  kind: string
  label: string          // entity name / number
  sub?: string           // code / party type / status
  createdAt: string
  icon?: typeof Boxes
  color?: string
}

const KIND_META: Record<string, { icon: typeof Boxes; color: string }> = {
  'Item added': { icon: Boxes, color: 'text-emerald-600 bg-emerald-50' },
  'Party added': { icon: Users, color: 'text-sky-600 bg-sky-50' },
  'Member added': { icon: UserRound, color: 'text-indigo-600 bg-indigo-50' },
  'Membership type added': { icon: Tag, color: 'text-amber-600 bg-amber-50' },
  'Event added': { icon: CalendarDays, color: 'text-violet-600 bg-violet-50' },
  'Transaction added': { icon: FileText, color: 'text-slate-600 bg-slate-100' },
}

interface DocLike {
  id: number
  number?: string | null
  docType?: string | null
  status?: string | null
  createdAt: string
}
interface EventLike {
  id: number
  title?: string | null
  createdAt: string
}
interface Member {
  id: number
  fullName: string
  membershipType?: { id: number; name: string; fee: number } | null
  createdAt: string
}
interface MemberType {
  id: number
  name: string
  createdAt: string
}
interface RItem {
  id: number
  name: string
  code?: string | null
  createdAt: string
}
interface RParty {
  id: number
  name: string
  type?: string | null
  createdAt: string
}

export default function RecentActivity() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()
  const { cacheVersion } = useSyncState()
  const [rows, setRows] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = { sort: '-createdAt', limit: 12, ...tenantQuery }
      const [items, parties, members, memberTypes, events, docs] = await Promise.all([
        list<RItem>('items', q),
        list<RParty>('parties', q),
        list<Member>('members', q),
        list<MemberType>('membership-types', q),
        list<EventLike>('events', q),
        list<DocLike>('documents', { ...q, limit: 20 }),
      ])
      const out: Activity[] = [
        ...items.docs.map((d) => ({
          key: `i${d.id}`,
          kind: 'Item added',
          label: d.name,
          sub: d.code || '',
          createdAt: d.createdAt,
        })),
        ...parties.docs.map((d) => ({
          key: `p${d.id}`,
          kind: 'Party added',
          label: d.name,
          sub: d.type || '',
          createdAt: d.createdAt,
        })),
        ...members.docs.map((d) => ({
          key: `m${d.id}`,
          kind: 'Member added',
          label: d.fullName,
          sub: d.membershipType?.name || '',
          createdAt: d.createdAt,
        })),
        ...memberTypes.docs.map((d) => ({
          key: `mt${d.id}`,
          kind: 'Membership type added',
          label: d.name,
          sub: '',
          createdAt: d.createdAt,
        })),
        ...events.docs.map((d) => ({
          key: `e${d.id}`,
          kind: 'Event added',
          label: d.title || `Event #${d.id}`,
          sub: '',
          createdAt: d.createdAt,
        })),
        ...docs.docs.map((d) => ({
          key: `d${d.id}`,
          kind: 'Transaction added',
          label: d.number || `Transaction #${d.id}`,
          sub: `${DOC_LABELS[d.docType || ''] || d.docType || 'Transaction'} · ${d.status || 'draft'}`,
          createdAt: d.createdAt,
        })),
      ]
      out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      setRows(out.slice(0, 60))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load recent activity')
    } finally { setLoading(false) }
  }, [cacheVersion, tenantId, tenantQuery])

  useEffect(() => { load() }, [load])

  const groups = rows.reduce<Record<string, Activity[]>>((acc, r) => {
    const day = (r.createdAt || '').slice(0, 10)
    ;(acc[day] ||= []).push(r)
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-semibold text-slate-900">Recent Activity</h1>
        </div>
      </div>
      <div className="mt-2"><DataStatus /></div>
      <p className="mt-3 text-sm text-slate-500">
        Everything recently added to the books — items, parties, members, programs and vouchers, newest first.
      </p>
      {error && <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && rows.length === 0 ? <ReportSkeleton sections={1} /> : (
        <div className="mt-4 space-y-5">
          {rows.length === 0 && <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">No activity recorded yet.</p>}
          {Object.entries(groups).map(([day, dayRows]) => (
            <div key={day}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {formatDate(day) || day}
              </div>
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="divide-y divide-slate-50">
                  {dayRows.map((r) => {
                    const meta = KIND_META[r.kind] || KIND_META['Item added']
                    const Icon = meta.icon
                    return (
                      <div key={r.key} className="flex items-center gap-3 px-4 py-2.5">
                        <span className={`shrink-0 rounded-md p-1.5 ${meta.color}`}>
                          <Icon size={15} />
                        </span>
                        <span className="shrink-0 text-xs font-medium text-slate-500">{r.kind}</span>
                        <span className="flex-1 truncate text-sm font-medium text-slate-800">{r.label}</span>
                        {r.sub && <span className="hidden max-w-[220px] truncate text-xs text-slate-400 sm:inline">{r.sub}</span>}
                        <span className="shrink-0 text-xs text-slate-400">
                          {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}