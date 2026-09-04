import { useEffect, useRef, useState } from 'react'
import { list, useSyncState } from './api'
import { useCachedGlobals } from './useCachedGlobals'
import { useFiscalYear } from './fiscalYear'
import { useTenantQuery } from './tenant'
import type { Account, BillingSettings, Document } from './types'

/**
 * M1 setup gate — readiness for posting vouchers.
 *
 * A tenant's books are "ready" when all four onboarding steps are done:
 *   1. company profile (name set — shown on invoices)
 *   2. a fiscal year exists / is active (drives voucher numbering)
 *   3. a chart of accounts exists (accounts to post into)
 *   4. the default accounts are mapped in billing settings (the posting
 *      engine resolves every leg through these, so posting without them
 *      fails cryptically)
 *
 * Dashboard shows a checklist until `complete`; the voucher forms disable
 * "Save & post" (drafts stay allowed) until it flips.
 *
 * Read-failure policy: the gate may only block when it KNOWS a step is
 * missing. A transient network error (first /api hit can race a dev-server
 * route compile) must never latch as "no chart of accounts" — counts are
 * retried with backoff and treated as unknown (non-blocking) while the read
 * has not succeeded, so a fresh-but-seeded tenant is never locked out by a
 * one-shot blip.
 */
export type SetupStepKey = 'company' | 'fiscalYear' | 'chart' | 'defaults'

export interface SetupStatus {
  /** True while setup data is still loading — the UI should not flash the
   *  gate, and unknown counts must not disable posting. */
  loading: boolean
  company: boolean
  fiscalYear: boolean
  chart: boolean
  defaults: boolean
  complete: boolean
  /** Number of steps still missing (0 when complete). */
  missingCount: number
  /** True when the books are already in use (any posted/draft voucher exists). */
  inUse: boolean
}

/** The default-account slots the posting engine needs to resolve legs. */
const CORE_DEFAULTS: (keyof BillingSettings)[] = [
  'receivableAccount',
  'payableAccount',
  'cashAccount',
  'bankAccount',
  'taxAccount',
  'inventoryAccount',
  'revenueAccount',
  'expenseAccount',
]

export const SETUP_STEPS: { key: SetupStepKey; label: string; to: string }[] = [
  { key: 'company', label: 'Add your company name', to: '/settings' },
  { key: 'fiscalYear', label: 'Create a fiscal year', to: '/settings' },
  { key: 'chart', label: 'Set up your chart of accounts', to: '/accounts' },
  { key: 'defaults', label: 'Map your default accounts', to: '/settings' },
]

/** Max count-read attempts before giving up (2s, 4s, 6s backoff). */
const MAX_READ_ATTEMPTS = 4

export function useSetupStatus(): SetupStatus {
  const {
    data: settings,
    loading: settingsLoading,
    failed: settingsFailed,
  } = useCachedGlobals<BillingSettings>('/globals/billing-settings')
  const { years } = useFiscalYear()
  const tenantQuery = useTenantQuery()
  const { cacheVersion } = useSyncState()
  // null = count still unknown (loading or every attempt failed).
  const [accountCount, setAccountCount] = useState<number | null>(null)
  const [docCount, setDocCount] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    let attempts = 0
    const load = () => {
      attempts++
      Promise.allSettled([
        list<Account>('gl-accounts', { depth: 0, limit: 1 }),
        list<Document>('documents', { depth: 0, limit: 1, ...tenantQuery }),
      ]).then(([accounts, documents]) => {
        if (!alive) return
        if (accounts.status === 'fulfilled') setAccountCount(accounts.value.totalDocs ?? 0)
        if (documents.status === 'fulfilled') setDocCount(documents.value.totalDocs ?? 0)
        // Retry transient failures (dev-server route compiles, dropped
        // first-hit requests) — never latch them as "empty chart".
        const anyFailed = accounts.status === 'rejected' || documents.status === 'rejected'
        const stillUnknown =
          (accounts.status === 'rejected' && accountCount === null) ||
          (documents.status === 'rejected' && docCount === null)
        if (anyFailed && attempts < MAX_READ_ATTEMPTS) {
          setTimeout(load, 2000 * attempts)
        }
      })
    }
    load()
    return () => {
      alive = false
    }
    // Refresh the counts when a background flush lands too — a newly created
    // account flips the chart step without needing a page reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantQuery.tenant, cacheVersion])

  // A failed settings read means "unknown", not "empty company / defaults".
  // Only a CONFIRMED missing step (or a confirmed empty chart) may block.
  const settingsKnown = settingsLoading === false && !settingsFailed
  const company =
    !settingsKnown ? null
      : Boolean(settings?.companyName && settings.companyName.trim().length > 0)
  const defaults = !settingsKnown
    ? null
    : CORE_DEFAULTS.every((k) => settings && settings[k] != null)
  const fiscalYear = (years?.length ?? 0) > 0 || Boolean(settings?.activeFiscalYear)
  // Unknown counts are not treated as missing — only a confirmed 0 blocks.
  const chart = accountCount === null ? null : accountCount > 0
  const inUse = (docCount ?? 0) > 0

  const flags: Record<SetupStepKey, boolean | null> = {
    company,
    fiscalYear,
    chart,
    defaults,
  }
  const missingCount = SETUP_STEPS.filter((s) => flags[s.key] === false).length
  // Books already in use: legacy tenant — nothing to gate. Fresh books only.
  // Unknown (null) inputs never count as missing, so a transient read blip
  // cannot lock the books.
  const complete = inUse || missingCount === 0
  // Loading until the settings and both counts have resolved (counts retry
  // with backoff on failure). While loading, forms must NOT disable posting
  // on data that is still unknown.
  const loading = settingsLoading || accountCount === null || docCount === null

  return {
    loading,
    company: company === true,
    fiscalYear,
    chart: chart === true,
    defaults: defaults === true,
    complete,
    missingCount,
    inUse,
  }
}
