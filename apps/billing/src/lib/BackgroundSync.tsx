import { useEffect, useRef } from 'react'
import { getEngine } from './offline'
import { useTenant } from './tenant'

/**
 * Background sync hook: every 5 minutes, pull fresh data for the main
 * collections into IndexedDB. If new docs are found, the engine's
 * cacheVersion bumps and all useSyncState() consumers re-render
 * silently — no loading spinners, no user interruption.
 *
 * Runs only when the app is online and the tab is visible.
 */
const INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/** Collections to keep warm in the background. */
const COLLECTIONS = [
  'documents',
  'parties',
  'gl-accounts',
  'items',
  'membership-types',
  'members',
  'journal-entries',
]

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

      let changed = false
      for (const col of COLLECTIONS) {
        try {
          const count = await engine.pull(col, tenant)
          if (count > 0) changed = true
        } catch {
          // Best-effort: a single failed pull shouldn't block others
        }
      }
      // Bump cacheVersion so all useSyncState consumers re-render with
      // fresh data. Only bump if something actually changed.
      if (changed) {
        // Trigger a re-render by emitting a state change
        engine.setOnline(engine.getState().online)
      }
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
