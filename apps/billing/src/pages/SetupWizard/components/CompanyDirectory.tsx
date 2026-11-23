import React, { useState } from 'react'
import {
  ArrowRight,
  Building2,
  Edit2,
  GitBranch,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import type { TenantOption } from '../../../lib/tenant'
import { getSubCompaniesForParent } from '../../../lib/tenant'
import { useT } from '../../../lib/i18n'

interface CompanyDirectoryProps {
  parentCompanies: TenantOption[]
  allTenants: TenantOption[]
  onSelectTenant: (id: string) => void
  onAddParentCompany: () => void
  onEditParentCompany: (company: TenantOption) => void
  onDeleteParentCompany: (id: string, name: string) => void
  onAddSubCompany: (parent: TenantOption) => void
}

export const CompanyDirectory: React.FC<CompanyDirectoryProps> = ({
  parentCompanies,
  allTenants,
  onSelectTenant,
  onAddParentCompany,
  onEditParentCompany,
  onDeleteParentCompany,
  onAddSubCompany,
}) => {
  const t = useT()
  const [search, setSearch] = useState('')

  const filteredCompanies = parentCompanies.filter((p) => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.pan && p.pan.toLowerCase().includes(q))
    )
  })

  if (parentCompanies.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-crimson-50 text-crimson-600 shadow-2xs">
            <Building2 size={28} />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900">
            Create Your Organization / Parent Company
          </h2>
          <p className="mt-2 text-xs text-slate-500 max-w-md mx-auto">
            No companies have been configured yet. Start by setting up your primary parent company
            (e.g. Syasyah Samaj or ABC Company). You can later manage branches, illakas, and
            subsidiaries under it.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={onAddParentCompany}
              className="inline-flex items-center gap-2 rounded-xl bg-crimson-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-crimson-700 transition"
            >
              <Plus size={16} />
              <span>Create Company & Continue</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Select Company to Onboard & Configure
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            You are currently in consolidated mode. Select a company below to configure its
            profile, fiscal periods, and accounts, or create a new parent company.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddParentCompany}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-crimson-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-crimson-700 transition"
        >
          <Plus size={14} />
          <span>Add Parent Company</span>
        </button>
      </div>

      {parentCompanies.length > 4 && (
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organizations by name, code, or PAN…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs outline-none focus:border-crimson-500 shadow-2xs"
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {filteredCompanies.map((parent) => {
          const children = getSubCompaniesForParent(parent.id, allTenants)
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
                    <span className="text-slate-400">PAN:</span>{' '}
                    <span className="font-mono font-medium">{parent.pan}</span>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-medium text-slate-500">
                      Sub-Companies ({children.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => onAddSubCompany(parent)}
                      className="text-[11px] font-semibold text-crimson-600 hover:text-crimson-700 inline-flex items-center gap-0.5"
                    >
                      <Plus size={11} /> {t('setup.addSubCompany', 'Add Sub-Company')}
                    </button>
                  </div>

                  {children.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => onSelectTenant(child.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-crimson-50 hover:border-crimson-200 hover:text-crimson-700 transition"
                          title={`Switch to ${child.name}`}
                        >
                          <GitBranch size={10} className="text-slate-400" />
                          <span>{child.name}</span>
                          {child.code && (
                            <span className="font-mono text-[9px] text-slate-400">
                              ({child.code})
                            </span>
                          )}
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
                  onClick={() => onSelectTenant(parent.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-2xs"
                >
                  <span>🏢 Configure {parent.name}</span>
                  <ArrowRight size={13} />
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEditParentCompany(parent)}
                    className="rounded-lg p-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                    title={`Edit ${parent.name}`}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteParentCompany(parent.id, parent.name)}
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
