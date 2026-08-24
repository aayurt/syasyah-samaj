import { useState } from 'react'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { getEngine, useSyncState } from '../lib/api'

/**
 * Compact sync status shown in the header: Synced / n to sync / Offline,
 * plus a manual "sync now" button that uses the single POST /api/sync
 * endpoint to push queued writes and pull all changes in one request.
 */
export default function SyncStatus() {
  const state = useSyncState()
  const [syncing, setSyncing] = useState(false)
  const [pullProgress, setPullProgress] = useState('')

  const syncNow = async () => {
    setSyncing(true)
    setPullProgress('Syncing…')
    try {
      const engine = getEngine()
      // Single endpoint: pushes outbox + pulls all changes
      await engine.pull()
      setPullProgress('Done')
    } finally {
      setSyncing(false)
      setPullProgress('')
    }
  }

  const offline = !state.online
  const reportAge =
    state.reportsStale && state.lastReportSyncAt
      ? ` · reports ${new Date(state.lastReportSyncAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : ''

  let pill: React.ReactNode
  if (offline) {
    pill = (
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
  } else if (syncing || state.pending > 0) {
    pill = (
      <button
        onClick={() => void syncNow()}
        disabled={syncing}
        title="Changes waiting to sync. Click to sync now."
        className="flex items-center gap-1.5 rounded border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
      >
        <RefreshCw size={13} className="animate-spin" />
        {pullProgress || (state.pending > 0 ? `${state.pending} to sync` : 'Syncing…')}
      </button>
    )
  } else if (state.syncingCount > 0) {
    // Background sync in progress (periodic or pull)
    pill = (
      <span
        className="flex items-center gap-1.5 rounded border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-600"
        title="Background sync in progress"
      >
        <RefreshCw size={13} className="animate-spin" />
        Refreshing…
      </span>
    )
  } else {
    pill = (
      <span
        className="flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
        title="All changes synced"
      >
        <Cloud size={13} />
        Synced
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5">
      {pill}
      <button
        onClick={() => void syncNow()}
        disabled={syncing}
        title="Resync — push queued changes and pull the latest data from the server"
        aria-label="Resync"
        className="flex items-center gap-1.5 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
      >
        <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
        {syncing ? (pullProgress || 'Syncing…') : 'Resync'}
      </button>
    </span>
  )
}
