import { useEffect, useRef, useState } from 'react'
import { CloudOff, RefreshCw, TriangleAlert, X } from 'lucide-react'
import { getEngine, useSyncState } from '../lib/api'

const COLLECTIONS = [
  'gl-accounts',
  'account-groups',
  'journal-entries',
  'documents',
  'parties',
  'items',
]

export default function SyncBanner() {
  const state = useSyncState()
  const [syncing, setSyncing] = useState(false)
  const wasOnline = useRef(state.online)

  const syncNow = async () => {
    setSyncing(true)
    try {
      await getEngine().flush()
      for (const slug of COLLECTIONS) {
        try {
          await getEngine().pull(slug)
        } catch {
          // collection may not exist in this deployment
        }
      }
      // Keep the core reports warm (throttled inside the engine) so they
      // are usable offline and never more than a few minutes stale.
      try {
        await getEngine().warmReports()
      } catch {
        // best-effort — reports still fall back to the cache offline
      }
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    const online = () => getEngine().setOnline(true)
    const offline = () => getEngine().setOnline(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])

  // Auto-sync when the connection returns.
  useEffect(() => {
    if (state.online && !wasOnline.current) {
      void syncNow()
    }
    wasOnline.current = state.online
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.online])

  // Background pull loop: keep the local cache fresh so every view renders
  // from local data instantly — on mount, on a timer, and when the window
  // regains focus. Pulls are incremental (updatedAt cursor) and cheap.
  //
  // Deliberately NOT gated on `online`: a page-load is cache-first, so it
  // never probes the network — without an unconditional probe, the pill
  // would stay "Offline" forever after the server comes back (the browser's
  // `online` event doesn't fire for a server restart). Each pull updates the
  // online state from its own success/failure.
  useEffect(() => {
    const pullAll = () => {
      void syncNow()
    }
    pullAll()
    const id = setInterval(pullAll, 30_000)
    const onFocus = () => {
      if (document.visibilityState === 'visible') pullAll()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!state.online && state.pending === 0) {
    return (
      <div className="flex items-center justify-between gap-3 bg-amber-50 px-6 py-2 text-sm text-amber-800">
        <div className="flex items-center gap-2">
          <CloudOff size={15} />
          <span>
            Offline — new changes will be queued and synced when you reconnect.
          </span>
        </div>
        <button
          onClick={() => void syncNow()}
          disabled={syncing}
          className="flex items-center gap-1 rounded border border-amber-300 px-2 py-0.5 text-xs font-medium hover:bg-amber-100 disabled:opacity-50"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          Retry
        </button>
      </div>
    )
  }

  if (state.pending > 0 || state.banners.length > 0) {
    return (
      <div className="border-b border-slate-200 bg-sky-50">
        {state.banners.map((b, i) => (
          <div
            key={i}
            className="flex items-center gap-2 bg-orange-50 px-6 py-1.5 text-xs text-orange-800"
          >
            <TriangleAlert size={13} />
            <span className="flex-1">{b.message}</span>
            <button
              onClick={() => getEngine().dismissBanner(i)}
              className="text-orange-400 hover:text-orange-700"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 px-6 py-2 text-sm text-sky-800">
          <span>
            {state.online
              ? `${state.pending} change${state.pending === 1 ? '' : 's'} waiting to sync.`
              : `Offline — ${state.pending} change${state.pending === 1 ? '' : 's'} queued locally.`}
          </span>
          <button
            onClick={() => void syncNow()}
            disabled={syncing || !state.online}
            className="flex items-center gap-1 rounded border border-sky-300 px-2 py-0.5 text-xs font-medium hover:bg-sky-100 disabled:opacity-50"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>
    )
  }

  return null
}
