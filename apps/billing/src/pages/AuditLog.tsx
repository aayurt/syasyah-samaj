import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Download, Filter } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, fmt, list } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { ReportSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'

interface AuditLogEntry {
  id: number
  action: string
  entityType: string
  entityId: string
  entityLabel?: string
  userName?: string
  userRole?: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  meta?: Record<string, unknown> | null
  createdAt: string
  tenant?: number | null
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-700',
  update: 'bg-amber-100 text-amber-700',
  delete: 'bg-red-100 text-red-700',
  post: 'bg-blue-100 text-blue-700',
  void: 'bg-slate-100 text-slate-700',
  transfer: 'bg-purple-100 text-purple-700',
}

const QUICK_RANGES = [
  { label: 'Today', from: () => new Date().toISOString().slice(0, 10), to: () => new Date().toISOString().slice(0, 10) },
  { label: 'This Week', from: () => weekStart(), to: () => new Date().toISOString().slice(0, 10) },
  { label: 'This Month', from: () => monthStart(), to: () => new Date().toISOString().slice(0, 10) },
  { label: 'All Time', from: () => '', to: () => '' },
]
function weekStart(): string { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10) }
function monthStart(): string { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }

function JsonDiff({ before, after }: { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null }) {
  if (!before && !after) return null
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
  // Filter out internal/relationship fields
  const skip = new Set(['id', 'createdAt', 'updatedAt', 'tenant', 'sort'])
  const relevant = keys.filter((k) => !skip.has(k) && before?.[k] !== after?.[k])
  if (relevant.length === 0) return <span className="text-xs text-slate-400">No field changes</span>
  return (
    <div className="mt-2 space-y-1">
      {relevant.map((k) => (
        <div key={k} className="flex items-start gap-2 text-xs">
          <span className="shrink-0 font-medium text-slate-500">{k}:</span>
          <span className="text-red-500 line-through">{formatVal(before?.[k])}</span>
          <span className="text-emerald-600">{formatVal(after?.[k])}</span>
        </div>
      ))}
    </div>
  )
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 100)
  return String(v)
}

export default function AuditLog() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const q: Record<string, string | number | undefined> = { depth: 0, sort: '-createdAt', limit: 200, ...tenantQuery }
      const where: Record<string, Record<string, string>> = {}
      if (from) where.createdAt = { ...where.createdAt, greater_than_equal: from + 'T00:00:00.000Z' }
      if (to) where.createdAt = { ...where.createdAt, less_than_equal: to + 'T23:59:59.999Z' }
      if (actionFilter) where.action = { equals: actionFilter }
      if (entityFilter) where.entityType = { equals: entityFilter }
      if (Object.keys(where).length > 0) q.where = where as any
      const res = await api<{ docs: AuditLogEntry[]; totalDocs: number }>('audit-logs', { query: q })
      setLogs(res.docs)
      setTotal(res.totalDocs)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally { setLoading(false) }
  }, [from, to, actionFilter, entityFilter, tenantId])

  useEffect(() => { load() }, [load])

  const toggle = (id: number) => setExpanded((prev) => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const csv = () => downloadCsv('audit-log.csv', ['Timestamp', 'Action', 'Entity', 'Label', 'User', 'Role'],
    logs.map((l) => [l.createdAt, l.action, l.entityType, l.entityLabel || l.entityId, l.userName || '', l.userRole || '']))

  // Collect unique entity types for filter
  const entityTypes = [...new Set(logs.map((l) => l.entityType))]

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-semibold text-slate-900">Audit Log</h1>
        </div>
        <div className="print:hidden flex items-center gap-2">
          <button onClick={csv} disabled={loading || logs.length === 0} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download size={14} /> CSV</button>
        </div>
      </div>
      <div className="mt-2"><DataStatus /></div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500" />
          <span className="text-xs text-slate-400">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500" />
        </div>
        <div className="flex gap-1">
          {QUICK_RANGES.map((r) => (<button key={r.label} onClick={() => { setFrom(r.from()); setTo(r.to()) }} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">{r.label}</button>))}
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500">
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="post">Post</option>
          <option value="void">Void</option>
          <option value="transfer">Transfer</option>
        </select>
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500">
          <option value="">All Entities</option>
          {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {error && <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? <ReportSkeleton /> : (
        <>
          <div className="mt-4 rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
              {total} audit log{total !== 1 ? 's' : ''}
            </div>
            {logs.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No audit logs found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2">Timestamp</th>
                    <th className="px-4 py-2">Action</th>
                    <th className="px-4 py-2">Entity</th>
                    <th className="px-4 py-2">User</th>
                    <th className="px-4 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        <span className="font-medium">{log.entityType}</span>
                        {log.entityLabel && <span className="ml-1 text-slate-400">· {log.entityLabel}</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {log.userName || '—'}
                        {log.userRole && <span className="ml-1 text-xs text-slate-400">({log.userRole})</span>}
                      </td>
                      <td className="px-4 py-2">
                        {(log.before || log.after) && (
                          <button onClick={() => toggle(log.id)} className="text-slate-400 hover:text-slate-700">
                            <Filter size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Expanded diffs */}
          {logs.filter((l) => expanded.has(l.id)).map((log) => (
            <div key={`diff-${log.id}`} className="mt-2 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-slate-700">
                  {log.action} · {log.entityType} · {log.entityLabel || log.entityId}
                </div>
                <button onClick={() => toggle(log.id)} className="text-xs text-slate-400 hover:text-slate-700">close</button>
              </div>
              <JsonDiff before={log.before} after={log.after} />
              {log.meta && (
                <div className="mt-2 text-xs text-slate-500">
                  <span className="font-medium">Meta:</span> {JSON.stringify(log.meta)}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
