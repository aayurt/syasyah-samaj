import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { api } from '../lib/api'
import { DATA_COLLECTIONS, runCleanup, runSeedDemo } from '../lib/dataOps'
import { useTenant } from '../lib/tenant'
import { useT } from '../lib/i18n'
import { pushToast } from '../lib/toast'
import type { BillingSettings } from '../lib/types'

/**
 * Data Management — bulk operations that shape a tenant's books.
 *
 *  · Cleanup: wipe transaction-level data (vouchers, journal entries, opening
 *    balances…) while keeping masters (ilakas, accounts, parties, items…).
 *  · Demo data: bootstrap a starter chart + sample masters + draft vouchers.
 *
 * Both hit the server synchronously (bypassing the offline outbox) and are
 * recorded in the audit log. Demo seeding is gated by billing-settings
 * `demoSeedEnabled` (global switch in Settings → Feature Toggles).
 */

const CLEANUP_LABELS: Record<string, string> = {
  documents: 'Vouchers (transactions)',
  'journal-entries': 'Journal entries',
  'stock-movements': 'Stock movements',
  'bank-statements': 'Bank statements',
  'expense-claims': 'Expense claims',
  'recurring-schedules': 'Recurring billing',
  'opening-balances': 'Opening balances',
  'fixed-assets': 'Fixed assets',
}

const KEPT = [
  'Ilakas / Tenants',
  'Accounts & groups',
  'Parties',
  'Items',
  'Members & membership types',
  'Tax types',
  'Fiscal years',
  'Users & roles',
  'Settings & audit log',
]

const TYPED_CONFIRMATION = 'DELETE ALL TRANSACTIONS'

export default function DataManagement() {
  const navigate = useNavigate()
  const t = useT()
  const { tenantId, isCentral } = useTenant()

  const [settings, setSettings] = useState<BillingSettings | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  const [confirmText, setConfirmText] = useState('')
  const [cleaning, setCleaning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{ counts: Record<string, number>; failures: Record<string, number>; epoch?: number } | null>(null)

  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState<{ chart?: { groups: number; accounts: number }; partyCount?: number; draftCount?: number } | null>(null)

  useEffect(() => {
    api<BillingSettings>('/globals/billing-settings', { query: { depth: 0 } })
      .then((s) => { setSettings(s); setSettingsLoaded(true) })
      .catch(() => { setSettingsLoaded(true) })
  }, [])

  const demoEnabled = settingsLoaded && settings?.demoSeedEnabled !== false
  const confirmOk = confirmText.trim() === TYPED_CONFIRMATION

  const doCleanup = async () => {
    if (!tenantId) {
      pushToast('error', 'Select an ilaka first', 'Pick the tenant from the header switcher.')
      return
    }
    if (!confirmOk) return
    setCleaning(true)
    setCleanupResult(null)
    try {
      const res = await runCleanup(tenantId)
      if (res.error) {
        pushToast('error', 'Cleanup failed', res.error)
      } else {
        setCleanupResult({ counts: res.counts || {}, failures: res.failures || {}, epoch: res.epoch })
        pushToast('success', 'Data cleaned', `${Object.values(res.counts || {}).reduce((a, b) => a + b, 0)} rows removed`)
        setConfirmText('')
      }
    } catch (e) {
      pushToast('error', 'Cleanup failed', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setCleaning(false)
    }
  }

  const doSeed = async () => {
    if (!tenantId) {
      pushToast('error', 'Select an ilaka first', 'Pick the tenant from the header switcher.')
      return
    }
    setSeeding(true)
    setSeedResult(null)
    try {
      const res = await runSeedDemo(tenantId, false)
      if (res.error) {
        pushToast('error', 'Demo data failed', res.error)
      } else {
        setSeedResult({ chart: res.chart, partyCount: res.partyCount, draftCount: res.draftCount })
        pushToast('success', 'Demo data added', `${res.partyCount ?? 0} parties, ${res.draftCount ?? 0} draft vouchers`)
      }
    } catch (e) {
      pushToast('error', 'Demo data failed', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSeeding(false)
    }
  }

  const totalRemoved = cleanupResult
    ? Object.values(cleanupResult.counts).reduce((a, b) => a + b, 0)
    : 0

  return (
    <div className="mx-auto max-w-3xl py-4">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
          <Database size={20} className="text-slate-400" />
          {t('dataManagement.title', 'Data Management')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Destroy or bootstrap a tenant's transactional data. Masters (ilakas, accounts, parties,
          items, tax types, years) are never touched.
        </p>
      </div>

      {/* ── Cleanup ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-50 p-3 text-red-600">
            <Trash2 size={20} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-800">{t('dataManagement.title', 'Cleanup data')}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Delete every voucher and ledger row for the selected tenant. Posted and voided
              documents are final (posting rules) and stay as history — void them in the Posting
              queue first if you need them gone.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Removes</p>
            <ul className="mt-2 space-y-1">
              {DATA_COLLECTIONS.map((c) => (
                <li key={c} className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  {CLEANUP_LABELS[c] || c}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500">Keeps</p>
            <ul className="mt-2 space-y-1">
              {KEPT.map((k) => (
                <li key={k} className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                  {k}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {!tenantId && (
          <div className="mt-4 flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle size={15} />
            {isCentral
              ? 'Select the tenant to clean up from the header switcher.'
              : 'Your tenant is auto-selected. Use the header switcher if you can reach another.'}
          </div>
        )}

        <div className="mt-5 rounded-lg border border-red-100 bg-red-50/50 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-red-700">
            <AlertTriangle size={15} />
            Type <span className="font-mono font-semibold">{TYPED_CONFIRMATION}</span> to confirm
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={TYPED_CONFIRMATION}
              className="h-10 flex-1 rounded border border-slate-300 px-3 font-mono text-sm outline-none focus:border-red-400"
            />
            <button
              onClick={() => void doCleanup()}
              disabled={!tenantId || !confirmOk || cleaning}
              className="inline-flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {cleaning ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              {cleaning ? t('msg.saving', 'Cleaning…') : t('dataManagement.title', 'Cleanup data')}
            </button>
          </div>
        </div>

        {cleanupResult && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-medium text-slate-700">
              Removed {totalRemoved} row(s) · voucher counters reset to 0
            </p>
            <div className="mt-2 grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {DATA_COLLECTIONS.map((c) => {
                const n = cleanupResult.counts[c] ?? 0
                const f = cleanupResult.failures[c] ?? 0
                if (n === 0 && f === 0) return null
                return (
                  <div key={c} className="flex justify-between text-xs text-slate-500">
                    <span>{CLEANUP_LABELS[c] || c}</span>
                    <span>{n} deleted{f > 0 ? `, ${f} kept` : ''}</span>
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Voucher numbering picks up again after the highest remaining number.
            </p>
          </div>
        )}
      </section>

      {/* ── Demo seed ───────────────────────────────────────────── */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-crimson-50 p-3 text-crimson-600">
            <Sparkles size={20} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-800">{t('dataManagement.seedDemo', 'Demo data')}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Bootstrap a starter chart of accounts, default mappings, a 13% VAT, sample parties
              and items, and 5 draft vouchers that land in the Posting queue — great for trying
              the app before your real data. Masters are created only when missing.
            </p>
          </div>
        </div>

        {!demoEnabled ? (
          <div className="mt-4 flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle size={15} />
            Demo data is disabled in Settings → Feature Toggles → "Demo seed". Enable it to run the
            seeder.
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => void doSeed()}
              disabled={!tenantId || seeding}
              className="inline-flex items-center gap-2 rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
            >
              {seeding ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {seeding ? t('msg.saving', 'Seeding…') : t('dataManagement.seedDemo', 'Add demo data')}
            </button>
            {!tenantId && (
              <span className="text-xs text-slate-400">
                Select a tenant from the header switcher first.
              </span>
            )}
          </div>
        )}

        {seedResult && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p>
              Chart: {seedResult.chart?.groups ?? 0} groups, {seedResult.chart?.accounts ?? 0} accounts ·
              {seedResult.partyCount ?? 0} parties · {seedResult.draftCount ?? 0} draft vouchers.
            </p>
            <button
              onClick={() => navigate('/posting')}
              className="mt-2 font-medium text-crimson-600 hover:underline"
            >
              Review drafts in the Posting queue →
            </button>
          </div>
        )}
      </section>
    </div>
  )
}