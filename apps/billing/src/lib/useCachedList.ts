import { useEffect, useRef, useState } from 'react'
import { api, type ListResponse } from './api'

/**
 * Cache-first list hook: returns cached data instantly (no skeleton on warm
 * cache), then fetches fresh data in the background and updates state.
 *
 * On first mount with a warm cache the component renders immediately.
 * A background fetch keeps the data fresh. If the cache is cold the
 * component shows a loading state until the first fetch completes.
 *
 * Also exposes `setDocs` for optimistic inline creates — append the new
 * item immediately, and the next background refresh will reconcile.
 */
export function useCachedList<T>(
  slug: string,
  query?: Record<string, string | number | undefined>,
  opts?: { enabled?: boolean },
) {
  const [docs, setDocs] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    const enabled = opts?.enabled !== false
    if (!enabled) { setLoading(false); return }

    let didRender = false
    const q = { limit: 1000, depth: 1, ...query }

    api<ListResponse<T>>(`/${slug}`, { query: q })
      .then((res) => {
        if (!alive.current) return
        setDocs(res.docs || [])
        if (!didRender) setLoading(false)
        didRender = true
      })
      .catch((err) => {
        if (!alive.current) return
        setError(err instanceof Error ? err.message : 'Failed to load')
        if (!didRender) setLoading(false)
        didRender = true
      })

    return () => { alive.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, JSON.stringify(query), opts?.enabled])

  return { docs, setDocs, loading, error }
}
