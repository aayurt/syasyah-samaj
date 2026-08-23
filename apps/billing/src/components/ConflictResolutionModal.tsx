import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Loader2, X } from 'lucide-react'
import { DOC_TYPE_LABELS } from '../lib/types'
import type { OutboxEntry } from '../lib/offline/types'
import { getEngine } from '../lib/api'
import { useCalendar } from '../lib/calendar'

interface Props {
  entry: OutboxEntry
  onClose: () => void
  onResolved: () => void
}

/**
 * Side-by-side conflict resolution modal. Fetches the server version,
 * compares field-by-field with the queued offline version, and lets the
 * user choose "Keep Mine", "Keep Server", or merge individual fields.
 */
export default function ConflictResolutionModal({ entry, onClose, onResolved }: Props) {
  const { formatDateTime } = useCalendar()
  const [loading, setLoading] = useState(true)
  const [serverDoc, setServerDoc] = useState<Record<string, unknown> | null>(null)
  const [merged, setMerged] = useState<Record<string, unknown>>({})
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const offlineBody = (entry.body ?? {}) as Record<string, unknown>
  const label = DOC_TYPE_LABELS[String(offlineBody.docType)] || 'Document'

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const server = await getEngine().fetchServerVersion(entry.path)
        if (cancelled) return
        setServerDoc(server)
        // Initialize merged with offline values
        setMerged({ ...offlineBody })
      } catch {
        if (!cancelled) setError('Could not fetch server version')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [entry.path]) // eslint-disable-line react-hooks/exhaustive-deps

  const serverFields = serverDoc ? Object.keys(serverDoc).filter((k) => {
    const skip = new Set(['id', 'createdAt', 'updatedAt', '_status', 'tenant'])
    return !skip.has(k) && serverDoc[k] !== undefined && serverDoc[k] !== null
  }) : []

  const offlineFields = Object.keys(offlineBody).filter((k) => {
    const skip = new Set(['id', 'createdAt', 'updatedAt', 'localId', '_pendingSync'])
    return !skip.has(k) && offlineBody[k] !== undefined && offlineBody[k] !== null
  })

  const allFields = [...new Set([...serverFields, ...offlineFields])]

  const hasDiff = (field: string) => {
    const sv = JSON.stringify(serverDoc?.[field])
    const ov = JSON.stringify(offlineBody[field])
    return sv !== ov
  }

  const chooseServer = () => {
    if (serverDoc) setMerged({ ...serverDoc })
  }

  const chooseMine = () => {
    setMerged({ ...offlineBody })
  }

  const pickField = (field: string, which: 'server' | 'mine') => {
    const value = which === 'server' ? serverDoc?.[field] : offlineBody[field]
    setMerged((prev) => ({ ...prev, [field]: value }))
  }

  const applyResolution = async () => {
    setApplying(true)
    setError(null)
    try {
      const result = await getEngine().forceApply(entry, merged)
      if (result.status === 'pushed') {
        onResolved()
      } else {
        setError(result.message ?? 'Unknown error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply')
    } finally {
      setApplying(false)
    }
  }

  const formatValue = (v: unknown): string => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'boolean') return v ? 'Yes' : 'No'
    if (typeof v === 'number') return v.toLocaleString()
    if (typeof v === 'object') {
      if (Array.isArray(v)) return `[${v.length} items]`
      return String((v as { id?: unknown }).id ?? JSON.stringify(v))
    }
    return String(v)
  }

  const friendlyName = (field: string) =>
    field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <div className="text-base font-semibold text-slate-900">
              Resolve Conflict — {label}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {entry.method} {entry.path} · queued {formatDateTime(entry.queuedAt)}
            </div>
            {entry.conflict && (
              <div className="mt-1 text-xs text-red-600">
                {entry.conflict.message}
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-500">
              <Loader2 size={16} className="mr-2 animate-spin" />
              Fetching server version…
            </div>
          ) : error && !serverDoc ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <>
              {/* Quick actions */}
              <div className="mb-4 flex gap-2">
                <button
                  onClick={chooseMine}
                  className="flex items-center gap-1.5 rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                >
                  <ArrowLeft size={12} />
                  Keep All Mine
                </button>
                <button
                  onClick={chooseServer}
                  className="flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  <ArrowRight size={12} />
                  Keep All Server
                </button>
              </div>

              {/* Field comparison table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="w-40 py-2 pr-3">Field</th>
                    <th className="w-[35%] py-2 px-3">Your Version (Offline)</th>
                    <th className="w-[35%] py-2 px-3">Server Version</th>
                    <th className="w-24 py-2 pl-3 text-center">Pick</th>
                  </tr>
                </thead>
                <tbody>
                  {allFields.map((field) => {
                    const diff = hasDiff(field)
                    const isMergedServer = JSON.stringify(merged[field]) === JSON.stringify(serverDoc?.[field])
                    const isMergedMine = JSON.stringify(merged[field]) === JSON.stringify(offlineBody[field])
                    return (
                      <tr
                        key={field}
                        className={`border-b border-slate-50 ${diff ? 'bg-amber-50/50' : ''}`}
                      >
                        <td className="py-2.5 pr-3 font-medium text-slate-700">
                          {friendlyName(field)}
                          {diff && <span className="ml-1 text-amber-500">●</span>}
                        </td>
                        <td className={`py-2.5 px-3 ${isMergedMine && diff ? 'font-medium text-blue-700' : 'text-slate-600'}`}>
                          <div className="flex items-center gap-1">
                            {isMergedMine && diff && <Check size={11} className="text-blue-500" />}
                            {formatValue(offlineBody[field])}
                          </div>
                        </td>
                        <td className={`py-2.5 px-3 ${isMergedServer && diff ? 'font-medium text-emerald-700' : 'text-slate-600'}`}>
                          <div className="flex items-center gap-1">
                            {isMergedServer && diff && <Check size={11} className="text-emerald-500" />}
                            {formatValue(serverDoc?.[field])}
                          </div>
                        </td>
                        <td className="py-2.5 pl-3 text-center">
                          {diff && (
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => pickField(field, 'mine')}
                                title="Use your version"
                                className="rounded border border-blue-200 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100"
                              >
                                Mine
                              </button>
                              <button
                                onClick={() => pickField(field, 'server')}
                                title="Use server version"
                                className="rounded border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 hover:bg-emerald-100"
                              >
                                Server
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
          <div className="text-xs text-slate-400">
            {error && <span className="text-red-500">{error}</span>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => void applyResolution()}
              disabled={loading || applying || !!error}
              className="flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {applying ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Applying…
                </>
              ) : (
                <>
                  <Check size={13} />
                  Apply Resolution
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
