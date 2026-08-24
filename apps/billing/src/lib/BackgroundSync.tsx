import { useEffect, useRef } from 'react'
import { getEngine } from './offline'
import { useTenant } from './tenant'

/**
 * Background sync hook: every 5 minutes, pull fresh data from the server
 * via the single POST /api/sync endpoint. This pushes any queued writes
 * and pulls all changes in one HTTP request. If new docs are found, the
 * engine's cacheVersion bumps and all useSyncState() consumers re-render
 * silently — no loading spinners, no user interruption.
 *
 * Runs only when the app is online and the tab is visible.
 */
const INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export function useBackgroundSync() {
  const { tenantId } = useTenant()
  const tenant = tenantId ? String(tenantId) : undefined
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const engine = getEngine()

    const pullAll = async () => {
      // Don't pull if the page is hidden (user is in another tab)
      if (typeof document !== 'undefined' && document.hidden) return
      // Don't pull if offline
      if (!engine.getState().online) return

      // Single endpoint: pushes outbox + pulls all changes
      await engine.pull(tenant)
    }

    // Pull immediately on mount (after a short delay so the first render
    // isn't competing with the initial page load).
    const initialTimer = setTimeout(pullAll, 3_000)

    // Then every 5 minutes
    timerRef.current = setInterval(pullAll, INTERVAL_MS)

    return () => {
      clearTimeout(initialTimer)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [tenant])
}
