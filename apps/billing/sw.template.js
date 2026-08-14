/* Syasya Accounting — app-shell service worker.
 * Generated at build time; the build id is injected below so each build's
 * bytes differ and the browser notices the SW update.
 *
 * Strategy:
 *   - navigations: network-first, fall back to the cached shell (offline)
 *   - /app/assets/* (hashed, immutable): cache-first, fill on miss
 *   - everything else (API, auth, version.json): untouched, pass through
 */
const VERSION = '__VERSION__'
const CACHE = `syasya-shell-${VERSION}`
// Canonical shell URL — every successful navigation is ALSO stored under this
// key, so any offline navigation falls back to the app shell (index.html).
const INDEX = new URL('./index.html', self.registration.scope).href

self.addEventListener('install', (event) => {
  self.skipWaiting()
  // Best-effort precache of the shell on install (skipped when offline).
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch(INDEX)
        if (res && res.ok) {
          const cache = await caches.open(CACHE)
          await cache.put(INDEX, res)
        }
      } catch {
        // offline at install — the shell is cached on first successful nav
      }
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Only handle same-origin GETs for the app shell / its assets.
  if (url.origin !== self.location.origin) return

  // Never intercept the API, auth, admin, or the version probe.
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.endsWith('/version.json')
  ) {
    return
  }

  const isNavigation = req.mode === 'navigate'

  if (isNavigation) {
    event.respondWith(networkFirst(req))
  } else {
    event.respondWith(cacheFirst(req))
  }
})

async function networkFirst(req) {
  try {
    const res = await fetch(req)
    if (res && res.ok) {
      const cache = await caches.open(CACHE)
      await cache.put(req, res.clone())
      // Keep the shell under the canonical index key for offline fallback.
      await cache.put(INDEX, res.clone())
    }
    return res
  } catch {
    const cached = await caches.match(req)
    if (cached) return cached
    // Last resort: the cached shell index.
    const shell = await caches.match(INDEX)
    if (shell) return shell
    throw new Error('Offline and no cached shell')
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req)
  if (cached) return cached
  try {
    const res = await fetch(req)
    if (res && res.ok) {
      const cache = await caches.open(CACHE)
      await cache.put(req, res.clone())
    }
    return res
  } catch (err) {
    throw err
  }
}
