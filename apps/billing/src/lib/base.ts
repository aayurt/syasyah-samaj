const env = (import.meta as unknown as { env?: Record<string, string> }).env

function sameOriginApi(): boolean {
  if (typeof window === 'undefined') return false
  // Bundled desktop (tauri:// or file://) talks to the local backend on :3000.
  // Dev server (5173) and hosted pages use same-origin via Vite proxy or
  // Payload's own server — no CORS needed.
  if (window.location.protocol === 'tauri:' || window.location.protocol === 'file:') return false
  return /^https?:$/.test(window.location.protocol)
}

export const API_BASE: string =
  env?.VITE_API_URL ||
  (sameOriginApi() ? window.location.origin : 'http://localhost:3000')
