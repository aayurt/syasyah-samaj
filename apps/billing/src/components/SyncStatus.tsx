import { useState } from 'react'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { getEngine, useSyncState } from '../lib/api'

/**
 * Compact sync status shown in the header: Synced / n to sync / Offline.
 * Clicking while pending or offline retries the outbox flush.
 */
export default function SyncStatus() {
  const state = useSyncState()
  const [syncing, setSyncing] = useState(false)

  const syncNow = async () => {
    setSyncing(true)
    try {
      await getEngine().flush()
    } finally {
      setSyncing(false)
    }
  }

  if (!state.online) {
    const reportAge =
      state.reportsStale && state.lastReportSyncAt
        ? ` · reports ${new Date(state.lastReportSyncAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : ''
    return (
      <button
        onClick={() => void syncNow()}
        disabled={syncing}
        title="Offline — new changes are queued locally and reports show the last synced snapshot. Click to retry."
        className="flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
      >
        <CloudOff size={13} />
        Offline{state.pending > 0 ? ` · ${state.pending} queued` : ''}
        {reportAge}
      </button>
    )
  }

  if (syncing || state.pending > 0) {
    return (
      <button
        onClick={() => void syncNow()}
        disabled={syncing}
        title="Changes waiting to sync. Click to sync now."
        className="flex items-center gap-1.5 rounded border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
      >
        <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
        {syncing ? 'Syncing…' : `${state.pending} to sync`}
      </button>
    )
  }

  return (
    <span
      className="flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
      title="All changes synced"
    >
      <Cloud size={13} />
      Synced
    </span>
  )
}
