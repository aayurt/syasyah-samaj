import { useEffect, useState } from 'react'
import { api } from './api'

/**
 * Cache-first read for Payload globals (singleton settings).
 * Returns cached data instantly from localStorage, refreshes in background.
 */
export function useCachedGlobals<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    api<T>(path, { query: { depth: 0 } })
      .then((res) => { if (alive) { setData(res); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [path])

  return { data, loading }
}
