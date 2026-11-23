import React, { useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Edit2,
  Lock,
  Plus,
  Save,
  Trash2,
  Unlock,
  X,
} from 'lucide-react'
import { adToBsString, bsToAdString } from '../../../lib/nepaliDate'
import type { FiscalYear } from '../../../lib/types'

interface FiscalYearStepProps {
  isSubCompany: boolean
  parentName?: string
  years: FiscalYear[]
  yearsLoading: boolean
  fy: { label: string; startDate: string; endDate: string }
  setFy: React.Dispatch<React.SetStateAction<{ label: string; startDate: string; endDate: string }>>
  fyCal: 'AD' | 'BS'
  toggleFyCal: () => void
  fyBs: { start: string; end: string }
  setFyBs: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>
  activeFiscalYearId?: string | number
  onCreateYear: () => Promise<void>
  onSetActiveYear: (id: string) => Promise<void>
  onOpenYear: (id: string) => Promise<void>
  onCloseYear: (id: string) => Promise<void>
  onSaveYear: (id: string, draft: any) => Promise<void>
  onDeleteYear: (id: string) => Promise<void>
  busy: string
}

export const FiscalYearStep: React.FC<FiscalYearStepProps> = ({
  isSubCompany,
  parentName,
  years,
  yearsLoading,
  fy,
  setFy,
  fyCal,
  toggleFyCal,
  fyBs,
  setFyBs,
  activeFiscalYearId,
  onCreateYear,
  onSetActiveYear,
  onOpenYear,
  onCloseYear,
  onSaveYear,
  onDeleteYear,
  busy,
}) => {
  const [fyEditRow, setFyEditRow] = useState<string | null>(null)
  const [fyRowDraft, setFyRowDraft] = useState<{
    label: string
    startDate: string
    endDate: string
    status: string
  }>({
    label: '',
    startDate: '',
    endDate: '',
    status: 'active',
  })

  return (
    <>
      {isSubCompany && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 shadow-2xs">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <CalendarDays size={16} className="text-blue-700" />
            <span>Fiscal Periods Inherited from Parent ({parentName || 'Parent Company'})</span>
          </div>
          <p className="mt-1 text-blue-700">
            Sub-companies and branches share the parent organization&apos;s fiscal calendar and periods
            for consolidated books.
          </p>
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Add Fiscal Period</h3>
            <p className="text-xs text-slate-500">
              Define the accounting date range that drives voucher and receipt sequences.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Calendar:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={toggleFyCal}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  fyCal === 'AD'
                    ? 'bg-white text-crimson-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                AD
              </button>
              <button
                type="button"
                onClick={toggleFyCal}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  fyCal === 'BS'
                    ? 'bg-white text-crimson-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                BS
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Start Date</label>
            {fyCal === 'AD' ? (
              <input
                type="date"
                value={fy.startDate}
                onChange={(e) => setFy({ ...fy, startDate: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
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
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm outline-none focus:border-crimson-500"
              />
            )}
            {fyCal === 'BS' && fyBs.start && !bsToAdString(fyBs.start) && (
              <p className="mt-1 text-xs text-red-600">Invalid BS date</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">End Date</label>
            {fyCal === 'AD' ? (
              <input
                type="date"
                value={fy.endDate}
                onChange={(e) => setFy({ ...fy, endDate: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
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
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm outline-none focus:border-crimson-500"
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
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-crimson-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-400">
            Label is auto-generated from the start date when left blank. Added year becomes active.
          </p>
          <button
            type="button"
            onClick={() => void onCreateYear()}
            disabled={busy === 'fiscalYear' || !fy.startDate || !fy.endDate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-crimson-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-crimson-700 disabled:opacity-60 transition shadow-2xs"
          >
            <Plus size={14} /> <span>Add Year</span>
          </button>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Fiscal Years</p>
            <p className="text-xs text-slate-400">
              Set working year · Close/reopen · Edit inline · Delete
            </p>
          </div>
        </div>

        {years.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400 bg-slate-50/50">
            No fiscal years defined yet. Add your organization&apos;s first accounting period above.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5">Working</th>
                  <th className="px-3 py-2.5">Label</th>
                  <th className="px-3 py-2.5">Start</th>
                  <th className="px-3 py-2.5">End</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {years.map((y) => {
                  const isWorking =
                    Boolean(y.isActive) || String(y.id) === String(activeFiscalYearId)
                  const isClosed = y.status === 'closed'
                  const isEditing = fyEditRow === String(y.id)

                  return (
                    <tr key={y.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-2">
                        {isClosed ? (
                          <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-300">
                            <CheckCircle2 size={12} />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSetActiveYear(String(y.id))}
                            title={isWorking ? 'Working year' : 'Set as working year'}
                            className={`flex size-5 items-center justify-center rounded-full border transition ${
                              isWorking
                                ? 'border-crimson-600 bg-crimson-600 text-white'
                                : 'border-slate-300 text-transparent hover:border-crimson-400'
                            }`}
                          >
                            <CheckCircle2 size={12} />
                          </button>
                        )}
                      </td>

                      {isEditing ? (
                        <td className="px-3 py-2">
                          <input
                            defaultValue={fyRowDraft.label || y.label || ''}
                            className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-sm font-medium outline-none focus:ring-1 focus:ring-crimson-500"
                            onChange={(e) =>
                              setFyRowDraft({ ...fyRowDraft, label: e.target.value })
                            }
                            autoFocus
                          />
                        </td>
                      ) : (
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {y.label || `FY ${y.startDate}`}
                        </td>
                      )}

                      {isEditing ? (
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            defaultValue={String(y.startDate || '').slice(0, 10)}
                            className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-500 outline-none focus:ring-1 focus:ring-crimson-500"
                            onChange={(e) =>
                              setFyRowDraft({ ...fyRowDraft, startDate: e.target.value })
                            }
                          />
                        </td>
                      ) : (
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">
                          {String(y.startDate || '').slice(0, 10)}
                        </td>
                      )}

                      {isEditing ? (
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            defaultValue={String(y.endDate || '').slice(0, 10)}
                            className="w-full rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-500 outline-none focus:ring-1 focus:ring-crimson-500"
                            onChange={(e) =>
                              setFyRowDraft({ ...fyRowDraft, endDate: e.target.value })
                            }
                          />
                        </td>
                      ) : (
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">
                          {String(y.endDate || '').slice(0, 10)}
                        </td>
                      )}

                      <td className="px-3 py-2">
                        {isEditing ? (
                          <select
                            defaultValue={y.status || 'active'}
                            className="w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-crimson-500"
                            onChange={(e) =>
                              setFyRowDraft({ ...fyRowDraft, status: e.target.value })
                            }
                          >
                            <option value="active">Active</option>
                            <option value="closed">Closed</option>
                          </select>
                        ) : isClosed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.2 text-[10px] font-medium text-slate-600">
                            <Lock size={10} /> Closed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.2 text-[10px] font-bold text-emerald-700">
                            <Unlock size={10} /> Active
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await onSaveYear(String(y.id), fyRowDraft)
                                setFyEditRow(null)
                              }}
                              title="Save"
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-crimson-600"
                            >
                              <Save size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFyEditRow(null)}
                              title="Cancel"
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {isClosed ? (
                              <button
                                type="button"
                                onClick={() => onOpenYear(String(y.id))}
                                title="Reopen year"
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-emerald-600"
                              >
                                <Unlock size={13} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onCloseYear(String(y.id))}
                                title="Close year"
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-amber-600"
                              >
                                <Lock size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setFyRowDraft({
                                  label: y.label || '',
                                  startDate: String(y.startDate || '').slice(0, 10),
                                  endDate: String(y.endDate || '').slice(0, 10),
                                  status: y.status || 'active',
                                })
                                setFyEditRow(String(y.id))
                              }}
                              title="Edit year"
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteYear(String(y.id))}
                              title="Delete year"
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
    </>
  )
}
