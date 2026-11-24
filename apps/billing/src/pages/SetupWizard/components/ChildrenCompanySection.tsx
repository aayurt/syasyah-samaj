import React, { useState } from 'react'
import {
  AlertTriangle,
  Building2,
  GitBranch,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import type { TenantOption } from '../../../lib/tenant'

interface ChildrenCompanySectionProps {
  enabled: boolean
  onToggle: (nextState: boolean) => void
  subCompanies: TenantOption[]
  isSuperAdmin: boolean
  companyName: string
  canAddChild: boolean
  parentCoaMissingReason?: string
  onAddClick: () => void
  onEditClick: (subCompany: TenantOption) => void
  onDeleteClick: (id: string, name: string) => void
  subCompanyBusy: string
  subCompanyError: string
}

export function ChildrenCompanySection({
  enabled,
  onToggle,
  subCompanies,
  isSuperAdmin,
  companyName,
  canAddChild,
  parentCoaMissingReason,
  onAddClick,
  onEditClick,
  onDeleteClick,
  subCompanyBusy,
  subCompanyError,
}: ChildrenCompanySectionProps) {
  const [showCollapseWarning, setShowCollapseWarning] = useState(false)

  const handleToggleClick = (targetChecked: boolean) => {
    if (!isSuperAdmin) return
    // If turning OFF and there are existing child companies, show confirmation dialog
    if (!targetChecked && subCompanies.length > 0) {
      setShowCollapseWarning(true)
      return
    }
    onToggle(targetChecked)
  }

  const confirmCollapse = () => {
    setShowCollapseWarning(false)
    onToggle(false)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
      {/* Header and Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold border border-indigo-100 shrink-0">
            <GitBranch size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Children Companies</h3>
              {subCompanies.length > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">
                  {subCompanies.length} {subCompanies.length === 1 ? 'branch' : 'branches'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Enable if this organization operates multiple branches, illakas, or subsidiaries.
              If disabled, this parent company operates as a single standalone organization.
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
          <span className="text-xs font-medium text-slate-600">
            {enabled ? (
              <span className="text-indigo-600 font-semibold">Enabled</span>
            ) : (
              <span className="text-slate-400">Disabled</span>
            )}
          </span>
          <label
            aria-label="Toggle Children Companies"
            className={`relative inline-flex items-center cursor-pointer ${
              !isSuperAdmin ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <input
              type="checkbox"
              disabled={!isSuperAdmin}
              checked={enabled}
              onChange={(e) => handleToggleClick(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      {!isSuperAdmin && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-1.5">
          Only Super-Admins have permission to toggle child branches and manage subsidiary structure.
        </p>
      )}

      {/* When Disabled: Compact informative card */}
      {!enabled && (
        <div className="rounded-lg bg-slate-50 border border-slate-200/70 p-3.5 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-slate-400 shrink-0" />
            <span>
              Operating as a standalone organization. Setup will configure <strong>{companyName || 'this company'}</strong> directly.
            </span>
          </div>
          {subCompanies.length > 0 && (
            <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shrink-0">
              {subCompanies.length} child {subCompanies.length === 1 ? 'branch' : 'branches'} preserved
            </span>
          )}
        </div>
      )}

      {/* When Enabled: Full Child Companies Management Section */}
      {enabled && (
        <div className="space-y-4 pt-3 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Child Companies & Illakas under {companyName || 'this Company'}
              </h4>
              <p className="text-xs text-slate-500">
                Branches, illakas, and subsidiaries reporting under this parent organization.
              </p>
            </div>
            {isSuperAdmin && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canAddChild}
                  onClick={onAddClick}
                  title={!canAddChild ? parentCoaMissingReason : 'Register a child company or branch'}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-2xs shrink-0 transition ${
                    canAddChild
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  }`}
                >
                  <Plus size={14} />
                  <span>Add Child Company</span>
                </button>
              </div>
            )}
          </div>

          {!canAddChild && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800 flex items-start gap-2.5 shadow-2xs">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-950">
                  Account Types and Chart of Accounts must be set up first
                </p>
                <p className="mt-0.5 text-amber-800 leading-relaxed">
                  {parentCoaMissingReason ||
                    'Please complete the "Account Types & Groups" and "Chart of Accounts" steps for this parent company before adding child companies, so that all branches can share and inherit a common chart.'}
                </p>
              </div>
            </div>
          )}

          {subCompanyError && (
            <div className="rounded-lg bg-crimson-50 border border-crimson-200 p-3 text-xs text-crimson-700 flex items-center justify-between">
              <span>{subCompanyError}</span>
            </div>
          )}

          {subCompanies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center space-y-2">
              <GitBranch className="mx-auto size-8 text-slate-400" />
              <h5 className="text-xs font-semibold text-slate-700">No child companies added yet</h5>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Click <strong>"Add Child Company"</strong> above to register branches or illakas for {companyName || 'this company'}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Name & Code</th>
                    <th className="py-2.5 px-3">PAN</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {subCompanies.map((sc) => (
                    <tr key={sc.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{sc.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {sc.code || 'NO-CODE'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {sc.pan || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {sc.contactInfo?.phone || sc.contactInfo?.email || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            sc.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {sc.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {isSuperAdmin ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditClick(sc)}
                                className="rounded px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteClick(sc.id, sc.name)}
                                disabled={subCompanyBusy === sc.id}
                                className="rounded p-1 text-slate-400 hover:text-crimson-600 hover:bg-crimson-50 transition"
                                title="Delete Child Company"
                              >
                                {subCompanyBusy === sc.id ? (
                                  <Loader2 size={13} className="animate-spin text-crimson-600" />
                                ) : (
                                  <Trash2 size={13} />
                                )}
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">View only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Gentle Confirmation when Disabling with Existing Children */}
      {showCollapseWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-amber-50 text-amber-600 shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">Collapse Child Companies?</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  This company has <strong>{subCompanies.length}</strong> registered child {subCompanies.length === 1 ? 'branch' : 'branches'}.
                  Disabling this will collapse the branch management panel and proceed with standalone parent setup.
                </p>
                <p className="text-xs text-indigo-600 font-medium">
                  Note: Your existing child companies will NOT be deleted from the database.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCollapseWarning(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCollapse}
                className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-2xs"
              >
                Proceed with Parent Only
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
