import { useEffect, useState } from 'react'
import { Wifi } from 'lucide-react'
import { getEngine } from '../lib/offline'

/**
 * Subtle cold-boot banner: shows "Connecting…" while IndexedDB is empty
 * (first-ever visit or after clearing site data). Auto-hides once the
 * first data pull warms the cache, or after 5 seconds — whichever comes
 * first. Never shows if the cache is already warm.
 */
export default function ConnectingBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const engine = getEngine()
    let timeout: ReturnType<typeof setTimeout>

    const check = async () => {
      // If the documents collection has been pulled before, cache is warm
      const pulled = await engine.getKey('pulled:documents')
      if (pulled) return // cache warm — don't show anything

      // Cold boot: show the banner
      setVisible(true)

      // Poll until cache is warm (max 5 seconds)
      const start = Date.now()
      const poll = setInterval(async () => {
        const warm = await engine.getKey('pulled:documents')
        if (warm || Date.now() - start > 5_000) {
          setVisible(false)
          clearInterval(poll)
        }
      }, 500)

      // Safety net: always hide after 5 seconds
      timeout = setTimeout(() => {
        setVisible(false)
        clearInterval(poll)
      }, 5_500)
    }

    // Small delay so the first render isn't competing with IndexedDB init
    const initTimer = setTimeout(check, 200)

    return () => {
      clearTimeout(initTimer)
      clearTimeout(timeout)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="flex items-center justify-center gap-2 bg-slate-800 px-4 py-1.5 text-xs text-slate-300">
      <Wifi size={12} className="animate-pulse" />
      <span>Connecting to server…</span>
    </div>
  )
}
