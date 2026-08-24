import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { VERSION_PATH } from '../lib/appBase'

declare const __APP_VERSION__: string

const POLL_MS = 5 * 60 * 1000 // check every 5 minutes

/**
 * "New version available — Reload" banner.
 *
 * Polls the server's version.json (which is regenerated on every build and
 * never served from the SW cache) and compares it with the version baked
 * into this bundle. When they differ, a newer web build has been deployed —
 * offer a one-click reload that picks up the fresh shell + assets.
 */
export default function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) return

    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch(VERSION_PATH, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (data.version && data.version !== __APP_VERSION__) {
          setUpdateAvailable(true)
        }
      } catch {
        // Offline or server unreachable — nothing to do.
      }
    }

    check()
    const id = setInterval(check, POLL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  if (!updateAvailable) return null

  const reload = async () => {
    // If the new SW is waiting, let it take control before reloading so the
    // fresh shell isn't immediately re-cached by the old worker.
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
    } catch {
      // ignore
    }
    window.location.reload()
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-crimson-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-sm text-slate-700">
        A new version of Syasha धुकू is available.
      </p>
      <button
        onClick={reload}
        className="flex items-center gap-1.5 rounded bg-crimson-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-crimson-700"
      >
        <RefreshCw size={14} />
        Reload
      </button>
    </div>
  )
}
