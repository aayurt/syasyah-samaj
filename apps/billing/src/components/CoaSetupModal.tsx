import React, { useState } from 'react'
import { Check, FolderTree, X, AlertCircle } from 'lucide-react'
import { LiquidButton } from './ui/LiquidButton'
import { api } from '../lib/api'
import { AccountType, AccountGroup } from '../lib/types'

const STARTER_GROUPS = [
  { code: '1000', name: 'Current Assets', type: 'asset' },
  { code: '2000', name: 'Fixed Assets', type: 'asset' },
  { code: '3000', name: 'Current Liabilities', type: 'liability' },
  { code: '4000', name: 'Fixed Liabilities', type: 'liability' },
  { code: '5000', name: 'Equity', type: 'equity' },
  { code: '6000', name: 'Income', type: 'income' },
  { code: '7000', name: 'Expenses', type: 'expense' },
]

export interface CoaSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  groupToEdit?: {
    id: number
    name: string
    code?: string
    type: AccountType
    parent?: number | AccountGroup | null | undefined
  }
  onEditGroup?: (group: {
    id: number
    name: string
    code?: string
    type: AccountType
    parent?: number | AccountGroup | null | undefined
  }) => void
}

export default function CoaSetupModal({ isOpen, onClose, onSuccess, groupToEdit, onEditGroup }: CoaSetupModalProps) {
  if (!isOpen) return null

  const [tab, setTab] = useState<'standard' | 'manual'>('standard')
  const [groupName, setGroupName] = useState('')
  const [groupType, setGroupType] = useState<AccountType>('asset')
  const [accountName, setAccountName] = useState('')
  const [accountCode, setAccountCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingGroup, setEditingGroup] = useState(false)
  const [editGroup, setEditGroup] = useState<{ id: number; name: string; code?: string; type: AccountType; parent?: number | AccountGroup | null | undefined } | null>(null)

  // If groupToEdit prop is provided, start editing mode
  useState(() => {
    if (groupToEdit) {
      setGroupName(groupToEdit.name)
      setGroupType(groupToEdit.type)
      setEditGroup(groupToEdit)
      setEditingGroup(true)
    }
  })

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api('/account-groups', {
        method: 'POST',
        body: {
          name: groupName.trim(),
          code: groupCode.trim() || undefined,
          type: groupType,
        },
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account structure.')
    } finally {
      setLoading(false)
    }
  }

  const handleEditGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api(`/account-groups/${editGroup!.id}`, {
        method: 'PATCH',
        body: {
          name: groupName.trim(),
          code: groupCode.trim() || undefined,
          type: groupType,
        },
      })
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update group.')
    } finally {
      setLoading(false)
      setEditingGroup(false)
    }
  }

  const groupCode = editGroup?.code || ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-crimson-50 text-crimson-600">
              <FolderTree size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Configure Chart of Accounts
              </h2>
              <p className="text-xs text-slate-500">
                Establish account headings and subheadings before setting opening balances
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        <div className="flex border-b border-slate-100 bg-slate-50 px-6 pt-3">
          <button type="button" onClick={() => setTab('standard')} className={`pb-2.5 text-xs font-medium border-b-2 transition-all ${tab === 'standard' ? 'border-crimson-600 text-crimson-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            Standard Chart (Recommended)
          </button>
          <button type="button" onClick={() => setTab('manual')} className={`ml-6 pb-2.5 text-xs font-medium border-b-2 transition-all ${tab === 'manual' ? 'border-crimson-600 text-crimson-600 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            Custom Heading & Subheading
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Body */}
        {editingGroup ? (
          <form onSubmit={handleEditGroup} className="p-6 space-y-4">
            <input type="hidden" value={editGroup!.id} name="groupId" />
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Edit Account Heading (Group)</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-slate-600">Heading Name *</label>
                  <input
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Current Assets"
                    className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600">Type *</label>
                  <select
                    value={editGroup!.type}
                    onChange={(e) => setGroupType(e.target.value as AccountType)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-slate-500"
                  >
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Equity</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <LiquidButton variant="outline" size="sm" type="button" onClick={() => setEditingGroup(false)} disabled={loading}>
                Cancel
              </LiquidButton>
              <LiquidButton variant="accent" size="sm" type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Update'}
              </LiquidButton>
            </div>
          </form>
        ) : (tab === 'standard' ? (
          <div className="p-6">
            <p className="text-sm text-slate-600 leading-relaxed">
              Initialize a complete standard Chart of Accounts structure tailored for organizations and non-profits, including all core headings:
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 font-medium">
              {STARTER_GROUPS.map((g) => (
                <div key={g.code} className="flex items-center gap-1.5 rounded bg-slate-50 px-2.5 py-1.5 border border-slate-100">
                  <Check size={12} className="text-emerald-500" />
                  <span>{g.name} ({g.type})</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Includes cash, banks, receivables, payables, expenses, equity, and revenues. Subheadings can be edited or customized anytime.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <LiquidButton variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </LiquidButton>
              <LiquidButton
                variant="accent"
                size="sm"
                disabled={loading}
                className="gap-1.5"
              >
                {loading ? 'Configuring…' : 'Apply Standard Structure'}
              </LiquidButton>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateCustom} className="p-6 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">1. Account Heading (Group)</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-slate-600">Heading Name *</label>
                  <input
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Current Assets"
                    className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600">Type *</label>
                  <select
                    value={groupType}
                    onChange={(e) => setGroupType(e.target.value as AccountType)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-slate-500"
                  >
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Equity</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">2. Subheading (Account)</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-slate-600">Account Name *</label>
                  <input
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Cash in Hand"
                    className="mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-slate-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600">Code</label>
                  <input
                    value={accountCode}
                    onChange={(e) => setAccountCode(e.target.value)}
                    placeholder="1010"
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-xs font-mono outline-none focus:border-slate-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <LiquidButton variant="outline" size="sm" type="button" onClick={onClose} disabled={loading}>
                Cancel
              </LiquidButton>
              <LiquidButton variant="accent" size="sm" type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Save & Configure'}
              </LiquidButton>
            </div>
          </form>
        ))}
      </div>
    </div>
  )
}
