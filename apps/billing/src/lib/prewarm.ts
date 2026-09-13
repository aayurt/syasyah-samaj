import { useEffect, useRef } from 'react'
import { api } from './api'
import { useTenantQuery } from './tenant'

/**
 * Pre-warm the offline masters cache (kanban t_1ba79f98).
 *
 * Goal: when a laptop/iPad is opened at a remote event with no network,
 * member autocomplete, account dropdowns, fiscal-year selection and org
 * settings must render with 0ms latency from the local IndexedDB /
 * localStorage caches.
 *
 * How it works: every entry below is a plain collection read issued through
 * the cache-first `api()`. On a cold cache the read falls through to the
 * network once, and api() then stores the FULL list in IndexedDB
 * (engine.warmCache + the `pulled:` flag), so every later read — including
 * offline ones — is served from cache instantly. On a warm cache the read is
 * a local no-op (0ms). Freshness afterwards is the existing background sync's
 * job (60s periodic / 5min pull via POST /api/sync).
 *
 * IMPORTANT: the query here must stay "cache-safe" (only tenant/sort/depth/
 * limit keys) and must mirror how consumers read the collection, because the
 * cache is keyed per tenant: e.g. account-groups are read WITHOUT a tenant
 * scope in Accounts.tsx, so they must be warmed the same way or the warmed
 * copy would live under a different key and never be served.
 */

interface MasterList {
  slug: string
  query: Record<string, string | number | undefined>
  /** true when consumers read this collection tenant-scoped. */
  tenantScoped: boolean
}

const MASTER_LISTS: MasterList[] = [
  // Member autocomplete (Members page + party pickers read these scoped).
  { slug: 'members', query: { limit: 1000, depth: 1, sort: 'name' }, tenantScoped: true },
  // Party dropdown in VoucherForm (members appear as parties).
  { slug: 'parties', query: { limit: 1000, depth: 1, sort: 'name' }, tenantScoped: true },
  // Chart of accounts — account dropdowns in vouchers/journal/ledgers.
  { slug: 'gl-accounts', query: { limit: 1000, depth: 1, sort: 'name' }, tenantScoped: true },
  // Account groups — read UNSCOPED by Accounts.tsx; warm the same key.
  { slug: 'account-groups', query: { limit: 500, depth: 0, sort: 'name' }, tenantScoped: false },
  // Active fiscal year — FiscalYearProvider reads scoped when a tenant is set.
  { slug: 'fiscal-years', query: { limit: 100, depth: 0, sort: '-startDate' }, tenantScoped: true },
  // Remaining dropdown masters on the voucher form so entry works fully
  // offline at an event (membership types feed the Members create form).
  { slug: 'membership-types', query: { limit: 100, depth: 0, sort: 'name' }, tenantScoped: true },
  { slug: 'items', query: { limit: 1000, depth: 1, sort: 'name' }, tenantScoped: true },
  { slug: 'tax-types', query: { limit: 500, depth: 0, sort: 'name' }, tenantScoped: true },
]

/**
 * Fetch-and-warm every master collection + org settings. Fire-and-forget:
 * failures (offline, 401 during login handoff) are ignored — the cache-first
 * reads retry naturally on the next mount / tenant switch.
 */
export function prewarmMasters(
  tenantQuery: Record<string, string | number | undefined> = {},
): void {
  // Org settings — seeds the localStorage globals cache used by
  // useCachedGlobals / useSetupStatus / fmt().
  void api('/globals/billing-settings', { query: { depth: 0 } }).catch(() => {})
  for (const { slug, query, tenantScoped } of MASTER_LISTS) {
    void api(`/${slug}`, {
      query: {
        ...query,
        ...(tenantScoped ? tenantQuery : {}),
      },
    }).catch(() => {})
  }
}

/**
 * Hook version: runs once per tenant on app mount (inside the shell, after
 * login and the tenant provider have resolved). Re-runs when the user
 * switches illaka so the newly scoped cache keys get warmed too.
 */
export function usePrewarmMasters(): void {
  const tenantQuery = useTenantQuery()
  const warmedFor = useRef<string | null>(null)

  useEffect(() => {
    const key = tenantQuery.tenant == null ? '' : String(tenantQuery.tenant)
    if (warmedFor.current === key) return
    warmedFor.current = key
    prewarmMasters(tenantQuery)
  }, [tenantQuery])
}
