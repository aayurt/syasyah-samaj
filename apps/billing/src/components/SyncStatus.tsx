import { useEffect, useState } from 'react'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { getEngine, useSyncState } from '../lib/api'
import { useT } from '../lib/i18n'
import ConflictDrawer from './ConflictDrawer'

/**
 * Compact, non-intrusive sync status in the header:
 * - 🟢 Synced
 * - 🟡 n Pending Sync (subtle spin while a background sync runs)
 * - 🔴 Offline — reassuring "Saved locally" copy
 * A conflicts badge (server-rejected writes) opens the quarantine review
 * drawer instead of interrupting the user with banners or alerts.
 */
export default function SyncStatus() {
  const t = useT()
  const state = useSyncState()
  const [syncing, setSyncing] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  // 1s tick so the "Resync in Xs" countdown stays smooth between the 2s
  // state polls.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!state.online || state.syncingCount > 0) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [state.online, state.syncingCount])

  const syncNow = async () => {
    setSyncing(true)
    try {
      const engine = getEngine()
      // Single endpoint: pushes outbox + pulls all changes
      await engine.syncAll()
    } finally {
      setSyncing(false)
    }
  }

  const offline = !state.online
  const hasConflicts = state.conflicts > 0
  // Seconds until the next scheduled automatic sync (debounced flush,
  // backoff retry, or the 60s periodic sync). Null when none is scheduled.
  const nextIn =
    state.nextSyncAt != null
      ? Math.max(0, Math.ceil((state.nextSyncAt - now) / 1000))
      : null

  let pill: React.ReactNode
  if (offline) {
    pill = (
      <button
        onClick={() => void syncNow()}
        disabled={syncing}
        title={t(
          'sync.offlineHint',
          'Offline — your changes are saved on this device and will sync automatically when you reconnect.',
        )}
        className="flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
      >
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full rounded-full bg-red-400" />
        </span>
        <CloudOff size={13} />
        <span>
          {t('sync.offline', 'Offline')}
          <span className="hidden md:inline">
            {' · '}
            {t('sync.savedLocally', 'Saved locally')}
          </span>
        </span>
        {state.pending > 0 && (
          <span className="text-red-500">
            · {t('sync.pendingSync', '{n} pending sync').replace('{n}', String(state.pending))}
          </span>
        )}
      </button>
    )
  } else if (syncing || state.pending > 0 || state.syncingCount > 0) {
    // 🟡 Pending — amber, subtle spin while anything is in flight.
    pill = (
      <button
        onClick={() => void syncNow()}
        disabled={syncing}
        title={t('sync.pendingHint', 'Changes waiting to sync. Click to sync now.')}
        className="flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
      >
        <RefreshCw
          size={13}
          className={syncing || state.syncingCount > 0 ? 'animate-spin' : ''}
        />
        {state.pending > 0
          ? t('sync.pendingSync', '{n} pending sync').replace('{n}', String(state.pending))
          : t('sync.syncing', 'Syncing…')}
      </button>
    )
  } else if (nextIn != null && nextIn > 0) {
    // All synced now; the next automatic sync (or backoff retry) is scheduled.
    pill = (
      <span
        className="flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
        title={t('sync.resyncScheduled', 'All changes synced — next automatic sync is scheduled')}
      >
        <RefreshCw size={13} />
        {t('sync.resyncIn', 'Resync in {n}s').replace('{n}', String(nextIn))}
      </span>
    )
  } else {
    pill = (
      <span
        className="flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
        title={t('sync.syncedTitle', 'All changes synced')}
      >
        <Cloud size={13} />
        {t('sync.syncedLabel', 'Synced')}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5">
      {pill}
      {hasConflicts && (
        <button
          onClick={() => setDrawerOpen(true)}
          title={t(
            'sync.reviewHint',
            'Changes the server could not accept — review, edit, or discard them.',
          )}
          className="flex items-center gap-1.5 rounded border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100"
        >
          {t('sync.reviewQueued', '{n} to review').replace('{n}', String(state.conflicts))}
        </button>
      )}
      <button
        onClick={() => void syncNow()}
        disabled={syncing || (!offline && state.pending === 0 && !state.reportsStale)}
        title={
          offline || state.pending > 0 || state.reportsStale
            ? t('sync.resyncAria', 'Resync — push queued changes and pull the latest data from the server')
            : t('sync.syncedTitle', 'All changes synced')
        }
        aria-label={t('sync.resyncAria', 'Resync — push queued changes and pull the latest data from the server')}
        className="flex items-center gap-1.5 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-default disabled:opacity-40"
      >
        <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
        <span className="hidden sm:inline">
          {syncing ? t('sync.resyncing', 'Resyncing…') : t('sync.resync', 'Resync')}
        </span>
      </button>
      {drawerOpen && <ConflictDrawer onClose={() => setDrawerOpen(false)} />}
    </span>
  )
}
