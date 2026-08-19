import { CloudOff, RefreshCw } from 'lucide-react'
import { useSyncState } from '../lib/api'

/**
 * Inline data-source hint for list/report pages.
 *
 * Offline with a cached copy: "showing saved data" + last-synced time, so a
 * stale-looking table is explained rather than looking broken.
 * Online with a background refresh in flight: a subtle "Refreshing…" note.
 * Online + idle: renders nothing.
 */
export default function DataStatus() {
  const { online, syncingCount, lastSyncAt } = useSyncState()

  if (!online) {
    const time = lastSyncAt
      ? new Date(lastSyncAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : ''
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
        <CloudOff size={12} />
        Offline · showing saved data{time ? ` · ${time}` : ''}
      </span>
    )
  }

  if (syncingCount > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
        <RefreshCw size={12} className="animate-spin" />
        Refreshing…
      </span>
    )
  }

  return null
}