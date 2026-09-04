import { useCallback, useEffect, useState } from 'react'
import { Download, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { api, fmt, list, useSyncState } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { type SortState, useSortSearch } from '../lib/useSortSearch'
import ActionMenu from '../components/ActionMenu'
import SearchBox from '../components/SearchBox'
import SortableTh from '../components/SortableTh'
import { TableSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useCalendar } from '../lib/calendar'
import { useSearchParams } from 'react-router-dom'
import { useTenant, useTenantQuery } from '../lib/tenant'
import type { Item, StockLedgerRow, StockLevel } from '../lib/types'

const emptyForm = {
  name: '',
  code: '',
  unit: '',
  reorderLevel: '',
  openingStock: '',
  salePrice: '',
  purchasePrice: '',
}

export default function Items() {
  const { cacheVersion } = useSyncState()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()
  const [items, setItems] = useState<Item[]>([])
  const [levels, setLevels] = useState<StockLevel[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [ledgerItem, setLedgerItem] = useState<Item | null>(null)
  const [ledger, setLedger] = useState<{
    rows: StockLedgerRow[]
    closing: { onHand: number; avgCost: number; value: number }
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [i, l] = await Promise.all([
        list<Item>('items', { depth: 0, sort: 'name', ...tenantQuery }),
        api<{ docs: StockLevel[] }>('/items/stock-levels', {
          query: { ...tenantQuery },
        }),
      ])
      setItems(i.docs)
      setLevels(l.docs)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [cacheVersion, tenantId])

  const levelFor = (itemId: number) =>
    levels.find((l) => l.item.id === itemId)

  const [searchParams, setSearchParams] = useSearchParams()
  const urlSortKey = searchParams.get('sort') || 'name'
  const urlSortDir = (searchParams.get('dir') as 'asc' | 'desc') || 'asc'
  const urlQuery = searchParams.get('q') || ''

  const syncToUrl = useCallback((_q: string, s: SortState) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (_q) params.set('q', _q); else params.delete('q')
      if (s.key && s.key !== 'name') params.set('sort', s.key); else params.delete('sort')
      if (s.key && s.dir !== 'asc') params.set('dir', s.dir); else params.delete('dir')
      return params
    }, { replace: true })
  }, [setSearchParams])

  const { query, setQuery, sort, toggleSort, visible } = useSortSearch(items, {
    searchable: (it) => `${it.name} ${it.code || ''} ${it.unit || ''}`,
    valueOf: (it, key) => {
      switch (key) {
        case 'name':
          return it.name
        case 'unit':
          return it.unit || ''
        case 'onHand':
          return levelFor(it.id)?.onHand ?? -1
        case 'avgCost':
          return levelFor(it.id)?.avgCost ?? -1
        case 'value':
          return levelFor(it.id)?.value ?? -1
        case 'salePrice':
          return Number(it.salePrice) || 0
        default:
          return (it as unknown as Record<string, unknown>)[key] as
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

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api('/items', {
        method: 'POST',
        body: {
          name: form.name,
          code: form.code || undefined,
          unit: form.unit || undefined,
          reorderLevel: form.reorderLevel ? Number(form.reorderLevel) : 0,
          openingStock: form.openingStock ? Number(form.openingStock) : 0,
          salePrice: form.salePrice ? Number(form.salePrice) : undefined,
          purchasePrice: form.purchasePrice
            ? Number(form.purchasePrice)
            : undefined,
          ...(tenantId ? { tenant: tenantId } : {}),
        },
      })
      setForm(emptyForm)
      setShowForm(false)
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create item')
    }
    setSaving(false)
  }

  const remove = async (id: number) => {
    if (!window.confirm('Delete this item?')) return
    try {
      // Admin op — bypass the offline outbox (a queued delete can't resolve a
      // row that still carries a local id). api() resolves local→server ids.
      await api(`/items/${id}`, { method: 'DELETE', immediate: true })
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete item')
    }
  }

  const showLedger = async (item: Item) => {
    setLedgerItem(item)
    setLedger(null)
    try {
      const res = await api<{
        rows: StockLedgerRow[]
        closing: { onHand: number; avgCost: number; value: number }
      }>(`/items/${item.id}/ledger`, { query: { ...tenantQuery } })
      setLedger(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load stock ledger')
    }
  }

  const low = levels.filter((l) => l.belowReorder)

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Inventory</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCsv('inventory.csv', ['Code', 'Name', 'Unit', 'Sale Price', 'Purchase Price', 'Reorder Level'],
              visible.map((i) => [i.code || '', i.name, i.unit || '', i.salePrice || 0, i.purchasePrice || 0, i.reorderLevel || 0]))
            }
            disabled={visible.length === 0}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus size={14} />
            New item
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {low.length > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <TriangleAlert size={15} />
          <span className="font-medium">Reorder needed:</span>
          <span>
            {low.map((l) => l.item.name).join(', ')} — on hand below reorder
            level.
          </span>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={create}
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <label className="text-sm text-slate-700">
              Name *
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              Code
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              Unit
              <input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                placeholder="pc, kg, box…"
              />
            </label>
            <label className="text-sm text-slate-700">
              Opening stock
              <input
                type="number"
                min="0"
                step="any"
                value={form.openingStock}
                onChange={(e) =>
                  setForm({ ...form, openingStock: e.target.value })
                }
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              Purchase price
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.purchasePrice}
                onChange={(e) =>
                  setForm({ ...form, purchasePrice: e.target.value })
                }
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              Sale price
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.salePrice}
                onChange={(e) =>
                  setForm({ ...form, salePrice: e.target.value })
                }
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <label className="text-sm text-slate-700">
              Reorder level
              <input
                type="number"
                min="0"
                step="any"
                value={form.reorderLevel}
                onChange={(e) =>
                  setForm({ ...form, reorderLevel: e.target.value })
                }
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-crimson-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-2">
        <DataStatus />
      </div>

      {loading && items.length === 0 ? (
        <TableSkeleton rows={7} />
      ) : (
        <>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
          <span className="text-xs text-slate-400">
            {visible.length} of {items.length}
          </span>
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search item, code, unit…"
          />
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <SortableTh label="Item" sortKey="name" sort={sort} onSort={toggleSort} />
              <SortableTh label="Unit" sortKey="unit" sort={sort} onSort={toggleSort} />
              <SortableTh label="On hand" sortKey="onHand" sort={sort} onSort={toggleSort} align="right" />
              <SortableTh label="Avg cost" sortKey="avgCost" sort={sort} onSort={toggleSort} align="right" />
              <SortableTh label="Value" sortKey="value" sort={sort} onSort={toggleSort} align="right" />
              <SortableTh label="Sale price" sortKey="salePrice" sort={sort} onSort={toggleSort} align="right" />
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No items yet — add your first inventory item.
                </td>
              </tr>
            )}
            {visible.map((it) => {
              const lv = levelFor(it.id)
              return (
                <tr key={it.id} className="border-b border-slate-50">
                  <td className="px-4 py-2">
                    <button
                      onClick={() => showLedger(it)}
                      className="text-left font-medium text-slate-800 hover:text-blue-700 hover:underline"
                    >
                      {it.code ? `${it.code} · ` : ''}
                      {it.name}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{it.unit || '—'}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-700">
                    <span
                      className={
                        lv?.belowReorder ? 'text-amber-700 font-semibold' : ''
                      }
                    >
                      {lv ? fmtQty(lv.onHand) : '—'}
                    </span>
                    {lv?.belowReorder && (
                      <span
                        className="ml-1.5 text-amber-600"
                        title="Below reorder level"
                      >
                        ⚠
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-600">
                    {lv && lv.onHand > 0 ? fmt(lv.avgCost) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-800">
                    {lv && lv.onHand > 0 ? fmt(lv.value) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-600">
                    {it.salePrice ? fmt(Number(it.salePrice)) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ActionMenu
                      items={[
                        {
                          label: 'Delete',
                          icon: <Trash2 size={13} />,
                          danger: true,
                          onClick: () => remove(it.id),
                        },
                      ]}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
        </>
      )}

      {ledgerItem && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="text-sm font-medium text-slate-700">
              Stock ledger — {ledgerItem.code ? `${ledgerItem.code} · ` : ''}
              {ledgerItem.name}
              <span className="ml-2 text-xs font-normal text-slate-400">
                AVCO · {ledgerItem.unit || 'units'}
              </span>
            </div>
            <button
              onClick={() => setLedgerItem(null)}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              close
            </button>
          </div>
          {ledger === null ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              Loading…
            </p>
          ) : ledger.rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              No stock movements yet.
            </p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Doc</th>
                    <th className="px-4 py-2 text-right">In</th>
                    <th className="px-4 py-2 text-right">Out</th>
                    <th className="px-4 py-2 text-right">Unit cost</th>
                    <th className="px-4 py-2 text-right">On hand</th>
                    <th className="px-4 py-2 text-right">Avg cost</th>
                    <th className="px-4 py-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.rows.map((r, i) => (
                    <tr
                      key={r.id ?? `open-${i}`}
                      className="border-b border-slate-50"
                    >
                      <td className="px-4 py-2 text-slate-600">
                        {r.date ? formatDate(r.date) : (
                          <span className="text-slate-400">opening</span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-slate-600">
                        {r.docNumber || (r.location ? r.location : '—')}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-emerald-700">
                        {r.qtyIn ? fmtQty(r.qtyIn) : ''}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-red-700">
                        {r.qtyOut ? `−${fmtQty(r.qtyOut)}` : ''}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-slate-600">
                        {fmt(r.unitCost)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-slate-800">
                        {fmtQty(r.qtyOnHand)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-slate-600">
                        {fmt(r.avgCost)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-slate-700">
                        {fmt(r.balanceValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between px-4 py-3 text-sm font-semibold text-slate-800">
                <span>Closing</span>
                <span className="flex gap-8">
                  <span className="font-mono">
                    {fmtQty(ledger.closing.onHand)} on hand
                  </span>
                  <span className="font-mono">@ {fmt(ledger.closing.avgCost)}</span>
                  <span className="font-mono w-24 text-right">
                    {fmt(ledger.closing.value)}
                  </span>
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {items.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          Tip: click an item to open its stock ledger. Sales invoices and
          delivery challans issue stock at weighted-average cost.
        </p>
      )}
    </div>
  )
}

const fmtQty = (n: number) =>
  n.toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })
