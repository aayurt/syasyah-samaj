import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Calendar,
  ChevronDown,
  Hash,
  HelpCircle,
  LogOut,
  RotateCcw,
  ToggleLeft,
  Wallet,
} from 'lucide-react'
import { api } from '../lib/api'
import { authClient, clearCachedSession } from '../lib/auth'
import { formatDate } from '../lib/nepaliDate'
import { useCalendar } from '../lib/calendar'
import type { Account, BillingSettings } from '../lib/types'

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
  saving,
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
  saving?: boolean
}) {
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
                {saved && <span className="text-sm text-emerald-600">✓ Saved</span>}
                {hasChanges && !saved && (
                  <span className="text-sm text-amber-500">Unsaved changes</span>
                )}
              </div>
              {onCancel && hasChanges && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded px-4 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={onSave}
                disabled={saving || !hasChanges}
                className="rounded bg-crimson-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Constants ────────────────────────────────────────────── */
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
]

const inputCls =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 h-[38px]'

/* ─── Component ────────────────────────────────────────────── */
export default function Settings() {
  const [settings, setSettings] = useState<BillingSettings | null>(null)
  const loaded = useRef(false)
  const navigate = useNavigate()
  const { update: updateCalendar } = useCalendar()

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
  const [calSaving, setCalSaving] = useState(false)

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
  const [companySaving, setCompanySaving] = useState(false)

  // ── Fiscal state ──
  const [fiscalYearStart, setFiscalYearStart] = useState('')
  const [freezeDate, setFreezeDate] = useState('')
  const savedFiscal = useRef({ fy: '', freeze: '' })
  const fiscalDirty =
    fiscalYearStart !== savedFiscal.current.fy ||
    freezeDate !== savedFiscal.current.freeze
  const [fiscalSaved, setFiscalSaved] = useState(false)
  const [fiscalSaving, setFiscalSaving] = useState(false)

  // ── Feature toggles ──
  const [bankRecEnabled, setBankRecEnabled] = useState(false)
  const [simplifiedInvEnabled, setSimplifiedInvEnabled] = useState(true)
  const [simplifiedInvThreshold, setSimplifiedInvThreshold] = useState('5000')
  const savedFeatures = useRef({ bankRec: false, simplifiedInv: true, threshold: '5000' })
  const featuresDirty =
    bankRecEnabled !== savedFeatures.current.bankRec ||
    simplifiedInvEnabled !== savedFeatures.current.simplifiedInv ||
    simplifiedInvThreshold !== savedFeatures.current.threshold
  const [featuresSaved, setFeaturesSaved] = useState(false)
  const [featuresSaving, setFeaturesSaving] = useState(false)

  // ── Doc sequences ──
  const [sequences, setSequences] = useState<{ key: string; lastNumber: number; id?: number }[]>([])
  const [resetKey, setResetKey] = useState('')
  const [resetValue, setResetValue] = useState('')
  const [resetting, setResetting] = useState(false)

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

      const fy = res.fiscalYearStart?.slice(0, 10) || ''
      const fr = res.freezeDate?.slice(0, 10) || ''
      setFiscalYearStart(fy)
      setFreezeDate(fr)
      savedFiscal.current = { fy, freeze: fr }

      const br = res.bankReconciliationEnabled || false
      const si = res.simplifiedInvoiceEnabled !== false
      const st = String(res.simplifiedInvoiceThreshold || 5000)
      setBankRecEnabled(br)
      setSimplifiedInvEnabled(si)
      setSimplifiedInvThreshold(st)
      savedFeatures.current = { bankRec: br, simplifiedInv: si, threshold: st }

      loaded.current = true
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    }
  }

  const loadSequences = async () => {
    try {
      const res = await api<{ docs: { key: string; lastNumber: number; id?: number }[] }>(
        'doc-sequences',
        { query: { limit: 100, sort: 'key' } },
      )
      setSequences(res.docs || [])
    } catch { /* non-critical */ }
  }

  useEffect(() => {
    load()
    loadSequences()
  }, [])

  /* ── Persist helpers ── */
  const persistCalendar = async () => {
    setCalSaving(true)
    const body = { calendarType, dateFormat, timeFormat }
    try {
      const cached = JSON.parse(localStorage.getItem('billing.settingsCache') || '{}')
      localStorage.setItem(
        'billing.settingsCache',
        JSON.stringify({ data: { ...(cached.data || {}), ...body }, ts: Date.now() }),
      )
      window.dispatchEvent(new Event('billing-settings-changed'))
      updateCalendar({ calendarType, dateFormat, timeFormat })
    } catch { /* ignore */ }
    try {
      await api('/globals/billing-settings', { method: 'POST', body })
      savedCalendar.current = { calendarType, dateFormat, timeFormat }
      setCalSaved(true)
      setTimeout(() => setCalSaved(false), 2000)
    } catch { /* offline */ }
    setCalSaving(false)
  }

  const cancelCalendar = () => {
    setCalendarType(savedCalendar.current.calendarType as 'AD' | 'BS')
    setDateFormat(savedCalendar.current.dateFormat)
    setTimeFormat(savedCalendar.current.timeFormat as '12h' | '24h')
  }

  const persistCompany = async () => {
    setCompanySaving(true)
    const body = { companyName, companyPan, companyContact, companyEmail, companyAddress, companyLogo }
    try {
      const cached = JSON.parse(localStorage.getItem('billing.settingsCache') || '{}')
      localStorage.setItem(
        'billing.settingsCache',
        JSON.stringify({ data: { ...(cached.data || {}), ...body }, ts: Date.now() }),
      )
      window.dispatchEvent(new Event('billing-settings-changed'))
    } catch { /* ignore */ }
    try {
      await api('/globals/billing-settings', { method: 'POST', body })
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
    } catch { /* offline */ }
    setCompanySaving(false)
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

  const persistFiscal = async () => {
    setFiscalSaving(true)
    const body = { fiscalYearStart: fiscalYearStart || null, freezeDate: freezeDate || null }
    try {
      const cached = JSON.parse(localStorage.getItem('billing.settingsCache') || '{}')
      localStorage.setItem(
        'billing.settingsCache',
        JSON.stringify({ data: { ...(cached.data || {}), ...body }, ts: Date.now() }),
      )
    } catch { /* ignore */ }
    try {
      await api('/globals/billing-settings', { method: 'POST', body })
      savedFiscal.current = { fy: fiscalYearStart, freeze: freezeDate }
      setFiscalSaved(true)
      setTimeout(() => setFiscalSaved(false), 2000)
    } catch { /* offline */ }
    setFiscalSaving(false)
  }

  const cancelFiscal = () => {
    setFiscalYearStart(savedFiscal.current.fy)
    setFreezeDate(savedFiscal.current.freeze)
  }

  const persistFeatures = async () => {
    setFeaturesSaving(true)
    const body = {
      bankReconciliationEnabled: bankRecEnabled,
      simplifiedInvoiceEnabled: simplifiedInvEnabled,
      simplifiedInvoiceThreshold: parseFloat(simplifiedInvThreshold) || 5000,
    }
    try {
      const cached = JSON.parse(localStorage.getItem('billing.settingsCache') || '{}')
      localStorage.setItem(
        'billing.settingsCache',
        JSON.stringify({ data: { ...(cached.data || {}), ...body }, ts: Date.now() }),
      )
      window.dispatchEvent(new Event('billing-settings-changed'))
    } catch { /* ignore */ }
    try {
      await api('/globals/billing-settings', { method: 'POST', body })
      savedFeatures.current = { bankRec: bankRecEnabled, simplifiedInv: simplifiedInvEnabled, threshold: simplifiedInvThreshold }
      setFeaturesSaved(true)
      setTimeout(() => setFeaturesSaved(false), 2000)
    } catch { /* offline */ }
    setFeaturesSaving(false)
  }

  const cancelFeatures = () => {
    const s = savedFeatures.current
    setBankRecEnabled(s.bankRec)
    setSimplifiedInvEnabled(s.simplifiedInv)
    setSimplifiedInvThreshold(s.threshold)
  }

  const accountName = (v: BillingSettings[keyof BillingSettings]) =>
    v && typeof v === 'object' ? (v as Account).name : '—'

  /* ── Calendar summary ── */
  const calSummary = `${calendarType} • ${dateFormat} • ${timeFormat === '12h' ? '12h' : '24h'}`

  return (
    <div data-tour="settings" className="mx-auto max-w-4xl space-y-3">
      <h1 className="text-lg font-semibold text-slate-900">Settings</h1>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* ── 1. Calendar ──────────────────────────────────────── */}
      <Section
        title="Calendar"
        subtitle={calSummary}
        icon={Calendar}
        open={!!openSections.calendar}
        onToggle={() => toggle('calendar')}
        hasChanges={calDirty}
        saved={calSaved}
        onSave={() => void persistCalendar()}
        onCancel={cancelCalendar}
        saving={calSaving}
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-slate-600">Calendar type</span>
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
            <label className="text-sm text-slate-600">Date Format</label>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className={inputCls}
            >
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY/MM/DD">YYYY/MM/DD</option>
              <option value="DD MMMM YYYY">DD MMMM YYYY (15 Asar 2083)</option>
              <option value="MMMM DD, YYYY">MMMM DD, YYYY</option>
              <option value="DD MMM YYYY">DD MMM YYYY</option>
            </select>
            <div className="mt-2 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="text-xs text-slate-400">Preview: </span>
              <span className="font-medium">
                {formatDate(new Date().toISOString(), calendarType, dateFormat)}
              </span>
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-600">Time Format</label>
            <select
              value={timeFormat}
              onChange={(e) => setTimeFormat(e.target.value as '12h' | '24h')}
              className={inputCls}
            >
              <option value="12h">12-hour (1:30 PM)</option>
              <option value="24h">24-hour (13:30)</option>
            </select>
            <div className="mt-2 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="text-xs text-slate-400">Preview: </span>
              <span className="font-medium">
                {formatDate(new Date().toISOString(), calendarType, 'HH:mm', timeFormat)}
              </span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── 2. Company Profile ───────────────────────────────── */}
      <Section
        title="Company Profile"
        subtitle={companyName || 'Set name, PAN, contact — shown on invoices'}
        icon={Building2}
        open={!!openSections.company}
        onToggle={() => toggle('company')}
        hasChanges={companyDirty}
        saved={companySaved}
        onSave={() => void persistCompany()}
        onCancel={cancelCompany}
        saving={companySaving}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm text-slate-600">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Syasyah Samaj"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">PAN Number</label>
            <input
              type="text"
              value={companyPan}
              onChange={(e) => setCompanyPan(e.target.value)}
              placeholder="e.g. 123456789"
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Contact Number</label>
            <input
              type="tel"
              value={companyContact}
              onChange={(e) => setCompanyContact(e.target.value)}
              placeholder="e.g. +977-1-4567890"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Email</label>
            <input
              type="email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              placeholder="e.g. info@syasyahsamaj.com"
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Logo URL</label>
            <input
              type="text"
              value={companyLogo}
              onChange={(e) => setCompanyLogo(e.target.value)}
              placeholder="https://example.com/logo.png"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-slate-600">Address</label>
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
            <span className="text-xs text-slate-400">Preview:</span>
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
        title="Fiscal Settings"
        subtitle={
          fiscalYearStart
            ? `FY start: ${fiscalYearStart}${freezeDate ? ` • Freeze: ${freezeDate}` : ''}`
            : 'Fiscal year and period freeze'
        }
        icon={Wallet}
        open={!!openSections.fiscal}
        onToggle={() => toggle('fiscal')}
        hasChanges={fiscalDirty}
        saved={fiscalSaved}
        onSave={() => void persistFiscal()}
        onCancel={cancelFiscal}
        saving={fiscalSaving}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-slate-600">Fiscal year start</label>
            <input
              type="date"
              value={fiscalYearStart}
              onChange={(e) => setFiscalYearStart(e.target.value)}
              className={inputCls}
            />
            <span className="mt-1 block text-xs text-slate-400">
              Used for voucher numbering. Empty = calendar year.
            </span>
          </div>
          <div>
            <label className="text-sm text-slate-600">Freeze date</label>
            <input
              type="date"
              value={freezeDate}
              onChange={(e) => setFreezeDate(e.target.value)}
              className={inputCls}
            />
            <span className="mt-1 block text-xs text-slate-400">
              No entry posted before this date. Empty = no freeze.
            </span>
          </div>
        </div>
      </Section>

      {/* ── 4. Feature Toggles ───────────────────────────────── */}
      <Section
        title="Feature Toggles"
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
        saving={featuresSaving}
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
        </div>
      </Section>

      {/* ── 5. Default Accounts (read-only) ───────────────────── */}
      <Section
        title="Default Accounts"
        subtitle="Managed in Payload admin"
        icon={Wallet}
        open={!!openSections.accounts}
        onToggle={() => toggle('accounts')}
      >
        <table className="w-full text-sm">
          <tbody>
            {ACCOUNT_FIELDS.map((f) => (
              <tr key={f.key} className="border-b border-slate-50 last:border-0">
                <td className="px-3 py-2 text-slate-600">{f.label}</td>
                <td className="px-3 py-2 text-right font-medium text-slate-800">
                  {settings ? accountName(settings[f.key]) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-400">
          Default accounts are configured in the Payload admin (Billing → Billing Settings). Missing
          accounts block posting until configured.
        </p>
      </Section>

      {/* ── 6. Voucher Numbering ─────────────────────────────── */}
      <Section
        title="Voucher Numbering"
        subtitle={sequences.length ? `${sequences.length} sequences` : 'No sequences yet'}
        icon={Hash}
        open={!!openSections.sequences}
        onToggle={() => toggle('sequences')}
      >
        {sequences.length === 0 ? (
          <p className="text-sm text-slate-400">
            No sequences yet. Numbers are created automatically when vouchers are posted.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Doc Type</th>
                <th className="px-3 py-2">Fiscal Year</th>
                <th className="px-3 py-2 text-right">Last</th>
                <th className="px-3 py-2 text-right">Next</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sequences.map((seq) => {
                const [docType, fy] = seq.key.split(':')
                return (
                  <tr key={seq.key} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{seq.key}</td>
                    <td className="px-3 py-2 text-slate-700">{docType || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{fy || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-800">{seq.lastNumber}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-emerald-700">
                      {seq.lastNumber + 1}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => { setResetKey(seq.key); setResetValue('0') }}
                        className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                      >
                        <RotateCcw size={10} /> Reset
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
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
                if (!window.confirm(`Reset ${resetKey} to ${val}? The next voucher will use ${val + 1}.`)) return
                setResetting(true)
                try {
                  await api(`doc-sequences/${sequences.find((s) => s.key === resetKey)?.id}`, {
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
      </Section>

      {/* ── 7. Account ───────────────────────────────────────── */}
      <Section
        title="Account"
        subtitle="Tutorial & sign out"
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
            Show Tutorial
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
