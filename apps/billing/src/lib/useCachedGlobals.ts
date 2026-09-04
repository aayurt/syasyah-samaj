import { useEffect, useState } from 'react'
import { api } from './api'

/**
 * Cache-first read for Payload globals (singleton settings).
 * Returns cached data instantly from localStorage, refreshes in background.
 *
 * `failed` is true only when the read errored (data stays null). Consumers
 * that gate on settings content (e.g. the setup checklist) must treat a
 * failed read as "unknown" — never as "empty", or a transient network error
 * would wrongly lock the books.
 */
export function useCachedGlobals<T>(path: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    api<T>(path, { query: { depth: 0 } })
      .then((res) => {
        if (alive) {
          setData(res)
          setFailed(false)
          setLoading(false)
        }
      })
      .catch(() => {
        if (alive) {
          setFailed(true)
          setLoading(false)
        }
      })
    return () => {
      alive = false
    }
  }, [path])

  return { data, loading, failed }
}
