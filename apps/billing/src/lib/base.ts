const env = (import.meta as unknown as { env?: Record<string, string> }).env

function sameOriginApi(): boolean {
  if (typeof window === 'undefined') return false
  // Dev server (5173) and bundled desktop (tauri:// or file://) talk to the
  // local backend on :3000. A hosted page (https://…/app/) uses its own
  // origin so requests are same-origin and need no CORS.
  if (window.location.port === '5173') return false
  return /^https?:$/.test(window.location.protocol)
}

export const API_BASE: string =
  env?.VITE_API_URL ||
  (sameOriginApi() ? window.location.origin : 'http://localhost:3000')
