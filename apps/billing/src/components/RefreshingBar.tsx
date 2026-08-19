import { useSyncState } from '../lib/api'

/**
 * Thin indeterminate progress strip showing when the sync engine has network
 * requests in flight (background refreshes, pulls, report warms). The 2px
 * track is always rendered so appearing/disappearing never shifts layout;
 * it stays transparent when idle or offline.
 */
export default function RefreshingBar() {
  const { syncingCount, online } = useSyncState()
  const active = online && syncingCount > 0
  return (
    <div
      className={`relative h-0.5 overflow-hidden rounded-full transition-colors ${
        active ? 'bg-slate-200/70' : 'bg-transparent'
      }`}
    >
      {active && (
        <div className="animate-[refreshing_1.2s_ease-in-out_infinite] h-full w-1/3 rounded-full bg-crimson-500" />
      )}
    </div>
  )
}