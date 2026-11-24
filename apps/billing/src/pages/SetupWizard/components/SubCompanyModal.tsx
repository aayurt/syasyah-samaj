import React from 'react'
import { Edit2, Loader2, Plus, X } from 'lucide-react'
import type { TenantOption } from '../../../lib/tenant'
import type { SubCompanyFormData } from '../types'
import { useT } from '../../../lib/i18n'

interface SubCompanyModalProps {
  open: boolean
  editingSubCompany: TenantOption | null
  subCompanyForm: SubCompanyFormData
  setSubCompanyForm: React.Dispatch<React.SetStateAction<SubCompanyFormData>>
  subCompanyBusy: string
  subCompanyError: string
  onClose: () => void
  onSubmit: () => void
  activeTenantName?: string
  existingSubCompanies?: TenantOption[]
}

export const SubCompanyModal: React.FC<SubCompanyModalProps> = ({
  open,
  editingSubCompany,
  subCompanyForm,
  setSubCompanyForm,
  subCompanyBusy,
  subCompanyError,
  onClose,
  onSubmit,
  activeTenantName,
  existingSubCompanies = [],
}) => {
  const t = useT()

  const isSameAsParent = React.useMemo(() => {
    if (!activeTenantName || !subCompanyForm.name.trim()) return false
    return subCompanyForm.name.trim().toLowerCase() === activeTenantName.trim().toLowerCase()
  }, [activeTenantName, subCompanyForm.name])

  const isDuplicateChildName = React.useMemo(() => {
    if (!subCompanyForm.name.trim()) return false
    const trimmed = subCompanyForm.name.trim().toLowerCase()
    return existingSubCompanies.some(
      (sc) => (!editingSubCompany || String(sc.id) !== String(editingSubCompany.id)) &&
             sc.name.trim().toLowerCase() === trimmed
    )
  }, [existingSubCompanies, subCompanyForm.name, editingSubCompany])

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {editingSubCompany
                ? t('setup.subCompanyUpdated', 'Edit Sub-Company')
                : t('setup.addSubCompany', 'Add Sub-Company / Branch')}
            </h3>
            {activeTenantName && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                Under {activeTenantName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-red-600 transition"
          >
            <X size={15} />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">
              {t('setup.subCompanyName', 'Name')} *
            </label>
            <input
              autoFocus
              value={subCompanyForm.name}
              onChange={(e) => {
                const name = e.target.value
                const slug = name
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/(^-|-$)/g, '')
                setSubCompanyForm((prev) => ({
                  ...prev,
                  name,
                  slug:
                    prev.slug === '' ||
                    prev.slug ===
                      prev.name
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/(^-|-$)/g, '')
                      ? slug
                      : prev.slug,
                }))
              }}
              placeholder="e.g. ABC sub-company -1"
              className={`mt-1 h-9 w-full rounded border px-2.5 text-sm outline-none focus:ring-1 ${
                isSameAsParent || isDuplicateChildName
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500 bg-red-50/30'
                  : 'border-slate-300 focus:border-crimson-500 focus:ring-crimson-500'
              }`}
            />
            {isSameAsParent && (
              <p className="mt-1 text-xs font-medium text-red-600">
                Child branch cannot have the same name as the parent company.
              </p>
            )}
            {isDuplicateChildName && (
              <p className="mt-1 text-xs font-medium text-red-600">
                A child branch with this name already exists under this company.
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">
              {t('setup.subCompanyCode', 'Code')} *
            </label>
            <input
              value={subCompanyForm.code}
              onChange={(e) =>
                setSubCompanyForm({ ...subCompanyForm, code: e.target.value.toUpperCase() })
              }
              placeholder="ABC-01"
              className="mt-1 h-9 w-full rounded border border-slate-300 px-2.5 font-mono text-sm outline-none focus:border-crimson-500 uppercase"
            />
          </div>
          <div className="flex items-end">
            <label className="text-xs font-medium text-slate-600 mr-2">
              {t('setup.subCompanyActive', 'Active')}
            </label>
            <input
              type="checkbox"
              checked={subCompanyForm.active}
              onChange={(e) =>
                setSubCompanyForm({ ...subCompanyForm, active: e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-crimson-600 focus:ring-crimson-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">PAN</label>
            <input
              value={subCompanyForm.pan || ''}
              onChange={(e) => setSubCompanyForm({ ...subCompanyForm, pan: e.target.value })}
              placeholder="e.g. 601234567"
              className="mt-1 h-9 w-full rounded border border-slate-300 px-2.5 font-mono text-sm outline-none focus:border-crimson-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-600">
              {t('setup.subCompanySlug', 'Slug')} *
            </label>
            <input
              value={subCompanyForm.slug}
              onChange={(e) => setSubCompanyForm({ ...subCompanyForm, slug: e.target.value })}
              placeholder="abc-sub-company-1"
              className="mt-1 h-9 w-full rounded border border-slate-300 px-2.5 text-sm outline-none focus:border-crimson-500"
            />
          </div>
        </div>

        {subCompanyError && (
          <p className="mt-3 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
            {subCompanyError}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
          >
            {t('setup.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={subCompanyBusy !== '' || !subCompanyForm.name || !subCompanyForm.code || isSameAsParent || isDuplicateChildName}
            className="inline-flex items-center gap-1.5 rounded-lg bg-crimson-600 px-4 py-2 text-xs font-semibold text-white hover:bg-crimson-700 disabled:opacity-60 transition shadow-2xs"
          >
            {subCompanyBusy === (editingSubCompany ? 'update' : 'create') ? (
              <Loader2 size={13} className="animate-spin" />
            ) : editingSubCompany ? (
              <Edit2 size={13} />
            ) : (
              <Plus size={13} />
            )}
            <span>
              {subCompanyBusy !== ''
                ? 'Saving…'
                : editingSubCompany
                  ? t('setup.subCompanyUpdated', 'Update')
                  : t('setup.addSubCompany', 'Create')}
            </span>
          </button>
        </div>
      </div>
    </>
  )
}
