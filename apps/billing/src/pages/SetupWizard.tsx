import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Database,
  Eye,
  GitBranch,
  Hourglass,
  Layers,
  Loader2,
  Package,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { api, list } from '../lib/api'
import { useDataEpochWatcher } from '../lib/dataOps'
import { useFiscalYear } from '../lib/fiscalYear'
import {
  useTenant,
  getParentCompanies,
  getSubCompaniesForParent,
  isParentCompany,
  type TenantOption,
} from '../lib/tenant'
import { useT } from '../lib/i18n'
import { pushToast } from '../lib/toast'
import { adToBsString, bsToAdString } from '../lib/nepaliDate'
import type { Account, BillingSettings, Document, FiscalYear } from '../lib/types'
import type { AIModel } from '../lib/ai/schemas'
import AIWorkspaceModal from '../components/AIWorkspaceModal'

// Modularized Setup Wizard Subcomponents
import type {
  StepDef,
  CompanyFormData,
  SubCompanyFormData,
  NewParentCompanyFormData,
} from './SetupWizard/types'
import { SetupContextBar } from './SetupWizard/components/SetupContextBar'
import { SetupRail } from './SetupWizard/components/SetupRail'
import { SetupMetrics } from './SetupWizard/components/SetupMetrics'
import { CompanyDirectory } from './SetupWizard/components/CompanyDirectory'
import { CompanyCreatorModal } from './SetupWizard/components/CompanyCreatorModal'
import { SubCompanyModal } from './SetupWizard/components/SubCompanyModal'
import { SeedTableStep } from './SetupWizard/components/SeedTableStep'
import { FiscalYearStep } from './SetupWizard/components/FiscalYearStep'
import { ChildrenCompanySection } from './SetupWizard/components/ChildrenCompanySection'
import { SetupFlowChoiceModal } from './SetupWizard/components/SetupFlowChoiceModal'

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
  const { tenantId, setTenantId, tenants, isIllaka, isCentral, isSuperAdmin, isAdmin: rawIsAdmin, isViewer } = useTenant()
  const isAdmin = rawIsAdmin ?? (isSuperAdmin || isCentral)
  const { years, loading: yearsLoading, refresh: refreshYears } = useFiscalYear()

  const [stepIdx, setStepIdx] = useState(0)
  const [settings, setSettings] = useState<BillingSettings | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [syncing, setSyncing] = useState(true)

  // Children Company toggle and choice flow
  const [enableChildrenCompanies, setEnableChildrenCompanies] = useState<boolean>(false)
  const [showPostSaveChoiceModal, setShowPostSaveChoiceModal] = useState<boolean>(false)

  // Fact counts
  const [chartCount, setChartCount] = useState<number | null>(null)
  const [illakaCount, setIllakaCount] = useState<number | null>(null)
  const [memberCount, setMemberCount] = useState<number | null>(null)
  const [accountGroupsCount, setAccountGroupsCount] = useState<number | null>(null)
  const [taxTypesCount, setTaxTypesCount] = useState<number | null>(null)

  // Sub-companies state
  const [subCompanies, setSubCompanies] = useState<TenantOption[]>([])
  const [selectedSubCompanies, setSelectedSubCompanies] = useState<Set<string>>(new Set())
  const [subCompanyForm, setSubCompanyForm] = useState<SubCompanyFormData>({
    name: '',
    code: '',
    type: 'illaka',
    active: true,
    slug: '',
    pan: '',
  })
  const [editingSubCompany, setEditingSubCompany] = useState<TenantOption | null>(null)
  const [subCompanyBusy, setSubCompanyBusy] = useState('')
  const [subCompanyError, setSubCompanyError] = useState('')
  const [subCompanyModalOpen, setSubCompanyModalOpen] = useState(false)

  // Parent Company Creator / Editor state
  const [showCompanyCreator, setShowCompanyCreator] = useState(false)
  const [editingCompany, setEditingCompany] = useState<TenantOption | null>(null)
  const [newCompany, setNewCompany] = useState<NewParentCompanyFormData>({
    name: '',
    code: '',
    pan: '',
    contact: '',
    email: '',
    address: '',
  })
  const [creatingCompany, setCreatingCompany] = useState(false)
  const [companyCreatorError, setCompanyCreatorError] = useState('')

  // AI Workspace import modal
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInitialModel, setAiInitialModel] = useState<AIModel | null>(null)

  // Company Profile form
  const [company, setCompany] = useState<CompanyFormData>({
    companyName: '',
    companyPan: '',
    companyContact: '',
    companyEmail: '',
    companyAddress: '',
  })

  // Fiscal Year form
  const [fy, setFy] = useState<{ label: string; startDate: string; endDate: string }>({
    label: '',
    startDate: '',
    endDate: '',
  })
  const [fyCal, setFyCal] = useState<'AD' | 'BS'>('AD')
  const [fyBs, setFyBs] = useState({ start: '', end: '' })
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

  // Per-seed-step completion tracking
  const [seedDone, setSeedDone] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const tenantQuery = useMemo(() => (tenantId ? { tenant: tenantId } : {}), [tenantId])

  // Context tenant resolution
  const allTenantsList = useMemo(() => {
    return subCompanies.length > 0 ? subCompanies : tenants
  }, [subCompanies, tenants])

  const currentTenant = useMemo(() => {
    return allTenantsList.find((t) => String(t.id) === String(tenantId)) || null
  }, [allTenantsList, tenantId])

  const parentCompanies = useMemo(() => {
    return getParentCompanies(allTenantsList)
  }, [allTenantsList])

  const activeTenant = currentTenant
  const isSubCompany = Boolean(activeTenant && !isParentCompany(activeTenant))

  const parentOfActiveTenant = useMemo(() => {
    if (!activeTenant || isParentCompany(activeTenant)) return null
    return allTenantsList.find((t) => String(t.id) === String(activeTenant.parentId)) || null
  }, [activeTenant, allTenantsList])

  const currentCompanySubCompanies = useMemo(() => {
    if (!tenantId) return []
    return getSubCompaniesForParent(tenantId, allTenantsList)
  }, [allTenantsList, tenantId])

  // Auto-initialize children companies toggle: ON if parent already has children in DB, OFF otherwise
  useEffect(() => {
    if (currentCompanySubCompanies.length > 0) {
      setEnableChildrenCompanies(true)
    } else {
      setEnableChildrenCompanies(false)
    }
  }, [tenantId, currentCompanySubCompanies.length])

  const fyTenantId = useMemo(() => {
    if (!currentTenant) return tenantId
    if (isParentCompany(currentTenant)) return tenantId
    return currentTenant.parentId || tenantId
  }, [currentTenant, tenantId])

  const fyTenantQuery = useMemo(() => (fyTenantId ? { tenant: fyTenantId } : {}), [fyTenantId])

  // Fact refresh loader
  const refreshFacts = useCallback(async () => {
    try {
      const [s, chartRes, illakaRes, memberRes, agRes, ttRes] = await Promise.all([
        api<BillingSettings>('/globals/billing-settings', { query: { depth: 1 } }).catch(() => null),
        list<Account>('gl-accounts', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null),
        list<TenantOption>('tenants', { depth: 0, limit: 100 }).catch(() => null),
        tenantId ? list<{ id: number }>('members', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null) : Promise.resolve(null),
        tenantId ? list<{ id: number }>('account-groups', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null) : Promise.resolve(null),
        tenantId ? list<{ id: number }>('tax-types', { depth: 0, limit: 1, ...tenantQuery }).catch(() => null) : Promise.resolve(null),
      ])

      setSettings(s)
      setSettingsLoaded(true)
      setChartCount(chartRes?.totalDocs ?? 0)
      setIllakaCount(illakaRes?.totalDocs ?? 0)
      setMemberCount(memberRes?.totalDocs ?? 0)
      setAccountGroupsCount(agRes?.totalDocs ?? 0)
      setTaxTypesCount(ttRes?.totalDocs ?? 0)

      const rawTenants: any[] = illakaRes?.docs ?? []
      const mapped: TenantOption[] = rawTenants.map((t) => {
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
          contactInfo: t.contactInfo || null,
          location: t.location || null,
        }
      })
      setSubCompanies(mapped)

      if (s && !tenantId) {
        setCompany({
          companyName: s.companyName || '',
          companyPan: s.companyPan || '',
          companyContact: s.companyContact || '',
          companyEmail: s.companyEmail || '',
          companyAddress: s.companyAddress || '',
        })
      }
    } finally {
      setSyncing(false)
    }
  }, [tenantId, tenantQuery])

  // Sync full company profile on tenant change
  useEffect(() => {
    if (activeTenant) {
      setCompany({
        companyName: activeTenant.name || '',
        companyPan: activeTenant.pan || '',
        companyContact: activeTenant.contactInfo?.phone || '',
        companyEmail: activeTenant.contactInfo?.email || '',
        companyAddress: activeTenant.location?.address || '',
      })
    }
  }, [activeTenant])

  // Initial load
  useEffect(() => {
    let alive = true
    const init = async () => {
      if (alive) {
        setSyncing(true)
        await refreshFacts()
      }
    }
    void init()
    return () => {
      alive = false
    }
  }, [refreshFacts, tenantId])

  const step = STEPS[stepIdx]
  const isRequired = stepIdx < REQUIRED_STEPS.length

  // Deep-link step via ?step=<key>
  useEffect(() => {
    const urlStep = searchParams.get('step')
    const idx = STEPS.findIndex((s) => s.key === urlStep)
    if (urlStep && idx !== -1 && idx !== stepIdx) setStepIdx(idx)
  }, [])

  // Sync step to URL query param
  useEffect(() => {
    const key = step.key
    if (searchParams.get('step') !== key) {
      setSearchParams({ step: key }, { replace: true })
    }
  }, [step.key, searchParams, setSearchParams])

  const satisfied: Record<string, boolean> = {
    company: Boolean(
      activeTenant
        ? (company.companyName || activeTenant.name)?.trim()
        : settings?.companyName && String(settings.companyName).trim(),
    ),
    fiscalYear: (years?.length ?? 0) > 0 || Boolean(settings?.activeFiscalYear),
    'seed-account-groups':
      Boolean(seedDone['seed-account-groups'] || seedDone['accountGroups']) ||
      (accountGroupsCount ?? 0) > 0,
    'seed-accounts':
      Boolean(seedDone['seed-accounts'] || seedDone['accounts']) ||
      (chartCount ?? 0) > 0,
    'seed-taxTypes':
      Boolean(seedDone['seed-taxTypes'] || seedDone['taxTypes']) ||
      (taxTypesCount ?? 0) > 0,
    'seed-parties': Boolean(seedDone['seed-parties'] || seedDone['parties']) || false,
    'seed-items': Boolean(seedDone['seed-items'] || seedDone['items']) || false,
    'seed-members':
      Boolean(seedDone['seed-members'] || seedDone['members']) ||
      (memberCount ?? 0) > 0,
    openings: true,
  }

  const bumpGlobals = () => {
    window.dispatchEvent(new Event('billing-settings-changed'))
    void refreshFacts()
  }

  // Check duplicate parent company name
  const isDuplicateParentName = useMemo(() => {
    if (isSubCompany || !company.companyName.trim()) return false
    const trimmed = company.companyName.trim().toLowerCase()
    // If the name is unchanged from the active company's current name, it is not a duplicate
    if (activeTenant && activeTenant.name.trim().toLowerCase() === trimmed) return false
    const currentCompanyId = activeTenant?.id || tenantId
    return parentCompanies.some(
      (p) => (!currentCompanyId || String(p.id) !== String(currentCompanyId)) && p.name.trim().toLowerCase() === trimmed,
    )
  }, [isSubCompany, company.companyName, parentCompanies, tenantId, activeTenant])

  // Save company profile
  const saveCompany = async () => {
    if (!isAdmin) {
      pushToast('error', 'Admin permission required', 'Only administrators have permission to update the company profile.')
      return
    }
    const targetName = company.companyName.trim()
    if (!targetName) {
      setError('Organization name is required.')
      return
    }
    if (isDuplicateParentName) {
      const msg = `A parent company with the name "${targetName}" already exists. Parent company names must be unique.`
      setError(msg)
      pushToast('error', 'Duplicate company name', msg)
      return
    }
    setBusy('company')
    setError('')
    try {
      if (activeTenant && !isParentCompany(activeTenant)) {
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
        })
      } else if (activeTenant && isParentCompany(activeTenant)) {
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
        })
        await api('/globals/billing-settings', {
          method: 'POST',
          body: {
            companyName: company.companyName,
            companyPan: company.companyPan || undefined,
            companyContact: company.companyContact || undefined,
            companyEmail: company.companyEmail || undefined,
            companyAddress: company.companyAddress || undefined,
          },
        })
      } else {
        await api('/globals/billing-settings', {
          method: 'POST',
          body: {
            companyName: company.companyName,
            companyPan: company.companyPan || undefined,
            companyContact: company.companyContact || undefined,
            companyEmail: company.companyEmail || undefined,
            companyAddress: company.companyAddress || undefined,
          },
        })
      }
      bumpGlobals()
      pushToast('success', t('setup.companySaved', 'Company profile saved'))
      if (!isSubCompany && enableChildrenCompanies && currentCompanySubCompanies.length > 0) {
        setShowPostSaveChoiceModal(true)
      } else {
        setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save company profile')
    } finally {
      setBusy('')
    }
  }

  // Parent Company CRUD
  const handleCreateParentCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = newCompany.name.trim()
    const trimmedCode = newCompany.code.trim().toUpperCase()
    if (!trimmedName || !trimmedCode) {
      setCompanyCreatorError('Company name and code are required.')
      return
    }

    const isDuplicateName = parentCompanies.some(
      (p) => (!editingCompany || String(p.id) !== String(editingCompany.id)) &&
             p.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    )
    if (isDuplicateName && (!editingCompany || editingCompany.name.trim().toLowerCase() !== trimmedName.toLowerCase())) {
      setCompanyCreatorError(`A parent company with the name "${trimmedName}" already exists. Parent company names must be unique.`)
      return
    }

    const isDuplicateCode = parentCompanies.some(
      (p) => (!editingCompany || String(p.id) !== String(editingCompany.id)) &&
             p.code.trim().toUpperCase() === trimmedCode,
    )
    if (isDuplicateCode && (!editingCompany || editingCompany.code.trim().toUpperCase() !== trimmedCode)) {
      setCompanyCreatorError(`A company with the code "${trimmedCode}" already exists. Please choose a unique code.`)
      return
    }

    setCreatingCompany(true)
    setCompanyCreatorError('')

    try {
      if (editingCompany) {
        await api(`/tenants/${editingCompany.id}`, {
          method: 'PATCH',
          immediate: true,
          body: {
            name: newCompany.name.trim(),
            code: newCompany.code.trim().toUpperCase(),
            pan: newCompany.pan.trim() || undefined,
            contactInfo: {
              phone: newCompany.contact.trim() || undefined,
              email: newCompany.email.trim() || undefined,
            },
            location: {
              address: newCompany.address.trim() || undefined,
            },
          },
        })
        pushToast('success', `Parent company "${newCompany.name}" updated successfully!`)
      } else {
        const slug = newCompany.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')

        const res = await api<{ doc: { id: string | number; name: string } }>('/tenants', {
          method: 'POST',
          immediate: true,
          body: {
            name: newCompany.name.trim(),
            code: newCompany.code.trim().toUpperCase(),
            type: 'central',
            active: true,
            slug: slug || newCompany.code.toLowerCase(),
            pan: newCompany.pan.trim() || undefined,
            parent: null,
            parentId: null,
            contactInfo: {
              phone: newCompany.contact.trim() || undefined,
              email: newCompany.email.trim() || undefined,
            },
            location: {
              address: newCompany.address.trim() || undefined,
            },
          },
        })

        if (parentCompanies.length === 0) {
          await api('/globals/billing-settings', {
            method: 'POST',
            body: {
              companyName: newCompany.name.trim(),
              companyPan: newCompany.pan.trim() || undefined,
              companyContact: newCompany.contact.trim() || undefined,
              companyEmail: newCompany.email.trim() || undefined,
              companyAddress: newCompany.address.trim() || undefined,
            },
          }).catch(() => {})
        }

        const newId = String(res.doc?.id ?? (res as any)?.id)
        const createdOption: TenantOption = {
          id: newId,
          code: newCompany.code.trim().toUpperCase(),
          name: newCompany.name.trim(),
          type: 'central',
          active: true,
          slug: slug || newCompany.code.toLowerCase(),
          pan: newCompany.pan.trim() || '',
          parent: null,
          parentId: null,
        }
        setSubCompanies((prev) => [...prev, createdOption])
        setTenantId(newId)
        setCompany({
          companyName: newCompany.name.trim(),
          companyPan: newCompany.pan.trim(),
          companyContact: newCompany.contact.trim(),
          companyEmail: newCompany.email.trim(),
          companyAddress: newCompany.address.trim(),
        })
        pushToast('success', `Parent company "${newCompany.name}" created successfully!`)
      }

      setNewCompany({ name: '', code: '', pan: '', contact: '', email: '', address: '' })
      setShowCompanyCreator(false)
      setEditingCompany(null)
      bumpGlobals()
    } catch (err: any) {
      setCompanyCreatorError(err?.message || 'Failed to save parent company.')
    } finally {
      setCreatingCompany(false)
    }
  }

  const deleteParentCompany = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete parent company "${name}" and all associated records?`)) {
      return
    }
    try {
      await api(`/tenants/${id}`, { method: 'DELETE', immediate: true })
      pushToast('success', `Deleted company "${name}"`)
      bumpGlobals()
    } catch (err: any) {
      pushToast('error', 'Failed to delete company', err?.message)
    }
  }

  // Sub-company CRUD
  const saveSubCompany = async () => {
    const trimmedSubName = subCompanyForm.name.trim()
    const trimmedSubCode = subCompanyForm.code.trim().toUpperCase()
    if (!trimmedSubName || !trimmedSubCode) {
      setSubCompanyError('Sub-company name and code are required.')
      return
    }

    if (activeTenant && activeTenant.name.trim().toLowerCase() === trimmedSubName.toLowerCase()) {
      setSubCompanyError(`A child branch cannot have the same name as the parent company ("${activeTenant.name}").`)
      return
    }

    const isDuplicateChildName = currentCompanySubCompanies.some(
      (sc) => (!editingSubCompany || String(sc.id) !== String(editingSubCompany.id)) &&
             sc.name.trim().toLowerCase() === trimmedSubName.toLowerCase(),
    )
    if (isDuplicateChildName) {
      setSubCompanyError(`A child branch with the name "${trimmedSubName}" already exists under this parent company.`)
      return
    }

    const isDuplicateChildCode = allTenantsList.some(
      (t) => (!editingSubCompany || String(t.id) !== String(editingSubCompany.id)) &&
             t.code.trim().toUpperCase() === trimmedSubCode,
    )
    if (isDuplicateChildCode) {
      setSubCompanyError(`A company / branch with the code "${trimmedSubCode}" already exists. Please choose a unique code.`)
      return
    }

    setSubCompanyBusy(editingSubCompany ? 'update' : 'create')
    setSubCompanyError('')

    const currentParentId = tenantId || null
    const parentNum = currentParentId ? Number(currentParentId) : undefined
    const parentVal = parentNum && !isNaN(parentNum) ? parentNum : currentParentId || undefined

    try {
      if (editingSubCompany) {
        await api(`/tenants/${editingSubCompany.id}`, {
          method: 'PATCH',
          immediate: true,
          body: {
            name: subCompanyForm.name,
            code: subCompanyForm.code,
            active: subCompanyForm.active,
            slug: subCompanyForm.slug,
            pan: subCompanyForm.pan || undefined,
            type: 'illaka',
            parent: parentVal,
          },
        })
        setSubCompanies((prev) =>
          prev.map((sc) =>
            sc.id === editingSubCompany.id
              ? {
                  ...sc,
                  name: subCompanyForm.name,
                  code: subCompanyForm.code,
                  active: subCompanyForm.active,
                  slug: subCompanyForm.slug,
                  pan: subCompanyForm.pan || '',
                }
              : sc,
          ),
        )
        pushToast('success', t('setup.subCompanyUpdated', 'Sub-company updated'))
      } else {
        const res = await api<{ doc: { id: string | number; name: string } }>('/tenants', {
          method: 'POST',
          immediate: true,
          body: {
            name: subCompanyForm.name,
            code: subCompanyForm.code,
            type: 'illaka',
            active: subCompanyForm.active,
            slug: subCompanyForm.slug,
            pan: subCompanyForm.pan || undefined,
            parent: parentVal,
          },
        })
        const newSubId = String(res.doc?.id ?? (res as any)?.id ?? Date.now())
        setSubCompanies((prev) => [
          ...prev,
          {
            id: newSubId,
            name: subCompanyForm.name,
            code: subCompanyForm.code,
            type: 'illaka',
            active: subCompanyForm.active,
            slug: subCompanyForm.slug,
            pan: subCompanyForm.pan || '',
            parent: parentVal as any,
            parentId: currentParentId,
          },
        ])
        pushToast('success', t('setup.subCompanyCreated', 'Sub-company created'))
        setEnableChildrenCompanies(true)
      }
      setSubCompanyModalOpen(false)
      setEditingSubCompany(null)
      setSubCompanyForm({ name: '', code: '', type: 'illaka', active: true, slug: '', pan: '' })
      bumpGlobals()
    } catch (e) {
      setSubCompanyError(e instanceof Error ? e.message : 'Failed to save sub-company')
    } finally {
      setSubCompanyBusy('')
    }
  }

  const editSubCompany = (sc: TenantOption) => {
    setEditingSubCompany(sc)
    setSubCompanyForm({
      name: sc.name,
      code: sc.code,
      type: 'illaka',
      active: sc.active ?? true,
      slug: sc.slug ?? '',
      pan: sc.pan ?? '',
    })
    setSubCompanyError('')
    setSubCompanyModalOpen(true)
  }

  const deleteSubCompany = async (id: string, name?: string) => {
    if (!window.confirm(`Delete sub-company "${name || id}"?`)) return
    try {
      await api(`/tenants/${id}`, { method: 'DELETE', immediate: true })
      bumpGlobals()
      pushToast('success', 'Sub-company deleted')
    } catch (e) {
      pushToast('error', 'Failed to delete sub-company', e instanceof Error ? e.message : String(e))
    }
  }

  const toggleSubCompanySelect = (id: string, checked: boolean) => {
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

  const deleteSelectedSubCompanies = async () => {
    const ids = Array.from(selectedSubCompanies)
    if (ids.length === 0) return
    if (!window.confirm(`Delete ${ids.length} selected sub-companies?`)) return
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
    setSelectedSubCompanies(new Set())
    bumpGlobals()
    if (failed === 0) pushToast('success', `Deleted ${ids.length} sub-companies`)
    else pushToast('warning', `Deleted ${ids.length - failed} of ${ids.length} sub-companies`, `${failed} failed`)
  }

  // Fiscal Year Handlers
  const createFiscalYear = async () => {
    setBusy('fiscalYear')
    setError('')
    try {
      const label =
        fy.label.trim() ||
        (() => {
          const bs = adToBsString(fy.startDate)
          const bsYear = bs ? Number(bs.slice(0, 4)) : null
          return bsYear ? `${bsYear}-${String(bsYear + 1).slice(2)}` : `FY ${fy.startDate}`
        })()

      const created = await api<FiscalYear>('/fiscal-years', {
        method: 'POST',
        body: {
          label,
          startDate: fy.startDate,
          endDate: fy.endDate,
          status: 'active',
          isActive: true,
          ...(fyTenantId ? { tenant: Number(fyTenantId) } : {}),
        },
      })
      await api('/globals/billing-settings', {
        method: 'POST',
        body: { activeFiscalYear: created.id },
      })
      bumpGlobals()
      await refreshYears()
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
      pushToast('success', t('setup.fySaved', 'Fiscal year created & set active'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create fiscal year')
    } finally {
      setBusy('')
    }
  }

  const fySetActive = async (id: string) => {
    try {
      await api(`/fiscal-years/${id}`, { method: 'PATCH', body: { isActive: true } })
      await api('/globals/billing-settings', { method: 'POST', body: { activeFiscalYear: Number(id) } })
      bumpGlobals()
      await refreshYears()
      pushToast('success', 'Working year updated')
    } catch (e) {
      pushToast('error', 'Failed to set working year', e instanceof Error ? e.message : String(e))
    }
  }

  const fyOpen = async (id: string) => {
    try {
      await api(`/fiscal-years/${id}`, { method: 'PATCH', body: { status: 'active' } })
      bumpGlobals()
      await refreshYears()
      pushToast('success', 'Fiscal year reopened')
    } catch (e) {
      pushToast('error', 'Failed to reopen fiscal year', e instanceof Error ? e.message : String(e))
    }
  }

  const fyClose = async (id: string) => {
    if (!window.confirm('Close this fiscal year? Transactions will be locked.')) return
    try {
      await api(`/fiscal-years/${id}`, { method: 'PATCH', body: { status: 'closed' } })
      bumpGlobals()
      await refreshYears()
      pushToast('success', 'Fiscal year closed')
    } catch (e) {
      pushToast('error', 'Failed to close fiscal year', e instanceof Error ? e.message : String(e))
    }
  }

  const fyRowSave = async (id: string, draft: any) => {
    try {
      await api(`/fiscal-years/${id}`, {
        method: 'PATCH',
        body: {
          label: draft.label,
          startDate: draft.startDate,
          endDate: draft.endDate,
          status: draft.status,
        },
      })
      bumpGlobals()
      await refreshYears()
      pushToast('success', 'Fiscal year updated')
    } catch (e) {
      pushToast('error', 'Failed to update fiscal year', e instanceof Error ? e.message : String(e))
    }
  }

  const fyDelete = async (id: string) => {
    if (!window.confirm('Delete this fiscal year?')) return
    try {
      await api(`/fiscal-years/${id}`, { method: 'DELETE' })
      bumpGlobals()
      await refreshYears()
      pushToast('success', 'Fiscal year deleted')
    } catch (e) {
      pushToast('error', 'Failed to delete fiscal year', e instanceof Error ? e.message : String(e))
    }
  }

  const finish = () => navigate('/app', { replace: true })

  // 1. Initial sync and loading facts
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

  // 2. Consolidated view / No tenant selected
  if (!isIllaka && !tenantId) {
    if (parentCompanies.length === 0 || showCompanyCreator) {
      return (
        <CompanyCreatorModal
          open={true}
          isFirstCompany={parentCompanies.length === 0}
          editingCompany={editingCompany}
          formData={newCompany}
          setFormData={setNewCompany}
          creating={creatingCompany}
          error={companyCreatorError}
          parentCompanies={parentCompanies}
          onClose={() => {
            setShowCompanyCreator(false)
            setEditingCompany(null)
            setCompanyCreatorError('')
          }}
          onSubmit={handleCreateParentCompany}
        />
      )
    }

    return (
      <CompanyDirectory
        parentCompanies={parentCompanies}
        allTenants={allTenantsList}
        isSuperAdmin={isSuperAdmin}
        onSelectTenant={(id, autoAdvance) => {
          setTenantId(id)
          if (autoAdvance) {
            setStepIdx(1)
          }
        }}
        onAddParentCompany={() => {
          setEditingCompany(null)
          setNewCompany({ name: '', code: '', pan: '', contact: '', email: '', address: '' })
          setCompanyCreatorError('')
          setShowCompanyCreator(true)
        }}
        onEditParentCompany={(parent) => {
          setEditingCompany(parent)
          setNewCompany({
            name: parent.name,
            code: parent.code,
            pan: parent.pan || '',
            contact: parent.contactInfo?.phone || '',
            email: parent.contactInfo?.email || '',
            address: parent.location?.address || '',
          })
          setShowCompanyCreator(true)
        }}
        onDeleteParentCompany={deleteParentCompany}
        onAddSubCompany={(parent) => {
          setTenantId(parent.id)
          setSubCompanyForm({ name: '', code: '', type: 'illaka', active: true, slug: '', pan: '' })
          setEditingSubCompany(null)
          setSubCompanyError('')
          setSubCompanyModalOpen(true)
        }}
      />
    )
  }

  // 3. Loading check when tenant is selected
  if (syncing || !settingsLoaded || yearsLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-crimson-50 text-crimson-600 shadow-sm animate-pulse">
          <Database size={26} />
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-800">
          Syncing & loading setup facts…
        </h2>
        <div className="mt-5 flex items-center gap-2 text-xs font-medium text-slate-500">
          <Loader2 size={14} className="animate-spin text-crimson-600" />
          <span>Please wait a moment…</span>
        </div>
      </div>
    )
  }

  // 4. Main Setup Wizard View
  return (
    <div className="w-full py-6">
      {/* View-Only Demo Banner */}
      {isViewer && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 shadow-2xs">
          <Eye size={16} className="text-amber-600 shrink-0" />
          <span className="font-medium">
            You are viewing the Setup Wizard in View-Only (Demo) mode. Modifications and seeding are disabled.
          </span>
        </div>
      )}

      {/* Active Organization Context Bar */}
      <SetupContextBar
        activeTenant={activeTenant}
        companyName={company.companyName}
        isCentral={isCentral}
        isSuperAdmin={isSuperAdmin}
        onSwitchAll={() => setTenantId('')}
      />

      {/* Progress: numbered rail */}
      <SetupRail
        requiredSteps={REQUIRED_STEPS}
        optionalSteps={OPTIONAL_STEPS}
        satisfied={satisfied}
        stepIdx={stepIdx}
        busy={busy}
        onSelectStep={(idx) => setStepIdx(idx)}
      />

      {/* Metric cards */}
      <SetupMetrics
        isParent={!isSubCompany}
        illakaCount={illakaCount}
        memberCount={memberCount}
        chartCount={chartCount}
        taxTypesCount={taxTypesCount}
      />

      {/* Step Body */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">{step.title}</h2>
            <p className="text-xs text-slate-500">{step.blurb}</p>
          </div>
          {isRequired && (
            <span className="rounded-full bg-crimson-50 px-2.5 py-0.5 text-[10px] font-bold text-crimson-700">
              Required
            </span>
          )}
        </div>

        <div className="mt-6">
          {/* Step 0: Company Profile */}
          {step.key === 'company' && (
            <div className="space-y-6">
              {isSubCompany && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-indigo-50/60 border border-indigo-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold shadow-xs">
                      <GitBranch size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-indigo-950">{activeTenant?.name}</span>
                        <span className="rounded bg-indigo-200/70 px-1.5 py-0.2 text-[10px] font-bold text-indigo-800">
                          Sub-Company
                        </span>
                      </div>
                      <p className="text-xs text-indigo-800/80">
                        Operating branch under {parentOfActiveTenant?.name || 'Parent Organization'}.
                      </p>
                    </div>
                  </div>
                  {parentOfActiveTenant && isSuperAdmin && (
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

              {/* Organization Profile Details */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
                <div className="mb-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {isSubCompany ? 'Branch Profile Details' : 'Company Profile Details'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {isSubCompany
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
                      disabled={!isAdmin}
                      onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
                      placeholder="e.g. Syasyah Sahakari"
                      className={`mt-1 h-10 w-full rounded-lg border px-3 text-sm outline-none focus:ring-1 disabled:bg-slate-50 disabled:text-slate-500 ${
                        isDuplicateParentName
                          ? 'border-red-400 focus:border-red-500 focus:ring-red-500 bg-red-50/30'
                          : 'border-slate-300 focus:border-crimson-500 focus:ring-crimson-500'
                      }`}
                    />
                    {isDuplicateParentName && (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        A parent company with this name already exists. Please choose a unique organization name.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">PAN / Tax ID</label>
                    <input
                      value={company.companyPan}
                      disabled={!isAdmin}
                      onChange={(e) => setCompany({ ...company, companyPan: e.target.value })}
                      placeholder="e.g. 612345678"
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm outline-none focus:border-crimson-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Contact</label>
                    <input
                      value={company.companyContact}
                      disabled={!isAdmin}
                      onChange={(e) => setCompany({ ...company, companyContact: e.target.value })}
                      placeholder="Phone number"
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Email</label>
                    <input
                      type="email"
                      value={company.companyEmail}
                      disabled={!isAdmin}
                      onChange={(e) => setCompany({ ...company, companyEmail: e.target.value })}
                      placeholder="org@example.com"
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Address</label>
                    <input
                      value={company.companyAddress}
                      disabled={!isAdmin}
                      onChange={(e) => setCompany({ ...company, companyAddress: e.target.value })}
                      placeholder="Registered address"
                      className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                </div>
              </div>

              {/* Children Companies Section (Parent Companies, Super-Admin controlled) */}
              {isCentral && !isSubCompany && (
                <ChildrenCompanySection
                  enabled={enableChildrenCompanies}
                  onToggle={setEnableChildrenCompanies}
                  subCompanies={currentCompanySubCompanies}
                  isSuperAdmin={isSuperAdmin}
                  companyName={activeTenant?.name || company.companyName}
                  onAddClick={() => {
                    setSubCompanyForm({ name: '', code: '', type: 'illaka', active: true, slug: '', pan: '' })
                    setEditingSubCompany(null)
                    setSubCompanyError('')
                    setSubCompanyModalOpen(true)
                  }}
                  onEditClick={(sc) => editSubCompany(sc)}
                  onDeleteClick={(id, name) => deleteSubCompany(id, name)}
                  subCompanyBusy={subCompanyBusy}
                  subCompanyError={subCompanyError}
                />
              )}
            </div>
          )}

          {/* Step 1: Fiscal Year */}
          {step.key === 'fiscalYear' && (
            <FiscalYearStep
              isSubCompany={isSubCompany}
              parentName={parentOfActiveTenant?.name}
              years={years}
              yearsLoading={yearsLoading}
              fy={fy}
              setFy={setFy}
              fyCal={fyCal}
              toggleFyCal={toggleFyCal}
              fyBs={fyBs}
              setFyBs={setFyBs}
              activeFiscalYearId={
                settings?.activeFiscalYear
                  ? String(
                      typeof settings.activeFiscalYear === 'object'
                        ? settings.activeFiscalYear.id
                        : settings.activeFiscalYear,
                    )
                  : undefined
              }
              onCreateYear={createFiscalYear}
              onSetActiveYear={fySetActive}
              onOpenYear={fyOpen}
              onCloseYear={fyClose}
              onSaveYear={fyRowSave}
              onDeleteYear={fyDelete}
              busy={busy}
              isViewer={isViewer}
            />
          )}

          {/* Step 2: Account Groups */}
          {step.key === 'seed-account-groups' && (
            <SeedTableStep
              collection="account-groups"
              title="Account Types & Groups"
              subtitle="Parent groups — Asset, Liability, Equity, Income, Expense. Seed first, then accounts."
              seedKey="accountGroups"
              stepKey={step.key}
              seedLabel="Seed types & groups"
              icon={<Layers size={18} className="text-slate-600" />}
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

          {/* Step 3: Chart of Accounts */}
          {step.key === 'seed-accounts' && (
            <SeedTableStep
              collection="gl-accounts"
              title="Chart of Accounts"
              subtitle="Starter chart — seed then edit inline. Edits persist to the ledger."
              seedKey="accounts"
              stepKey={step.key}
              seedLabel="Seed chart"
              icon={<Database size={18} className="text-slate-600" />}
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

          {/* Step 4: Tax Types */}
          {step.key === 'seed-taxTypes' && (
            <SeedTableStep
              collection="tax-types"
              title="Tax Types"
              subtitle="VAT @ 13% plus sales/purchase ledger wiring."
              seedKey="taxTypes"
              stepKey={step.key}
              seedLabel="Seed tax types"
              icon={<Tag size={18} className="text-slate-600" />}
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

          {/* Step 5: Parties */}
          {step.key === 'seed-parties' && (
            <SeedTableStep
              collection="parties"
              title="Parties"
              subtitle="Customers and vendors — still editable after setup."
              seedKey="parties"
              seedLabel="Seed parties"
              icon={<UserPlus size={18} className="text-slate-600" />}
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

          {/* Step 6: Items */}
          {step.key === 'seed-items' && (
            <SeedTableStep
              collection="items"
              title="Items"
              subtitle="Stock items with rates — still editable after setup."
              seedKey="items"
              seedLabel="Seed items"
              icon={<Package size={18} className="text-slate-600" />}
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

          {/* Step 7: Members */}
          {step.key === 'seed-members' && (
            <SeedTableStep
              collection="members"
              title="Members"
              subtitle="Membership types plus sample members."
              seedKey="members"
              seedLabel="Seed members"
              icon={<Users size={18} className="text-slate-600" />}
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

          {/* Step 8: Opening Balances */}
          {step.key === 'openings' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm text-slate-700">
                Enter opening balances per account for the working year (cash, bank, receivables,
                payables…) on the <span className="font-semibold">Opening Balances</span> page.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/app/opening-balances')}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-2xs"
                >
                  Open Opening Balances
                </button>
                {!isViewer && (
                  <button
                    type="button"
                    onClick={() => {
                      setAiInitialModel('opening-balances')
                      setAiOpen(true)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    <Sparkles size={14} className="text-amber-500" />
                    <span>{t('ai.importOpenings', 'Import Opening Balances with AI')}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Footer: unified single action per step */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={busy !== '' || stepIdx === 0}
            onClick={() => setStepIdx((i) => Math.max(i - 1, 0))}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition"
          >
            <ArrowLeft size={14} /> <span>{t('setup.back', 'Back')}</span>
          </button>

          <div className="flex items-center gap-2">
            {/* AI helper shortcuts on specific steps */}
            {isAdmin && step.key === 'company' && (
              <button
                type="button"
                onClick={() => {
                  setAiInitialModel('company-profile')
                  setAiOpen(true)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <Sparkles size={13} className="text-amber-500" />
                <span>{t('ai.importCompanyProfile', 'Import Profile')}</span>
              </button>
            )}

            {/* Primary Action Button - ONE authoritative button */}
            {step.key === 'company' && (
              !isAdmin ? (
                <button
                  type="button"
                  onClick={() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900 transition shadow-2xs"
                >
                  <span>Next Step (View Only)</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {satisfied.company && (
                    <button
                      type="button"
                      onClick={() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                    >
                      <span>Continue without saving</span>
                      <ArrowRight size={13} className="text-slate-500" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void saveCompany()}
                    disabled={busy === 'company' || !settingsLoaded}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-crimson-600 px-4 py-2 text-xs font-semibold text-white hover:bg-crimson-700 disabled:opacity-60 transition shadow-2xs"
                  >
                    {busy === 'company' ? <Loader2 size={13} className="animate-spin" /> : null}
                    <span>Save & continue</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )
            )}

            {step.key === 'fiscalYear' && (
              <button
                type="button"
                onClick={() => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))}
                disabled={!satisfied.fiscalYear}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition shadow-2xs ${
                  satisfied.fiscalYear
                    ? 'bg-crimson-600 text-white hover:bg-crimson-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>{t('setup.next', 'Next Step')}</span>
                <ArrowRight size={14} />
              </button>
            )}

            {step.key.startsWith('seed-') && (
              <button
                type="button"
                onClick={() => {
                  if (!seedDone[step.key]) {
                    setSeedDone((p) => ({ ...p, [step.key]: true }))
                  }
                  setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition shadow-2xs ${
                  satisfied[step.key]
                    ? 'bg-crimson-600 text-white hover:bg-crimson-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>
                  {satisfied[step.key]
                    ? t('setup.nextStep', 'Next Step')
                    : t('setup.skipOrNext', 'Skip / Next')}
                </span>
                <ArrowRight size={14} />
              </button>
            )}

            {step.key === 'openings' && (
              <button
                type="button"
                onClick={finish}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-2xs"
              >
                <span>{t('setup.finish', 'Finish')}</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Completion Banner */}
      {REQUIRED_STEPS.every((s) => satisfied[s.key]) && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-900">
                Your books are ready — the required setup is complete.
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                All essential configurations have been applied. You can now post vouchers, manage inventory, and invite team members.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={finish}
            className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition shadow-2xs"
          >
            <span>Start using Billing</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Choice Modal for Next Step after Company Profile Save */}
      <SetupFlowChoiceModal
        open={showPostSaveChoiceModal}
        onClose={() => setShowPostSaveChoiceModal(false)}
        parentCompany={activeTenant}
        parentName={company.companyName}
        childCompanies={currentCompanySubCompanies}
        onContinueParent={() => {
          setShowPostSaveChoiceModal(false)
          setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
        }}
        onSelectChild={(child) => {
          setShowPostSaveChoiceModal(false)
          setTenantId(child.id)
          setStepIdx(0)
        }}
      />

      {/* SubCompany Modal */}
      <SubCompanyModal
        open={subCompanyModalOpen}
        editingSubCompany={editingSubCompany}
        subCompanyForm={subCompanyForm}
        setSubCompanyForm={setSubCompanyForm}
        subCompanyBusy={subCompanyBusy}
        subCompanyError={subCompanyError}
        onClose={() => {
          setSubCompanyModalOpen(false)
          setEditingSubCompany(null)
          setSubCompanyError('')
        }}
        onSubmit={saveSubCompany}
        activeTenantName={activeTenant?.name}
        existingSubCompanies={currentCompanySubCompanies}
      />

      {/* Parent Company Editor Modal */}
      <CompanyCreatorModal
        open={showCompanyCreator}
        isFirstCompany={false}
        editingCompany={editingCompany}
        formData={newCompany}
        setFormData={setNewCompany}
        creating={creatingCompany}
        error={companyCreatorError}
        parentCompanies={parentCompanies}
        onClose={() => {
          setShowCompanyCreator(false)
          setEditingCompany(null)
          setCompanyCreatorError('')
        }}
        onSubmit={handleCreateParentCompany}
      />

      {/* AI Workspace Modal */}
      <AIWorkspaceModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        initialModel={aiInitialModel ?? undefined}
        onImported={() => {
          setAiOpen(false)
          bumpGlobals()
          void refreshYears()
        }}
      />
    </div>
  )
}
