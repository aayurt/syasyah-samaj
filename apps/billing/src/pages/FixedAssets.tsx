import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
  Calendar,
  ChevronDown,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  User,
  Wallet,
} from 'lucide-react'
import { LiquidButton } from '../components/ui/LiquidButton'
import { api, fmt, list, useSyncState } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { pushToast } from '../lib/toast'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { useT } from '../lib/i18n'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type SortState, useSortSearch } from '../lib/useSortSearch'
import SearchBox from '../components/SearchBox'
import SortableTh from '../components/SortableTh'
import ActionMenu from '../components/ActionMenu'
import { TableSkeleton } from '../components/Skeleton'

/** One row of the asset register, as returned by GET /fixed-assets/register. */
export interface FixedAssetRegisterRow {
  id: number
  code?: string
  name: string
  category: string
  location?: string
  status: 'active' | 'disposed'
  purchaseDate?: string
  purchaseCost: number
  salvageValue: number
  usefulLifeYears: number
  accumulatedDepreciation: number
  netBookValue: number
  depreciatedPct: number
}

export interface FixedAssetRegisterTotals {
  cost: number
  accumulatedDepreciation: number
  netBookValue: number
}

const CATEGORY_OPTIONS = [
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'computer', label: 'Computer' },
  { value: 'building', label: 'Building' },
  { value: 'land', label: 'Land' },
  { value: 'other', label: 'Other' },
] as const

const CATEGORY_USEFUL_LIFE_PRESETS: Record<string, string> = {
  vehicle: '5',
  equipment: '5',
  furniture: '5',
  computer: '3',
  building: '20',
  land: '0',
  other: '5',
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'disposed', label: 'Disposed' },
] as const

const DISPOSAL_TYPE_OPTIONS = [
  { value: 'sale', label: 'Sale' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'write_off', label: 'Write-off' },
  { value: 'donation', label: 'Donation' },
] as const

const emptyForm = {
  name: '',
  code: '',
  category: 'equipment',
  purchaseDate: new Date().toISOString().slice(0, 10),
  purchaseCost: '',
  salvageValue: '0',
  usefulLifeYears: '5',
  location: '',
  status: 'active',
}

function categoryLabel(value: string): string {
  return CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value
}

/** Monthly straight-line depreciation, mirroring the server engine. */
export function monthlyDepreciation(
  cost: number,
  salvage: number,
  usefulLifeYears: number,
): number | null {
  const life = Number(usefulLifeYears)
  if (!Number.isFinite(life) || life <= 0) return null
  const base = Math.max(0, (Number(cost) || 0) - (Number(salvage) || 0))
  if (base <= 0) return null
  return base / (life * 12)
}

/* ================================================================
 * Tab navigation
 * ================================================================ */

type Tab = 'register' | 'depreciation' | 'disposal' | 'reports'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'register', label: 'Register', icon: Building2 },
  { key: 'depreciation', label: 'Depreciation Run', icon: TrendingDown },
  { key: 'disposal', label: 'Disposals', icon: Trash2 },
  { key: 'reports', label: 'Reports', icon: Calendar },
]

function TabButton({ tabKey, label, icon: Icon, active, onClick }: { tabKey: Tab; label: string; icon: React.ElementType; active: boolean; onClick: (k: Tab) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(tabKey)}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-slate-100 text-slate-900 border border-slate-200'
          : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}

/* ================================================================
 * Fixed Assets Page
 * ================================================================ */

export default function FixedAssetsPage() {
  const navigate = useNavigate()
  const { cacheVersion } = useSyncState()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const t = useT()

  const [activeTab, setActiveTab] = useState<Tab>('register')

  /* ── Register state ── */
  const [rows, setRows] = useState<FixedAssetRegisterRow[]>([])
  const [totals, setTotals] = useState<FixedAssetRegisterTotals | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [depreciatingId, setDepreciatingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api<{ docs: FixedAssetRegisterRow[]; totals: FixedAssetRegisterTotals }>(
        '/fixed-assets/register',
        { query: { ...tenantQuery } },
      )
      setRows(res.docs ?? [])
      setTotals(res.totals ?? null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load fixed assets')
    } finally {
      setLoading(false)
    }
  }, [tenantQuery])

  useEffect(() => {
    load()
  }, [cacheVersion, tenantId, load])

  const [searchParams, setSearchParams] = useSearchParams()
  const urlSortKey = searchParams.get('sort') || 'name'
  const urlSortDir = (searchParams.get('dir') as 'asc' | 'desc') || 'asc'
  const urlQuery = searchParams.get('q') || ''

  const syncToUrl = useCallback(
    (_q: string, s: SortState) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (_q) params.set('q', _q)
          else params.delete('q')
          if (s.key && s.key !== 'name') params.set('sort', s.key)
          else params.delete('sort')
          if (s.key && s.dir !== 'asc') params.set('dir', s.dir)
          else params.delete('dir')
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const { query, setQuery, sort, toggleSort, visible } = useSortSearch(rows, {
    searchable: (r) => `${r.name} ${r.code || ''} ${r.category} ${r.location || ''}`,
    valueOf: (r, key) => {
      switch (key) {
        case 'name':
          return r.name
        case 'category':
          return categoryLabel(r.category)
        case 'purchaseCost':
          return r.purchaseCost
        case 'accumulatedDepreciation':
          return r.accumulatedDepreciation
        case 'netBookValue':
          return r.netBookValue
        case 'depreciatedPct':
          return r.depreciatedPct
        default:
          return (r as unknown as Record<string, unknown>)[key] as
            | string
            | number
            | undefined
      }
    },
    defaultSort: { key: 'name', dir: 'asc' },
    initialQuery: urlQuery,
    initialSort: { key: urlSortKey, dir: urlSortDir },
    onChange: syncToUrl,
  })

  const openNew = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (row: FixedAssetRegisterRow) => {
    setEditing(row.id)
    setForm({
      name: row.name ?? '',
      code: row.code ?? '',
      category: row.category ?? 'other',
      purchaseDate: row.purchaseDate ? String(row.purchaseDate).slice(0, 10) : '',
      purchaseCost: String(row.purchaseCost ?? ''),
      salvageValue: String(row.salvageValue ?? 0),
      usefulLifeYears: String(row.usefulLifeYears ?? 5),
      location: row.location ?? '',
      status: row.status ?? 'active',
    })
    setShowForm(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        category: form.category,
        purchaseDate: form.purchaseDate || undefined,
        purchaseCost: Number(form.purchaseCost) || 0,
        salvageValue: Number(form.salvageValue) || 0,
        usefulLifeYears: Number(form.usefulLifeYears) || 0,
        location: form.location.trim() || undefined,
        status: form.status,
        ...(tenantId ? { tenant: Number(tenantId) || tenantId } : {}),
      }
      if (editing != null) {
        await api(`/fixed-assets/${editing}`, {
          method: 'PATCH',
          body: payload,
          immediate: true,
        })
        pushToast('success', t('common.saved', 'Saved'), String(payload.name))
      } else {
        await api('/fixed-assets', {
          method: 'POST',
          body: payload,
          immediate: true,
        })
        pushToast('success', t('common.created', 'Created'), String(payload.name))
      }
      setShowForm(false)
      setEditing(null)
      setForm(emptyForm)
      await load()
    } catch (err: unknown) {
      pushToast('error', t('common.error', 'Error'), err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row: FixedAssetRegisterRow) => {
    try {
      await api(`/fixed-assets/${row.id}`, { method: 'DELETE', immediate: true })
      pushToast('success', t('common.deleted', 'Deleted'), row.name)
      await load()
    } catch (err: unknown) {
      pushToast('error', t('common.error', 'Error'), err instanceof Error ? err.message : String(err))
    }
  }

  /**
   * Post depreciation for elapsed periods of a single asset.
   */
  const depreciate = async (row: FixedAssetRegisterRow) => {
    setDepreciatingId(row.id)
    try {
      const res = await api<{
        postings: number
        totalAmount: number
        accumulatedDepreciation: number
        netBookValue: number
        error?: string
      }>(`/fixed-assets/${row.id}/depreciate`, { method: 'POST', immediate: true })
      if (res.postings > 0) {
        pushToast(
          'success',
          t('fixedAssets.depreciated', 'Depreciation posted'),
          `${res.postings} period(s), ${fmt(res.totalAmount)}`,
        )
      } else {
        pushToast('info', t('fixedAssets.noDepreciation', 'Nothing to depreciate'), row.name)
      }
      await load()
    } catch (err: unknown) {
      pushToast('error', t('common.error', 'Error'), err instanceof Error ? err.message : String(err))
    } finally {
      setDepreciatingId(null)
    }
  }

  const exportCsv = () => {
    downloadCsv(
      'fixed-assets.csv',
      [
        'Code',
        'Name',
        'Category',
        'Location',
        'Status',
        'Purchase Date',
        'Purchase Cost',
        'Salvage Value',
        'Useful Life (Years)',
        'Accumulated Depreciation',
        'Net Book Value',
        'Depreciated %',
      ],
      visible.map((r) => [
        r.code || '',
        r.name,
        categoryLabel(r.category),
        r.location || '',
        r.status,
        r.purchaseDate || '',
        r.purchaseCost,
        r.salvageValue,
        r.usefulLifeYears,
        r.accumulatedDepreciation,
        r.netBookValue,
        r.depreciatedPct,
      ]),
    )
  }

  const cards = useMemo(
    () => [
      {
        label: t('fixedAssets.totalCost', 'Total Cost'),
        value: fmt(totals?.cost),
        icon: Building2,
        tone: 'text-slate-900',
      },
      {
        label: t('fixedAssets.accumulated', 'Accumulated Depreciation'),
        value: fmt(totals?.accumulatedDepreciation),
        icon: TrendingDown,
        tone: 'text-amber-700',
      },
      {
        label: t('fixedAssets.netBookValue', 'Net Book Value'),
        value: fmt(totals?.netBookValue),
        icon: Building2,
        tone: 'text-emerald-700',
      },
    ],
    [totals, t],
  )

  /* ── Depreciation Run state ── */
  const [depRunLoading, setDepRunLoading] = useState(false)
  const [depRunPreview, setDepRunPreview] = useState<any[]>([])
  const [depRunTotal, setDepRunTotal] = useState(0)
  const [depRunAsOf, setDepRunAsOf] = useState<string>('')
  const [depRunDryRun, setDepRunDryRun] = useState(true)
  const [depRunPosting, setDepRunPosting] = useState(false)

  const runDepreciationPreview = async () => {
    setDepRunLoading(true)
    try {
      const res = await api<{ dryRun: boolean; asOf: string; processed: number; totalAmount: number; results: any[] }>(
        '/fixed-assets/depreciation-run',
        {
          method: 'POST',
          body: { asOf: depRunAsOf || undefined, dryRun: true },
          immediate: true,
        },
      )
      setDepRunPreview(res.results ?? [])
      setDepRunTotal(res.totalAmount ?? 0)
    } catch (err: unknown) {
      pushToast('error', t('common.error', 'Error'), err instanceof Error ? err.message : String(err))
    } finally {
      setDepRunLoading(false)
    }
  }

  const postDepreciationRun = async () => {
    setDepRunPosting(true)
    try {
      const res = await api<{ dryRun: boolean; asOf: string; processed: number; totalAmount: number; results: any[] }>(
        '/fixed-assets/depreciation-run',
        {
          method: 'POST',
          body: { asOf: depRunAsOf || undefined, dryRun: false },
          immediate: true,
        },
      )
      pushToast(
        'success',
        t('fixedAssets.depreciationRunPosted', 'Depreciation run posted'),
        `${res.processed} asset(s), ${fmt(res.totalAmount)}`,
      )
      setDepRunPreview([])
      setDepRunTotal(0)
      await load()
    } catch (err: unknown) {
      pushToast('error', t('common.error', 'Error'), err instanceof Error ? err.message : String(err))
    } finally {
      setDepRunPosting(false)
    }
  }

  /* ── Disposal state ── */
  const [disposalLoading, setDisposalLoading] = useState(false)
  const [disposingId, setDisposingId] = useState<number | null>(null)
  const [disposalDialog, setDisposalDialog] = useState<FixedAssetRegisterRow | null>(null)
  const [disposalForm, setDisposalForm] = useState({
    disposalDate: '',
    disposalType: 'sale' as const,
    proceeds: '',
    proceedsAccount: '',
    remarks: '',
  })

  const openDisposal = (row: FixedAssetRegisterRow) => {
    setDisposalDialog(row)
    setDisposalForm({
      disposalDate: new Date().toISOString().slice(0, 10),
      disposalType: 'sale',
      proceeds: '',
      proceedsAccount: '',
      remarks: '',
    })
  }

  const closeDisposal = () => {
    setDisposalDialog(null)
    setDisposalForm({
      disposalDate: '',
      disposalType: 'sale',
      proceeds: '',
      proceedsAccount: '',
      remarks: '',
    })
  }

  const submitDisposal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!disposalDialog) return
    setDisposingId(disposalDialog.id)
    try {
      await api(`/fixed-assets/${disposalDialog.id}/dispose`, {
        method: 'POST',
        body: {
          disposalDate: disposalForm.disposalDate || undefined,
          disposalType: disposalForm.disposalType,
          proceeds: Number(disposalForm.proceeds) || 0,
          proceedsAccount: disposalForm.proceedsAccount || undefined,
          remarks: disposalForm.remarks || undefined,
        },
        immediate: true,
      })
      pushToast('success', t('fixedAssets.disposed', 'Asset disposed'), disposalDialog.name)
      closeDisposal()
      await load()
    } catch (err: unknown) {
      pushToast('error', t('common.error', 'Error'), err instanceof Error ? err.message : String(err))
    } finally {
      setDisposingId(null)
    }
  }

  /* ── Render helpers ── */

  const renderRegister = () => (
    <>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <c.icon size={14} className="text-slate-400" />
              {c.label}
            </div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${c.tone}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={save} className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            {editing != null
              ? `${t('common.edit', 'Edit')} ${t('fixedAssets.title', 'Fixed Asset')}`
              : t('fixedAssets.newAsset', 'New Fixed Asset')}
          </h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="text-sm text-slate-700">
              {t('fixedAssets.name', 'Name')} *
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              {t('fixedAssets.code', 'Code')}
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              {t('fixedAssets.category', 'Category')}
              <select
                value={form.category}
                onChange={(e) => {
                  const cat = e.target.value
                  const presetYears = CATEGORY_USEFUL_LIFE_PRESETS[cat] ?? '5'
                  setForm({
                    ...form,
                    category: cat,
                    usefulLifeYears: !form.usefulLifeYears || form.usefulLifeYears === '5' || form.usefulLifeYears === '3'
                      ? presetYears
                      : form.usefulLifeYears,
                  })
                }}
                className="mt-1 min-w-[160px] w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-700">
              {t('fixedAssets.location', 'Location')}
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              {t('fixedAssets.purchaseDate', 'Purchase Date')}
              <input
                type="date"
                value={form.purchaseDate}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              {t('fixedAssets.purchaseCost', 'Purchase Cost')} *
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={form.purchaseCost}
                onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              {t('fixedAssets.salvageValue', 'Salvage Value')}
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.salvageValue}
                onChange={(e) => setForm({ ...form, salvageValue: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              {t('fixedAssets.usefulLife', 'Useful Life (Years)')}
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.usefulLifeYears}
                onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              {t('fixedAssets.status', 'Status')}
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <LiquidButton type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              {t('common.cancel', 'Cancel')}
            </LiquidButton>
            <LiquidButton type="submit" variant="accent" size="sm" disabled={saving}>
              {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
            </LiquidButton>
          </div>
        </form>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder={t('fixedAssets.search', 'Search assets…')}
        />
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {loading && rows.length === 0 ? (
          <TableSkeleton rows={8} />
        ) : visible.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
            {t('fixedAssets.empty', 'No fixed assets yet.')}
          </div>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <SortableTh
                  label={t('fixedAssets.code', 'Code')}
                  sortKey="code"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableTh
                  label={t('fixedAssets.name', 'Name')}
                  sortKey="name"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableTh
                  label={t('fixedAssets.category', 'Category')}
                  sortKey="category"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableTh
                  label={t('fixedAssets.purchaseCost', 'Cost')}
                  sortKey="purchaseCost"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableTh
                  label={t('fixedAssets.accumulated', 'Accum. Depreciation')}
                  sortKey="accumulatedDepreciation"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableTh
                  label={t('fixedAssets.netBookValue', 'Net Book Value')}
                  sortKey="netBookValue"
                  sort={sort}
                  onSort={toggleSort}
                />
                <SortableTh
                  label={t('fixedAssets.depreciatedPct', 'Depreciated %')}
                  sortKey="depreciatedPct"
                  sort={sort}
                  onSort={toggleSort}
                />
                <th className="px-3 py-2 text-right">{t('common.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.code || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{r.name}</div>
                    {r.location && (
                      <div className="text-xs text-slate-400">{r.location}</div>
                    )}
                    {r.status === 'disposed' && (
                      <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {t('fixedAssets.disposed', 'Disposed')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{categoryLabel(r.category)}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-700">{fmt(r.purchaseCost)}</td>
                  <td className="px-3 py-2 tabular-nums text-amber-700">
                    {fmt(r.accumulatedDepreciation)}
                  </td>
                  <td className="px-3 py-2 font-medium tabular-nums text-slate-800">
                    {fmt(r.netBookValue)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">
                    {r.depreciatedPct.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <LiquidButton
                        onClick={() => depreciate(r)}
                        variant="outline"
                        size="sm"
                        disabled={depreciatingId === r.id || r.status === 'disposed'}
                        title={t('fixedAssets.postDepreciation', 'Post depreciation')}
                      >
                        <TrendingDown size={14} />
                        {depreciatingId === r.id ? '…' : t('fixedAssets.depreciate', 'Depreciate')}
                      </LiquidButton>
                      {r.status === 'active' && (
                        <LiquidButton
                          onClick={() => openDisposal(r)}
                          variant="outline"
                          size="sm"
                          disabled={disposingId === r.id}
                          title={t('fixedAssets.disposeAsset', 'Dispose asset')}
                        >
                          <Trash2 size={14} />
                          {disposingId === r.id ? '…' : t('fixedAssets.dispose', 'Dispose')}
                        </LiquidButton>
                      )}
                      <ActionMenu
                        items={[
                          { label: t('common.edit', 'Edit'), icon: <Pencil size={13} />, onClick: () => openEdit(r) },
                          { label: t('common.delete', 'Delete'), danger: true, icon: <Trash2 size={13} />, onClick: () => remove(r) },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )

  const renderDepreciationRun = () => (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">
        {t('fixedAssets.depreciationRunTitle', 'Batch Depreciation Run')}
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="text-sm text-slate-700">
          {t('fixedAssets.asOfDate', 'As-of date')} *
          <input
            type="date"
            required
            value={depRunAsOf}
            onChange={(e) => setDepRunAsOf(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
        </label>
        <label className="text-sm text-slate-700">
          {t('fixedAssets.dryRun', 'Dry run (preview only)')}
          <select
            value={depRunDryRun ? 'true' : 'false'}
            onChange={(e) => setDepRunDryRun(e.target.value === 'true')}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
          >
            <option value="true">{t('fixedAssets.yes', 'Yes')}</option>
            <option value="false">{t('fixedAssets.no', 'No')}</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <LiquidButton
            onClick={runDepreciationPreview}
            variant="outline"
            size="sm"
            disabled={depRunLoading}
          >
            <RefreshCw size={14} /> {t('fixedAssets.preview', 'Preview')}
          </LiquidButton>
          <LiquidButton
            onClick={postDepreciationRun}
            variant="accent"
            size="sm"
            disabled={depRunPosting || depRunPreview.length === 0 || depRunDryRun}
          >
            {depRunPosting ? t('common.posting', 'Posting…') : t('fixedAssets.postRun', 'Post Depreciation')}
          </LiquidButton>
        </div>
      </div>

      {depRunLoading && <p className="mt-2 text-sm text-slate-500">{t('common.calculating', 'Calculating…')}</p>}

      {depRunPreview.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{t('fixedAssets.asset', 'Asset')}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{t('fixedAssets.category', 'Category')}</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">{t('fixedAssets.monthlyDepreciation', 'Monthly Depn')}</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">{t('fixedAssets.periods', 'Periods')}</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">{t('fixedAssets.totalAmount', 'Total Amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {depRunPreview.map((r) => (
                <tr key={r.assetId} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{r.name}</div>
                    {r.code && <div className="text-xs text-slate-400 font-mono">{r.code}</div>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{categoryLabel(r.category)}</td>
                  <td className="px-3 py-2 tabular-nums text-right">{fmt(r.monthly)}</td>
                  <td className="px-3 py-2 tabular-nums text-right">{r.postings}</td>
                  <td className="px-3 py-2 tabular-nums text-right font-medium">{fmt(r.totalAmount)}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 bg-slate-50">
                <td colSpan={4} className="px-3 py-2 text-right font-medium text-slate-700">
                  {t('fixedAssets.runTotal', 'Run total')}
                </td>
                <td className="px-3 py-2 tabular-nums text-right font-semibold text-slate-900">
                  {fmt(depRunTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const renderDisposal = () => (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">
        {t('fixedAssets.disposalTitle', 'Asset Disposal')}
      </h3>
      <p className="mb-4 text-sm text-slate-500">
        {t('fixedAssets.disposalDesc', 'Dispose of an asset: sale, retirement, write-off, or donation. The system calculates depreciation up to the disposal date, net book value, and gain or loss.')}
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {disposalLoading && <TableSkeleton rows={5} />}
        {!disposalLoading && (
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{t('fixedAssets.code', 'Code')}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{t('fixedAssets.name', 'Name')}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">{t('fixedAssets.category', 'Category')}</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">{t('fixedAssets.purchaseCost', 'Cost')}</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">{t('fixedAssets.netBookValue', 'Net Book Value')}</th>
                <th className="px-3 py-2 text-right">{t('common.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.filter((r) => r.status === 'active').map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.code || '—'}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{r.name}</td>
                  <td className="px-3 py-2 text-slate-600">{categoryLabel(r.category)}</td>
                  <td className="px-3 py-2 tabular-nums text-right">{fmt(r.purchaseCost)}</td>
                  <td className="px-3 py-2 tabular-nums text-right">{fmt(r.netBookValue)}</td>
                  <td className="px-3 py-2 text-right">
                    <LiquidButton
                      onClick={() => openDisposal(r)}
                      variant="outline"
                      size="sm"
                      disabled={disposingId === r.id}
                    >
                      {disposingId === r.id ? '…' : t('fixedAssets.dispose', 'Dispose')}
                    </LiquidButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {disposalDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900">
              {t('fixedAssets.disposeAsset', 'Dispose Asset')} — {disposalDialog.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('fixedAssets.disposalPreview', 'Disposal preview')}
            </p>
            <form onSubmit={submitDisposal} className="mt-4 space-y-3">
              <label className="text-sm text-slate-700">
                {t('fixedAssets.disposalDate', 'Disposal date')} *
                <input
                  type="date"
                  required
                  value={disposalForm.disposalDate}
                  onChange={(e) => setDisposalForm({ ...disposalForm, disposalDate: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm text-slate-700">
                {t('fixedAssets.disposalType', 'Disposal type')}
                <select
                  value={disposalForm.disposalType}
                  onChange={(e) => setDisposalForm({ ...disposalForm, disposalType: e.target.value as any })}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                  {DISPOSAL_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                {t('fixedAssets.proceeds', 'Proceeds')}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={disposalForm.proceeds}
                  onChange={(e) => setDisposalForm({ ...disposalForm, proceeds: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm text-slate-700">
                {t('fixedAssets.proceedsAccount', 'Proceeds account (cash/bank)')}
                <select
                  value={disposalForm.proceedsAccount}
                  onChange={(e) => setDisposalForm({ ...disposalForm, proceedsAccount: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">{t('fixedAssets.selectAccount', 'Select account…')}</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">
                {t('fixedAssets.remarks', 'Remarks')}
                <input
                  value={disposalForm.remarks}
                  onChange={(e) => setDisposalForm({ ...disposalForm, remarks: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
              </label>
              <div className="mt-4 p-3 rounded bg-slate-50 border border-slate-100">
                <div className="flex justify-between text-sm">
                  <span>{t('fixedAssets.cost', 'Cost')}</span>
                  <span className="font-mono text-right">{fmt(disposalDialog.purchaseCost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('fixedAssets.accumulatedDepreciation', 'Accumulated Depreciation')}</span>
                  <span className="font-mono text-right text-amber-700">{fmt(disposalDialog.accumulatedDepreciation)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('fixedAssets.netBookValue', 'Net Book Value')}</span>
                  <span className="font-mono text-right font-medium">{fmt(disposalDialog.netBookValue)}</span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <LiquidButton type="button" variant="outline" size="sm" onClick={closeDisposal}>
                  {t('common.cancel', 'Cancel')}
                </LiquidButton>
                <LiquidButton
                  type="submit"
                  variant="accent"
                  size="sm"
                  disabled={disposingId === disposalDialog.id || !disposalForm.proceedsAccount}
                >
                  {disposingId === disposalDialog.id ? t('common.processing', 'Processing…') : t('fixedAssets.confirmDispose', 'Confirm Disposal')}
                </LiquidButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )

  const renderReports = () => (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-700">
        {t('fixedAssets.reportsTitle', 'Fixed Asset Reports')}
      </h3>
      <p className="mb-4 text-sm text-slate-500">
        {t('fixedAssets.reportsDesc', 'Fixed asset reports reconcile with the General Ledger.')}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-800">{t('fixedAssets.assetRegister', 'Fixed Asset Register')}</h4>
          <p className="mb-3 text-xs text-slate-500">{t('fixedAssets.assetRegisterDesc', 'Complete asset register with cost, depreciation, and NBV.')}</p>
          <LiquidButton
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('register')}
          >
            {t('common.view', 'View')}
          </LiquidButton>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-800">{t('fixedAssets.assetSummary', 'Fixed Asset Summary')}</h4>
          <p className="mb-3 text-xs text-slate-500">{t('fixedAssets.assetSummaryDesc', 'Cost, accumulated depreciation, and NBV by category.')}</p>
          <LiquidButton
            variant="outline"
            size="sm"
            onClick={() => navigate('/reports/fixed-asset-summary')}
          >
            {t('common.view', 'View')}
          </LiquidButton>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-800">{t('fixedAssets.depreciationSchedule', 'Depreciation Schedule')}</h4>
          <p className="mb-3 text-xs text-slate-500">{t('fixedAssets.depreciationScheduleDesc', 'Monthly posted depreciation per asset.')}</p>
          <LiquidButton
            variant="outline"
            size="sm"
            onClick={() => navigate('/reports/depreciation-schedule')}
          >
            {t('common.view', 'View')}
          </LiquidButton>
        </div>
      </div>
    </div>
  )

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-lg font-semibold text-slate-900">
          {t('fixedAssets.title', 'Fixed Assets')}
        </h1>
        <div className="flex items-center gap-2">
          <LiquidButton onClick={load} variant="outline" size="sm" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh', 'Refresh')}
          </LiquidButton>
          <LiquidButton onClick={exportCsv} variant="outline" size="sm" disabled={visible.length === 0 && activeTab === 'register'}>
            <Download size={14} /> CSV
          </LiquidButton>
          <LiquidButton onClick={openNew} variant="accent" size="sm" disabled={activeTab !== 'register'}>
            <Plus size={14} />
            {t('fixedAssets.newAsset', 'New asset')}
          </LiquidButton>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-1 mb-4">
        {TABS.map((tab) => (
          <TabButton
            key={tab.key}
            tabKey={tab.key}
            label={tab.label}
            icon={tab.icon}
            active={activeTab === tab.key}
            onClick={setActiveTab}
          />
        ))}
      </div>

      {activeTab === 'register' && renderRegister()}
      {activeTab === 'depreciation' && renderDepreciationRun()}
      {activeTab === 'disposal' && renderDisposal()}
      {activeTab === 'reports' && renderReports()}
    </div>
  )
}
