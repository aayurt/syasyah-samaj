import React from 'react'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  GitBranch,
  Sparkles,
  X,
} from 'lucide-react'
import type { TenantOption } from '../../../lib/tenant'

interface SetupFlowChoiceModalProps {
  open: boolean
  onClose: () => void
  parentCompany: TenantOption | null
  parentName: string
  childCompanies: TenantOption[]
  canOnboardChildren?: boolean
  parentCoaMissingReason?: string
  onContinueParent: () => void
  onSelectChild: (child: TenantOption) => void
}

export function SetupFlowChoiceModal({
  open,
  onClose,
  parentCompany,
  parentName,
  childCompanies,
  canOnboardChildren = true,
  parentCoaMissingReason,
  onContinueParent,
  onSelectChild,
}: SetupFlowChoiceModalProps) {
  if (!open) return null

  const displayName = parentCompany?.name || parentName || 'Parent Company'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-2xs">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Company Profile Saved</h3>
              <p className="text-xs text-slate-500">
                Choose how you would like to continue with your setup.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            title="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Choice Cards Container */}
        <div className="space-y-4 pt-1">
          {/* Option A: Continue Parent Setup */}
          <div
            onClick={onContinueParent}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onContinueParent()
            }}
            className="group rounded-xl border border-slate-200 bg-white p-4 hover:border-crimson-400 hover:bg-crimson-50/20 transition cursor-pointer shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-crimson-50 text-crimson-600 font-bold border border-crimson-100 shrink-0 group-hover:bg-crimson-600 group-hover:text-white transition">
                <Building2 size={17} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-crimson-700 transition">
                    Continue Parent Company Setup
                  </h4>
                  <span className="rounded bg-crimson-100 px-1.5 py-0.5 text-[10px] font-bold text-crimson-800">
                    Parent
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set up Fiscal Year, Chart of Accounts, and Tax Types for <strong>{displayName}</strong>.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white group-hover:bg-crimson-600 transition shadow-2xs shrink-0 self-end sm:self-center"
            >
              <span>Continue Parent</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center py-1">
            <div className="grow border-t border-slate-200"></div>
            <span className="mx-3 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white px-2">
              OR ONBOARD A CHILD COMPANY
            </span>
            <div className="grow border-t border-slate-200"></div>
          </div>

          {/* Option B: Choose a Child Company to Onboard */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-600 flex items-center justify-between">
              <span>Select a branch to configure its fiscal year & accounts:</span>
              <span className="text-[11px] text-slate-400">
                {childCompanies.length} available
              </span>
            </div>

            {!canOnboardChildren ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800 space-y-1 shadow-2xs">
                <p className="font-semibold text-amber-950">Parent Chart of Accounts Required</p>
                <p className="text-amber-800 leading-relaxed">
                  {parentCoaMissingReason ||
                    'Please complete the parent company setup (Account Types & Chart of Accounts) first before onboarding child branches.'}
                </p>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-2 pr-1 rounded-xl border border-slate-100 bg-slate-50/50 p-2">
                {childCompanies.map((child) => (
                  <div
                    key={child.id}
                    onClick={() => onSelectChild(child)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onSelectChild(child)
                    }}
                    className="group flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white p-3 hover:border-indigo-400 hover:bg-indigo-50/30 transition cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex size-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                        <GitBranch size={14} />
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-xs text-slate-900 group-hover:text-indigo-900 transition truncate">
                          {child.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                          <span>Code: {child.code || '—'}</span>
                          {child.pan && <span>• PAN: {child.pan}</span>}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 shadow-2xs group-hover:bg-indigo-600 group-hover:text-white transition shrink-0"
                    >
                      <span>Onboard</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
          <span className="text-slate-400">
            You can also switch companies anytime via the top context bar.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 font-medium"
          >
            Decide Later
          </button>
        </div>
      </div>
    </div>
  )
}
