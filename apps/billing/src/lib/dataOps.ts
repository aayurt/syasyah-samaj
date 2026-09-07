import { useEffect, useRef } from 'react'
import { api, getEngine } from './api'
import { useCachedGlobals } from './useCachedGlobals'
import type { BillingSettings } from './types'

/**
 * Data Management helpers — cleanup + demo seeding.
 *
 * The DataOps endpoints on the server are atomic and destructive by nature,
 * so every call here uses `immediate: true` (bypasses the offline outbox —
 * queueing a partial replay of a wipe would be wrong) and, on success,
 * invalidates the cached transaction collections so the cache-first UI shows
 * the post-operation state on the next render.
 */

/** Transaction-level collections the cleanup wipes (masters are kept). */
export const DATA_COLLECTIONS = [
  'documents',
  'journal-entries',
  'stock-movements',
  'bank-statements',
  'expense-claims',
  'recurring-schedules',
  'opening-balances',
  'fixed-assets',
] as const

/** Collections the demo seeder may create (chart + masters + vouchers). */
export const SEED_COLLECTIONS = [
  'account-groups',
  'gl-accounts',
  'parties',
  'items',
  'tax-types',
  'documents',
] as const

/** Selective-seed keys the server accepts for POST /data-ops/seed-demo. */
export type SeedKey =
  | 'accounts'
  | 'taxTypes'
  | 'parties'
  | 'items'
  | 'members'
  | 'fiscalYears'

export const SEED_KEYS: { key: SeedKey; label: string; blurb: string }[] = [
  { key: 'accounts', label: 'Chart of accounts & groups', blurb: 'Starter chart — 6 groups, 18 accounts, and the default-account mappings.' },
  { key: 'taxTypes', label: 'Tax types', blurb: 'VAT @ 13% plus its sales/purchase ledger wiring.' },
  { key: 'parties', label: 'Parties', blurb: 'A few sample customers and vendors (still editable).' },
  { key: 'items', label: 'Items', blurb: 'Sample stock items with rates (still editable).' },
  { key: 'members', label: 'Members & membership types', blurb: 'General / Permanent / Lifetime types plus sample members.' },
  { key: 'fiscalYears', label: 'Fiscal years', blurb: 'A default working year (2083-84) when none exists yet.' },
]

const EPOCH_KEY = 'billing.dataEpoch'

/** Drop the local cache for the given collections (engine bumps cacheVersion too).
 *  Clears both the unscoped and the tenant-scoped read keys. */
export async function invalidateCollections(slugs: readonly string[], tenant?: string): Promise<void> {
  const engine = getEngine()
  for (const slug of slugs) {
    try {
      await engine.invalidate(slug)
      if (tenant) await engine.invalidate(slug, tenant)
    } catch {
      /* non-fatal */
    }
  }
}

export interface CleanupResult {
  ok: boolean
  tenant?: string
  counts?: Record<string, number>
  failures?: Record<string, number>
  sequencesReset?: number
  epoch?: number
  error?: string
}

/** Wipe one tenant's transaction-level data. Returns the deleted counts. */
export async function runCleanup(tenant: string): Promise<CleanupResult> {
  const res = await api<CleanupResult>('/data-ops/cleanup', {
    method: 'POST',
    immediate: true,
    body: { tenant },
  })
  if (res?.ok) {
    await invalidateCollections(DATA_COLLECTIONS, tenant)
    localStorage.setItem(EPOCH_KEY, String(res.epoch ?? 0))
  }
  return res
}

export interface SeedResult {
  ok: boolean
  tenant?: string
  chart?: { groups: number; accounts: number }
  taxId?: number | null
  defaultsApplied?: string[]
  partyCount?: number
  draftCount?: number
  membershipTypes?: number
  membersCreated?: number
  seededYear?: number | null
  epoch?: number
  error?: string
}

/** Bootstrap demo/chart data for a tenant. chartOnly skips parties/items/vouchers. */
export async function runSeedDemo(tenant: string, chartOnly = false): Promise<SeedResult> {
  const res = await api<SeedResult>('/data-ops/seed-demo', {
    method: 'POST',
    immediate: true,
    body: { tenant, chartOnly },
  })
  if (res?.ok) {
    await invalidateCollections([...DATA_COLLECTIONS, ...SEED_COLLECTIONS], tenant)
    localStorage.setItem(EPOCH_KEY, String(res.epoch ?? 0))
  }
  return res
}

/** Selectively seed the chosen master collections for a tenant. */
export async function runSeedSelective(
  tenant: string,
  seeds: SeedKey[],
): Promise<SeedResult> {
  if (seeds.length === 0) {
    return { ok: false, error: 'Select at least one area to seed.' }
  }
  const res = await api<SeedResult>('/data-ops/seed-demo', {
    method: 'POST',
    immediate: true,
    body: { tenant, seeds },
  })
  if (res?.ok) {
    await invalidateCollections([...DATA_COLLECTIONS, ...SEED_COLLECTIONS, 'members', 'membership-types', 'fiscal-years'], tenant)
    localStorage.setItem(EPOCH_KEY, String(res.epoch ?? 0))
  }
  return res
}

/**
 * Cross-device invalidation: when `billing-settings.dataEpoch` bumps (someone
 * ran cleanup / seeded demo data elsewhere), drop locally cached transaction
 * lists so the next read re-pulls from the server. Harmless on every-day
 * settings saves — dataEpoch only moves on data operations.
 */
export function useDataEpochWatcher(): void {
  const { data: settings } = useCachedGlobals<BillingSettings>('/globals/billing-settings')
  const seen = useRef<string | null>(null)

  useEffect(() => {
    const server = Number(settings?.dataEpoch ?? 0)
    const localRaw = localStorage.getItem(EPOCH_KEY)
    const local = localRaw === null ? null : Number(localRaw)
    // First observed value just initialises the marker — never invalidate on
    // cold start (the cache is already current).
    if (seen.current === null) {
      seen.current = String(local ?? server)
      localStorage.setItem(EPOCH_KEY, String(local ?? server))
      return
    }
if (local !== null && server > local) {
      localStorage.setItem(EPOCH_KEY, String(server))
      // Clear both unscoped and current-tenant-scoped read caches so the next
      // render re-pulls the post-operation data from the server.
      const engine = getEngine() as unknown as { invalidate: (c: string, t?: string) => Promise<void>; _tenant?: string }
      const tenant = typeof engine._tenant === 'string' && engine._tenant ? engine._tenant : undefined
      void invalidateCollections(DATA_COLLECTIONS, tenant)
    }
    seen.current = String(server)
  }, [settings?.dataEpoch])
}