import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Circle,
  Database,
  Hourglass,
  Loader2,
  PartyPopper,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { api, list } from '../lib/api'
import { useDataEpochWatcher, runSeedDemo, runSeedSelective, SEED_KEYS } from '../lib/dataOps'
import type { SeedKey } from '../lib/dataOps'
import { useFiscalYear } from '../lib/fiscalYear'
import { useTenant } from '../lib/tenant'
import { useT } from '../lib/i18n'
import { pushToast } from '../lib/toast'
import { adToBsString } from '../lib/nepaliDate'
import type { Account, BillingSettings, Document } from '../lib/types'
import AccountSelect from '../components/AccountSelect'

/**
 * Onboarding wizard for fresh (or freshly-cleaned) books.
 *
 * Walks a tenant through the four required M1 setup steps — company profile,
 * a fiscal year, a chart of accounts and default account mappings — with the
 * optional extras (opening balances, demo data) offered at the end. It drives
 * the same billing-settings / fiscal-years state the setup gate (`useSetupStatus`)
 * checks, so the run always reflects the wizard's progress.
 */

interface StepDef {
  key: string
  title: string
  blurb: string
  icon: typeof Building2
  optional?: boolean
}

const REQUIRED_STEPS: StepDef[] = [
  { key: 'company', title: 'Company Profile', blurb: 'Enter the org name and contact details shown on invoices.', icon: Building2 },
  { key: 'fiscalYear', title: 'Fiscal Year', blurb: 'Define the accounting period that drives voucher numbering.', icon: CalendarDays },
  { key: 'seeds', title: 'Seed Master Data', blurb: 'Choose which master records to pre-fill — you can skip all and enter them later.', icon: Database },
  { key: 'defaults', title: 'Default Accounts', blurb: 'Map the default accounts the posting engine needs.', icon: Wallet },
]

const OPTIONAL_STEPS: StepDef[] = [
  { key: 'openings', title: 'Opening Balances', blurb: 'Enter opening balances per account for the year.', icon: Hourglass, optional: true },
  { key: 'demo', title: 'Demo Data', blurb: 'Add sample parties, items and draft vouchers for testing.', icon: PartyPopper, optional: true },
]

const STEPS = [...REQUIRED_STEPS, ...OPTIONAL_STEPS]

const CORE_DEFAULTS: { key: keyof BillingSettings; label: string }[] = [
  { key: 'receivableAccount', label: 'Accounts Receivable' },
  { key: 'payableAccount', label: 'Accounts Payable' },
  { key: 'cashAccount', label: 'Cash' },
  { key: 'bankAccount', label: 'Bank' },
  { key: 'taxAccount', label: 'Tax (VAT)' },
  { key: 'inventoryAccount', label: 'Inventory' },
  { key: 'revenueAccount', label: 'Revenue' },
  { key: 'expenseAccount', label: 'Expenses' },
]

export default function SetupWizard() {
  useDataEpochWatcher()
  const navigate = useNavigate()
  const t = useT()
  const { tenantId, isIllaka } = useTenant()
  const { years, refresh: refreshYears } = useFiscalYear()

  const [stepIdx, setStepIdx] = useState(0)
  const [settings, setSettings] = useState<BillingSettings | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [chartCount, setChartCount] = useState<number | null>(null)
  const [docCount, setDocCount] = useState<number | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])

  // Company form
  const [company, setCompany] = useState({ companyName: '', companyPan: '', companyContact: '', companyEmail: '', companyAddress: '' })
  // Fiscal year form
  const [fy, setFy] = useState({ label: '', startDate: '2026-07-16', endDate: '2027-07-15' })
  // Default accounts form
  const [defaults, setDefaults] = useState<Record<string, string>>({})
  // Selective seeding
  const [seedSelection, setSeedSelection] = useState<Record<SeedKey, boolean>>({
    accounts: true,
    taxTypes: true,
    parties: true,
    items: true,
    members: true,
    fiscalYears: true,
  })
  const [seedingDone, setSeedingDone] = useState(false)

  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const tenantQuery = useMemo(() => (tenantId ? { tenant: tenantId } : {}), [tenantId])

  const refreshFacts = useCallback(async () => {
    const [s, chartRes, docRes] = await Promise.all([
      api<BillingSettings>('/globals/billing-settings', { query: { depth: 1 } }).catch(() => null),
      list<Account>('gl-accounts', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null),
      list<Document>('documents', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null),
    ])
    setSettings(s)
    setSettingsLoaded(true)
    setChartCount(chartRes?.totalDocs ?? 0)
    setDocCount(docRes?.totalDocs ?? 0)
    if (s) {
      setCompany({
        companyName: s.companyName || '',
        companyPan: s.companyPan || '',
        companyContact: s.companyContact || '',
        companyEmail: s.companyEmail || '',
        companyAddress: s.companyAddress || '',
      })
      const da: Record<string, string> = {}
      for (const d of CORE_DEFAULTS) {
        const v = s[d.key]
        da[d.key] = v && typeof v === 'object' ? String((v as { id: number }).id) : v ? String(v) : ''
      }
      setDefaults(da)
    }
  }, [tenantQuery])

  // Reload facts on mount and when the tenant changes.
  useEffect(() => { void refreshFacts() }, [refreshFacts])

  // Load accounts for the default-account step.
  useEffect(() => {
    if (tenantId) {
      void api<{ docs: Account[] }>('/gl-accounts', { query: { depth: 0, sort: 'name', limit: 500, ...tenantQuery } })
        .then((r) => setAccounts(r.docs || []))
        .catch(() => {})
    } else {
      setAccounts([])
    }
  }, [tenantId, tenantQuery])

  const step = STEPS[stepIdx]
  const isRequired = stepIdx < REQUIRED_STEPS.length

  const satisfied: Record<string, boolean> = {
    company: Boolean(settings?.companyName && String(settings.companyName).trim()),
    fiscalYear: (years?.length ?? 0) > 0 || Boolean(settings?.activeFiscalYear),
    seeds: seedingDone || (chartCount ?? 0) > 0,
    defaults: CORE_DEFAULTS.every((d) => settings && settings[d.key] != null),
    openings: true,
    demo: (docCount ?? 0) > 0,
  }

  const canNext = !busy && (isRequired ? satisfied[step.key] : true)

  const bumpGlobals = () => {
    window.dispatchEvent(new Event('billing-settings-changed'))
    void refreshFacts()
  }

  const saveCompany = async () => {
    setBusy('company')
    setError('')
    try {
      await api('/globals/billing-settings', { method: 'POST', body: { ...company } })
      bumpGlobals()
      pushToast('success', 'Company profile saved')
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save company profile')
    } finally {
      setBusy('')
    }
  }

  const createFiscalYear = async () => {
    if (!fy.startDate || !fy.endDate) {
      pushToast('error', 'Missing dates', 'Pick a start and end date for the fiscal year.')
      return
    }
    setBusy('fiscalYear')
    setError('')
    try {
      let label = fy.label.trim()
      if (!label && fy.startDate) {
        const bs = adToBsString(fy.startDate)
        const bsYear = Number(bs.slice(0, 4)) || 0
        if (bsYear) label = `${bsYear}-${String((bsYear + 1) % 100).padStart(2, '0')}`
      }
      const body: Record<string, unknown> = {
        label: label || undefined,
        startDate: fy.startDate,
        endDate: fy.endDate,
        status: 'active',
        isActive: true,
      }
      if (tenantId) body.tenant = Number(tenantId)
      await api('/fiscal-years', { method: 'POST', body })
      // Point billing-settings at the new working year.
      if (tenantId) {
        const res = await api<{ docs: { id: number }[] }>('/fiscal-years', {
          query: { limit: 1, depth: 0, sort: '-startDate', ...tenantQuery },
        })
        const created = res.docs?.[0]
        if (created) {
          await api('/globals/billing-settings', { method: 'POST', body: { activeFiscalYear: created.id } }).catch(() => {})
        }
      }
      await refreshYears()
      bumpGlobals()
      pushToast('success', 'Fiscal year created', label || fy.startDate)
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create fiscal year')
    } finally {
      setBusy('')
    }
  }

  const runSelectiveSeed = async () => {
    if (!tenantId) {
      pushToast('error', 'Select an ilaka first', 'Pick the tenant to set up from the switcher.')
      return
    }
    const chosen = SEED_KEYS.filter((s) => seedSelection[s.key]).map((s) => s.key)
    if (chosen.length === 0) {
      pushToast('error', 'Nothing selected', 'Tick at least one area to seed, or skip this step.')
      return
    }
    setBusy('seeds')
    setError('')
    try {
      const res = await runSeedSelective(tenantId, chosen)
      if (res.error) {
        setError(res.error)
        return
      }
      const parts: string[] = []
      if (res.chart?.accounts) parts.push(`${res.chart.accounts} accounts`)
      if (res.taxId != null) parts.push('VAT')
      if (res.partyCount) parts.push(`${res.partyCount} parties`)
      if (res.membersCreated) parts.push(`${res.membersCreated} members`)
      if (res.seededYear != null) parts.push('a fiscal year')
      pushToast('success', 'Master data seeded', parts.join(', ') || 'Done')
      setSeedingDone(true)
      await refreshFacts()
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to seed master data')
    } finally {
      setBusy('')
    }
  }

  const saveDefaults = async () => {
    setBusy('defaults')
    setError('')
    try {
      const body: Record<string, unknown> = {}
      for (const d of CORE_DEFAULTS) {
        body[d.key] = defaults[d.key] ? Number(defaults[d.key]) : null
      }
      await api('/globals/billing-settings', { method: 'POST', body })
      bumpGlobals()
      pushToast('success', 'Default accounts mapped')
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save default accounts')
    } finally {
      setBusy('')
    }
  }

  const seedDemo = async () => {
    if (!tenantId) {
      pushToast('error', 'Select an ilaka first', 'Pick the tenant from the switcher.')
      return
    }
    setBusy('demo')
    setError('')
    try {
      const res = await runSeedDemo(tenantId, false)
      if (res.error) {
        setError(res.error)
        return
      }
      pushToast('success', 'Demo data added', `${res.partyCount ?? 0} parties, ${res.draftCount ?? 0} draft vouchers`)
      await refreshFacts()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to seed demo data')
    } finally {
      setBusy('')
    }
  }

  const finish = () => navigate('/', { replace: true })

  if (!isIllaka && !tenantId) {
    // Consolidated mode — no concrete tenant to set up.
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-medium">Select an ilaka (tenant) to set up</p>
          <p className="mt-1 text-amber-700">
            You are in consolidated mode. Use the tenant switcher in the header to pick the tenant
            you want to onboard, then this wizard will set that tenant up.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl py-6">
      {/* Progress: numbered rail */}
      <div className="mb-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-800">{t('setup.title', 'Get the books ready')}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Complete the required steps below before you start posting.
          </p>
        </div>
        <div className="mt-6 flex items-center justify-center gap-2">
          {REQUIRED_STEPS.map((s, i) => {
            const done = satisfied[s.key]
            const active = i === stepIdx
            return (
              <button
                key={s.key}
                onClick={() => !busy && setStepIdx(i)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'border-crimson-500 bg-crimson-50 text-crimson-700'
                    : done
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                <span className="hidden sm:inline">{s.title}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Active step card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-crimson-50 p-3 text-crimson-600">
            <step.icon size={22} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-400">
              {step.optional ? 'Optional' : `Step ${stepIdx + 1} of ${REQUIRED_STEPS.length}`}
            </div>
            <h2 className="text-lg font-semibold text-slate-800">{step.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{step.blurb}</p>
          </div>
          {satisfied[step.key] && stepIdx < REQUIRED_STEPS.length && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CheckCircle2 size={13} /> done
            </span>
          )}
        </div>

        <div className="mt-6">
          {step.key === 'company' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600">Organization name *</label>
                  <input
                    value={company.companyName}
                    onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                    placeholder="e.g. Syasyah Sahakari"
                    className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">PAN</label>
                  <input
                    value={company.companyPan}
                    onChange={(e) => setCompany({ ...company, companyPan: e.target.value })}
                    placeholder="e.g. 612345678"
                    className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Contact</label>
                  <input
                    value={company.companyContact}
                    onChange={(e) => setCompany({ ...company, companyContact: e.target.value })}
                    placeholder="Phone number"
                    className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Email</label>
                  <input
                    type="email"
                    value={company.companyEmail}
                    onChange={(e) => setCompany({ ...company, companyEmail: e.target.value })}
                    placeholder="org@example.com"
                    className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Address</label>
                  <input
                    value={company.companyAddress}
                    onChange={(e) => setCompany({ ...company, companyAddress: e.target.value })}
                    placeholder="Registered address"
                    className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  />
                </div>
              </div>
            </div>
          )}

          {step.key === 'fiscalYear' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Start date</label>
                  <input
                    type="date"
                    value={fy.startDate}
                    onChange={(e) => setFy({ ...fy, startDate: e.target.value })}
                    className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">End date</label>
                  <input
                    type="date"
                    value={fy.endDate}
                    onChange={(e) => setFy({ ...fy, endDate: e.target.value })}
                    className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Label (optional)</label>
                  <input
                    value={fy.label}
                    onChange={(e) => setFy({ ...fy, label: e.target.value })}
                    placeholder="e.g. 2083-84"
                    className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Label is auto-generated from the start date (BS year) when left blank. The new year
                becomes the active working year.
              </p>
            </div>
          )}

          {step.key === 'seeds' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Database size={18} className="text-slate-400" />
                  <div>
                    <p className="font-medium">Selectively pre-fill master data</p>
                    <p className="text-xs text-slate-400">
                      Tick the areas you want seeded for this tenant, then confirm. Anything you
                      skip stays manual and you can enter it later. All seeding is idempotent and
                      never overwrites existing records.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {SEED_KEYS.map((s) => (
                  <label
                    key={s.key}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={seedSelection[s.key]}
                      onChange={(e) =>
                        setSeedSelection((prev) => ({ ...prev, [s.key]: e.target.checked }))
                      }
                      disabled={busy === 'seeds'}
                      className="mt-0.5 h-4 w-4 accent-crimson-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{s.label}</p>
                      <p className="text-xs text-slate-400">{s.blurb}</p>
                    </div>
                  </label>
                ))}
              </div>
              {(chartCount ?? 0) > 0 && (
                <p className="text-xs text-amber-600">
                  You already have a chart of accounts — seeding is skipped for anything already
                  present.
                </p>
              )}
            </div>
          )}

          {step.key === 'defaults' && (
            <div className="space-y-3">
              {CORE_DEFAULTS.map((d) => (
                <div key={d.key} className="flex items-center justify-between gap-4">
                  <label className="w-48 shrink-0 text-sm text-slate-600">{d.label}</label>
                  <div className="flex-1">
                    <AccountSelect
                      accounts={accounts}
                      value={defaults[d.key] || ''}
                      onChange={(id) => setDefaults({ ...defaults, [d.key]: id })}
                    />
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-400">
                The posting engine resolves every voucher leg through these accounts.
              </p>
            </div>
          )}

          {step.key === 'openings' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-600">
                Enter opening balances per account for the working year (cash, bank, receivables,
                payables…) on the <span className="font-medium">Opening Balances</span> page.
              </p>
              <button
                onClick={() => navigate('/opening-balances')}
                className="mt-4 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Open Opening Balances
              </button>
            </div>
          )}

          {step.key === 'demo' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <Sparkles size={18} className="mt-0.5 shrink-0 text-crimson-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Add demo data</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Adds sample parties, items and 5 draft vouchers so you can try posting, journal
                      reports and the daybook before real entries. Your existing data is untouched.
                    </p>
                    {settings?.demoSeedEnabled === false && (
                      <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                        Demo data is disabled — enable it in Settings → Feature Toggles.
                      </p>
                    )}
                    {(docCount ?? 0) > 0 && (
                      <p className="mt-2 text-xs text-amber-600">
                        You already have {docCount} document(s) — the seeder only runs if you want
                        the extras.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {settings?.demoSeedEnabled !== false && (
                <button
                  disabled={busy === 'demo'}
                  onClick={() => void seedDemo()}
                  className="inline-flex items-center gap-2 rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-60"
                >
                  {busy === 'demo' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {busy === 'demo' ? 'Seeding…' : 'Add demo data'}
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Footer: primary action per step + nav */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            disabled={busy !== '' || stepIdx === 0}
            onClick={() => setStepIdx((i) => Math.max(i - 1, 0))}
            className="inline-flex items-center gap-1 rounded px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-40"
          >
            <ArrowLeft size={15} /> {t('setup.back', 'Back')}
          </button>

          <div className="flex items-center gap-2">
            {/* Optional steps: offer Skip and the primary action */}
            {step.key === 'openings' && (
              <button
                onClick={finish}
                className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Skip for now
              </button>
            )}
            {step.key === 'demo' && (
              <button
                onClick={finish}
                className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Skip for now
              </button>
            )}

            {step.key === 'company' && (
              <button
                onClick={() => void saveCompany()}
                disabled={busy === 'company' || !settingsLoaded}
                className="inline-flex items-center gap-2 rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-60"
              >
                {busy === 'company' ? <Loader2 size={15} className="animate-spin" /> : null}
                Save & continue
              </button>
            )}
            {step.key === 'fiscalYear' && (
              <button
                onClick={() => void createFiscalYear()}
                disabled={busy === 'fiscalYear' || !fy.startDate || !fy.endDate || (years?.length ?? 0) > 0 || Boolean(settings?.activeFiscalYear)}
                className="inline-flex items-center gap-2 rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-60"
              >
                {busy === 'fiscalYear' ? <Loader2 size={15} className="animate-spin" /> : null}
                Create fiscal year
              </button>
            )}
            {step.key === 'seeds' && (
              <button
                onClick={() => setSeedingDone(true)}
                disabled={busy === 'seeds'}
                className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Skip for now
              </button>
            )}
            {step.key === 'seeds' && (
              <button
                onClick={() => void runSelectiveSeed()}
                disabled={busy === 'seeds'}
                className="inline-flex items-center gap-2 rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-60"
              >
                {busy === 'seeds' ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />}
                {busy === 'seeds' ? 'Seeding…' : 'Seed selected'}
              </button>
            )}
            {step.key === 'defaults' && (
              <button
                onClick={() => void saveDefaults()}
                disabled={busy === 'defaults'}
                className="inline-flex items-center gap-2 rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-60"
              >
                {busy === 'defaults' ? <Loader2 size={15} className="animate-spin" /> : null}
                Save & continue
              </button>
            )}

            {/* When the required step is already done, allow moving on. */}
            {isRequired && satisfied[step.key] && !busy && (
              <button
                onClick={() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))}
                className="inline-flex items-center gap-1 rounded px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                {t('setup.next', 'Next')} <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Final call-to-action when everything required is done */}
      {REQUIRED_STEPS.every((s) => satisfied[s.key]) && (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 size={22} className="text-emerald-600" />
          <p className="text-sm font-medium text-emerald-800">
            Your books are ready — the required setup is complete.
          </p>
          <button
            onClick={finish}
            className="mt-2 rounded bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            {t('setup.finish', 'Start using Billing')}
          </button>
        </div>
      )}
    </div>
  )
}