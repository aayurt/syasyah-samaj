/**
 * The SPA is served from two places with an absolute base set at build time:
 *   - hosted under Payload at `/app/`   (vite base: /app/)
 *   - bundled into the desktop app      (vite base: /)
 *
 * Vite's BASE_URL reflects that base. `APP_BASE` is the URL prefix WITHOUT a
 * trailing slash, so it works both as the router basename (Next.js strips the
 * trailing slash via 308, so `/app/` never matches the URL) and as a path
 * prefix for the service worker / version probe.
 */
export const APP_BASE: string = import.meta.env.BASE_URL.replace(/\/$/, '')

export const SW_PATH = `${APP_BASE}/sw.js`
export const VERSION_PATH = `${APP_BASE}/version.json`

/** Register the shell service worker once, on first load (production only). */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  // Custom protocols (tauri://, file://) don't support service workers.
  if (!/^https?:$/.test(window.location.protocol)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(SW_PATH, { scope: `${APP_BASE}/` })
      .catch(() => {
        // SW registration is best-effort — the app works without it.
      })
  })
}
