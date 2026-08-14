import { existsSync } from 'fs'
import path from 'path'

/**
 * Locate the built billing SPA (`apps/billing/dist`).
 *
 * Layouts this must handle:
 *   - dev:  `next dev` with cwd = repo root          → apps/billing/dist
 *   - prod: `.next/standalone/server.js` (cwd = standalone root)
 *                                                      → ../apps/billing/dist
 *   - override: BILLING_DIST_DIR env var (absolute or repo-root-relative)
 */
const REPO_ROOT = path.resolve(process.cwd(), '..')

function candidates(): string[] {
  const out: string[] = []
  const env = process.env.BILLING_DIST_DIR
  if (env) {
    out.push(path.isAbsolute(env) ? env : path.resolve(process.cwd(), env))
  }
  out.push(path.resolve(process.cwd(), 'apps/billing/dist'))
  out.push(path.resolve(REPO_ROOT, 'apps/billing/dist'))
  out.push(path.resolve(process.cwd(), 'dist'))
  return out
}

let cached: string | null = null

export function distRoot(): string {
  if (cached) return cached
  const found = candidates().find((p) => existsSync(p))
  cached = found ?? candidates()[0]
  return cached
}
