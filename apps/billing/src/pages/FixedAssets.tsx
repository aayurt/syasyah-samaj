import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Download, Pencil, Plus, RefreshCw, Trash2, TrendingDown } from 'lucide-react'
import { LiquidButton } from '../components/ui/LiquidButton'
import { api, fmt, list, useSyncState } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { pushToast } from '../lib/toast'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { useT } from '../lib/i18n'
import { useSearchParams } from 'react-router-dom'
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

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'disposed', label: 'Disposed' },
] as const

const emptyForm = {
  name: '',
  code: '',
  category: 'equipment',
  purchaseDate: '',
  purchaseCost: '',
  salvageValue: '0',
  usefulLifeYears: '5',
  location: '',
  status: 'active',
}

function categoryLabel(value: string): string {
  return CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value
}

/**
 * Monthly straight-line depreciation, mirroring the server engine
 * (src/collections/FixedAssets/index.ts): (cost - salvage) / (life in months).
 * Returned as null when the asset cannot depreciate yet (no purchase date,
 * zero life, or fully depreciated).
 */
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

export default function FixedAssetsPage() {
  const { cacheVersion } = useSyncState()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const t = useT()

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
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        category: form.category,
        purchaseDate: form.purchaseDate || undefined,
        purchaseCost: Number(form.purchaseCost) || 0,
        salvageValue: Number(form.salvageValue) || 0,
        usefulLifeYears: Number(form.usefulLifeYears) || 0,
        location: form.location.trim() || undefined,
        status: form.status,
      }
      if (editing != null) {
        await api(`/fixed-assets/${editing}`, {
          method: 'PATCH',
          body: payload,
          immediate: true,
        })
        pushToast('success', t('common.saved', 'Saved'), payload.name)
      } else {
        await api('/fixed-assets', {
          method: 'POST',
          body: payload,
          immediate: true,
        })
        pushToast('success', t('common.created', 'Created'), payload.name)
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
   * Post depreciation for elapsed periods. The server writes one journal
   * entry per month and refuses when the billing settings are missing the
   * depreciation / accumulated-depreciation accounts.
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

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">
          {t('fixedAssets.title', 'Fixed Assets')}
        </h1>
        <div className="flex items-center gap-2">
          <LiquidButton onClick={load} variant="outline" size="sm" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh', 'Refresh')}
          </LiquidButton>
          <LiquidButton onClick={exportCsv} variant="outline" size="sm" disabled={visible.length === 0}>
            <Download size={14} /> CSV
          </LiquidButton>
          <LiquidButton onClick={openNew} variant="accent" size="sm">
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
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
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
                        disabled={depreciatingId === r.id}
                        title={t('fixedAssets.postDepreciation', 'Post depreciation')}
                      >
                        <TrendingDown size={14} />
                        {depreciatingId === r.id ? '…' : t('fixedAssets.depreciate', 'Depreciate')}
                      </LiquidButton>
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
    </div>
  )
}
