import React, { useMemo, useState } from 'react'
import { Account, AccountGroup, AccountType } from '../lib/types'
import ActionMenu from './ActionMenu'
import { Pencil, Trash2, ChevronRight, ChevronDown, Folder, FileText, Plus } from 'lucide-react'

type AccountsTableProps = {
  accounts: Account[]
  groups: AccountGroup[]
  openings: Record<number, number>
  onEdit: (account: Account) => void
  onDelete: (id: number) => void
  onConfigureCoa?: () => void
  className?: string
}

const TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expense',
}

export default function AccountsTable({
  accounts,
  groups,
  openings,
  onEdit,
  onDelete,
  onConfigureCoa,
  className,
}: AccountsTableProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const toggleGroupCollapse = (groupId: number) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const isGroupCollapsed = (groupId: number) => collapsedGroups.has(groupId)

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return accounts
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.code || '').toLowerCase().includes(q) ||
        (a.class || '').toLowerCase().includes(q),
    )
  }, [accounts, searchQuery])

  // Group accounts and groups by Type
  const types: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense']

  if (accounts.length === 0) {
    return (
      <div className={`mx-auto max-w-5xl rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center ${className || ''}`}>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-crimson-50 text-crimson-600">
          <Folder size={28} />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-800">
          No Chart of Accounts Configured
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 leading-relaxed">
          Chart of Accounts must be configured before recording transactions or setting up Opening Balances. You can initialize the standard accounts structure or create your own custom headings and subheadings.
        </p>
        {onConfigureCoa && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={onConfigureCoa}
              className="inline-flex items-center gap-2 rounded-lg bg-crimson-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-crimson-700 transition-colors"
            >
              <Plus size={16} /> Configure Chart of Accounts
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`mx-auto max-w-5xl space-y-5 ${className || ''}`}>
      {/* Search */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-500">
          {filteredAccounts.length} of {accounts.length} accounts · {groups.length} headings
        </span>
        <input
          type="text"
          placeholder="Search name, code, class…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-slate-500 shadow-sm"
        />
      </div>

      {filteredAccounts.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          No accounts match &ldquo;{searchQuery}&rdquo;.
        </div>
      )}

      {types.map((type) => {
        const typeAccts = filteredAccounts.filter((a) => a.type === type)
        const typeGroups = groups.filter((g) => g.type === type)
        if (typeAccts.length === 0 && typeGroups.length === 0) return null

        // Group accounts by group ID
        const accountsByGroup = new Map<number | null, Account[]>()
        for (const a of typeAccts) {
          let gid: number | null = null
          if (typeof a.group === 'object' && a.group !== null) {
            gid = a.group.id
          } else if (a.group) {
            gid = Number(a.group)
          }
          if (!accountsByGroup.has(gid)) accountsByGroup.set(gid, [])
          accountsByGroup.get(gid)!.push(a)
        }

        const unassigned = accountsByGroup.get(null) || []

        return (
          <div key={type} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Type Header */}
            <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-800 flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-crimson-600" />
                {TYPE_LABELS[type]}
              </span>
              <span className="text-xs font-normal text-slate-400">
                {typeAccts.length} account{typeAccts.length === 1 ? '' : 's'}
              </span>
            </div>

            <table className="w-full text-left text-sm table-fixed">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40 text-xs uppercase tracking-wide text-slate-500 font-medium">
                  <th className="w-24 px-4 py-2">Code</th>
                  <th className="px-4 py-2">Account Heading / Subheading</th>
                  <th className="w-28 px-4 py-2">Class</th>
                  <th className="w-24 px-4 py-2">Description</th>
                  <th className="w-36 px-4 py-2 text-right">Opening (FY)</th>
                  <th className="w-14 px-4 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {/* 1. Grouped Headings */}
                {typeGroups.map((group) => {
                  const children = accountsByGroup.get(group.id) || []
                  const isCollapsed = isGroupCollapsed(group.id)
                  const groupTotalOpening = children.reduce((sum, a) => sum + (openings[a.id] ?? a.openingBalance ?? 0), 0)

                  return (
                    <React.Fragment key={`group-${group.id}`}>
                      {/* Heading Row */}
                      <tr className="border-b border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-600">
                          {group.code || '—'}
                        </td>
                        <td className="px-4 py-2 font-medium text-slate-800">
                          <button
                            type="button"
                            onClick={() => toggleGroupCollapse(group.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
                          >
                            {isCollapsed ? (
                              <ChevronRight size={14} className="text-slate-400" />
                            ) : (
                              <ChevronDown size={14} className="text-slate-400" />
                            )}
                            <Folder size={14} className="text-amber-500 shrink-0" />
                            <span>{group.name}</span>
                            <span className="ml-1 text-[11px] font-normal text-slate-400">
                              ({children.length})
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-400 italic">
                          Heading
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs font-medium text-slate-500">
                          {children.length > 0
                            ? groupTotalOpening.toLocaleString('en-US', { minimumFractionDigits: 2 })
                            : '—'}
                        </td>
                        <td className="px-4 py-2 text-right"></td>
                      </tr>

                      {/* Subheading (Accounts under group) */}
                      {!isCollapsed &&
                        children.map((a) => {
                          const opening = openings[a.id] ?? a.openingBalance ?? 0
                          return (
                            <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                              <td className="px-4 py-2 pl-6 font-mono text-xs text-slate-500">
                                {a.code || '—'}
                              </td>
                              <td className="px-4 py-2 pl-9 text-slate-700 flex items-center gap-2">
                                <FileText size={13} className="text-slate-300 shrink-0" />
                                <span className="font-medium text-slate-800">{a.name}</span>
                              </td>
                              <td className="px-4 py-2 text-xs text-slate-500 capitalize">
                                {a.class || 'other'}
                              </td>
                              <td className="px-4 py-2 text-xs text-slate-500">
                                {a.description || '—'}
                              </td>
                              <td className="px-4 py-2 text-right font-mono text-xs text-slate-700 font-medium">
                                {opening.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <ActionMenu
                                  items={[
                                    {
                                      label: 'Edit',
                                      icon: <Pencil size={13} />,
                                      onClick: () => onEdit(a),
                                    },
                                    {
                                      label: 'Delete',
                                      icon: <Trash2 size={13} />,
                                      danger: true,
                                      onClick: () => onDelete(a.id),
                                    },
                                  ]}
                                />
                              </td>
                            </tr>
                          )
                        })}
                    </React.Fragment>
                  )
                })}

                {/* 2. Unassigned Accounts (Without Group) */}
                {unassigned.map((a) => {
                  const opening = openings[a.id] ?? a.openingBalance ?? 0
                  return (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">
                        {a.code || '—'}
                      </td>
                      <td className="px-4 py-2 pl-4 text-slate-700 flex items-center gap-2">
                        <FileText size={13} className="text-slate-300 shrink-0" />
                        <span className="font-medium text-slate-800">{a.name}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500 capitalize">
                        {a.class || 'other'}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {a.description || '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-slate-700 font-medium">
                        {opening.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <ActionMenu
                          items={[
                            {
                              label: 'Edit',
                              icon: <Pencil size={13} />,
                              onClick: () => onEdit(a),
                            },
                            {
                              label: 'Delete',
                              icon: <Trash2 size={13} />,
                              danger: true,
                              onClick: () => onDelete(a.id),
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
        )
      })}
    </div>
  )
}
