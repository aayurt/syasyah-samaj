import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Circle,
  Database,
  Edit2,
  Hourglass,
  Layers,
  Loader2,
  Lock,
  Package,
  Plus,
  Save,
  Sparkles,
  Tag,
  Trash2,
  Unlock,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { api, list, getEngine } from '../lib/api'
import { useDataEpochWatcher, runSeedSelective } from '../lib/dataOps'
import type { SeedKey } from '../lib/dataOps'
import { useFiscalYear } from '../lib/fiscalYear'
import { useTenant, type TenantOption } from '../lib/tenant'
import { useT } from '../lib/i18n'
import { pushToast } from '../lib/toast'
import { adToBsString, bsToAdString } from '../lib/nepaliDate'
import type { Account, BillingSettings, Document } from '../lib/types'
import type { AIModel } from '../lib/ai/schemas'
import AIWorkspaceModal from '../components/AIWorkspaceModal'
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
  { key: 'seed-account-groups', title: 'Account Types & Groups', blurb: 'Asset, liability, equity, income, expense — the parent structure accounts belong to.', icon: Layers },
  { key: 'seed-accounts', title: 'Chart of Accounts', blurb: 'Starter chart — groups, accounts, and default-account mappings.', icon: Database },
  { key: 'seed-taxTypes', title: 'Tax Types', blurb: 'VAT @ 13% plus its sales/purchase ledger wiring.', icon: Tag },
  { key: 'defaults', title: 'Default Accounts', blurb: 'Map the default accounts the posting engine needs.', icon: Wallet },
]

const OPTIONAL_STEPS: StepDef[] = [
  { key: 'seed-parties', title: 'Parties', blurb: 'Sample customers and vendors (still editable).', icon: UserPlus },
  { key: 'seed-items', title: 'Items', blurb: 'Sample stock items with rates (still editable).', icon: Package },
  { key: 'seed-members', title: 'Members', blurb: 'Membership types plus sample members.', icon: Users },
  { key: 'openings', title: 'Opening Balances', blurb: 'Enter opening balances per account for the year.', icon: Hourglass, optional: true },
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
  const [searchParams, setSearchParams] = useSearchParams()
  const t = useT()
  const { tenantId, isIllaka, isCentral } = useTenant()
  const { years, loading: yearsLoading, refresh: refreshYears } = useFiscalYear()

  const [stepIdx, setStepIdx] = useState(0)
  const [settings, setSettings] = useState<BillingSettings | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [syncing, setSyncing] = useState(true)
  const [chartCount, setChartCount] = useState<number | null>(null)
  const [illakaCount, setIllakaCount] = useState<number | null>(null)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [itemCount, setItemCount] = useState<number | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  // Sub-company / ilaka management (central admin only)
  const [subCompanies, setSubCompanies] = useState<TenantOption[]>([])
  const [subCompanyForm, setSubCompanyForm] = useState<{ name: string; code: string; type: 'illaka'; active: boolean; slug: string }>({ name: '', code: '', type: 'illaka', active: true, slug: '' })
  const [editingSubCompany, setEditingSubCompany] = useState<TenantOption | null>(null)
  const [subCompanyBusy, setSubCompanyBusy] = useState('')
  const [subCompanyError, setSubCompanyError] = useState('')
  const [subCompanyModalOpen, setSubCompanyModalOpen] = useState(false)
  // AI Workspace import (Chart of Accounts / Opening Balances)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInitialModel, setAiInitialModel] = useState<AIModel | null>(null)

  // Company form
  const [company, setCompany] = useState({ companyName: '', companyPan: '', companyContact: '', companyEmail: '', companyAddress: '' })
  // Fiscal year form
  const [fy, setFy] = useState({ label: '', startDate: '2026-07-16', endDate: '2027-07-15' })
  const [fyCal, setFyCal] = useState<'AD' | 'BS'>('AD')
  const [fyBs, setFyBs] = useState({ start: '', end: '' })
  const [fyEditRow, setFyEditRow] = useState<string | null>(null)
  const [fyRowDraft, setFyRowDraft] = useState<{ label: string; startDate: string; endDate: string; status: string }>({
    label: '', startDate: '', endDate: '', status: 'active',
  })
  const toggleFyCal = () => {
    setFyCal((c) => {
      const next = c === 'AD' ? 'BS' : 'AD'
      if (next === 'BS') {
        setFyBs({
          start: fy.startDate ? adToBsString(fy.startDate) : '',
          end: fy.endDate ? adToBsString(fy.endDate) : '',
        })
      }
      return next
    })
  }
  // Default accounts form
  const [defaults, setDefaults] = useState<Record<string, string>>({})
  // Per-seed-step completion (each seed area is its own wizard step now)
  const [seedDone, setSeedDone] = useState<Record<string, boolean>>({})

  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const tenantQuery = useMemo(() => (tenantId ? { tenant: tenantId } : {}), [tenantId])

  const refreshFacts = useCallback(async () => {
    const [s, chartRes, docRes, illakaRes, memberRes, itemRes] = await Promise.all([
      api<BillingSettings>('/globals/billing-settings', { query: { depth: 1 } }).catch(() => null),
      list<Account>('gl-accounts', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null),
      list<Document>('documents', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null),
      list<TenantOption>('tenants', { depth: 0, limit: 100 }).catch(() => null),
      tenantId ? list<{ id: number }>('members', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null) : Promise.resolve(null),
      tenantId ? list<{ id: number }>('items', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null) : Promise.resolve(null),
    ])
    setSettings(s)
    setSettingsLoaded(true)
    setChartCount(chartRes?.totalDocs ?? 0)
    setIllakaCount(illakaRes?.totalDocs ?? 0)
    setMemberCount(memberRes?.totalDocs ?? 0)
    setItemCount(itemRes?.totalDocs ?? 0)
    setSubCompanies(illakaRes?.docs ?? [])
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

  // Reload facts on mount, sync data first, and refresh when tenant changes.
  useEffect(() => {
    let alive = true
    const init = async () => {
      setSyncing(true)
      try {
        const engine = getEngine()
        await engine.syncAll().catch(() => {})
      } catch {
        /* proceed with local facts if offline */
      }
      if (alive) {
        await refreshFacts()
        setSyncing(false)
      }
    }
    void init()
    return () => {
      alive = false
    }
  }, [refreshFacts, tenantId])

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

  // Deep-link a wizard step via ?step=<key>, e.g. /app/setup?step=fiscalYear.
  // Honored on mount so a shared URL opens straight at that step.
  useEffect(() => {
    const urlStep = searchParams.get('step')
    const idx = STEPS.findIndex((s) => s.key === urlStep)
    if (urlStep && idx !== -1 && idx !== stepIdx) setStepIdx(idx)
  }, [])

  // Keep the URL in sync with the current step so it is shareable / bookmarkable.
  useEffect(() => {
    const key = step.key
    if (searchParams.get('step') !== key) {
      setSearchParams({ step: key }, { replace: true })
    }
  }, [step.key])

  const satisfied: Record<string, boolean> = {
    company: Boolean(settings?.companyName && String(settings.companyName).trim()),
    fiscalYear: (years?.length ?? 0) > 0 || Boolean(settings?.activeFiscalYear),
    'seed-accounts': Boolean(seedDone['seed-accounts']),
    'seed-taxTypes': Boolean(seedDone['seed-taxTypes']),
    defaults: CORE_DEFAULTS.every((d) => settings && settings[d.key] != null),
    'seed-parties': Boolean(seedDone['seed-parties']),
    'seed-items': Boolean(seedDone['seed-items']),
    'seed-members': Boolean(seedDone['seed-members']),
    openings: true,
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

  const cancelEditSubCompany = () => {
    setEditingSubCompany(null)
    setSubCompanyForm({ name: '', code: '', type: 'illaka', active: true, slug: '' })
    setSubCompanyError('')
    setSubCompanyModalOpen(false)
  }

  const saveSubCompany = async () => {
    const { name, code, type, active, slug } = subCompanyForm
    if (!name || !code || !slug) {
      setSubCompanyError('Name, code and slug are required.')
      return
    }
    setSubCompanyBusy(editingSubCompany ? 'update' : 'create')
    setSubCompanyError('')
    try {
      if (editingSubCompany) {
        await api(`/tenants/${editingSubCompany.id}`, {
          method: 'PATCH',
          body: { name, code, type, active, slug },
          immediate: true,
        })
        pushToast('success', 'Sub-company updated')
      } else {
        await api('/tenants', {
          method: 'POST',
          body: { name, code, type, active, slug },
          immediate: true,
        })
        pushToast('success', 'Sub-company created')
      }
      await refreshFacts()
      cancelEditSubCompany()
    } catch (e) {
      setSubCompanyError(e instanceof Error ? e.message : 'Failed to save sub-company')
    } finally {
      setSubCompanyBusy('')
    }
  }

  const deleteSubCompany = async (id: string) => {
    if (!window.confirm('Delete this sub-company? This cannot be undone.')) return
    setSubCompanyBusy('delete')
    try {
      await api(`/tenants/${id}`, { method: 'DELETE', immediate: true })
      pushToast('success', 'Sub-company deleted')
      await refreshFacts()
      if (editingSubCompany?.id === id) cancelEditSubCompany()
    } catch (e) {
      setSubCompanyError(e instanceof Error ? e.message : 'Failed to delete sub-company')
    } finally {
      setSubCompanyBusy('')
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
      // Overlap check: new [start,end] must not intersect any existing period.
      const overlapsExisting = (years ?? []).some((y) => {
        return fy.startDate <= (y.endDate ?? '') && (y.startDate ?? '') <= fy.endDate
      })
      if (overlapsExisting) {
        pushToast('error', 'Date range overlaps', 'This fiscal year overlaps an existing period. Pick non-overlapping dates.')
        setBusy('')
        return
      }
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create fiscal year')
    } finally {
      setBusy('')
    }
  }

  const fySetActive = (id: string) => {
    api(`/fiscal-years/${id}`, { method: 'PATCH', body: { isActive: true } })
      .then(async () => {
        await api('/globals/billing-settings', { method: 'POST', body: { activeFiscalYear: Number(id) } }).catch(() => {})
        await refreshYears()
        pushToast('success', 'Working year set')
      })
      .catch((e) => pushToast('error', 'Failed to set working year', e instanceof Error ? e.message : String(e)))
  }

  const fyClose = (id: string) => {
    api(`/fiscal-years/${id}`, { method: 'PATCH', body: { status: 'closed' } })
      .then(() => { void refreshYears(); pushToast('success', 'Year closed') })
      .catch((e) => pushToast('error', 'Failed to close year', e instanceof Error ? e.message : String(e)))
  }

  const fyOpen = (id: string) => {
    api(`/fiscal-years/${id}`, { method: 'PATCH', body: { status: 'active' } })
      .then(() => { void refreshYears(); pushToast('success', 'Year opened') })
      .catch((e) => pushToast('error', 'Failed to open year', e instanceof Error ? e.message : String(e)))
  }

  const fyDelete = (id: string) => {
    if (!window.confirm('Delete this fiscal year? This cannot be undone.')) return
    api(`/fiscal-years/${id}`, { method: 'DELETE' })
      .then(() => { void refreshYears(); pushToast('success', 'Year deleted') })
      .catch((e) => pushToast('error', 'Failed to delete year', e instanceof Error ? e.message : String(e)))
  }

  const fyRowSave = async (id: string) => {
    const d = fyRowDraft
    if (!d.startDate || !d.endDate) {
      pushToast('error', 'Missing dates', 'Both start and end date are required.')
      return
    }
    const overlapsExisting = (years ?? []).some((y) => {
      if (String(y.id) === id) return false
      return d.startDate <= (y.endDate ?? '') && (y.startDate ?? '') <= d.endDate
    })
    if (overlapsExisting) {
      pushToast('error', 'Date range overlaps', 'This fiscal year overlaps an existing period.')
      return
    }
    api(`/fiscal-years/${id}`, { method: 'PATCH', body: { label: d.label || undefined, startDate: d.startDate, endDate: d.endDate, status: d.status } })
      .then(() => { setFyEditRow(null); void refreshYears(); pushToast('success', 'Year updated') })
      .catch((e) => pushToast('error', 'Failed to update year', e instanceof Error ? e.message : String(e)))
  }

  const runSeedStep = async (seedKey: SeedKey) => {
    if (!tenantId) {
      pushToast('error', 'Select an ilaka first', 'Pick the tenant to set up from the switcher.')
      return
    }
    setBusy(seedKey)
    setError('')
    try {
      const res = await runSeedSelective(tenantId, [seedKey])
      if (res.error) {
        setError(res.error)
        return
      }
      const parts: string[] = []
      if (res.groups) parts.push(`${res.groups} groups`)
      if (res.chart?.accounts) parts.push(`${res.chart.accounts} accounts`)
      if (res.taxId != null) parts.push('VAT')
      if (res.partyCount) parts.push(`${res.partyCount} parties`)
      if (res.membersCreated) parts.push(`${res.membersCreated} members`)
      if (res.seededYear != null) parts.push('a fiscal year')
      pushToast('success', 'Seeded', parts.join(', ') || 'Done')
      setSeedDone((prev) => ({ ...prev, [seedKey]: true }))
      await refreshFacts()
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to seed')
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

  if (syncing || !settingsLoaded || yearsLoading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-crimson-50 text-crimson-600 shadow-sm animate-pulse">
          <Database size={26} />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-800">
          Syncing & loading setup facts…
        </h2>
        <p className="mt-1 max-w-sm text-xs text-slate-400">
          Fetching the latest organization profile, fiscal periods, and chart of accounts from the server.
        </p>
        <div className="mt-5 flex items-center gap-2 text-xs font-medium text-slate-500">
          <Loader2 size={14} className="animate-spin text-crimson-600" />
          <span>Please wait a moment…</span>
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

      {/* Where you stand — current state tied to dashboard metrics */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Building2 size={18} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t('setup.illakaCount', 'Illaka count')}
            </div>
            <div className="font-mono text-lg font-bold text-slate-800">
              {illakaCount ?? '–'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
            <UserPlus size={18} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t('setup.members', 'Members')}
            </div>
            <div className="font-mono text-lg font-bold text-slate-800">
              {memberCount ?? '–'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <Package size={18} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t('setup.inventoryItems', 'Inventory items')}
            </div>
            <div className="font-mono text-lg font-bold text-slate-800">
              {itemCount ?? '–'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Wallet size={18} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t('setup.chartOfAccounts', 'Chart of accounts')}
            </div>
            <div className="font-mono text-lg font-bold text-slate-800">
              {chartCount ?? '–'}
            </div>
          </div>
        </div>
      </div>

      {/* Active step card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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

              {/* Sub-company / ilaka management (central admin only) */}
              {isCentral && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-700">
                      {t('setup.subCompanies', 'Sub-companies')} (ilakas)
                    </h3>
                    {!subCompanyModalOpen && (
                      <button
                        onClick={() => {
                          setSubCompanyForm({ name: '', code: '', type: 'illaka', active: true, slug: '' })
                          setEditingSubCompany(null)
                          setSubCompanyError('')
                          setSubCompanyModalOpen(true)
                        }}
                        className="inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800"
                      >
                        <Plus size={12} /> {t('setup.addSubCompany', 'Add sub-company')}
                      </button>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left pb-2 text-xs font-semibold text-slate-500">
                              {t('setup.subCompanyName', 'Name')}
                            </th>
                            <th className="text-left pb-2 text-xs font-semibold text-slate-500">
                              {t('setup.subCompanyCode', 'Code')}
                            </th>
                            <th className="text-left pb-2 text-xs font-semibold text-slate-500">
                              {t('setup.subCompanyActive', 'Active')}
                            </th>
                            <th className="text-right pb-2 text-xs font-semibold text-slate-500 w-24">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {subCompanies.map((tc) => (
                            <tr key={tc.id}>
                              <td className="py-3 text-slate-700 font-medium">{tc.name}</td>
                              <td className="py-3 text-slate-600">{tc.code || '–'}</td>
                              <td className="py-3 text-slate-600">
                                {tc.active ? 'Yes' : 'No'}
                              </td>
                              <td className="py-3 text-right">
                                <button
                                  onClick={() => {
                                    setSubCompanyForm({
                                      name: tc.name,
                                      code: tc.code,
                                      type: 'illaka',
                                      active: tc.active ?? true,
                                      slug: tc.slug || ''
                                    })
                                    setEditingSubCompany(tc)
                                    setSubCompanyError('')
                                    setSubCompanyModalOpen(true)
                                  }}
                                  className="mr-2 rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteSubCompany(tc.id)}
                                  disabled={subCompanyBusy === 'delete'}
                                  className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {subCompanies.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-4 text-center text-xs text-slate-400">
                                No sub-companies yet. {t('setup.addSubCompany', 'Add sub-company')} to get started.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Modal */}
                  {subCompanyModalOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                        onClick={cancelEditSubCompany}
                      />
                      <div
                        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-medium text-slate-700">
                            {editingSubCompany ? t('setup.subCompanyUpdated', 'Edit sub-company') : t('setup.addSubCompany', 'Add sub-company')}
                          </h3>
                          <button
                            onClick={cancelEditSubCompany}
                            className="rounded px-2 py-1 text-xs text-slate-500 hover:text-red-600"
                          >
                            <X size={13} />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-4">
                          <div className="sm:col-span-2">
                            <label className="text-xs font-medium text-slate-600">
                              {t('setup.subCompanyName', 'Name')} *
                            </label>
                            <input
                              autoFocus
                              value={subCompanyForm.name}
                              onChange={(e) => setSubCompanyForm({ ...subCompanyForm, name: e.target.value })}
                              className="mt-1 h-9 w-full rounded border border-slate-300 px-2.5 text-sm outline-none focus:border-slate-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600">
                              {t('setup.subCompanyCode', 'Code')} *
                            </label>
                            <input
                              value={subCompanyForm.code}
                              onChange={(e) => setSubCompanyForm({ ...subCompanyForm, code: e.target.value })}
                              placeholder="IL01"
                              className="mt-1 h-9 w-full rounded border border-slate-300 px-2.5 text-sm outline-none focus:border-slate-500"
                            />
                          </div>
                          <div className="flex items-end">
                            <label className="text-xs font-medium text-slate-600 mr-2">
                              {t('setup.subCompanyActive', 'Active')}
                            </label>
                            <input
                              type="checkbox"
                              checked={subCompanyForm.active}
                              onChange={(e) => setSubCompanyForm({ ...subCompanyForm, active: e.target.checked })}
                              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                            />
                          </div>
                          <div className="sm:col-span-4">
                            <label className="text-xs font-medium text-slate-600">
                              {t('setup.subCompanySlug', 'Slug')} *
                            </label>
                            <input
                              value={subCompanyForm.slug}
                              onChange={(e) => setSubCompanyForm({ ...subCompanyForm, slug: e.target.value })}
                              placeholder="ilaka-name"
                              className="mt-1 h-9 w-full rounded border border-slate-300 px-2.5 text-sm outline-none focus:border-slate-500"
                            />
                          </div>
                        </div>
                        <div className="mt-6 flex items-center gap-2">
                          <button
                            onClick={cancelEditSubCompany}
                            className="rounded px-3 py-2 text-xs font-medium text-slate-600 border border-slate-300 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveSubCompany}
                            disabled={subCompanyBusy !== ''}
                            className="inline-flex items-center gap-1 rounded bg-crimson-600 px-3 py-2 text-xs font-medium text-white hover:bg-crimson-700 disabled:opacity-60"
                          >
                            {subCompanyBusy === (editingSubCompany ? 'update' : 'create') ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : editingSubCompany ? (
                              <Edit2 size={13} />
                            ) : (
                              <Plus size={13} />
                            )}
                            {subCompanyBusy !== '' ? 'Saving…' : editingSubCompany ? t('setup.subCompanyUpdated', 'Update') : t('setup.addSubCompany', 'Create')}
                          </button>
                        </div>
                        {subCompanyError && (
                          <p className="mt-3 text-xs text-red-600">{subCompanyError}</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {step.key === 'fiscalYear' && (
            <>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Calendar</span>
                <button
                  onClick={toggleFyCal}
                  className={`rounded border border-slate-300 px-2.5 py-1 text-xs ${fyCal === 'AD' ? 'bg-slate-100' : ''}`}
                >
                  AD
                </button>
                <button
                  onClick={toggleFyCal}
                  className={`rounded border border-slate-300 px-2.5 py-1 text-xs ${fyCal === 'BS' ? 'bg-slate-100' : ''}`}
                >
                  BS
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Start date</label>
                  {fyCal === 'AD' ? (
                    <input
                      type="date"
                      value={fy.startDate}
                      onChange={(e) => setFy({ ...fy, startDate: e.target.value })}
                      className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                    />
                  ) : (
                    <input
                      type="text"
                      value={fyBs.start}
                      onChange={(e) => {
                        const v = e.target.value
                        setFyBs({ ...fyBs, start: v })
                        const ad = bsToAdString(v)
                        if (ad) setFy({ ...fy, startDate: ad })
                      }}
                      placeholder="YYYY-MM-DD"
                      className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                    />
                  )}
                  {fyCal === 'BS' && fyBs.start && !bsToAdString(fyBs.start) && (
                    <p className="mt-1 text-xs text-red-600">Invalid BS date</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">End date</label>
                  {fyCal === 'AD' ? (
                    <input
                      type="date"
                      value={fy.endDate}
                      onChange={(e) => setFy({ ...fy, endDate: e.target.value })}
                      className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                    />
                  ) : (
                    <input
                      type="text"
                      value={fyBs.end}
                      onChange={(e) => {
                        const v = e.target.value
                        setFyBs({ ...fyBs, end: v })
                        const ad = bsToAdString(v)
                        if (ad) setFy({ ...fy, endDate: ad })
                      }}
                      placeholder="YYYY-MM-DD"
                      className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                    />
                  )}
                  {fyCal === 'BS' && fyBs.end && !bsToAdString(fyBs.end) && (
                    <p className="mt-1 text-xs text-red-600">Invalid BS date</p>
                  )}
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
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Fiscal years</p>
                  <p className="text-xs text-slate-400">
                    Set the working year · Close/reopen · Edit inline · Delete
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void createFiscalYear()}
                  disabled={busy === 'fiscalYear' || !fy.startDate || !fy.endDate}
                  className="flex items-center gap-1.5 rounded-md bg-crimson-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-60"
                >
                  <Plus size={14} /> Add Year
                </button>
              </div>
              {(years?.length ?? 0) === 0 ? (
                <div className="rounded border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400">
                  No fiscal years defined. Add the first period above.
                </div>
              ) : (
                <div className="overflow-x-auto rounded border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Working</th>
                        <th className="px-3 py-2">Label</th>
                        <th className="px-3 py-2">Start</th>
                        <th className="px-3 py-2">End</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {years.map((y) => {
                        const isWorking = Boolean(y.isActive) || String(y.id) === String(settings?.activeFiscalYear)
                        const isClosed = y.status === 'closed'
                        return (
                          <tr key={y.id} className="border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2">
                              {isClosed ? (
                                <span className="h-5 w-5 rounded-full border border-slate-200 bg-slate-50 text-slate-300 flex items-center justify-center">
                                  <CheckCircle2 size={12} />
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => fySetActive(String(y.id))}
                                  title={isWorking ? 'Working year' : 'Set as working year'}
                                  className={`h-5 w-5 rounded-full border flex items-center justify-center ${isWorking ? 'border-crimson-600 bg-crimson-600 text-white' : 'border-slate-300 text-transparent hover:border-crimson-400'}`}
                                >
                                  <CheckCircle2 size={12} />
                                </button>
                              )}
                            </td>
                            {fyEditRow === String(y.id) ? (
                              <td className="px-3 py-2">
                                <input
                                  defaultValue={fyRowDraft.label || y.label || ''}
                                  className="w-full text-sm font-medium border border-slate-300 rounded px-1 py-0.5 focus:ring-2 focus:ring-crimson-500 outline-none"
                                  onChange={(e) => setFyRowDraft({ ...fyRowDraft, label: e.target.value })}
                                  autoFocus
                                />
                              </td>
                            ) : (
                              <td className="px-3 py-2 font-medium text-slate-800">{y.label || `FY ${y.startDate}`}</td>
                            )}
                            {fyEditRow === String(y.id) ? (
                              <td className="px-3 py-2">
                                <input
                                  type="date"
                                  defaultValue={String(y.startDate || '').slice(0, 10)}
                                  className="w-full text-xs text-slate-500 border border-slate-300 rounded px-1 py-0.5 focus:ring-2 focus:ring-crimson-500 outline-none"
                                  onChange={(e) => setFyRowDraft({ ...fyRowDraft, startDate: e.target.value })}
                                />
                              </td>
                            ) : (
                              <td className="px-3 py-2 font-mono text-xs text-slate-500">{String(y.startDate || '').slice(0, 10)}</td>
                            )}
                            {fyEditRow === String(y.id) ? (
                              <td className="px-3 py-2">
                                <input
                                  type="date"
                                  defaultValue={String(y.endDate || '').slice(0, 10)}
                                  className="w-full text-xs text-slate-500 border border-slate-300 rounded px-1 py-0.5 focus:ring-2 focus:ring-crimson-500 outline-none"
                                  onChange={(e) => setFyRowDraft({ ...fyRowDraft, endDate: e.target.value })}
                                />
                              </td>
                            ) : (
                              <td className="px-3 py-2 font-mono text-xs text-slate-500">{String(y.endDate || '').slice(0, 10)}</td>
                            )}
                            <td className="px-3 py-2">
                              {fyEditRow === String(y.id) ? (
                                <select
                                  defaultValue={y.status || 'active'}
                                  className="w-full text-xs border border-slate-300 rounded px-1 py-0.5 focus:ring-2 focus:ring-crimson-500 outline-none bg-white"
                                  onChange={(e) => setFyRowDraft({ ...fyRowDraft, status: e.target.value })}
                                >
                                  <option value="active">Active</option>
                                  <option value="closed">Closed</option>
                                </select>
                              ) : isClosed ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                                  <Lock size={10} /> Closed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                  <Unlock size={10} /> Active
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {fyEditRow === String(y.id) ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => fyRowSave(String(y.id))}
                                    title="Save"
                                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-crimson-600"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setFyEditRow(null)}
                                    title="Cancel"
                                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1">
                                  {isClosed ? (
                                    <button
                                      type="button"
                                      onClick={() => fyOpen(String(y.id))}
                                      title="Reopen year"
                                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-emerald-600"
                                    >
                                      <Unlock size={14} />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => fyClose(String(y.id))}
                                      title="Close year"
                                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-amber-600"
                                    >
                                      <Lock size={14} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFyRowDraft({ label: y.label || '', startDate: String(y.startDate || '').slice(0, 10), endDate: String(y.endDate || '').slice(0, 10), status: y.status || 'active' })
                                      setFyEditRow(String(y.id))
                                    }}
                                    title="Edit year"
                                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => fyDelete(String(y.id))}
                                    title="Delete year"
                                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 text-xs text-slate-400">
                Working year drives transaction numbering. Closed years reject new entries.
              </p>
            </div>
            </>
          )}

        {step.key === 'seed-account-groups' && (
          <SeedTable
            collection="account-groups"
            title="Account Types & Groups"
            subtitle="Parent groups — Asset, Liability, Equity, Income, Expense. Seed first, then accounts."
            seedKey="accountGroups"
            seedLabel="Seed types & groups"
            icon={<Layers size={18} className="text-slate-400" />}
            aiModel="account-groups"
            aiLabel="Import Account Types & Groups with AI"
            columns={[
              { key: 'code', label: 'Code', type: 'readonly' },
              { key: 'name', label: 'Group', type: 'text' },
              { key: 'type', label: 'Type', type: 'select', options: ['asset', 'liability', 'equity', 'income', 'expense'] },
              { key: 'description', label: 'Description', type: 'text' },
            ]}
            tenantId={tenantId}
            tenantQuery={tenantQuery}
            setSeedDone={setSeedDone}
            setAiOpen={setAiOpen}
            setAiInitialModel={setAiInitialModel}
          />
        )}
        {step.key === 'seed-accounts' && (
          <SeedTable
            collection="gl-accounts"
            title="Chart of Accounts"
            subtitle="Starter chart — seed then edit inline. Edits persist to the ledger."
            seedKey="accounts"
            seedLabel="Seed chart"
            icon={<Database size={18} className="text-slate-400" />}
            columns={[
              { key: 'code', label: 'Code', type: 'readonly' },
              { key: 'name', label: 'Account', type: 'text' },
              { key: 'type', label: 'Type', type: 'select', options: ['asset', 'liability', 'equity', 'income', 'expense'] },
              { key: 'active', label: 'Active', type: 'boolean' },
            ]}
            aiModel="gl-accounts"
            aiLabel="Import Chart of Accounts with AI"
            tenantId={tenantId}
            tenantQuery={tenantQuery}
            setSeedDone={setSeedDone}
            setAiOpen={setAiOpen}
            setAiInitialModel={setAiInitialModel}
          />
        )}
        {step.key === 'seed-taxTypes' && (
          <SeedTable
            collection="tax-types"
            title="Tax Types"
            subtitle="VAT @ 13% plus sales/purchase ledger wiring."
            seedKey="taxTypes"
            seedLabel="Seed tax types"
            icon={<Tag size={18} className="text-slate-400" />}
            columns={[
              { key: 'code', label: 'Code', type: 'readonly' },
              { key: 'name', label: 'Tax', type: 'text' },
              { key: 'rate', label: 'Rate %', type: 'number' },
              { key: 'active', label: 'Active', type: 'boolean' },
            ]}
            aiModel="tax-types"
            aiLabel="Import Tax Types with AI"
            tenantId={tenantId}
            tenantQuery={tenantQuery}
            setSeedDone={setSeedDone}
            setAiOpen={setAiOpen}
            setAiInitialModel={setAiInitialModel}
          />
        )}
        {step.key === 'seed-parties' && (
          <SeedTable
            collection="parties"
            title="Parties"
            subtitle="Customers and vendors — still editable after setup."
            seedKey="parties"
            seedLabel="Seed parties"
            icon={<UserPlus size={18} className="text-slate-400" />}
            aiModel="gl-accounts"
            aiLabel="Import Parties with AI"
            columns={[
              { key: 'name', label: 'Party', type: 'text' },
              { key: 'type', label: 'Type', type: 'select', options: ['customer', 'vendor', 'both'] },
              { key: 'email', label: 'Email', type: 'text' },
              { key: 'phone', label: 'Phone', type: 'text' },
            ]}
            tenantId={tenantId}
            tenantQuery={tenantQuery}
            setSeedDone={setSeedDone}
            setAiOpen={setAiOpen}
            setAiInitialModel={setAiInitialModel}
          />
        )}
        {step.key === 'seed-items' && (
          <SeedTable
            collection="items"
            title="Items"
            subtitle="Stock items with rates — still editable after setup."
            seedKey="items"
            seedLabel="Seed items"
            icon={<Package size={18} className="text-slate-400" />}
            aiModel="gl-accounts"
            aiLabel="Import Items with AI"
            columns={[
              { key: 'code', label: 'Code', type: 'readonly' },
              { key: 'name', label: 'Item', type: 'text' },
              { key: 'unit', label: 'Unit', type: 'text' },
              { key: 'salePrice', label: 'Sale Price', type: 'number' },
            ]}
            tenantId={tenantId}
            tenantQuery={tenantQuery}
            setSeedDone={setSeedDone}
            setAiOpen={setAiOpen}
            setAiInitialModel={setAiInitialModel}
          />
        )}
        {step.key === 'seed-members' && (
          <SeedTable
            collection="members"
            title="Members"
            subtitle="Membership types plus sample members."
            seedKey="members"
            seedLabel="Seed members"
            icon={<Users size={18} className="text-slate-400" />}
            aiModel="gl-accounts"
            aiLabel="Import Members with AI"
            columns={[
              { key: 'fullName', label: 'Member', type: 'text' },
              { key: 'email', label: 'Email', type: 'text' },
              { key: 'role', label: 'Role', type: 'text' },
              { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
            ]}
            tenantId={tenantId}
            tenantQuery={tenantQuery}
            setSeedDone={setSeedDone}
            setAiOpen={setAiOpen}
            setAiInitialModel={setAiInitialModel}
          />
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
              <button
                onClick={() => {
                  setAiInitialModel('opening-balances')
                  setAiOpen(true)
                }}
                className="mt-3 rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Sparkles size={14} /> {t('ai.importOpenings', 'Import Opening Balances with AI')}
              </button>
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
            {step.key.startsWith('seed-') && (
              <button
                onClick={() => {
                  if (!seedDone[step.key]) {
                    setSeedDone((p) => ({ ...p, [step.key]: true }))
                  }
                  setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
                }}
                className="inline-flex items-center gap-1 rounded px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                {seedDone[step.key] ? t('setup.next', 'Next') : 'Skip'} <ArrowRight size={15} />
              </button>
            )}
            {step.key === 'openings' && (
              <button
                onClick={finish}
                className="rounded px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Skip for now
              </button>
            )}

            {step.key === 'company' && (
              <button
                onClick={() => {
                  setAiInitialModel('company-profile')
                  setAiOpen(true)
                }}
                className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Sparkles size={14} /> {t('ai.importCompanyProfile', 'Import Company Profile with AI')}
              </button>
            )}
            {step.key === 'company' && isCentral && (
              <button
                onClick={() => {
                  setAiInitialModel('sub-companies')
                  setAiOpen(true)
                }}
                className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 ml-2"
              >
                <Sparkles size={14} /> {t('ai.importSubCompanies', 'Import Sub-companies with AI')}
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
                onClick={() => {
                  setAiInitialModel('fiscal-year')
                  setAiOpen(true)
                }}
                className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Sparkles size={14} /> {t('ai.importFiscalYear', 'Import Fiscal Year with AI')}
              </button>
            )}
            {/* Seed steps: single Skip/Next button above handles both cases */}
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

      <AIWorkspaceModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        initialModel={aiInitialModel ?? undefined}
        onImported={() => {
          setAiOpen(false)
          setAiInitialModel(null)
          void refreshFacts()
        }}
      />
    </div>
  )
}

/** Reusable table for each seed step: list + inline edit + delete + seed + AI import. */
type SeedCol = {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean' | 'readonly'
  options?: string[]
}

type SeedTableProps = {
  collection: string
  title: string
  subtitle: string
  seedKey: SeedKey
  seedLabel: string
  icon: any
  columns: SeedCol[]
  aiModel?: AIModel
  aiLabel?: string
  tenantId: string | undefined
  tenantQuery: { tenant?: string | number }
  setSeedDone: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void
  setAiOpen: (v: boolean) => void
  setAiInitialModel: (v: AIModel | null) => void
}

function SeedTable({
  collection, title, subtitle, seedKey, seedLabel, icon, columns, aiModel, aiLabel,
  tenantId, tenantQuery, setSeedDone, setAiOpen, setAiInitialModel,
}: SeedTableProps) {
  const [records, setRecords] = useState<any[]>([])
  const [editRow, setEditRow] = useState<string | null>(null)
  const [rowDraft, setRowDraft] = useState<Record<string, any>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    void loadRecords()
  }, [])

  const loadRecords = async () => {
    const res = await api<{ docs: any[] }>(`/${collection}`, {
      query: { limit: 1000, depth: 0, ...tenantQuery },
    })
    setRecords(res.docs ?? [])
  }

  const startEdit = (row: any) => {
    const draft: Record<string, any> = {}
    for (const col of columns) {
      if (col.type !== 'readonly') draft[col.key] = row[col.key] ?? ''
    }
    setRowDraft(draft)
    setEditRow(String(row.id))
  }

  const saveRow = async (id: string) => {
    setBusyId(id)
    try {
      const body: Record<string, any> = {}
      for (const col of columns) {
        if (col.type !== 'readonly') body[col.key] = rowDraft[col.key]
      }
      await api(`/${collection}/${id}`, { method: 'PATCH', body })
      setEditRow(null)
      setBusyId(null)
      void loadRecords()
      pushToast('success', `${title} updated`)
    } catch (e) {
      setBusyId(null)
      pushToast('error', `Failed to update ${title}`, e instanceof Error ? e.message : String(e))
    }
  }

  const deleteRow = async (id: string) => {
    if (!window.confirm(`Delete this ${title}?`)) return
    setBusyId(id)
    try {
      await api(`/${collection}/${id}`, { method: 'DELETE' })
      setBusyId(null)
      void loadRecords()
      pushToast('success', `${title} deleted`)
    } catch (e) {
      setBusyId(null)
      pushToast('error', `Failed to delete ${title}`, e instanceof Error ? e.message : String(e))
    }
  }

  const doSeed = async () => {
    if (!tenantId) {
      pushToast('error', 'Select an ilaka first', 'Pick the tenant to set up from the switcher.')
      return
    }
    setBusyId('seed')
    try {
      const res = await runSeedSelective(tenantId, [seedKey])
      if (res.error) {
        pushToast('error', 'Seed failed', res.error)
        return
      }
      setSeedDone((prev) => ({ ...prev, [seedKey]: true }))
      void loadRecords()
      pushToast('success', 'Seeded', 'Records added. Edit or delete any row inline.')
    } catch (e) {
      pushToast('error', 'Failed to seed', e instanceof Error ? e.message : 'Seed failed')
    } finally {
      setBusyId(null)
    }
  }

  const empty = (records.length ?? 0) === 0

  const renderTable = () => (
    <div className="overflow-x-auto rounded border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2">{c.label}</th>
            ))}
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-0">
              {columns.map((c) => {
                const editing = editRow === String(row.id)
                if (editing && c.type !== 'readonly') {
                  let input: any
                  if (c.type === 'select') {
                    input = (
                      <select
                        defaultValue={String(row[c.key] ?? '')}
                        className="w-full text-xs border border-slate-300 rounded px-1 py-0.5 focus:ring-2 focus:ring-crimson-500 outline-none bg-white"
                        onChange={(e) => setRowDraft({ ...rowDraft, [c.key]: e.target.value })}
                      >
                        {c.options!.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    )
                  } else if (c.type === 'boolean') {
                    input = (
                      <input
                        type="checkbox"
                        defaultChecked={Boolean(row[c.key])}
                        className="rounded focus:ring-crimson-500"
                        onChange={(e) => setRowDraft({ ...rowDraft, [c.key]: e.target.checked })}
                      />
                    )
                  } else {
                    input = (
                      <input
                        defaultValue={String(row[c.key] ?? '')}
                        className="w-full text-sm border border-slate-300 rounded px-1 py-0.5 focus:ring-2 focus:ring-crimson-500 outline-none"
                        onChange={(e) => setRowDraft({ ...rowDraft, [c.key]: e.target.value })}
                      />
                    )
                  }
                  return <td key={c.key} className="px-3 py-2">{input}</td>
                }
                if (c.type === 'boolean') {
                  return (
                    <td key={c.key} className="px-3 py-2">
                      {Boolean(row[c.key]) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <Unlock size={10} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                          <Lock size={10} /> Inactive
                        </span>
                      )}
                    </td>
                  )
                }
                return <td key={c.key} className="px-3 py-2 text-slate-700">{row[c.key] ?? '—'}</td>
              })}
              <td className="px-3 py-2">
                {editRow === String(row.id) ? (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => saveRow(String(row.id))}
                      title="Save"
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-crimson-600"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditRow(null)}
                      title="Cancel"
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      title="Edit"
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRow(String(row.id))}
                      disabled={busyId === String(row.id) || busyId === 'seed'}
                      title="Delete"
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Current Data section */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Current Data</p>
        {empty ? (
          <div className="rounded border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400">
            No records yet. Seed the {title.toLowerCase()} below.
          </div>
        ) : (
          renderTable()
        )}
      </div>

      {/* Seed Data section — always available */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Seed Data</p>
        <div className="flex items-center justify-between mb-1">
          <button
            onClick={() => { setAiInitialModel(aiModel ?? 'gl-accounts'); setAiOpen(true) }}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Sparkles size={14} /> {aiLabel ?? 'Import with AI'}
          </button>
          <button
            onClick={doSeed}
            disabled={busyId === 'seed'}
            className="inline-flex items-center gap-2 rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-60"
          >
            {busyId === 'seed' ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />}
            {seedLabel}
          </button>
        </div>
      </div>
    </div>
  )
}