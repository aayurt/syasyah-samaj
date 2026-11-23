import React from 'react'
import { Building2, Loader2, X } from 'lucide-react'
import type { TenantOption } from '../../../lib/tenant'
import type { NewParentCompanyFormData } from '../types'

interface CompanyCreatorModalProps {
  open: boolean
  isFirstCompany: boolean
  editingCompany: TenantOption | null
  formData: NewParentCompanyFormData
  setFormData: React.Dispatch<React.SetStateAction<NewParentCompanyFormData>>
  creating: boolean
  error: string
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export const CompanyCreatorModal: React.FC<CompanyCreatorModalProps> = ({
  open,
  isFirstCompany,
  editingCompany,
  formData,
  setFormData,
  creating,
  error,
  onClose,
  onSubmit,
}) => {
  if (!open) return null

  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-crimson-50 text-crimson-600 shadow-2xs">
            <Building2 size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {editingCompany
                  ? `Edit Parent Company: ${editingCompany.name}`
                  : isFirstCompany
                    ? 'Create Your Organization / Parent Company'
                    : 'Add New Parent Company'}
              </h2>
              {(!isFirstCompany || editingCompany) && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                  title="Close"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {editingCompany
                ? `Update company name, registration code, and contact information for ${editingCompany.name}.`
                : isFirstCompany
                  ? 'Start by creating your primary company profile (e.g. Syasyah Samaj, ABC Company). Once registered, you will configure its fiscal year, chart of accounts, and manage sub-companies / branches.'
                  : 'Register a new top-level organization. Once created, you can switch between companies and manage sub-companies for each.'}
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">
                Company Name <span className="text-crimson-600 font-bold ml-0.5">*</span>
              </label>
              <input
                autoFocus
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value
                  setFormData((prev) => ({
                    ...prev,
                    name,
                    code: prev.code || name.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, ''),
                  }))
                }}
                placeholder="e.g. ABC Company or Syasyah Samaj"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Company Code <span className="text-crimson-600 font-bold ml-0.5">*</span>
              </label>
              <input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g. ABC or SYASYA"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500 uppercase"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                PAN / Tax ID
              </label>
              <input
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
                placeholder="e.g. 601234567"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Contact Phone
              </label>
              <input
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                placeholder="+977-1-..."
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="info@company.com"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">
                Registered Address
              </label>
              <input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g. Kathmandu, Nepal"
                className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            {(!isFirstCompany || editingCompany) && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg bg-crimson-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-crimson-700 transition disabled:opacity-60"
            >
              {creating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{editingCompany ? 'Updating Company…' : 'Creating Company…'}</span>
                </>
              ) : (
                <>
                  <Building2 size={14} />
                  <span>{editingCompany ? 'Update Company & Continue' : 'Create Company & Continue'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
