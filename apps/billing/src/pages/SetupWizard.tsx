import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Database,
  Edit2,
  GitBranch,
  Hourglass,
  Layers,
  Loader2,
  Lock,
  Package,
  Plus,
  Save,
  Square,
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
import { useTenant, getParentCompanies, getSubCompaniesForParent, isParentCompany, type TenantOption } from '../lib/tenant'
import { useT } from '../lib/i18n'
import { pushToast } from '../lib/toast'
import { adToBsString, bsToAdString } from '../lib/nepaliDate'
import type { Account, BillingSettings, Document } from '../lib/types'
import type { AIModel } from '../lib/ai/schemas'
import AIWorkspaceModal from '../components/AIWorkspaceModal'

/**
 * Onboarding wizard for fresh (or freshly-cleaned) books.
 *
 * Walks a tenant through the four required M1 setup steps — company profile,
 * a fiscal year, a chart of accounts — with the
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

]

const OPTIONAL_STEPS: StepDef[] = [
  { key: 'seed-parties', title: 'Parties', blurb: 'Sample customers and vendors (still editable).', icon: UserPlus },
  { key: 'seed-items', title: 'Items', blurb: 'Sample stock items with rates (still editable).', icon: Package },
  { key: 'seed-members', title: 'Members', blurb: 'Membership types plus sample members.', icon: Users },
  { key: 'openings', title: 'Opening Balances', blurb: 'Enter opening balances per account for the year.', icon: Hourglass, optional: true },
]

const STEPS = [...REQUIRED_STEPS, ...OPTIONAL_STEPS]



export default function SetupWizard() {
  useDataEpochWatcher()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const t = useT()
  const { tenantId, setTenantId, tenants, isIllaka, isCentral } = useTenant()
  const { years, loading: yearsLoading, refresh: refreshYears } = useFiscalYear()

  const [stepIdx, setStepIdx] = useState(0)
  const [settings, setSettings] = useState<BillingSettings | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [syncing, setSyncing] = useState(true)
  const [chartCount, setChartCount] = useState<number | null>(null)
  const [illakaCount, setIllakaCount] = useState<number | null>(null)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [itemCount, setItemCount] = useState<number | null>(null)
  const [accountGroupsCount, setAccountGroupsCount] = useState<number | null>(null)
  const [taxTypesCount, setTaxTypesCount] = useState<number | null>(null)
  const [partiesCount, setPartiesCount] = useState<number | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  // Sub-company / ilaka management (central admin only)
  const [subCompanies, setSubCompanies] = useState<TenantOption[]>([])
  const [selectedSubCompanies, setSelectedSubCompanies] = useState<Set<string>>(new Set())
  const [subCompanyForm, setSubCompanyForm] = useState<{
    name: string
    code: string
    type: 'illaka'
    active: boolean
    slug: string
    pan: string
  }>({ name: '', code: '', type: 'illaka', active: true, slug: '', pan: '' })
  const [editingSubCompany, setEditingSubCompany] = useState<TenantOption | null>(null)
  const [subCompanyBusy, setSubCompanyBusy] = useState('')
  const [subCompanyError, setSubCompanyError] = useState('')
  const [subCompanyModalOpen, setSubCompanyModalOpen] = useState(false)

  // Company Creator state
  const [showCompanyCreator, setShowCompanyCreator] = useState(false)
  const [editingCompany, setEditingCompany] = useState<TenantOption | null>(null)
  const [newCompany, setNewCompany] = useState({
    name: '',
    code: '',
    pan: '',
    contact: '',
    email: '',
    address: '',
  })
  const [creatingCompany, setCreatingCompany] = useState(false)
  const [companyCreatorError, setCompanyCreatorError] = useState('')

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

  // Per-seed-step completion (each seed area is its own wizard step now)
  const [seedDone, setSeedDone] = useState<Record<string, boolean>>({})

  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const tenantQuery = useMemo(() => (tenantId ? { tenant: tenantId } : {}), [tenantId])

  // Fiscal years belong to the parent company. When a sub-company (illaka)
  // is selected, FY create/read/update targets the parent's periods.
  const currentTenant = useMemo(() => tenants.find((t) => String(t.id) === String(tenantId)) || null, [tenants, tenantId])
  const fyTenantId = useMemo(() => {
    if (!currentTenant) return tenantId
    if (isParentCompany(currentTenant)) return tenantId
    return currentTenant.parentId || tenantId
  }, [currentTenant, tenantId])
  const fyTenantQuery = useMemo(() => (fyTenantId ? { tenant: fyTenantId } : {}), [fyTenantId])

  const refreshFacts = useCallback(async () => {
    const [s, chartRes, docRes, illakaRes, memberRes, itemRes, agRes, ttRes, ptRes] = await Promise.all([
      api<BillingSettings>('/globals/billing-settings', { query: { depth: 1 } }).catch(() => null),
      list<Account>('gl-accounts', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null),
      list<Document>('documents', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null),
      list<TenantOption>('tenants', { depth: 0, limit: 100 }).catch(() => null),
      tenantId ? list<{ id: number }>('members', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null) : Promise.resolve(null),
      tenantId ? list<{ id: number }>('items', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null) : Promise.resolve(null),
      tenantId ? list<{ id: number }>('account-groups', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null) : Promise.resolve(null),
      tenantId ? list<{ id: number }>('tax-types', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null) : Promise.resolve(null),
      tenantId ? list<{ id: number }>('parties', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null) : Promise.resolve(null),
    ])
    setSettings(s)
    setSettingsLoaded(true)
    setChartCount(chartRes?.totalDocs ?? 0)
    setIllakaCount(illakaRes?.totalDocs ?? 0)
    setMemberCount(memberRes?.totalDocs ?? 0)
    setItemCount(itemRes?.totalDocs ?? 0)
    setAccountGroupsCount(agRes?.totalDocs ?? 0)
    setTaxTypesCount(ttRes?.totalDocs ?? 0)
    setPartiesCount(ptRes?.totalDocs ?? 0)
    const rawTenants: any[] = illakaRes?.docs ?? []
    const mapped = rawTenants.map((t) => {
      const parentId = t.parent
        ? typeof t.parent === 'object'
          ? String(t.parent.id)
          : String(t.parent)
        : t.parentId
          ? String(t.parentId)
          : null
      return {
        id: String(t.id),
        code: t.code || '',
        name: t.name || t.slug || '',
        type: (t.type || 'illaka') as 'central' | 'illaka',
        active: t.active,
        slug: t.slug,
        pan: t.pan || '',
        parent: t.parent || null,
        parentId,
      }
    })
    setSubCompanies(mapped)
    if (s) {
      setCompany({
        companyName: s.companyName || '',
        companyPan: s.companyPan || '',
        companyContact: s.companyContact || '',
        companyEmail: s.companyEmail || '',
        companyAddress: s.companyAddress || '',
      })

    }
  }, [tenantQuery])

  const parentCompanies = useMemo(() => {
    const source = subCompanies.length > 0 ? subCompanies : tenants
    return getParentCompanies(source)
  }, [subCompanies, tenants])

  const activeTenant = useMemo(() => {
    return (
      subCompanies.find((t) => String(t.id) === String(tenantId)) ||
      tenants.find((t) => String(t.id) === String(tenantId)) ||
      null
    )
  }, [subCompanies, tenants, tenantId])

  const parentOfActiveTenant = useMemo(() => {
    if (!activeTenant || isParentCompany(activeTenant)) return null
    const source = subCompanies.length > 0 ? subCompanies : tenants
    return source.find((t) => String(t.id) === String(activeTenant.parentId)) || null
  }, [activeTenant, subCompanies, tenants])

  const currentCompanySubCompanies = useMemo(() => {
    if (!tenantId) return []
    const source = subCompanies.length > 0 ? subCompanies : tenants
    return getSubCompaniesForParent(tenantId, source)
  }, [subCompanies, tenants, tenantId])

  // Sync company profile with selected tenant
  useEffect(() => {
    if (activeTenant) {
      setCompany((prev) => ({
        ...prev,
        companyName: activeTenant.name || prev.companyName,
        companyPan: activeTenant.pan || prev.companyPan,
      }))
    }
  }, [activeTenant])

  // Reload facts on mount, sync data first, and refresh when tenant changes.
  useEffect(() => {
    let alive = true
    const init = async () => {
      setSyncing(true)
      try {
        const engine = getEngine()
        await engine.syncAll().catch(() => { })
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
        .catch(() => { })
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
    company: Boolean(
      activeTenant
        ? (company.companyName || activeTenant.name)?.trim()
        : settings?.companyName && String(settings.companyName).trim()
    ),
    fiscalYear: (years?.length ?? 0) > 0 || Boolean(settings?.activeFiscalYear),
    'seed-account-groups': Boolean(seedDone['seed-account-groups']) || (accountGroupsCount ?? 0) > 0,
    'seed-accounts': Boolean(seedDone['seed-accounts']) || (chartCount ?? 0) > 0,
    'seed-taxTypes': Boolean(seedDone['seed-taxTypes']) || (taxTypesCount ?? 0) > 0,

    'seed-parties': Boolean(seedDone['seed-parties']) || (partiesCount ?? 0) > 0,
    'seed-items': Boolean(seedDone['seed-items']) || (itemCount ?? 0) > 0,
    'seed-members': Boolean(seedDone['seed-members']) || (memberCount ?? 0) > 0,
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
      if (activeTenant && !isParentCompany(activeTenant)) {
        // Sub-company: update the tenant record directly
        await api(`/tenants/${tenantId}`, {
          method: 'PATCH',
          body: {
            name: company.companyName,
            pan: company.companyPan || undefined,
            contactInfo: {
              phone: company.companyContact || undefined,
              email: company.companyEmail || undefined,
            },
            location: {
              address: company.companyAddress || undefined,
            },
          },
          immediate: true,
        })
      } else {
        // Parent company: update billing-settings and tenant record
        await api('/globals/billing-settings', { method: 'POST', body: { ...company } })
        if (tenantId) {
          await api(`/tenants/${tenantId}`, {
            method: 'PATCH',
            body: {
              name: company.companyName,
              pan: company.companyPan || undefined,
              contactInfo: {
                phone: company.companyContact || undefined,
                email: company.companyEmail || undefined,
              },
              location: {
                address: company.companyAddress || undefined,
              },
            },
            immediate: true,
          }).catch(() => {})
        }
      }
      bumpGlobals()
      pushToast('success', 'Company profile saved')
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save company profile')
    } finally {
      setBusy('')
    }
  }

  const handleCreateParentCompany = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const name = newCompany.name.trim()
    const code = newCompany.code.trim().toUpperCase()
    if (!name || !code) {
      setCompanyCreatorError('Company name and short code are required.')
      return
    }
    setCreatingCompany(true)
    setCompanyCreatorError('')
    try {
      const slug =
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || code.toLowerCase()

      const payloadBody: any = {
        name,
        code,
        slug,
        type: 'central',
        pan: newCompany.pan.trim() || undefined,
        contactInfo: {
          phone: newCompany.contact.trim() || undefined,
          email: newCompany.email.trim() || undefined,
        },
        location: {
          address: newCompany.address.trim() || undefined,
        },
        active: true,
      }

      if (editingCompany) {
        await api(`/tenants/${editingCompany.id}`, {
          method: 'PATCH',
          body: payloadBody,
          immediate: true,
        })
        pushToast('success', `Company "${name}" updated successfully`)
      } else {
        const res = await api<{ doc: any }>('/tenants', {
          method: 'POST',
          body: payloadBody,
          immediate: true,
        })
        const createdId = res?.doc?.id ? String(res.doc.id) : ''
        if (createdId) {
          setTenantId(createdId)
        }
        pushToast('success', `Company "${name}" created successfully`)
      }

      // Also ensure globals/billing-settings are populated and multiCompanyEnabled is true
      await api('/globals/billing-settings', {
        method: 'POST',
        body: {
          companyName: name,
          companyPan: newCompany.pan.trim() || undefined,
          companyContact: newCompany.contact.trim() || undefined,
          companyEmail: newCompany.email.trim() || undefined,
          companyAddress: newCompany.address.trim() || undefined,
          multiCompanyEnabled: true,
        },
      }).catch(() => {})

      setNewCompany({ name: '', code: '', pan: '', contact: '', email: '', address: '' })
      setEditingCompany(null)
      setShowCompanyCreator(false)
      await refreshFacts()
      bumpGlobals()
    } catch (err) {
      setCompanyCreatorError(err instanceof Error ? err.message : 'Failed to save company')
    } finally {
      setCreatingCompany(false)
    }
  }

  const deleteParentCompany = async (parentId: string, parentName: string) => {
    if (!window.confirm(`Delete company "${parentName}" and all its sub-companies? This cannot be undone.`)) return
    try {
      const source = subCompanies.length > 0 ? subCompanies : tenants
      const children = getSubCompaniesForParent(parentId, source)
      for (const child of children) {
        await api(`/tenants/${child.id}`, { method: 'DELETE', immediate: true }).catch(() => {})
      }
      await api(`/tenants/${parentId}`, { method: 'DELETE', immediate: true })
      if (String(tenantId) === String(parentId)) {
        setTenantId('')
      }
      await refreshFacts()
      bumpGlobals()
      pushToast('success', `Deleted company "${parentName}"`)
    } catch (e) {
      pushToast('error', 'Failed to delete company', e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const cancelEditSubCompany = () => {
    setEditingSubCompany(null)
    setSubCompanyForm({ name: '', code: '', type: 'illaka', active: true, slug: '', pan: '' })
    setSubCompanyError('')
    setSubCompanyModalOpen(false)
  }

  const saveSubCompany = async () => {
    const { name, code, type, active, slug, pan } = subCompanyForm
    if (!name || !code || !slug) {
      setSubCompanyError('Name, code and slug are required.')
      return
    }
    setSubCompanyBusy(editingSubCompany ? 'update' : 'create')
    setSubCompanyError('')
    try {
      const payloadBody: any = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type: 'illaka',
        active,
        slug: slug.trim(),
        pan: pan?.trim() || undefined,
        parent: Number(tenantId),
      }
      if (editingSubCompany) {
        await api(`/tenants/${editingSubCompany.id}`, {
          method: 'PATCH',
          body: payloadBody,
          immediate: true,
        })
        pushToast('success', 'Sub-company updated')
      } else {
        await api('/tenants', {
          method: 'POST',
          body: payloadBody,
          immediate: true,
        })
        pushToast('success', 'Sub-company created')
      }
      await refreshFacts()
      bumpGlobals()
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
      await refreshFacts()
      if (editingSubCompany?.id === id) cancelEditSubCompany()
      pushToast('success', 'Sub-company deleted')
    } catch (e) {
      setSubCompanyError(e instanceof Error ? e.message : 'Failed to delete sub-company')
    } finally {
      setSubCompanyBusy('')
    }
  }

  const toggleSubCompany = (id: string, checked: boolean) => {
    setSelectedSubCompanies((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleSelectAllSubCompanies = (checked: boolean, ids: string[]) => {
    const next = new Set(selectedSubCompanies)
    if (checked) ids.forEach((id) => next.add(id))
    else ids.forEach((id) => next.delete(id))
    setSelectedSubCompanies(next)
  }

  const clearSelectionSubCompanies = () => setSelectedSubCompanies(new Set())

  const deleteSelectedSubCompanies = async () => {
    const ids = Array.from(selectedSubCompanies)
    if (ids.length === 0) return
    if (!window.confirm(`Delete ${ids.length} sub-companies?`)) return
    setSubCompanyBusy('delete')
    let failed = 0
    for (const id of ids) {
      try {
        await api(`/tenants/${id}`, { method: 'DELETE' })
      } catch {
        failed += 1
      }
    }
    setSubCompanyBusy('')
    clearSelectionSubCompanies()
    await refreshFacts()
    if (failed === 0) pushToast('success', `Deleted ${ids.length} sub-companies`)
    else pushToast('warning', `Deleted ${ids.length - failed} of ${ids.length} sub-companies`, `${failed} failed`)
  }

  const createFiscalYear = async () => {
    if (!fy.startDate || !fy.endDate) {
      pushToast('error', 'Missing dates', 'Pick a start and end date for the fiscal year.')
      return
    }
    setBusy('fiscalYear')
    setError('')
    try {
      // You may not start a new period while a year is still the working year.
      // Close the active year first. 'open' years may coexist.
      const activeYear = (years ?? []).some((y) => y.status === 'active')
      if (activeYear) {
        pushToast('error', 'Close the working year first', 'Close the current active fiscal year before creating a new one.')
        setBusy('')
        return
      }
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
      const isFirstYear = (years ?? []).length === 0
      const body: Record<string, unknown> = {
        label: label || undefined,
        startDate: fy.startDate,
        endDate: fy.endDate,
        // First year becomes the working year; later years default to 'open'.
        status: isFirstYear ? 'active' : 'open',
        isActive: isFirstYear,
      }
      if (fyTenantId) body.tenant = Number(fyTenantId)
      await api('/fiscal-years', { method: 'POST', body })
      // Point billing-settings at the new working year.
      if (fyTenantId) {
        const res = await api<{ docs: { id: number }[] }>('/fiscal-years', {
          query: { limit: 1, depth: 0, sort: '-startDate', ...fyTenantQuery },
        })
        const created = res.docs?.[0]
        if (created) {
          await api('/globals/billing-settings', { method: 'POST', body: { activeFiscalYear: created.id } }).catch(() => { })
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
    api(`/fiscal-years/${id}`, { method: 'PATCH', body: { isActive: true, status: 'active' } })
      .then(async () => {
        await api('/globals/billing-settings', { method: 'POST', body: { activeFiscalYear: Number(id) } }).catch(() => { })
        await refreshYears()
        pushToast('success', 'Working year set')
      })
      .catch((e) => pushToast('error', 'Failed to set working year', e instanceof Error ? e.message : String(e)))
  }

  const fyClose = async (id: string) => {
    const year = (years ?? []).find((y) => String(y.id) === id)
    if (!year) return
    if (
      !window.confirm(
        `Close fiscal year “${year.label || id}”? Posting in this period will be locked and balance-sheet balances will carry forward to the next year as opening balances (income/expense are zeroed out).`,
      )
    )
      return
    try {
      await api(`/fiscal-years/${id}/close`, { method: 'POST', skipToast: true })
      await refreshYears()
      pushToast('success', 'Year closed', 'Posting in this period is now locked.')
    } catch (e) {
      pushToast('error', 'Failed to close year', e instanceof Error ? e.message : String(e))
    }
  }

  const fyOpen = (id: string) => {
    api(`/fiscal-years/${id}`, { method: 'PATCH', body: { status: 'active' } })
      .then(() => { void refreshYears(); pushToast('success', 'Year opened') })
      .catch((e) => pushToast('error', 'Failed to open year', e instanceof Error ? e.message : String(e)))
  }

  const fyDelete = async (id: string) => {
    if (!window.confirm('Delete this fiscal year? This cannot be undone.')) return
    try {
      await api(`/fiscal-years/${id}`, { method: 'DELETE' })
      await refreshYears()
      pushToast('success', 'Year deleted')
    } catch (e) {
      pushToast('error', 'Failed to delete year', e instanceof Error ? e.message : String(e))
    }
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
    // Fiscal years belong to the parent company — seed them under the parent's tenant.
    const seedTenant = seedKey === 'fiscalYears' ? fyTenantId : tenantId
    if (!seedTenant) {
      pushToast('error', 'Select a parent company first', 'Pick the parent tenant before seeding fiscal years.')
      return
    }
    setBusy(seedKey)
    setError('')
    try {
      const res = await runSeedSelective(seedTenant, [seedKey])
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





  const finish = () => navigate('/', { replace: true })

  if (syncing && !settingsLoaded && tenants.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-20 text-center">
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

  if (!isIllaka && !tenantId) {
    if (parentCompanies.length === 0 || showCompanyCreator) {
      return (
        <div className="w-full max-w-2xl mx-auto py-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-crimson-50 text-crimson-600 shadow-2xs">
                <Building2 size={24} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">
                    {editingCompany
                      ? `Edit Parent Company: ${editingCompany.name}`
                      : parentCompanies.length === 0
                        ? 'Create Your Organization / Parent Company'
                        : 'Add New Parent Company'}
                  </h2>
                  {(parentCompanies.length > 0 || editingCompany) && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCompanyCreator(false)
                        setEditingCompany(null)
                        setCompanyCreatorError('')
                      }}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {editingCompany
                    ? `Update company name, registration code, and contact information for ${editingCompany.name}.`
                    : parentCompanies.length === 0
                      ? 'Start by creating your primary company profile (e.g. Syasyah Samaj, ABC Company). Once registered, you will configure its fiscal year, chart of accounts, and manage sub-companies / branches.'
                      : 'Register a new top-level organization. Once created, you can switch between companies and manage sub-companies for each.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateParentCompany} className="mt-6 space-y-4">
              {companyCreatorError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
                  {companyCreatorError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Company Name <span className="text-crimson-600 font-bold ml-0.5">*</span>
                  </label>
                  <input
                    autoFocus
                    value={newCompany.name}
                    onChange={(e) => {
                      const name = e.target.value
                      setNewCompany((prev) => ({
                        ...prev,
                        name,
                        code: prev.code || name.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, ''),
                      }))
                    }}
                    placeholder="e.g. ABC Company or Syasyah Samaj"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Company Code <span className="text-crimson-600 font-bold ml-0.5">*</span>
                  </label>
                  <input
                    value={newCompany.code}
                    onChange={(e) => setNewCompany({ ...newCompany, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. ABC or SYASYA"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500 uppercase"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    PAN / Tax ID
                  </label>
                  <input
                    value={newCompany.pan}
                    onChange={(e) => setNewCompany({ ...newCompany, pan: e.target.value })}
                    placeholder="e.g. 601234567"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Contact Phone
                  </label>
                  <input
                    value={newCompany.contact}
                    onChange={(e) => setNewCompany({ ...newCompany, contact: e.target.value })}
                    placeholder="+977-1-..."
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newCompany.email}
                    onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                    placeholder="info@company.com"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Registered Address
                  </label>
                  <input
                    value={newCompany.address}
                    onChange={(e) => setNewCompany({ ...newCompany, address: e.target.value })}
                    placeholder="e.g. Kathmandu, Nepal"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                {(parentCompanies.length > 0 || editingCompany) && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompanyCreator(false)
                      setEditingCompany(null)
                      setCompanyCreatorError('')
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={creatingCompany}
                  className="inline-flex items-center gap-2 rounded-lg bg-crimson-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-crimson-700 transition disabled:opacity-60"
                >
                  {creatingCompany ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>{editingCompany ? 'Updating Company…' : 'Creating Company…'}</span>
                    </>
                  ) : (
                    <>
                      <Building2 size={14} />
                      <span>{editingCompany ? 'Update Company & Continue' : 'Create Company & Continue'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )
    }

    return (
      <div className="w-full max-w-4xl mx-auto py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Select Company to Onboard & Configure</h2>
            <p className="mt-1 text-xs text-slate-500">
              You are currently in consolidated mode. Select a company below to configure its profile, fiscal periods, and accounts, or create a new parent company.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCompanyCreator(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-crimson-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-crimson-700 transition"
          >
            <Plus size={14} />
            <span>Add Parent Company</span>
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {parentCompanies.map((parent) => {
            const children = getSubCompaniesForParent(parent.id, subCompanies.length > 0 ? subCompanies : tenants)
            return (
              <div
                key={parent.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-crimson-200 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-crimson-50 text-crimson-600 font-bold text-xs shadow-2xs">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 text-sm">{parent.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {parent.code && (
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                              {parent.code}
                            </span>
                          )}
                          <span className="rounded bg-crimson-100 px-1.5 py-0.2 text-[9px] font-bold text-crimson-700">
                            Parent Company
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {parent.pan && (
                    <div className="mt-3 text-xs text-slate-600">
                      <span className="text-slate-400">PAN:</span> <span className="font-mono font-medium">{parent.pan}</span>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-medium text-slate-500">
                        Sub-Companies ({children.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTenantId(parent.id)
                          setSubCompanyForm({ name: '', code: '', type: 'illaka', active: true, slug: '', pan: '' })
                          setEditingSubCompany(null)
                          setSubCompanyError('')
                          setSubCompanyModalOpen(true)
                        }}
                        className="text-[11px] font-semibold text-crimson-600 hover:text-crimson-700 inline-flex items-center gap-0.5"
                      >
                        <Plus size={11} /> Add Sub-Company
                      </button>
                    </div>

                    {children.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {children.map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => setTenantId(child.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-crimson-50 hover:border-crimson-200 hover:text-crimson-700 transition"
                            title={`Switch to ${child.name}`}
                          >
                            <GitBranch size={10} className="text-slate-400" />
                            <span>{child.name}</span>
                            {child.code && <span className="font-mono text-[9px] text-slate-400">({child.code})</span>}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">No sub-companies yet.</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setTenantId(parent.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                  >
                    <span>🏢 Configure {parent.name}</span>
                    <ArrowRight size={13} />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCompany(parent)
                        setNewCompany({
                          name: parent.name,
                          code: parent.code,
                          pan: parent.pan || '',
                          contact: '',
                          email: '',
                          address: '',
                        })
                        setShowCompanyCreator(true)
                      }}
                      className="rounded-lg p-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                      title={`Edit ${parent.name}`}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteParentCompany(parent.id, parent.name)}
                      className="rounded-lg p-1.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700 transition"
                      title={`Delete ${parent.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (syncing || !settingsLoaded || yearsLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-20 text-center">
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
    <div className="w-full py-6">
      {/* Active Organization Context Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-crimson-50 text-crimson-600 font-bold text-xs shadow-2xs">
            <Building2 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {activeTenant?.name || company.companyName || 'Organization Profile'}
              </span>
              {activeTenant?.code && (
                <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {activeTenant.code}
                </span>
              )}
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  activeTenant?.type === 'central' || !activeTenant?.parentId
                    ? 'bg-crimson-100 text-crimson-700'
                    : 'bg-indigo-100 text-indigo-700'
                }`}
              >
                {activeTenant?.type === 'central' || !activeTenant?.parentId
                  ? 'Parent Company'
                  : 'Sub-Company / Branch'}
              </span>
            </div>
            {activeTenant?.pan && (
              <span className="text-[11px] text-slate-500 font-mono">
                PAN: {activeTenant.pan}
              </span>
            )}
          </div>
        </div>

        {isCentral && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTenantId('')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition shadow-2xs"
            >
              <Building2 size={13} className="text-slate-500" />
              <span>Switch / All Companies</span>
            </button>
          </div>
        )}
      </div>

      {/* Progress: numbered rail */}
      <div className="mb-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-800">{t('setup.title', 'Get the books ready')}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Complete the required steps below before you start posting.
          </p>
        </div>
        <div className="mt-6 overflow-x-auto px-2 flex items-center gap-2 scrollbar-hide">
          {REQUIRED_STEPS.map((s, i) => {
            const done = satisfied[s.key]
            const active = i === stepIdx
            return (
              <button
                key={s.key}
                onClick={() => !busy && setStepIdx(i)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active
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
          {OPTIONAL_STEPS.map((s, i) => {
            const done = satisfied[s.key]
            const active = REQUIRED_STEPS.length + i === stepIdx
            return (
              <button
                key={s.key}
                onClick={() => !busy && setStepIdx(REQUIRED_STEPS.length + i)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active
                  ? 'border-slate-500 bg-slate-50 text-slate-700'
                  : done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-400'
                  }`}
              >
                {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                <span className="hidden sm:inline">{s.title} (optional)</span>
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
            <div className="space-y-6">
              {/* Context Banner if configuring a sub-company */}
              {activeTenant && !isParentCompany(activeTenant) && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-indigo-50/60 border border-indigo-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold shadow-xs">
                      <GitBranch size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-indigo-950">{activeTenant.name}</span>
                        <span className="rounded bg-indigo-200/70 px-1.5 py-0.2 text-[10px] font-bold text-indigo-800">
                          Sub-Company
                        </span>
                      </div>
                      <p className="text-xs text-indigo-800/80">
                        Operating branch under {parentOfActiveTenant?.name || 'Parent Organization'}.
                      </p>
                    </div>
                  </div>
                  {parentOfActiveTenant && (
                    <button
                      type="button"
                      onClick={() => setTenantId(parentOfActiveTenant.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs hover:bg-indigo-50 transition"
                    >
                      <Building2 size={13} />
                      <span>Switch to Parent ({parentOfActiveTenant.name})</span>
                    </button>
                  )}
                </div>
              )}

              {/* Organization profile fields — always accessible */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {activeTenant && !isParentCompany(activeTenant) ? 'Branch Profile Details' : 'Company Profile Details'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {activeTenant && !isParentCompany(activeTenant)
                        ? 'Details for this branch shown on branch vouchers and receipts.'
                        : 'Primary organization details shown on invoices and reports.'}
                    </p>
                  </div>
                  {activeTenant?.code && (
                    <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                      Code: {activeTenant.code}
                    </span>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-slate-600">
                      Organization name <span className="text-crimson-600 font-bold ml-0.5">*</span>
                    </label>
                    <input
                      value={company.companyName}
                      onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                      placeholder="e.g. Syasyah Sahakari"
                      className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">PAN / Tax ID</label>
                    <input
                      value={company.companyPan}
                      onChange={(e) => setCompany({ ...company, companyPan: e.target.value })}
                      placeholder="e.g. 612345678"
                      className="mt-1 h-10 w-full rounded border border-slate-300 px-3 font-mono text-sm outline-none focus:border-slate-500"
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

              {/* Sub-company / ilaka management (central admin only & parent company only) */}
              {isCentral && (!activeTenant || isParentCompany(activeTenant)) && (
                <div className="space-y-3 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">
                        Sub-Companies / Illakas for {activeTenant?.name || company.companyName || 'this Company'}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Branches, illakas, and subsidiaries reporting under this parent company.
                      </p>
                    </div>
                    {!subCompanyModalOpen && activeTenant && isParentCompany(activeTenant) && (
                      <button
                        onClick={() => {
                          setSubCompanyForm({ name: '', code: '', type: 'illaka', active: true, slug: '', pan: '' })
                          setEditingSubCompany(null)
                          setSubCompanyError('')
                          setSubCompanyModalOpen(true)
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-crimson-600 hover:bg-crimson-700 shadow-xs transition"
                      >
                        <Plus size={13} /> {t('setup.addSubCompany', 'Add Sub-Company')}
                      </button>
                    )}
                  </div>
                  {selectedSubCompanies.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-700">{selectedSubCompanies.size} selected</span>
                      <button
                        type="button"
                        onClick={deleteSelectedSubCompanies}
                        disabled={subCompanyBusy === 'delete'}
                        className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        <Trash2 size={13} /> Delete selected
                      </button>
                      <button
                        type="button"
                        onClick={clearSelectionSubCompanies}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-center pb-2 w-10">
                              <input
                                type="checkbox"
                                checked={
                                  currentCompanySubCompanies.length > 0 &&
                                  currentCompanySubCompanies.every((tc) => selectedSubCompanies.has(tc.id))
                                }
                                onChange={(e) =>
                                  toggleSelectAllSubCompanies(
                                    e.target.checked,
                                    currentCompanySubCompanies.map((tc) => tc.id)
                                  )
                                }
                                className="rounded focus:ring-crimson-500"
                              />
                            </th>
                            <th className="text-left pb-2 text-xs font-semibold text-slate-500">
                              {t('setup.subCompanyName', 'Name')}
                            </th>
                            <th className="text-left pb-2 text-xs font-semibold text-slate-500">
                              {t('setup.subCompanyCode', 'Code')}
                            </th>
                            <th className="text-left pb-2 text-xs font-semibold text-slate-500">
                              PAN
                            </th>
                            <th className="text-left pb-2 text-xs font-semibold text-slate-500">
                              {t('setup.subCompanyActive', 'Active')}
                            </th>
                            <th className="text-right pb-2 text-xs font-semibold text-slate-500 w-36">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {currentCompanySubCompanies.map((tc) => (
                            <tr key={tc.id}>
                              <td className="py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedSubCompanies.has(tc.id)}
                                  onChange={(e) => toggleSubCompany(tc.id, e.target.checked)}
                                  className="rounded focus:ring-crimson-500"
                                />
                              </td>
                              <td className="py-3 text-slate-700 font-medium">{tc.name}</td>
                              <td className="py-3 font-mono text-xs text-slate-600">{tc.code || '–'}</td>
                              <td className="py-3 font-mono text-xs text-slate-600">{tc.pan || '–'}</td>
                              <td className="py-3 text-slate-600">
                                {tc.active ? (
                                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Active</span>
                                ) : (
                                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Inactive</span>
                                )}
                              </td>
                              <td className="py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setTenantId(tc.id)}
                                  className="mr-1.5 inline-flex items-center gap-1 rounded bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-2xs"
                                  title={`Configure ${tc.name}`}
                                >
                                  <span>Configure</span>
                                  <ArrowRight size={11} />
                                </button>
                                <button
                                  onClick={() => {
                                    setSubCompanyForm({
                                      name: tc.name,
                                      code: tc.code,
                                      type: 'illaka',
                                      active: tc.active ?? true,
                                      slug: tc.slug || '',
                                      pan: tc.pan || '',
                                    })
                                    setEditingSubCompany(tc)
                                    setSubCompanyError('')
                                    setSubCompanyModalOpen(true)
                                  }}
                                  className="mr-1.5 rounded px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
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
                          {currentCompanySubCompanies.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-xs text-slate-400">
                                No sub-companies or branches under {activeTenant?.name || 'this company'} yet. Click &ldquo;{t('setup.addSubCompany', 'Add sub-company')}&rdquo; to create one.
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
                              onChange={(e) => {
                                const name = e.target.value
                                const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                                setSubCompanyForm((prev) => ({
                                  ...prev,
                                  name,
                                  slug: prev.slug === '' || prev.slug === prev.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') ? slug : prev.slug,
                                }))
                              }}
                              placeholder="e.g. ABC sub-company -1"
                              className="mt-1 h-9 w-full rounded border border-slate-300 px-2.5 text-sm outline-none focus:border-slate-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600">
                              {t('setup.subCompanyCode', 'Code')} *
                            </label>
                            <input
                              value={subCompanyForm.code}
                              onChange={(e) => setSubCompanyForm({ ...subCompanyForm, code: e.target.value.toUpperCase() })}
                              placeholder="ABC-01"
                              className="mt-1 h-9 w-full rounded border border-slate-300 px-2.5 font-mono text-sm outline-none focus:border-slate-500 uppercase"
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
                          <div className="sm:col-span-2">
                            <label className="text-xs font-medium text-slate-600">
                              PAN
                            </label>
                            <input
                              value={subCompanyForm.pan || ''}
                              onChange={(e) => setSubCompanyForm({ ...subCompanyForm, pan: e.target.value })}
                              placeholder="e.g. 601234567"
                              className="mt-1 h-9 w-full rounded border border-slate-300 px-2.5 font-mono text-sm outline-none focus:border-slate-500"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-xs font-medium text-slate-600">
                              {t('setup.subCompanySlug', 'Slug')} *
                            </label>
                            <input
                              value={subCompanyForm.slug}
                              onChange={(e) => setSubCompanyForm({ ...subCompanyForm, slug: e.target.value })}
                              placeholder="abc-sub-company-1"
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
              {activeTenant && !isParentCompany(activeTenant) && (
                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <CalendarDays size={16} className="text-blue-700" />
                    <span>Fiscal Periods Inherited from Parent ({parentOfActiveTenant?.name || 'Central'})</span>
                  </div>
                  <p className="mt-1 text-blue-700">
                    Sub-companies and branches share the parent organization&apos;s fiscal calendar and periods for consolidated books.
                  </p>
                </div>
              )}
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
              onSuccess={refreshFacts}
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
                { key: 'parent', label: 'Parent', type: 'readonly' },
              ]}
              aiModel="gl-accounts"
              aiLabel="Import Chart of Accounts with AI"
              depth={1}
              tenantId={tenantId}
              tenantQuery={tenantQuery}
              setSeedDone={setSeedDone}
              setAiOpen={setAiOpen}
              setAiInitialModel={setAiInitialModel}
              onSuccess={refreshFacts}
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
              seedRows={[
                { code: 'VAT', name: 'Value Added Tax', nature: 'additive', rate: 13, active: true },
                { code: 'TDS', name: 'Tax Deducted at Source', nature: 'withholding', rate: 1.5, active: true },
                { code: 'GST', name: 'Goods and Services Tax', nature: 'additive', rate: 18, active: true },
                { code: 'LUX', name: 'Luxury Tax', nature: 'additive', rate: 40, active: true },
              ]}
              aiModel="tax-types"
              aiLabel="Import Tax Types with AI"
              tenantId={tenantId}
              tenantQuery={tenantQuery}
              setSeedDone={setSeedDone}
              setAiOpen={setAiOpen}
              setAiInitialModel={setAiInitialModel}
              onSuccess={refreshFacts}
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
              aiModel="parties"
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
              onSuccess={refreshFacts}
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
              aiModel="items"
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
              onSuccess={refreshFacts}
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
              aiModel="members"
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
              onSuccess={refreshFacts}
            />
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
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition shadow-xs ${
                  satisfied[step.key]
                    ? 'bg-crimson-600 text-white hover:bg-crimson-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{satisfied[step.key] ? t('setup.nextStep', 'Next Step') : t('setup.skipOrNext', 'Skip / Next')}</span>
                <ArrowRight size={15} />
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


            {/* When the required step is already done, allow moving on. */}
            {isRequired && satisfied[step.key] && !busy && (
              <button
                onClick={() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))}
                className="inline-flex items-center gap-1 rounded bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 transition shadow-2xs"
              >
                {t('setup.next', 'Next Step')} <ArrowRight size={15} />
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
  seedRows?: Record<string, any>[]
  tenantId: string | undefined
  tenantQuery: { tenant?: string | number }
  depth?: number
  setSeedDone: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void
  setAiOpen: (v: boolean) => void
  setAiInitialModel: (v: AIModel | null) => void
  onSuccess?: () => void
}

function SeedTable({
  collection, title, subtitle, seedKey, seedLabel, icon, columns, aiModel, aiLabel, seedRows,
  tenantId, tenantQuery, depth, setSeedDone, setAiOpen, setAiInitialModel, onSuccess,
}: SeedTableProps) {
  const [records, setRecords] = useState<any[]>([])
  const [editRow, setEditRow] = useState<string | null>(null)
  const [rowDraft, setRowDraft] = useState<Record<string, any>>({})
  const [seedEditRow, setSeedEditRow] = useState<string | null>(null)
  const [seedRowDraft, setSeedRowDraft] = useState<Record<string, any>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const cellText = (v: any) =>
    v == null ? '—' : typeof v === 'object' ? String(v?.name ?? v?.title ?? v) : String(v)

  useEffect(() => {
    void loadRecords()
  }, [])

  const loadRecords = async () => {
    const res = await api<{ docs: any[] }>(`/${collection}`, {
      query: { limit: 1000, depth: depth ?? 0, ...tenantQuery },
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

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleSelectAll = (checked: boolean, ids: string[]) => {
    const next = new Set(selectedIds)
    if (checked) ids.forEach((id) => next.add(id))
    else ids.forEach((id) => next.delete(id))
    setSelectedIds(next)
  }

  const clearSelection = () => setSelectedIds(new Set())

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (!window.confirm(`Delete ${ids.length} ${title}?`)) return
    setBusyId('multi')
    let failed = 0
    for (const id of ids) {
      try {
        await api(`/${collection}/${id}`, { method: 'DELETE' })
      } catch {
        failed += 1
      }
    }
    setBusyId(null)
    clearSelection()
    void loadRecords()
    if (failed === 0) pushToast('success', `Deleted ${ids.length} ${title}`)
    else pushToast('warning', `Deleted ${ids.length - failed} of ${ids.length} ${title}`, `${failed} failed`)
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
      if (onSuccess) {
        onSuccess()
      }
      pushToast('success', 'Seeded', 'Records added. Edit or delete any row inline.')
    } catch (e) {
      pushToast('error', 'Failed to seed', e instanceof Error ? e.message : 'Seed failed')
    } finally {
      setBusyId(null)
    }
  }

  const startSeedEdit = (row: any) => {
    const draft: Record<string, any> = {}
    for (const col of columns) {
      if (col.type !== 'readonly') draft[col.key] = row[col.key] ?? ''
    }
    setSeedRowDraft(draft)
    setSeedEditRow(String(row.id ?? row.code))
  }

  const saveSeedRow = (id: string) => {
    const idx = (seedRows ?? []).findIndex((r) => String(r.id ?? r.code) === id)
    if (idx === -1) return
    const next = [...(seedRows ?? [])]
    for (const col of columns) {
      if (col.type !== 'readonly') next[idx][col.key] = seedRowDraft[col.key]
    }
    // Reassignment not possible on const prop; mutate in place for edit preview
    for (const col of columns) {
      if (col.type !== 'readonly') (next[idx] as any)[col.key] = seedRowDraft[col.key]
    }
    setSeedEditRow(null)
    setSeedRowDraft({})
  }

  const deleteSeedRow = (id: string) => {
    // client-side preview only; actual seed uses server defaults
    setSeedEditRow(null)
    setSeedRowDraft({})
  }

  const renderSeedTable = () => {
    const data = seedRows ?? []
    return (
      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={data.length > 0 && data.every((r) => selectedIds.has(String(r.id ?? r.code)))}
                  onChange={(e) => toggleSelectAll(e.target.checked, data.map((r) => String(r.id ?? r.code)))}
                  className="rounded focus:ring-crimson-500"
                />
              </th>
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2">{c.label}</th>
              ))}
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const editing = seedEditRow === String(row.id ?? row.code)
              const rowId = String(row.id ?? row.code)
              return (
                <tr key={rowId} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(rowId)}
                      onChange={(e) => toggleRow(rowId, e.target.checked)}
                      className="rounded focus:ring-crimson-500"
                    />
                  </td>
                  {columns.map((c) => {
                    if (editing && c.type !== 'readonly') {
                      let input: any
                      if (c.type === 'select') {
                        input = (
                          <select
                            defaultValue={String(row[c.key] ?? '')}
                            className="w-full text-xs border border-slate-300 rounded px-1 py-0.5 focus:ring-2 focus:ring-crimson-500 outline-none bg-white"
                            onChange={(e) => setSeedRowDraft({ ...seedRowDraft, [c.key]: e.target.value })}
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
                            onChange={(e) => setSeedRowDraft({ ...seedRowDraft, [c.key]: e.target.checked })}
                          />
                        )
                      } else {
                        input = (
                          <input
                            defaultValue={String(row[c.key] ?? '')}
                            className="w-full text-sm border border-slate-300 rounded px-1 py-0.5 focus:ring-2 focus:ring-crimson-500 outline-none"
                            onChange={(e) => setSeedRowDraft({ ...seedRowDraft, [c.key]: e.target.value })}
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
                    return <td key={c.key} className="px-3 py-2 text-slate-700">{cellText(row[c.key])}</td>
                  })}
                  <td className="px-3 py-2">
                    {editing ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => saveSeedRow(String(row.id ?? row.code))}
                          title="Save"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-crimson-600"
                        >
                          <Save size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSeedEditRow(null)}
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
                          onClick={() => startSeedEdit(row)}
                          title="Edit"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSeedRow(String(row.id ?? row.code))}
                          title="Delete"
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
    )
  }

  const empty = (records.length ?? 0) === 0

  const renderTable = () => (
    <div className="overflow-x-auto rounded border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 text-center">
              <input
                type="checkbox"
                checked={records.length > 0 && records.every((r) => selectedIds.has(String(r.id)))}
                onChange={(e) => toggleSelectAll(e.target.checked, records.map((r) => String(r.id)))}
                className="rounded focus:ring-crimson-500"
              />
            </th>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2">{c.label}</th>
            ))}
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.has(String(row.id))}
                  onChange={(e) => toggleRow(String(row.id), e.target.checked)}
                  className="rounded focus:ring-crimson-500"
                />
              </td>
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
                return <td key={c.key} className="px-3 py-2 text-slate-700">{cellText(row[c.key])}</td>
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
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-700">{selectedIds.size} selected</span>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={busyId === 'multi'}
            className="inline-flex items-center gap-1 rounded bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            <Trash2 size={13} /> Delete selected
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      )}
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

      {/* Seed Data section — only when current data is empty */}
      {empty ? (
        <div>
          {seedRows && seedRows.length > 0 && (
            <>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Seed Data</p>
              {renderSeedTable()}
            </>
          )}
          <div className="flex items-center justify-between mb-1 mt-1">
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
      ) : null}

      {/* AI Import — every step, whether or not data exists yet */}
      <div className="flex items-center gap-2 mb-1 mt-1">
        <button
          onClick={() => { setAiInitialModel(aiModel ?? 'gl-accounts'); setAiOpen(true) }}
          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Sparkles size={14} /> {aiLabel ?? 'Import with AI'}
        </button>
      </div>
    </div>
  )
}