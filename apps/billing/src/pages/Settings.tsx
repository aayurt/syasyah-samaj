import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  FolderTree,
  GripVertical,
  Hash,
  HelpCircle,
  Lock,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  ToggleLeft,
  Trash2,
  Unlock,
  Wallet,
  X,
  Type,
  CalendarDays,
} from 'lucide-react'
import { api, fmt, protectGlobalsFields, useSyncState } from '../lib/api'
import { authClient, clearCachedSession } from '../lib/auth'
import { adToBsString, formatDate } from '../lib/nepaliDate'
import { useCalendar } from '../lib/calendar'
import { useFiscalYear } from '../lib/fiscalYear'
import { useTenant } from '../lib/tenant'
import { pushToast } from '../lib/toast'
import type { Account, AccountGroup, AccountType, BillingSettings, FiscalYear } from '../lib/types'
import { useLang, useT } from '../lib/i18n'
import NepaliDateInput from '../components/NepaliDateInput'
import AccountSelect from '../components/AccountSelect'
import SearchSelect from '../components/SearchSelect'

/* ─── Language toggle ──────────────────────────────────────── */
function LanguageToggle() {
  const { lang, setLang } = useLang()
  const t = useT()
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {(['en', 'ne'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
              lang === l
                ? 'border-crimson-600 bg-crimson-50 ring-1 ring-crimson-600'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                lang === l ? 'border-crimson-600 bg-crimson-600' : 'border-slate-300'
              }`}
            >
              {lang === l && <Check size={12} className="text-white" />}
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900">
                {l === 'en' ? 'English' : 'नेपाली'}
              </div>
              <div className="text-xs text-slate-400">
                {l === 'en' ? 'English' : 'नेपाली (Devanagari)'}
              </div>
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        {t('hint.langDescription')}{' '}
        <span className="font-medium">{t('hint.langDataStays')}</span> — {t('hint.langOnlyLabels')}
      </p>
    </div>
  )
}

/* ─── Accordion wrapper ────────────────────────────────────── */
function Section({
  title,
  subtitle,
  icon: Icon,
  open,
  onToggle,
  children,
  hasChanges,
  saved,
  onSave,
  onCancel,
}: {
  title: string
  subtitle?: string
  icon: React.ElementType
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  hasChanges?: boolean
  saved?: boolean
  onSave?: () => void
  onCancel?: () => void
}) {
  const t = useT()
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <Icon size={16} className="shrink-0 text-slate-400" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-700">{title}</div>
          {subtitle && (
            <div className="text-xs text-slate-400 truncate">{subtitle}</div>
          )}
        </div>

        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          {children}
          {onSave && (
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <div className="mr-auto flex items-center gap-2">
                {saved && <span className="text-sm text-emerald-600">{t('msg.saved')}</span>}
                {hasChanges && !saved && (
                  <span className="text-sm text-amber-500">{t('msg.unsaved')}</span>
                )}
              </div>
              {onCancel && hasChanges && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded px-4 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
                >
                  {t('common.cancel')}
                </button>
              )}
              <button
                type="button"
                onClick={onSave}
                disabled={!hasChanges}
                className="rounded bg-crimson-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('common.save')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Constants ────────────────────────────────────────────── */
// Document type options for number series.
// Duplicated from src/collections/DocSequences/index.ts (DOC_TYPE_OPTIONS).
// Keep in sync with the backend source.
const DOC_TYPE_OPTIONS = [
  { label: 'Sales Invoice', value: 'sales-invoice' },
  { label: 'Purchase Invoice', value: 'purchase-invoice' },
  { label: 'Receipt Voucher', value: 'receipt-voucher' },
  { label: 'Payment Voucher', value: 'payment-voucher' },
  { label: 'Journal Voucher', value: 'journal-voucher' },
  { label: 'Contra Voucher', value: 'contra-voucher' },
  { label: 'Credit Note', value: 'credit-note' },
  { label: 'Debit Note', value: 'debit-note' },
  { label: 'GRN', value: 'grn' },
  { label: 'Delivery Challan', value: 'delivery-challan' },
]

const ACCOUNT_FIELDS: { key: keyof BillingSettings; label: string }[] = [
  { key: 'receivableAccount', label: 'Accounts Receivable' },
  { key: 'payableAccount', label: 'Accounts Payable' },
  { key: 'revenueAccount', label: 'Sales Revenue' },
  { key: 'expenseAccount', label: 'Purchases / Expense' },
  { key: 'taxAccount', label: 'Output / Input Tax' },
  { key: 'cashAccount', label: 'Cash' },
  { key: 'bankAccount', label: 'Bank (default)' },
  { key: 'pettyCashAccount', label: 'Petty Cash' },
  { key: 'inventoryAccount', label: 'Inventory' },
  { key: 'cogsAccount', label: 'Cost of Goods Sold' },
  { key: 'returnsAccount', label: 'Sales / Purchase Returns' },
  { key: 'accruedPayableAccount', label: 'Accrued Payables' },
  { key: 'depreciationAccount', label: 'Depreciation Expense' },
  { key: 'accumulatedDepreciationAccount', label: 'Accumulated Depreciation' },
]

const inputCls =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 h-[38px]'

/* ─── Component ────────────────────────────────────────────── */
export default function Settings() {
  const { cacheVersion } = useSyncState()
  const t = useT()
  const [settings, setSettings] = useState<BillingSettings | null>(null)
  const loaded = useRef(false)
  const navigate = useNavigate()
  const { update: updateCalendar } = useCalendar()
  const { tenantId } = useTenant()

  // Accordion open state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    calendar: true,
  })
  const toggle = (s: string) =>
    setOpenSections((p) => ({ ...p, [s]: !p[s] }))

  // ── Calendar state ──
  const [calendarType, setCalendarType] = useState<'AD' | 'BS'>('BS')
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD')
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')
  const savedCalendar = useRef({ calendarType: 'BS', dateFormat: 'YYYY-MM-DD', timeFormat: '12h' })
  const calDirty =
    calendarType !== savedCalendar.current.calendarType ||
    dateFormat !== savedCalendar.current.dateFormat ||
    timeFormat !== savedCalendar.current.timeFormat
  const [calSaved, setCalSaved] = useState(false)


  // ── Company state ──
  const [companyName, setCompanyName] = useState('')
  const [companyPan, setCompanyPan] = useState('')
  const [companyContact, setCompanyContact] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyLogo, setCompanyLogo] = useState('')
  const savedCompany = useRef({ name: '', pan: '', contact: '', email: '', address: '', logo: '' })
  const companyDirty =
    companyName !== savedCompany.current.name ||
    companyPan !== savedCompany.current.pan ||
    companyContact !== savedCompany.current.contact ||
    companyEmail !== savedCompany.current.email ||
    companyAddress !== savedCompany.current.address ||
    companyLogo !== savedCompany.current.logo
  const [companySaved, setCompanySaved] = useState(false)


  // ── Fiscal year state (managed as a list, Manager.io-style) ──
  const {
    years: fiscalYears,
    selectedYear: selectedFiscalYear,
    activeYear: activeFiscalYear,
    selectYear: selectFiscalYear,
    loading: fiscalLoading,
    refresh: refreshFiscalYears,
  } = useFiscalYear()
  const [fyModalOpen, setFyModalOpen] = useState(false)
  const [fySaving, setFySaving] = useState(false)
  const [fyEditing, setFyEditing] = useState<number | null>(null)
  const [fyForm, setFyForm] = useState({
    label: '',
    startDate: '',
    endDate: '',
    status: 'active' as 'active' | 'closed',
    makeActive: false,
  })
  // Shared confirmation/validation modal for fiscal-year state changes
  // (close / open / set-as-working). Enforces the single-active rule with an
  // explicit warning instead of a raw window.confirm.
  const [fyConfirm, setFyConfirm] = useState<{
    action: 'close' | 'open' | 'working'
    year: FiscalYear
    swap?: FiscalYear
    swapIsWorking?: boolean
  } | null>(null)
  // Reset the form every time the modal opens — the webview survives window
  // close (hide-to-tray) and modal cancels, so stale input must be cleared here.
  const openFyModal = () => {
    setFyForm({ label: '', startDate: '', endDate: '', status: 'active', makeActive: false })
    setFyEditing(null)
    setFyModalOpen(true)
  }
  const openFyEdit = (year: FiscalYear) => {
    setFyForm({
      label: year.label || '',
      startDate: (year.startDate || '').slice(0, 10),
      endDate: (year.endDate || '').slice(0, 10),
      status: year.status === 'closed' ? 'closed' : 'active',
      makeActive: !!year.isActive,
    })
    setFyEditing(year.id)
    setFyModalOpen(true)
  }


  // ── Feature toggles ──
  const [bankRecEnabled, setBankRecEnabled] = useState(false)
  const [simplifiedInvEnabled, setSimplifiedInvEnabled] = useState(true)
  const [simplifiedInvThreshold, setSimplifiedInvThreshold] = useState('5000')
  const [demoSeedEnabled, setDemoSeedEnabled] = useState(true)
  const savedFeatures = useRef({ bankRec: false, simplifiedInv: true, threshold: '5000', demoSeed: true })
  const featuresDirty =
    bankRecEnabled !== savedFeatures.current.bankRec ||
    simplifiedInvEnabled !== savedFeatures.current.simplifiedInv ||
    simplifiedInvThreshold !== savedFeatures.current.threshold ||
    demoSeedEnabled !== savedFeatures.current.demoSeed
  const [featuresSaved, setFeaturesSaved] = useState(false)


  // ── Chart of Accounts ──
  const [coaAccounts, setCoaAccounts] = useState<Account[]>([])
  const [coaGroups, setCoaGroups] = useState<AccountGroup[]>([])
  const [coaLoading, setCoaLoading] = useState(false)
  const [coaBalances, setCoaBalances] = useState<Record<number, number>>({})
  const [coaExpanded, setCoaExpanded] = useState<Record<number, boolean>>({})
  const [coaForm, setCoaForm] = useState({ name: '', code: '', type: 'asset' as AccountType, class: 'other', group: '' })
  const [coaSaving, setCoaSaving] = useState(false)
  const [showCoaForm, setShowCoaForm] = useState(false)
  const [coaEditingId, setCoaEditingId] = useState<number | null>(null)

  const openCoaNew = () => {
    setCoaForm({ name: '', code: '', type: 'asset', class: 'other', group: '' })
    setCoaEditingId(null)
    setShowCoaForm(true)
  }

  const openCoaEdit = (a: Account) => {
    setCoaForm({
      name: a.name,
      code: a.code || '',
      type: a.type,
      class: a.class || 'other',
      group: a.group && typeof a.group === 'object' ? String(a.group.id) : a.group ? String(a.group) : '',
    })
    setCoaEditingId(a.id)
    setShowCoaForm(true)
  }

  // ── Default account assignments (editable) ──
  const [defAccounts, setDefAccounts] = useState<Record<string, string>>({})
  const savedDefAccounts = useRef<Record<string, string>>({})
  const [defAccountOrder, setDefAccountOrder] = useState<string[]>(ACCOUNT_FIELDS.map((f) => f.key))
  const savedDefAccountOrder = useRef<string[]>(ACCOUNT_FIELDS.map((f) => f.key))
  const defAccountsDirty = JSON.stringify(defAccounts) !== JSON.stringify(savedDefAccounts.current) || JSON.stringify(defAccountOrder) !== JSON.stringify(savedDefAccountOrder.current)
  const [defAccountsSaved, setDefAccountsSaved] = useState(false)

  // ── Doc sequences ──
  // Full series records (docType, prefix, fiscalYearId, name, key, lastNumber, id).
  // Used by the Number Series card for add/edit/delete.
  const [sequences, setSequences] = useState<{
    id: number
    key: string
    name: string
    docType: string
    prefix: string
    fiscalYearId: number | null
    fiscalYearLabel?: string | null
    lastNumber: number
  }[]>([])
  const [resetKey, setResetKey] = useState('')
  const [resetValue, setResetValue] = useState('')
  const [resetting, setResetting] = useState(false)

  // ── Series form (add/edit modal) ──
  const [seriesModalOpen, setSeriesModalOpen] = useState(false)
  const [seriesEditingId, setSeriesEditingId] = useState<number | null>(null)
  const [seriesSaving, setSeriesSaving] = useState(false)
  const [seriesForm, setSeriesForm] = useState({
    docType: '',
    prefix: '',
    fiscalYearId: '' as string,
  })

  const openSeriesNew = () => {
    setSeriesForm({ docType: '', prefix: '', fiscalYearId: '' })
    setSeriesEditingId(null)
    setSeriesModalOpen(true)
  }

  const openSeriesEdit = (s: (typeof sequences)[0]) => {
    setSeriesForm({
      docType: s.docType,
      prefix: s.prefix,
      fiscalYearId: s.fiscalYearId ? String(s.fiscalYearId) : '',
    })
    setSeriesEditingId(s.id)
    setSeriesModalOpen(true)
  }

  const closeSeriesModal = () => {
    setSeriesModalOpen(false)
    setSeriesEditingId(null)
  }

  const seriesSave = async () => {
    if (!seriesForm.docType) {
      pushToast('error', 'Missing doc type', 'Select a document type for the series.')
      return
    }
    setSeriesSaving(true)
    try {
      const body: Record<string, unknown> = {
        docType: seriesForm.docType,
        prefix: seriesForm.prefix || undefined,
      }
      if (seriesForm.fiscalYearId) body.fiscalYear = Number(seriesForm.fiscalYearId)

      if (seriesEditingId != null) {
        // ── EDIT ──
        await api(`/doc-sequences/${seriesEditingId}`, { method: 'PATCH', body })
        pushToast('success', 'Series updated', DOC_TYPE_OPTIONS.find((o) => o.value === seriesForm.docType)?.label || seriesForm.docType)
      } else {
        // ── CREATE ──
        await api('/doc-sequences', { method: 'POST', body })
        pushToast('success', 'Series created', DOC_TYPE_OPTIONS.find((o) => o.value === seriesForm.docType)?.label || seriesForm.docType)
      }
      closeSeriesModal()
      await loadSequences()
      window.dispatchEvent(new Event('billing-settings-changed'))
    } catch (err) {
      pushToast('error', seriesEditingId != null ? 'Failed to update series' : 'Failed to create series', err instanceof Error ? err.message : String(err))
    } finally {
      setSeriesSaving(false)
    }
  }

  const seriesDelete = async (s: (typeof sequences)[0]) => {
    if (s.lastNumber > 0) {
      pushToast('error', 'Cannot delete', 'Documents already posted using this series.')
      return
    }
    if (!window.confirm(`Delete series "${s.name}"? This cannot be undone.`)) return
    try {
      await api(`/doc-sequences/${s.id}`, { method: 'DELETE' })
      pushToast('success', 'Series deleted', s.name)
      await loadSequences()
      window.dispatchEvent(new Event('billing-settings-changed'))
    } catch (err) {
      pushToast('error', 'Failed to delete series', err instanceof Error ? err.message : String(err))
    }
  }

  // ── Error ──
  const [error, setError] = useState('')

  /* ── Load ── */
  const load = async () => {
    try {
      const res = await api<BillingSettings>('/globals/billing-settings', {
        query: { depth: 1 },
      })
      setSettings(res)
      const ct = res.calendarType || 'BS'
      const df = res.dateFormat || 'YYYY-MM-DD'
      const tf = res.timeFormat || '12h'
      setCalendarType(ct)
      setDateFormat(df)
      setTimeFormat(tf)
      savedCalendar.current = { calendarType: ct, dateFormat: df, timeFormat: tf }

      const cn = res.companyName || ''
      const cp = res.companyPan || ''
      const cc = res.companyContact || ''
      const ce = res.companyEmail || ''
      const ca = res.companyAddress || ''
      const cl = res.companyLogo || ''
      setCompanyName(cn)
      setCompanyPan(cp)
      setCompanyContact(cc)
      setCompanyEmail(ce)
      setCompanyAddress(ca)
      setCompanyLogo(cl)
      savedCompany.current = { name: cn, pan: cp, contact: cc, email: ce, address: ca, logo: cl }

      const br = res.bankReconciliationEnabled || false
      const si = res.simplifiedInvoiceEnabled !== false
      const st = String(res.simplifiedInvoiceThreshold || 5000)
      const ds = res.demoSeedEnabled !== false
      setBankRecEnabled(br)
      setSimplifiedInvEnabled(si)
      setSimplifiedInvThreshold(st)
      setDemoSeedEnabled(ds)
      savedFeatures.current = { bankRec: br, simplifiedInv: si, threshold: st, demoSeed: ds }

      // Default account assignments
      const da: Record<string, string> = {}
      for (const f of ACCOUNT_FIELDS) {
        const v = res[f.key]
        da[f.key] = v && typeof v === 'object' ? String((v as any).id) : v ? String(v) : ''
      }
      setDefAccounts(da)
      savedDefAccounts.current = { ...da }
      // Restore saved order if present
      const savedOrder = res.defAccountOrder as string[] | undefined
      if (savedOrder && Array.isArray(savedOrder)) {
        setDefAccountOrder(savedOrder)
        savedDefAccountOrder.current = [...savedOrder]
      }

      loaded.current = true
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    }
  }

  const loadSequences = async () => {
    try {
      const res = await api<{
        docs: {
          id: number
          key: string
          name: string
          docType: string
          prefix: string
          fiscalYear?: number | { id: number; label?: string | null } | null
          lastNumber: number
        }[]
      }>('/doc-sequences', { query: { limit: 100, sort: 'key', depth: 1 } })
      const docs = res.docs || []
      setSequences(
        docs.map((d) => ({
          id: d.id,
          key: d.key,
          name: d.name || d.key,
          docType: d.docType || '',
          prefix: d.prefix || '',
          fiscalYearId: d.fiscalYear && typeof d.fiscalYear === 'object' ? d.fiscalYear.id : typeof d.fiscalYear === 'number' ? d.fiscalYear : null,
          fiscalYearLabel:
            d.fiscalYear && typeof d.fiscalYear === 'object' ? d.fiscalYear.label ?? null : null,
          lastNumber: d.lastNumber,
        })),
      )
    } catch { /* non-critical */ }
  }

  const loadCoa = async () => {
    setCoaLoading(true)
    try {
      const [a, g, b] = await Promise.all([
        api<{ docs: Account[] }>('/gl-accounts', { query: { depth: 1, sort: 'name', limit: 500 } }),
        api<{ docs: AccountGroup[] }>('/account-groups', { query: { depth: 0, sort: 'name', limit: 100 } }),
        api<{ docs: { account: { id: number }; balance: number }[] }>('/gl-accounts/balances', { query: { depth: 0, limit: 500 } }),
      ])
      setCoaAccounts(a.docs || [])
      setCoaGroups(g.docs || [])
      setCoaBalances(Object.fromEntries((b.docs || []).map((x) => [x.account.id, x.balance])))
    } catch { /* non-critical */ } finally { setCoaLoading(false) }
  }

  // Re-read when a background flush changes cached rows (a newly created
  // account/year gets its real server id) so tables never keep stale
  // `local-*` ids. Reads are cache-first, so this is cheap when nothing
  // changed and cannot loop.
  useEffect(() => {
    load()
    loadSequences()
    loadCoa()
  }, [cacheVersion])

  // Default groups to expanded once they first load; user collapses persist.
  useEffect(() => {
    if (coaGroups.length === 0) return
    setCoaExpanded((prev) => {
      const next = { ...prev }
      for (const g of coaGroups) if (!(g.id in prev)) next[g.id] = true
      return next
    })
  }, [coaGroups])

  /* ── Persist helpers ── */
  const persistCalendar = () => {
    const body = { calendarType, dateFormat, timeFormat }
    try {
      const cached = JSON.parse(localStorage.getItem('billing.settingsCache') || '{}')
      localStorage.setItem(
        'billing.settingsCache',
        JSON.stringify({ data: { ...(cached.data || {}), ...body }, ts: Date.now() }),
      )
      window.dispatchEvent(new Event('billing-settings-changed'))
      updateCalendar({ calendarType, dateFormat, timeFormat })
      protectGlobalsFields(['calendarType', 'dateFormat', 'timeFormat'])
    } catch { /* ignore */ }
    savedCalendar.current = { calendarType, dateFormat, timeFormat }
    setCalSaved(true)
    setTimeout(() => setCalSaved(false), 2000)
    // Fire-and-forget: sync to server in background
    api('/globals/billing-settings', { method: 'POST', body }).catch(() => {})
  }

  const cancelCalendar = () => {
    setCalendarType(savedCalendar.current.calendarType as 'AD' | 'BS')
    setDateFormat(savedCalendar.current.dateFormat)
    setTimeFormat(savedCalendar.current.timeFormat as '12h' | '24h')
  }

  const persistCompany = () => {
    const body = { companyName, companyPan, companyContact, companyEmail, companyAddress, companyLogo }
    try {
      const cached = JSON.parse(localStorage.getItem('billing.settingsCache') || '{}')
      localStorage.setItem(
        'billing.settingsCache',
        JSON.stringify({ data: { ...(cached.data || {}), ...body }, ts: Date.now() }),
      )
      window.dispatchEvent(new Event('billing-settings-changed'))
      protectGlobalsFields(Object.keys(body))
    } catch { /* ignore */ }
    savedCompany.current = {
      name: companyName,
      pan: companyPan,
      contact: companyContact,
      email: companyEmail,
      address: companyAddress,
      logo: companyLogo,
    }
    setCompanySaved(true)
    setTimeout(() => setCompanySaved(false), 2000)
    // Fire-and-forget: sync to server in background
    api('/globals/billing-settings', { method: 'POST', body }).catch(() => {})
  }

  const cancelCompany = () => {
    const s = savedCompany.current
    setCompanyName(s.name)
    setCompanyPan(s.pan)
    setCompanyContact(s.contact)
    setCompanyEmail(s.email)
    setCompanyAddress(s.address)
    setCompanyLogo(s.logo)
  }

  // ── Fiscal year actions ──
  // All state-changing actions funnel through a validation modal (fyConfirm)
  // so the single-active rule is surfaced before anything happens.

  const fyClose = (year: FiscalYear) => {
    setFyConfirm({ action: 'close', year })
  }

  const fyReopen = (year: FiscalYear) => {
    // Only one fiscal year may be open at a time — if another is already
    // open, reopening this one closes that other year.
    const alreadyOpen = fiscalYears.find(
      (y) => y.status === 'active' && y.id !== year.id,
    )
    setFyConfirm({
      action: 'open',
      year,
      swap: alreadyOpen,
      swapIsWorking: activeFiscalYear?.id === alreadyOpen?.id,
    })
  }

  const fySetActive = (year: FiscalYear) => {
    // Only an open (status 'active') year may become the working year.
    if (year.status === 'closed') {
      pushToast(
        'error',
        'Cannot set working year',
        `${year.label} is closed. Only an open fiscal year can be the working year — reopen it first.`,
      )
      return
    }
    // If another year is already active, confirm closing it first.
    const otherActive = fiscalYears.find(
      (y) => y.status === 'active' && y.id !== year.id,
    )
    if (otherActive) {
      setFyConfirm({
        action: 'working',
        year,
        swap: otherActive,
        swapIsWorking: activeFiscalYear?.id === otherActive.id,
      })
      return
    }
    fyDoSetWorking(year)
  }

  const fyCloseNow = (year: FiscalYear) => {
    api(`/fiscal-years/${year.id}`, {
      method: 'PATCH',
      body: { status: 'closed' },
    })
      .then(() => {
        pushToast('success', 'Fiscal year closed', `${year.label} — entries are now read-only.`)
        void refreshFiscalYears()
      })
      .catch((err) => pushToast('error', 'Failed to close year', err instanceof Error ? err.message : String(err)))
  }

  const fyOpenNow = (year: FiscalYear) => {
    api(`/fiscal-years/${year.id}`, {
      method: 'PATCH',
      body: { status: 'active' },
    })
      .then(() => {
        pushToast('success', 'Fiscal year opened', `${year.label} — entries are editable again.`)
        void refreshFiscalYears()
      })
      .catch((err) => pushToast('error', 'Failed to open year', err instanceof Error ? err.message : String(err)))
  }

  const fyDoSetWorking = (year: FiscalYear) => {
    api(`/fiscal-years/${year.id}`, {
      method: 'PATCH',
      body: { isActive: true },
    })
      .then(async () => {
        // Also point billing-settings at the new working year so numbering
        // and the period freeze follow the selection.
        await api('/globals/billing-settings', {
          method: 'POST',
          body: { activeFiscalYear: year.id },
        }).catch(() => {})
        selectFiscalYear(year.id)
        pushToast('success', 'Working year set', `${year.label} is now the active fiscal year.`)
        void refreshFiscalYears()
      })
      .catch((err) => pushToast('error', 'Failed to set working year', err instanceof Error ? err.message : String(err)))
  }

  const fyConfirmGo = async () => {
    if (!fyConfirm) return
    const { action, year, swap } = fyConfirm
    setFyConfirm(null)
    // When opening/setting a year requires closing the currently open one,
    // close that other year first, then perform the requested action.
    if (swap && (action === 'open' || action === 'working')) {
      try {
        await api(`/fiscal-years/${swap.id}`, {
          method: 'PATCH',
          body: { status: 'closed' },
        })
      } catch {
        // best-effort — the action below still runs
      }
    }
    if (action === 'close') fyCloseNow(year)
    else if (action === 'open') fyOpenNow(year)
    else fyDoSetWorking(year)
  }

  const fyDelete = (year: FiscalYear) => {
    // Queued to the offline outbox — flushes on reconnect when offline.
    api(`/fiscal-years/${year.id}`, { method: 'DELETE' })
      .then(() => {
        pushToast('success', 'Fiscal year deleted', String(year.label || year.id))
        void refreshFiscalYears()
      })
      .catch((err) => pushToast('error', 'Failed to delete year', err instanceof Error ? err.message : String(err)))
  }

  const fySave = async () => {
    if (!fyForm.startDate || !fyForm.endDate) {
      pushToast('error', 'Missing dates', 'Both start and end date are required.')
      return
    }
    // A closed year cannot be the working year — override makeActive if so.
    const makeActive = fyForm.status === 'active' && fyForm.makeActive
    setFySaving(true)
    try {
      // Auto-generate a BS label (e.g. "2083-84") from the AD start date when
      // the user left the label blank.
      let label = fyForm.label.trim()
      if (!label && fyForm.startDate) {
        const bs = adToBsString(fyForm.startDate)
        const bsYear = Number(bs.slice(0, 4)) || 0
        if (bsYear) label = `${bsYear}-${String((bsYear + 1) % 100).padStart(2, '0')}`
      }
      const body: Record<string, unknown> = {
        label: label || undefined,
        startDate: fyForm.startDate,
        endDate: fyForm.endDate,
        status: fyForm.status,
        isActive: makeActive,
      }
      // If making this the active year, close any other active year first.
      if (makeActive) {
        const otherActive = fiscalYears.find(
          (y) => y.status === 'active' && y.id !== activeFiscalYear?.id,
        )
        if (otherActive) {
          await api(`/fiscal-years/${otherActive.id}`, {
            method: 'PATCH',
            body: { status: 'closed' },
          }).catch(() => {})
        }
      }
      if (fyEditing) {
        // ── EDIT ──
        await api(`/fiscal-years/${fyEditing}`, { method: 'PATCH', body })
        if (makeActive) {
          await api('/globals/billing-settings', {
            method: 'POST',
            body: { activeFiscalYear: fyEditing },
          }).catch(() => {})
        }
        pushToast('success', 'Fiscal year updated', fyForm.label || fyForm.startDate)
      } else {
        // ── CREATE ──
        if (tenantId) body.tenant = Number(tenantId)
        await api('/fiscal-years', { method: 'POST', body })
        pushToast('success', 'Fiscal year created', fyForm.label || fyForm.startDate)
        if (makeActive) {
          const res = await api<{ docs: FiscalYear[] }>('/fiscal-years', {
            query: { limit: 1, depth: 0, sort: '-startDate', where: JSON.stringify({ startDate: { equals: fyForm.startDate } }) },
          })
          const created = res.docs?.[0]
          if (created) {
            await api('/globals/billing-settings', {
              method: 'POST',
              body: { activeFiscalYear: created.id },
            }).catch(() => {})
          }
        }
      }
      setFyModalOpen(false)
      setFyForm({ label: '', startDate: '', endDate: '', status: 'active', makeActive: false })
      setFyEditing(null)
      void refreshFiscalYears()
    } catch (err) {
      pushToast('error', fyEditing ? 'Failed to update fiscal year' : 'Failed to create fiscal year', err instanceof Error ? err.message : String(err))
    } finally {
      setFySaving(false)
    }
  }

  const persistFeatures = () => {
    const body = {
      bankReconciliationEnabled: bankRecEnabled,
      simplifiedInvoiceEnabled: simplifiedInvEnabled,
      simplifiedInvoiceThreshold: parseFloat(simplifiedInvThreshold) || 5000,
      demoSeedEnabled,
    }
    try {
      const cached = JSON.parse(localStorage.getItem('billing.settingsCache') || '{}')
      localStorage.setItem(
        'billing.settingsCache',
        JSON.stringify({ data: { ...(cached.data || {}), ...body }, ts: Date.now() }),
      )
      window.dispatchEvent(new Event('billing-settings-changed'))
      protectGlobalsFields(Object.keys(body))
    } catch { /* ignore */ }
    savedFeatures.current = { bankRec: bankRecEnabled, simplifiedInv: simplifiedInvEnabled, threshold: simplifiedInvThreshold, demoSeed: demoSeedEnabled }
    setFeaturesSaved(true)
    setTimeout(() => setFeaturesSaved(false), 2000)
    // Fire-and-forget: sync to server in background
    api('/globals/billing-settings', { method: 'POST', body }).catch(() => {})
  }

  const cancelFeatures = () => {
    const s = savedFeatures.current
    setBankRecEnabled(s.bankRec)
    setSimplifiedInvEnabled(s.simplifiedInv)
    setSimplifiedInvThreshold(s.threshold)
    setDemoSeedEnabled(s.demoSeed)
  }

  // ── Default account assignments ──
  const persistDefAccounts = () => {
    // Build body with proper types: numbers for relationships, null to clear
    const body: Record<string, unknown> = { defAccountOrder: defAccountOrder }
    for (const f of ACCOUNT_FIELDS) {
      const val = defAccounts[f.key]
      body[f.key] = val ? Number(val) : null
    }
    try {
      const cached = JSON.parse(localStorage.getItem('billing.settingsCache') || '{}')
      localStorage.setItem(
        'billing.settingsCache',
        JSON.stringify({ data: { ...(cached.data || {}), ...body }, ts: Date.now() }),
      )
      window.dispatchEvent(new Event('billing-settings-changed'))
      protectGlobalsFields(Object.keys(body))
    } catch { /* ignore */ }
    savedDefAccounts.current = { ...defAccounts }
    savedDefAccountOrder.current = [...defAccountOrder]
    setDefAccountsSaved(true)
    setTimeout(() => setDefAccountsSaved(false), 2000)
    api('/globals/billing-settings', { method: 'POST', body }).catch(() => {})
  }

  const cancelDefAccounts = () => {
    setDefAccounts({ ...savedDefAccounts.current })
    setDefAccountOrder([...savedDefAccountOrder.current])
  }

  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const onDragStart = (idx: number) => {
    setDragIdx(idx)
  }

  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setOverIdx(idx)
  }

  const onDragEnd = () => {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      setDefAccountOrder((prev) => {
        const next = [...prev]
        const [moved] = next.splice(dragIdx, 1)
        next.splice(overIdx, 0, moved)
        return next
      })
    }
    setDragIdx(null)
    setOverIdx(null)
  }

  const onDragLeave = () => {
    setOverIdx(null)
  }

  // ── Chart of Accounts CRUD ──
  const saveCoaAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setCoaSaving(true)
    try {
      const body = {
        name: coaForm.name,
        code: coaForm.code || undefined,
        type: coaForm.type,
        class: coaForm.class,
        group: coaForm.group ? Number(coaForm.group) : undefined,
      }
      if (coaEditingId != null) {
        await api(`/gl-accounts/${coaEditingId}`, { method: 'PATCH', body })
      } else {
        await api('/gl-accounts', { method: 'POST', body })
      }
      setCoaForm({ name: '', code: '', type: 'asset', class: 'other', group: '' })
      setCoaEditingId(null)
      setShowCoaForm(false)
      await loadCoa()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save account')
    }
    setCoaSaving(false)
  }

  const removeCoaAccount = async (id: number) => {
    if (!window.confirm('Delete this account?')) return
    try {
      await api(`/gl-accounts/${id}`, { method: 'DELETE' })
      await loadCoa()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
    }
  }

  const accountName = (v: BillingSettings[keyof BillingSettings]) =>
    v && typeof v === 'object' ? (v as Account).name : '—'

  // Nested tree: type → group → sub-group → accounts.
  interface CoaGroupNode {
    group: AccountGroup
    children: CoaGroupNode[]
    accounts: Account[]
  }
  const coaTreeFor = (type: AccountType): { roots: CoaGroupNode[]; ungrouped: Account[] } => {
    const accountsByGroup = new Map<number, Account[]>()
    const ungrouped: Account[] = []
    for (const a of coaAccounts) {
      if (a.type !== type) continue
      const gid = a.group && typeof a.group === 'object' ? a.group.id : Number(a.group)
      if (gid && !Number.isNaN(gid)) {
        const arr = accountsByGroup.get(gid) ?? []
        arr.push(a)
        accountsByGroup.set(gid, arr)
      } else {
        ungrouped.push(a)
      }
    }
    const childrenByParent = new Map<number, AccountGroup[]>()
    const roots: AccountGroup[] = []
    for (const g of coaGroups) {
      if (g.type !== type) continue
      const pid = g.parent && typeof g.parent === 'object' ? g.parent.id : Number(g.parent || 0)
      if (pid && !Number.isNaN(pid)) {
        const arr = childrenByParent.get(pid) ?? []
        arr.push(g)
        childrenByParent.set(pid, arr)
      } else {
        roots.push(g)
      }
    }
    const build = (g: AccountGroup): CoaGroupNode => ({
      group: g,
      children: (childrenByParent.get(g.id) ?? [])
        .map(build)
        .sort((x, y) => x.group.name.localeCompare(y.group.name)),
      accounts: (accountsByGroup.get(g.id) ?? []).sort((x, y) => x.name.localeCompare(y.name)),
    })
    ungrouped.sort((x, y) => x.name.localeCompare(y.name))
    return { roots: roots.map(build).sort((x, y) => x.group.name.localeCompare(y.group.name)), ungrouped }
  }

  const countCoaAccounts = (node: CoaGroupNode): number =>
    node.accounts.length + node.children.reduce((n, c) => n + countCoaAccounts(c), 0)

  const toggleCoaGroup = (id: number) => setCoaExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  /* ── Calendar summary ── */
  const calSummary = `${calendarType} • ${dateFormat} • ${timeFormat === '12h' ? '12h' : '24h'}`

  return (
    <div data-tour="settings" className="mx-auto max-w-4xl space-y-3">
      <h1 className="text-lg font-semibold text-slate-900">{t('settings.pageTitle')}</h1>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* ── 1. Calendar ──────────────────────────────────────── */}
      <Section
        title={t('settings.calendar')}
        subtitle={calSummary}
        icon={Calendar}
        open={!!openSections.calendar}
        onToggle={() => toggle('calendar')}
        hasChanges={calDirty}
        saved={calSaved}
        onSave={() => void persistCalendar()}
        onCancel={cancelCalendar}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-slate-600">{t('cal.type')}</span>
          <div className="flex gap-2">
            {(['AD', 'BS'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setCalendarType(t)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ring-1 ring-inset ${
                  calendarType === t
                    ? 'bg-crimson-600 text-white ring-crimson-600'
                    : 'bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-slate-600">{t('cal.dateFormat')}</label>
            <div className="mt-1">
              <SearchSelect
                value={dateFormat}
                onChange={setDateFormat}
                options={[
                  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                  { value: 'YYYY/MM/DD', label: 'YYYY/MM/DD' },
                  { value: 'DD MMMM YYYY', label: 'DD MMMM YYYY', sublabel: '15 Asar 2083' },
                  { value: 'MMMM DD, YYYY', label: 'MMMM DD, YYYY' },
                  { value: 'DD MMM YYYY', label: 'DD MMM YYYY' },
                ]}
              />
            </div>
            <div className="mt-2 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="text-xs text-slate-400">{t('cal.preview')}: </span>
              <span className="font-medium">
                {formatDate(new Date().toISOString(), calendarType, dateFormat)}
              </span>
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-600">{t('cal.timeFormat')}</label>
            <div className="mt-1">
              <SearchSelect
                value={timeFormat}
                onChange={(v) => setTimeFormat(v as '12h' | '24h')}
                options={[
                  { value: '12h', label: t('cal.h12'), sublabel: '1:30 PM' },
                  { value: '24h', label: t('cal.h24'), sublabel: '13:30' },
                ]}
              />
            </div>
            <div className="mt-2 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="text-xs text-slate-400">{t('cal.preview')}: </span>
              <span className="font-medium">
                {formatDate(new Date().toISOString(), calendarType, 'HH:mm', timeFormat)}
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 2. Company Profile ───────────────────────────────── */}
      <Section
        title={t('settings.companyProfile')}
        subtitle={companyName || t('hint.company')}
        icon={Building2}
        open={!!openSections.company}
        onToggle={() => toggle('company')}
        hasChanges={companyDirty}
        saved={companySaved}
        onSave={() => void persistCompany()}
        onCancel={cancelCompany}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm text-slate-600">{t('settings.companyName')}</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Syasyah Samaj"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">{t('settings.panNumber')}</label>
            <input
              type="text"
              value={companyPan}
              onChange={(e) => setCompanyPan(e.target.value)}
              placeholder="e.g. 123456789"
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">{t('settings.contactNumber')}</label>
            <input
              type="tel"
              value={companyContact}
              onChange={(e) => setCompanyContact(e.target.value)}
              placeholder="e.g. +977-1-4567890"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">{t('common.email')}</label>
            <input
              type="email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              placeholder="e.g. info@syasyahsamaj.com"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">{t('settings.logoUrl')}</label>
            <input
              type="text"
              value={companyLogo}
              onChange={(e) => setCompanyLogo(e.target.value)}
              placeholder="https://example.com/logo.png"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-slate-600">{t('settings.address')}</label>
            <textarea
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              rows={2}
              placeholder="Registered address"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>
        </div>
        {companyLogo && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-slate-400">{t('cal.preview')}:</span>
            <img
              src={companyLogo}
              alt="Logo"
              className="h-10 w-auto rounded border border-slate-200 bg-white object-contain p-1"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}
      </Section>

      {/* ── 3. Fiscal Settings ───────────────────────────────── */}
      <Section
        title={t('settings.fiscalSettings')}
        subtitle={
          selectedFiscalYear
            ? `${t('fy.workingYear')}: ${selectedFiscalYear.label || selectedFiscalYear.startDate}${selectedFiscalYear.status === 'closed' ? ` (${t('hint.fyStatusClosed')})` : ''}`
            : t('hint.fiscalYears')
        }
        icon={Wallet}
        open={!!openSections.fiscal}
        onToggle={() => toggle('fiscal')}
      >
        <div className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">{t('settings.fiscalYears')}</p>
              <p className="text-xs text-slate-400">
                Active years are editable · Closed years are read-only · The working year drives transaction numbering.
              </p>
            </div>
            <button
              type="button"
              onClick={openFyModal}
              className="flex items-center gap-1.5 rounded-md bg-crimson-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-crimson-700"
            >
              <Plus size={14} /> {t('settings.addYear')}
            </button>
          </div>

          {fiscalLoading ? (
            <div className="py-6 text-center text-sm text-slate-400">{t('hint.loadingFiscal')}</div>
          ) : fiscalYears.length === 0 ? (
            <div className="rounded border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400">
              No fiscal years defined. Click <span className="font-medium">Add Year</span> to create the first period.
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">{t('settings.working')}</th>
                    <th className="px-3 py-2">{t('settings.label')}</th>
                    <th className="px-3 py-2">{t('settings.start')}</th>
                    <th className="px-3 py-2">{t('settings.end')}</th>
                    <th className="px-3 py-2">{t('common.status')}</th>
                    <th className="px-3 py-2 text-right">{t('settings.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fiscalYears.map((y) => {
                    const isSelected = selectedFiscalYear?.id === y.id
                    const isActiveFlag = y.isActive || (activeFiscalYear?.id === y.id && !isSelected)
                    return (
                      <tr
                        key={y.id}
                        className={`border-b border-slate-100 last:border-0 ${isSelected ? 'bg-crimson-50/60' : ''}`}
                      >
                        <td className="px-3 py-2">
                          {y.status === 'closed' ? (
                            <span
                              title={t("settings.closedTooltip")}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-300"
                            >
                              <Check size={12} />
                            </span>
                          ) : (
                            <button
                              type="button"
                              title={t("settings.setWorkingYear")}
                              onClick={() => fySetActive(y)}
                              className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                isActiveFlag
                                  ? 'border-crimson-600 bg-crimson-600 text-white'
                                  : 'border-slate-300 text-transparent hover:border-crimson-400'
                              }`}
                            >
                              <Check size={12} />
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">{y.label || `FY ${y.startDate}`}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{String(y.startDate || '').slice(0, 10)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{String(y.endDate || '').slice(0, 10)}</td>
                        <td className="px-3 py-2">
                          {y.status === 'closed' ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                              <Lock size={10} /> {t("hint.closedLabel")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              <Unlock size={10} /> {t("hint.activeLabel")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            {y.status === 'closed' ? (
                              <button
                                type="button"
                                onClick={() => fyReopen(y)}
                                title={t("settings.openThisYear")}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-emerald-600"
                              >
                                <Unlock size={14} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => fyClose(y)}
                                title={t("settings.closeThisYear")}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-amber-600"
                              >
                                <Lock size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openFyEdit(y)}
                              title={t("settings.editFiscalYear")}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => fyDelete(y)}
                              title={t("settings.deleteFiscalYear")}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-slate-400">
            Selecting a fiscal year in the header filters the transactions, journal and reports to that period.
            Entries dated inside a <span className="font-medium">closed</span> year are rejected on the server.
          </p>
        </div>
      </Section>

      {/* ── Add / Edit Fiscal Year Modal ──────────────────── */}
      {fyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">{fyEditing ? t("settings.editFiscalYear") : t("settings.addYear")}</h3>
              <button type="button" onClick={() => { setFyModalOpen(false); setFyEditing(null) }} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-slate-600">{t("settings.labelExample")}</label>
                <input
                  value={fyForm.label}
                  onChange={(e) => setFyForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder={t("settings.autoFromStart")}
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm text-slate-600">{t("settings.startDate")}</label>
                  <NepaliDateInput compact value={fyForm.startDate} onChange={(v) => setFyForm((f) => ({ ...f, startDate: v }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-slate-600">{t("settings.endDate")}</label>
                  <NepaliDateInput compact value={fyForm.endDate} onChange={(v) => setFyForm((f) => ({ ...f, endDate: v }))} />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="radio"
                    name="fyStatus"
                    checked={fyForm.status === 'active'}
                    onChange={() => setFyForm((f) => ({ ...f, status: 'active' }))}
                  />
                  {t("hint.fyStatusActive")}
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="radio"
                    name="fyStatus"
                    checked={fyForm.status === 'closed'}
                    onChange={() => setFyForm((f) => ({ ...f, status: 'closed', makeActive: false }))}
                  />
                  {t("hint.fyStatusClosed")}
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={fyForm.makeActive}
                    disabled={fyForm.status === 'closed'}
                    onChange={(e) => setFyForm((f) => ({ ...f, makeActive: e.target.checked }))}
                  />
                  {t("hint.setWorking")}
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setFyModalOpen(false); setFyEditing(null) }}
                className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void fySave()}
                disabled={fySaving}
                className="rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
              >
                {fySaving ? t("hint.savingLabel") : fyEditing ? t("hint.saveChangesLabel") : t("hint.createYearLabel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fiscal Year Action Confirmation Modal ───────────── */}
      {fyConfirm && (() => {
        const { action, year, swap, swapIsWorking } = fyConfirm
        const isWorkingYear = activeFiscalYear?.id === year.id
        const title =
          action === 'close' ? 'Close Fiscal Year' :
          action === 'open' ? 'Open Fiscal Year' :
          'Set as Working Year'
        const confirmLabel =
          action === 'close' ? 'Close Year' :
          action === 'open' ? 'Open Year' :
          'Set as Working Year'
        const swapNote = swap
          ? `Only one fiscal year can be active at a time. ${action === 'open' ? `Opening ${year.label}` : `Setting ${year.label} as the working year`} will close ${swap.label}${swapIsWorking ? ' — the current working year' : ''}.`
          : null
        const closeWarn =
          action === 'close' && isWorkingYear
            ? `${year.label} is the current working year. After closing it, no fiscal year will be active for new entries.`
            : null
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-800">{title}</h3>
                <button type="button" onClick={() => setFyConfirm(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  {action === 'close'
                    ? `Close ${year.label}? Entries dated in this year will become read-only.`
                    : action === 'open'
                      ? `Open ${year.label}? Entries dated in this year will be editable again.`
                      : `Set ${year.label} as the working year for new entries and transaction numbering?`}
                </p>
                {swapNote && (
                  <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                    {swapNote}
                  </p>
                )}
                {closeWarn && (
                  <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                    {closeWarn}
                  </p>
                )}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFyConfirm(null)}
                  className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void fyConfirmGo()}
                  className={`rounded px-4 py-2 text-sm font-medium text-white hover:opacity-90 ${
                    action === 'close' ? 'bg-amber-600' : 'bg-crimson-600'
                  }`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── 4. Feature Toggles ───────────────────────────────── */}
      <Section
        title={t('settings.featureToggles', 'Feature Toggles')}
        subtitle={
          bankRecEnabled
            ? 'Bank Rec ON'
            : 'Bank Rec OFF'
        }
        icon={ToggleLeft}
        open={!!openSections.features}
        onToggle={() => toggle('features')}
        hasChanges={featuresDirty}
        saved={featuresSaved}
        onSave={() => void persistFeatures()}
        onCancel={cancelFeatures}
      >
        <div className="space-y-4">
          {/* Bank Reconciliation */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={bankRecEnabled}
                onChange={(e) => setBankRecEnabled(e.target.checked)}
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-crimson-600 transition-colors" />
              <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </div>
            <div>
              <div className="text-sm text-slate-700">Bank Reconciliation</div>
              <div className="text-xs text-slate-400">
                {bankRecEnabled ? 'Enabled — visible in sidebar' : 'Disabled — hidden from sidebar'}
              </div>
            </div>
          </label>

          {/* Simplified Invoice */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={simplifiedInvEnabled}
                onChange={(e) => setSimplifiedInvEnabled(e.target.checked)}
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-crimson-600 transition-colors" />
              <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </div>
            <div>
              <div className="text-sm text-slate-700">Simplified Invoice (VAT Inclusive)</div>
              <div className="text-xs text-slate-400">
                {simplifiedInvEnabled
                  ? `Shows VAT-inclusive for totals under Rs. ${simplifiedInvThreshold}`
                  : 'Always show full tax breakdown'}
              </div>
            </div>
          </label>
          {simplifiedInvEnabled && (
            <div className="ml-14">
              <label className="text-xs text-slate-500">Threshold amount (Rs.)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={simplifiedInvThreshold}
                onChange={(e) => setSimplifiedInvThreshold(e.target.value)}
                className="mt-1 w-32 rounded border border-slate-300 px-3 h-9 font-mono text-sm outline-none focus:border-slate-500"
              />
            </div>
          )}

          {/* Demo seed */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={demoSeedEnabled}
                onChange={(e) => setDemoSeedEnabled(e.target.checked)}
                className="peer sr-only"
              />
              <div className="h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-crimson-600 transition-colors" />
              <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </div>
            <div>
              <div className="text-sm text-slate-700">Demo seed</div>
              <div className="text-xs text-slate-400">
                {demoSeedEnabled
                  ? 'Enabled — Setup wizard & Data Management can add demo data'
                  : 'Disabled — demo data seeding is rejected'}
              </div>
            </div>
          </label>
        </div>
      </Section>

      {/* ── 5. Default Account Assignments (editable) ────────── */}
      <Section
        title={t('settings.defaultAccounts', 'Default Accounts')}
        subtitle={t('settings.accountsSubtitle', 'Map GL accounts to posting roles — drag to reorder')}
        icon={Wallet}
        open={!!openSections.accounts}
        onToggle={() => toggle('accounts')}
        hasChanges={defAccountsDirty}
        saved={defAccountsSaved}
        onSave={() => void persistDefAccounts()}
        onCancel={cancelDefAccounts}
      >
        <div className="space-y-1">
          {defAccountOrder.map((key, idx) => {
            const f = ACCOUNT_FIELDS.find((af) => af.key === key)
            if (!f) return null
            const isDragging = dragIdx === idx
            const isOver = overIdx === idx && dragIdx !== null && dragIdx !== idx
            return (
              <div
                key={f.key}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDragEnd={onDragEnd}
                onDragLeave={onDragLeave}
                className={`group flex items-center gap-2 rounded-md px-2 py-1.5 transition-all ${
                  isDragging
                    ? 'opacity-40 scale-[0.98] bg-crimson-50 ring-1 ring-crimson-200'
                    : isOver
                      ? 'bg-crimson-50 ring-1 ring-crimson-300 ring-dashed -my-0.5'
                      : 'hover:bg-slate-50'
                }`
                }
              >
                {/* Drag handle */}
                <div className="shrink-0 cursor-grab text-slate-300 transition-colors hover:text-slate-500 active:cursor-grabbing">
                  <GripVertical size={14} />
                </div>

                {/* Role label */}
                <label className="w-48 shrink-0 text-sm font-medium text-slate-600">
                  {f.label}
                </label>

                {/* Custom account select */}
                <div className="flex-1">
                  <AccountSelect
                    accounts={coaAccounts}
                    value={defAccounts[f.key] || ''}
                    onChange={(v) => setDefAccounts((prev) => ({ ...prev, [f.key]: v }))}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          These defaults are used when posting transactions. Missing accounts block posting until configured.
          Drag rows to reorder posting roles.
        </p>
      </Section>

      {/* ── 5b. Chart of Accounts ─────────────────────────────── */}
      <Section
        title={t('settings.chartOfAccounts', 'Chart of Accounts')}
        subtitle={t('settings.coaSummary', '{a} accounts · {g} groups').replace('{a}', String(coaAccounts.length)).replace('{g}', String(coaGroups.length))}
        icon={FolderTree}
        open={!!openSections.coa}
        onToggle={() => toggle('coa')}
      >
        {/* Create form */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {coaLoading ? 'Loading…' : `${coaAccounts.length} accounts`}
          </span>
          <button
            type="button"
            onClick={() => openCoaNew()}
            className="flex items-center gap-1 rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <Plus size={12} /> New Account
          </button>
        </div>

        {showCoaForm && (
          <form onSubmit={saveCoaAccount} className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-xs font-medium text-slate-600">{coaEditingId != null ? 'Edit Account' : 'New Account'}</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <input required value={coaForm.name} onChange={(e) => setCoaForm({ ...coaForm, name: e.target.value })}
                placeholder="Account name" className="rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500" />
              <input value={coaForm.code} onChange={(e) => setCoaForm({ ...coaForm, code: e.target.value })}
                placeholder="Code" className="rounded border border-slate-300 px-3 py-1.5 text-sm font-mono outline-none focus:border-slate-500" />
              <SearchSelect
                value={coaForm.type}
                onChange={(v) =>
                  setCoaForm((f) => ({
                    ...f,
                    type: v as AccountType,
                    // Clear the group when it no longer belongs to the type.
                    group:
                      f.group &&
                      coaGroups.find((g) => g.id === Number(f.group))?.type ===
                        v
                        ? f.group
                        : '',
                  }))
                }
                options={[
                  { value: 'asset', label: 'Asset' },
                  { value: 'liability', label: 'Liability' },
                  { value: 'equity', label: 'Equity' },
                  { value: 'income', label: 'Income' },
                  { value: 'expense', label: 'Expense' },
                ]}
              />
              <SearchSelect
                value={coaForm.class}
                onChange={(v) => setCoaForm({ ...coaForm, class: v })}
                options={[
                  { value: 'other', label: 'Other' },
                  { value: 'cash', label: 'Cash' },
                  { value: 'bank', label: 'Bank' },
                ]}
              />
            </div>
            <div className="mt-2 flex items-end gap-2">
              <div className="flex-1">
                <SearchSelect
                  value={coaForm.group}
                  onChange={(v) => setCoaForm({ ...coaForm, group: v })}
                  placeholder="— no group —"
                  options={coaGroups
                    .filter((g) => g.type === coaForm.type)
                    .map((g) => ({ value: g.id, label: g.name }))}
                />
              </div>
              <button type="submit" disabled={coaSaving}
                className="rounded bg-crimson-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50">
                {coaSaving ? 'Saving…' : coaEditingId != null ? 'Save Changes' : 'Save'}</button>
              <button type="button" onClick={() => { setCoaEditingId(null); setShowCoaForm(false) }} className="text-xs text-slate-400 hover:text-slate-700">Cancel</button>
            </div>
          </form>
        )}

        {/* Accounts grouped by type → nested tree */}
        {(['asset', 'liability', 'equity', 'income', 'expense'] as AccountType[]).map((type) => {
          const tree = coaTreeFor(type)
          if (tree.roots.length === 0 && tree.ungrouped.length === 0) return null
          const labels: Record<string, string> = { asset: 'Assets', liability: 'Liabilities', equity: 'Equity', income: 'Income', expense: 'Expenses' }
          const total = tree.roots.reduce((n, r) => n + countCoaAccounts(r), 0) + tree.ungrouped.length

          const renderCoaAccount = (a: Account, depth: number) => {
            const bal = coaBalances[a.id] ?? 0
            const isInventory = defAccounts.inventoryAccount === String(a.id)
            return (
              <div key={`a${a.id}`}
                className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50"
                style={{ paddingLeft: `${10 + depth * 22}px` }}>
                <span className="w-24 shrink-0 truncate font-mono text-xs text-slate-400">{a.code || '—'}</span>
                <span className="flex-1 truncate text-slate-800">{a.name}</span>
                {isInventory && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700" title="Inventory is valued at weighted-average cost (AVCO)">AVCO</span>
                )}
                {a.class === 'bank' && (
                  <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-600">Bank</span>
                )}
                {a.class === 'cash' && (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-600">Cash</span>
                )}
                <span className={`hidden shrink-0 font-mono text-xs sm:inline ${bal === 0 ? 'text-slate-300' : bal < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                  {fmt(bal)}
                </span>
                <span className="flex shrink-0 items-center gap-0.5">
                  <button onClick={() => openCoaEdit(a)} title="Edit"
                    className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-700">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => removeCoaAccount(a.id)} title="Delete"
                    className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>
            )
          }

          const renderCoaGroup = (node: CoaGroupNode, depth: number) => {
            const hasChildren = node.accounts.length + node.children.length > 0
            const expanded = !!coaExpanded[node.group.id]
            const count = node.accounts.length + node.children.reduce((n, c) => n + c.accounts.length, 0)
            return (
              <div key={`g${node.group.id}`}>
                <button type="button" onClick={() => hasChildren && toggleCoaGroup(node.group.id)}
                  className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm ${hasChildren ? 'hover:bg-slate-50' : 'cursor-default'}`}
                  style={{ paddingLeft: `${8 + depth * 22}px` }}>
                  {hasChildren ? (
                    expanded
                      ? <ChevronDown size={13} className="shrink-0 text-slate-400" />
                      : <ChevronRight size={13} className="shrink-0 text-slate-400" />
                  ) : (
                    <span className="w-[13px] shrink-0" />
                  )}
                  <span className="font-medium text-slate-700">{node.group.name}</span>
                  <span className="text-xs text-slate-400">({count} account{count === 1 ? '' : 's'})</span>
                </button>
                {(!hasChildren || expanded) && (
                  <div className="ml-[20px] border-l border-slate-100">
                    {node.children.map((c) => renderCoaGroup(c, depth + 1))}
                    {node.accounts.map((a) => renderCoaAccount(a, depth + 1))}
                  </div>
                )}
              </div>
            )
          }

          return (
            <div key={type} className="mb-3">
              <div className="mb-1 flex items-baseline gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                <span>{labels[type]} <span className="text-slate-400">({total})</span></span>
                {(() => {
                  const typeBalance = coaAccounts
                    .filter((x) => x.type === type)
                    .reduce((s, x) => s + (coaBalances[x.id] || 0), 0)
                  if (typeBalance === 0) return null
                  return (
                    <span className={`font-mono text-[11px] ${typeBalance < 0 ? 'text-red-500' : 'text-slate-600'}`}>
                      {fmt(typeBalance)}
                    </span>
                  )
                })()}
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="divide-y divide-slate-50">
                  {tree.roots.map((n) => renderCoaGroup(n, 0))}
                  {tree.ungrouped.length > 0 && (
                    <div className="bg-slate-50/60">
                      {tree.ungrouped.map((a) => renderCoaAccount(a, 1))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {coaAccounts.length === 0 && !coaLoading && (
          <p className="py-6 text-center text-sm text-slate-400">
            No accounts yet. Add your first account above.
          </p>
        )}
      </Section>

      {/* ── 6. Language / भाषा ─────────────────────────────────── */}
      <Section
        title="Language / भाषा"
        subtitle="Choose the interface language"
        icon={Type}
        open={!!openSections.language}
        onToggle={() => toggle('language')}
      >
        <LanguageToggle />
      </Section>

      {/* ── 7. Number Series / क्रमांक शृंखला ─────────────────────── */}
      <Section
        title={t('settings.numberSeries', 'Number Series / क्रमांक शृंखला')}
        subtitle={sequences.length ? `${sequences.length} series` : t('settings.noSeriesYet', 'No series yet — add one below')}
        icon={Hash}
        open={!!openSections.sequences}
        onToggle={() => toggle('sequences')}
      >
        {/* Add button */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {sequences.length} {t('settings.seriesSummary', 'series · Prefix per document type · FY-scoped series reset each year')}
          </span>
          <button
            type="button"
            onClick={openSeriesNew}
            className="flex items-center gap-1.5 rounded-md bg-crimson-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-crimson-700"
          >
            <Plus size={14} /> {t('settings.addSeries', 'Add Series')}
          </button>
        </div>

        {/* Series table */}
        {sequences.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400">
            {t('settings.noSeriesDefined', 'No number series defined yet. Click')}{' '}
            <span className="font-medium">{t('settings.addSeries', 'Add Series')}</span>{' '}
            {t('settings.noSeriesHint', 'to create one. Each series assigns a prefix to a document type — e.g.')}{' '}
            <span className="font-mono">SI-</span>{' '}
            {t('settings.forSalesInvoice', 'for Sales Invoice.')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Doc Type</th>
                  <th className="px-3 py-2">Prefix</th>
                  <th className="px-3 py-2">FY</th>
                  <th className="px-3 py-2 text-right">Last #</th>
                  <th className="px-3 py-2 text-right">Next #</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sequences.map((s) => {
                  const next = s.lastNumber + 1
                  return (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 font-medium text-slate-800">{s.name}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          <Type size={10} />
                          {DOC_TYPE_OPTIONS.find((o) => o.value === s.docType)?.label || s.docType}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">
                        {s.prefix || '<none>'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {s.fiscalYearLabel || s.fiscalYearId ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <CalendarDays size={10} className="text-slate-400" />
                            {s.fiscalYearLabel || `FY ${s.fiscalYearId}`}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Global</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-800">{s.lastNumber}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-emerald-700">{next}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openSeriesEdit(s)}
                            title="Edit series"
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => seriesDelete(s)}
                            disabled={s.lastNumber > 0}
                            title={s.lastNumber > 0 ? 'Cannot delete — documents already posted using this series.' : 'Delete series'}
                            className={`rounded p-1 transition-colors ${
                              s.lastNumber > 0
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-400 hover:bg-red-50 hover:text-red-500'
                            }`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Reset bar (existing functionality) */}
        {resetKey && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <span className="text-sm text-slate-700">
              Reset <span className="font-mono font-medium">{resetKey}</span> to:
            </span>
            <input
              type="number"
              min="0"
              value={resetValue}
              onChange={(e) => setResetValue(e.target.value)}
              className="w-24 rounded border border-slate-300 px-2 py-1 text-sm font-mono outline-none focus:border-slate-500"
            />
            <button
              onClick={async () => {
                const val = parseInt(resetValue) || 0
                if (!window.confirm(`Reset ${resetKey} to ${val}? The next transaction will use ${val + 1}.`)) return
                setResetting(true)
                try {
                  await api(`/doc-sequences/${sequences.find((s) => s.key === resetKey)?.id}`, {
                    method: 'PATCH',
                    body: { lastNumber: val },
                  })
                  setResetKey('')
                  await loadSequences()
                } catch (err: unknown) {
                  setError(err instanceof Error ? err.message : 'Failed to reset')
                }
                setResetting(false)
              }}
              disabled={resetting}
              className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-40"
            >
              {resetting ? 'Saving…' : 'Confirm'}
            </button>
            <button
              onClick={() => setResetKey('')}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-400">
          {t('settings.seriesDetermineNumbers', 'Series determine document numbers like')}{' '}
          <span className="font-mono">{DOC_TYPE_OPTIONS[0].label}</span> →{' '}
          <span className="font-mono">SI-2083-84-0001</span>. {t('settings.fyResetNote', 'FY-scoped series reset each fiscal year.')}{' '}
          {t('settings.postedSeriesLock', 'Series with posted documents cannot be deleted.')}
        </p>
      </Section>

      {/* ── Add / Edit Series Modal ─────────────────────────── */}
      {seriesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">
                {seriesEditingId != null ? t('settings.editSeries', 'Edit Series') : t('settings.addSeries', 'Add Series')}
              </h3>
              <button
                type="button"
                onClick={closeSeriesModal}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              {/* Doc Type — required */}
              <div>
                <label className="mb-1.5 block text-sm text-slate-600">
                  Document Type <span className="text-red-500">*</span>
                </label>
                <SearchSelect
                  value={seriesForm.docType}
                  onChange={(v) => setSeriesForm((f) => ({ ...f, docType: v }))}
                  placeholder="— select document type —"
                  options={DOC_TYPE_OPTIONS}
                />
              </div>

              {/* Prefix */}
              <div>
                <label className="mb-1.5 block text-sm text-slate-600">Prefix</label>
                <input
                  type="text"
                  value={seriesForm.prefix}
                  onChange={(e) => setSeriesForm((f) => ({ ...f, prefix: e.target.value }))}
                  placeholder={DOC_TYPE_OPTIONS.find((o) => o.value === seriesForm.docType)?.label || ''}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 h-[38px]"
                />
                {seriesForm.docType && (
                  <p className="mt-1 text-xs text-slate-400">
                    Example:{' '}
                    <span className="font-mono">
                      {seriesForm.prefix || 'SI-'}{' '}
                      {DOC_TYPE_OPTIONS.find((o) => o.value === seriesForm.docType)?.label}
                    </span>
                  </p>
                )}
              </div>

              {/* Fiscal Year — optional */}
              <div>
                <label className="mb-1.5 block text-sm text-slate-600">
                  Fiscal Year <span className="text-slate-300">(optional)</span>
                </label>
                <div className="mt-1">
                  <SearchSelect
                    value={seriesForm.fiscalYearId}
                    onChange={(v) => setSeriesForm((f) => ({ ...f, fiscalYearId: v }))}
                    placeholder="— global counter (no FY) —"
                    options={fiscalYears.map((fy) => ({
                      value: String(fy.id),
                      label: fy.label || `FY ${fy.startDate}`,
                      sublabel: fy.status === 'closed' ? 'closed' : 'active',
                    }))}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {t('settings.fySeriesResetHint', 'If set, this series resets each fiscal year. Leave empty for a global counter that never resets.')}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeSeriesModal}
                className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void seriesSave()}
                disabled={seriesSaving}
                className="rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
              >
                {seriesSaving ? t('settings.saving', 'Saving…') : seriesEditingId != null ? t('settings.saveChanges', 'Save Changes') : t('settings.createSeries', 'Create Series')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Account ───────────────────────────────────────── */}
      <Section
        title="Account"
        subtitle={t('settings.tutorialAndSignOut', 'Tutorial & sign out')}
        icon={HelpCircle}
        open={!!openSections.account}
        onToggle={() => toggle('account')}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('tour-seen')
              window.location.reload()
            }}
            className="flex items-center gap-2 rounded border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <HelpCircle size={14} />
            {t('hint.showTutorial', 'Show Tutorial')}
          </button>
          <button
            type="button"
            onClick={async () => {
              await authClient.signOut()
              await clearCachedSession()
              navigate('/')
            }}
            className="flex items-center gap-2 rounded border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </Section>
    </div>
  )
}
