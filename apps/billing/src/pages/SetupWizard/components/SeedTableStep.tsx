import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Database,
  Edit2,
  Loader2,
  Lock,
  Save,
  Search,
  Sparkles,
  Trash2,
  Unlock,
  X,
} from 'lucide-react'
import { api } from '../../../lib/api'
import { runSeedSelective } from '../../../lib/dataOps'
import { pushToast } from '../../../lib/toast'
import type { SeedTableProps } from '../types'

export const SeedTableStep: React.FC<SeedTableProps> = ({
  collection,
  title,
  subtitle,
  seedKey,
  stepKey,
  seedLabel,
  icon,
  columns,
  aiModel,
  aiLabel,
  seedRows,
  depth,
  tenantId,
  tenantQuery,
  setSeedDone,
  setAiOpen,
  setAiInitialModel,
  onSuccess,
}) => {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editRow, setEditRow] = useState<string | null>(null)
  const [rowDraft, setRowDraft] = useState<Record<string, any>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const cellText = (v: any) =>
    v == null ? '—' : typeof v === 'object' ? String(v?.name ?? v?.title ?? v) : String(v)

  const tenantQueryStr = useMemo(() => JSON.stringify(tenantQuery), [tenantQuery])

  const loadRecords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<{ docs: any[] }>(`/${collection}`, {
        immediate: true,
        query: { limit: 1000, depth: depth ?? 0, ...tenantQuery },
      })
      setRecords(res.docs ?? [])
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [collection, depth, tenantQueryStr])

  // Fix stale closures by reloading whenever collection, tenantId, or query changes
  useEffect(() => {
    void loadRecords()
  }, [loadRecords, tenantId])

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
      await api(`/${collection}/${id}`, { method: 'PATCH', body, immediate: true })
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
      await api(`/${collection}/${id}`, { method: 'DELETE', immediate: true })
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
      pushToast('error', 'Select a company first', 'Pick the organization to set up from the switcher.')
      return
    }
    setBusyId('seed')
    try {
      const res = await runSeedSelective(tenantId, [seedKey as any])
      if (res.error) {
        pushToast('error', 'Seed failed', res.error)
        return
      }
      setSeedDone((prev) => ({
        ...prev,
        [seedKey]: true,
        ...(stepKey ? { [stepKey]: true } : {}),
      }))
      await loadRecords()
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

  const filteredRecords = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return records
    return records.filter((r) => {
      return columns.some((col) => {
        const val = r[col.key]
        if (val == null) return false
        return String(typeof val === 'object' ? val.name || val.code : val)
          .toLowerCase()
          .includes(q)
      })
    })
  }, [records, search, columns])

  const empty = records.length === 0

  return (
    <div className="space-y-4">
      {/* Step Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAiInitialModel(aiModel ?? 'gl-accounts')
              setAiOpen(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition shadow-2xs"
          >
            <Sparkles size={13} className="text-amber-500" />
            <span>{aiLabel ?? 'Import with AI'}</span>
          </button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-lg">
          <span className="text-xs font-medium text-slate-700 ml-1">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={busyId === 'multi'}
            className="inline-flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            <Trash2 size={12} /> Delete selected
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-white"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table & Controls */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Current Data
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {records.length} records
            </span>
          </div>

          {records.length > 5 && (
            <div className="relative w-48 sm:w-64">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${title.toLowerCase()}…`}
                className="w-full rounded-lg border border-slate-200 bg-white py-1 pl-7 pr-3 text-xs outline-none focus:border-crimson-500"
              />
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 rounded-xl border border-slate-200 bg-white">
            <Loader2 size={20} className="animate-spin text-crimson-600" />
            <span className="ml-2 text-xs text-slate-500">Loading {title.toLowerCase()}…</span>
          </div>
        ) : empty ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center bg-slate-50/50">
            <Database size={24} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-medium text-slate-700">No records found</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Seed starter {title.toLowerCase()} or import with AI to continue.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={doSeed}
                disabled={busyId === 'seed'}
                className="inline-flex items-center gap-1.5 rounded-lg bg-crimson-600 px-4 py-2 text-xs font-semibold text-white hover:bg-crimson-700 shadow-2xs"
              >
                {busyId === 'seed' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Database size={13} />
                )}
                <span>{seedLabel}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="max-h-[440px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 shadow-2xs z-10">
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5 text-center w-10">
                    <input
                      type="checkbox"
                      checked={
                        filteredRecords.length > 0 &&
                        filteredRecords.every((r) => selectedIds.has(String(r.id)))
                      }
                      onChange={(e) =>
                        toggleSelectAll(
                          e.target.checked,
                          filteredRecords.map((r) => String(r.id)),
                        )
                      }
                      className="rounded text-crimson-600 focus:ring-crimson-500"
                    />
                  </th>
                  {columns.map((c) => (
                    <th key={c.key} className="px-3 py-2.5 font-semibold">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((row) => {
                  const editing = editRow === String(row.id)
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(String(row.id))}
                          onChange={(e) => toggleRow(String(row.id), e.target.checked)}
                          className="rounded text-crimson-600 focus:ring-crimson-500"
                        />
                      </td>
                      {columns.map((c) => {
                        if (editing && c.type !== 'readonly') {
                          let input: any
                          if (c.type === 'select') {
                            input = (
                              <select
                                defaultValue={String(row[c.key] ?? '')}
                                className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-crimson-500 outline-none bg-white"
                                onChange={(e) =>
                                  setRowDraft({ ...rowDraft, [c.key]: e.target.value })
                                }
                              >
                                {c.options!.map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            )
                          } else if (c.type === 'boolean') {
                            input = (
                              <input
                                type="checkbox"
                                defaultChecked={Boolean(row[c.key])}
                                className="rounded text-crimson-600 focus:ring-crimson-500"
                                onChange={(e) =>
                                  setRowDraft({ ...rowDraft, [c.key]: e.target.checked })
                                }
                              />
                            )
                          } else {
                            input = (
                              <input
                                defaultValue={String(row[c.key] ?? '')}
                                className="w-full text-xs border border-slate-300 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-crimson-500 outline-none"
                                onChange={(e) =>
                                  setRowDraft({ ...rowDraft, [c.key]: e.target.value })
                                }
                              />
                            )
                          }
                          return (
                            <td key={c.key} className="px-3 py-2">
                              {input}
                            </td>
                          )
                        }
                        if (c.type === 'boolean') {
                          return (
                            <td key={c.key} className="px-3 py-2">
                              {Boolean(row[c.key]) ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.2 text-[10px] font-bold text-emerald-700">
                                  <Unlock size={10} /> Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.2 text-[10px] font-medium text-slate-600">
                                  <Lock size={10} /> Inactive
                                </span>
                              )}
                            </td>
                          )
                        }
                        return (
                          <td key={c.key} className="px-3 py-2 text-xs text-slate-700">
                            {cellText(row[c.key])}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2">
                        {editing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => saveRow(String(row.id))}
                              title="Save"
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-crimson-600"
                            >
                              <Save size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditRow(null)}
                              title="Cancel"
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <X size={13} />
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
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteRow(String(row.id))}
                              disabled={busyId === String(row.id) || busyId === 'seed'}
                              title="Delete"
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                            >
                              <Trash2 size={13} />
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
      </div>
    </div>
  )
}
