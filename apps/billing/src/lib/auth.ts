import { useEffect, useRef, useState } from 'react'
import { createAuthClient } from 'better-auth/react'
import { API_BASE } from './base'
import { getEngine } from './offline'

export const authClient = createAuthClient({
  baseURL: API_BASE,
  fetchOptions: { credentials: 'include' },
})

export const isAdminUser = (role?: string): boolean =>
  role === 'admin' || role === 'super-admin'

export const isSuperAdminUser = (role?: string): boolean =>
  role === 'super-admin'

// Roles allowed to enter the Billing app. The publicly advertised demo account
// uses the `super-admin` role for full access to the setup wizard and platform features.
const ILLAKA_ROLES = [
  'illaka-chair',
  'illaka-treasurer',
  'illaka-secretary',
  'illaka-accountant',
  'illaka-member-officer',
  'viewer',
]
export const canAccessBilling = (role?: string): boolean =>
  isAdminUser(role) || ILLAKA_ROLES.includes(role ?? '')

const SESSION_CACHE_KEY = 'session'

type CachedSession = { user: { email: string; role?: string } }

/**
 * Keeps the last-known session in the offline store so the app shell can
 * render cached data when the server is unreachable. The cached session is
 * only trusted when the connectivity check fails at the network level — never
 * when the server responds "no session" (explicit sign-out) or returns an
 * auth error.
 */
export function useOfflineSession(): {
  session: CachedSession | null
  checking: boolean
} {
  // E2E test bypass: provide a mock admin session without network round-trips.
  // The bypass flag is read first, but hooks below always run in the same
  // order — we override values instead of returning early, to avoid breaking
  // the Rules of Hooks (conditional early return changes hook order).
  const bypass =
    typeof window !== 'undefined' &&
    window.localStorage.getItem('__e2e_bypass__') === '1'
  const bypassRole =
    bypass &&
    (window.localStorage.getItem('__e2e_role__') || 'super-admin')

  // Hooks are always called in this exact order, regardless of bypass mode.
  const { data: live, isPending } = authClient.useSession()
  const [cached, setCached] = useState<CachedSession | null>(null)
  const [checking, setChecking] = useState(false)
  const probedRef = useRef(false)
  const engine = getEngine()

  // In bypass mode, override the resolved session with a mock admin session.
  const session = bypass
    ? ({ user: { email: 'e2e@test.com', role: bypassRole } } as CachedSession)
    : live ? (live as unknown as CachedSession) : cached

  // Persist a live session for offline use, and drop the cached copy the
  // moment the live session is (re)established. Skipped in bypass mode.
  useEffect(() => {
    if (bypass || !live) return
    setCached(null)
    probedRef.current = false
    engine.setKey(SESSION_CACHE_KEY, JSON.stringify(live)).catch(() => {})
  }, [bypass, live, engine])

  // When the live check comes back empty, probe connectivity exactly once
  // (per live-session cycle). Only a thrown network error (offline) falls
  // back to the cached session; a reachable server saying "no session" means
  // signed out and clears it. Skipped in bypass mode.
  useEffect(() => {
    if (bypass || live || isPending || probedRef.current) return
    probedRef.current = true
    setChecking(true)
    fetch(`${API_BASE}/api/auth/get-session`, { credentials: 'include' })
      .then((r) => {
        // Server reachable with no live session means signed out (or invalid
        // session) — never trust the cached copy in that case.
        setCached(null)
      })
      .catch(async () => {
        // Network unreachable — trust the cached session so the shell renders.
        try {
          const raw = await engine.getKey(SESSION_CACHE_KEY)
          if (raw) {
            try {
              setCached(JSON.parse(raw) as CachedSession)
            } catch {
              setCached(null)
            }
          }
        } catch {
          // cache unavailable — treat as signed out
        }
      })
      .finally(() => setChecking(false))
  }, [bypass, live, isPending, engine])

  return {
    session,
    checking: bypass ? false : isPending || checking,
  }
}

export async function clearCachedSession(): Promise<void> {
  await getEngine().deleteKey(SESSION_CACHE_KEY).catch(() => {})
}
