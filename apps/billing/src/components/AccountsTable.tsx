import React, { useMemo, useState } from 'react'
import { Account, AccountGroup, AccountType } from '../lib/types'
import ActionMenu from './ActionMenu'
import { Pencil, Trash2, ChevronRight, ChevronDown, Folder, FileText, Plus, Sparkles } from 'lucide-react'
import { useT } from '../lib/i18n'
import { usePagination } from '../lib/usePagination'
import { Pagination } from './ui/Pagination'

type AccountsTableProps = {
  accounts: Account[]
  groups: AccountGroup[]
  openings: Record<number, number>
  onEdit: (account: Account) => void
  onEditGroup: (group: AccountGroup) => void
  onDelete: (id: number, isGroup?: boolean) => void
  onConfigureCoa?: () => void
  onSeedCoa?: () => void
  seeding?: boolean
  className?: string
  view?: 'tree' | 'table'
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
  onEditGroup,
  onDelete,
  onConfigureCoa,
  onSeedCoa,
  seeding = false,
  className,
  view = 'tree',
}: AccountsTableProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set())
  const [expandedAccounts, setExpandedAccounts] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const t = useT()

  const toggleGroupCollapse = (groupId: number) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const toggleAccountCollapse = (accountId: number) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      return next
    })
  }

  const isGroupCollapsed = (groupId: number) => collapsedGroups.has(groupId)
  const isAccountExpanded = (accountId: number) => expandedAccounts.has(accountId)

  // Resolve parent id from an account (Payload may return object at depth:1 or raw id)
  const parentIdOf = (a: Account): number | null => {
    const p = a.parent
    if (p === null || p === undefined) return null
    return typeof p === 'object' ? p.id : p
  }

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

  // Build parent → children map from filtered accounts
  const childrenByParent = useMemo(() => {
    const map = new Map<number | null, Account[]>()
    for (const a of filteredAccounts) {
      const pid = parentIdOf(a)
      if (!map.has(pid)) map.set(pid, [])
      map.get(pid)!.push(a)
    }
    return map
  }, [filteredAccounts])

  const { pageRows, state: pagState, actions: pagActions } = usePagination<Account>(filteredAccounts, {
    pageSize: 15,
  })

  // Group accounts and groups by Type
  const types: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense']

  if (accounts.length === 0) {
    return (
      <div className={`mx-auto  rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center ${className || ''}`}>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-crimson-50 text-crimson-600">
          <Folder size={28} />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-800">
          No Chart of Accounts Configured
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 leading-relaxed">
          Chart of Accounts must be configured before recording transactions or setting up Opening Balances. You can initialize the standard accounts structure or create your own custom headings and subheadings.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {onSeedCoa && (
            <button
              type="button"
              onClick={onSeedCoa}
              disabled={seeding}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Sparkles size={16} /> {seeding ? 'Initializing…' : 'Seed Recommended Chart'}
            </button>
          )}
          {onConfigureCoa && (
            <button
              type="button"
              onClick={onConfigureCoa}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <Plus size={16} /> Configure Manually
            </button>
          )}
        </div>
      {pagState.total > 0 && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            Page {pagState.page} of {pagState.totalPages} ({pagState.total} accounts)
          </span>
          <Pagination state={pagState} actions={pagActions} />
        </div>
      )}
    </div>
  )
}

  return (
    <div className={`mx-auto  space-y-5 ${className || ''}`}>
      {/* Search */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-500">
          {pageRows.length} of {filteredAccounts.length} accounts · {groups.length} headings
        </span>
        <input
          type="text"
          placeholder="Search name, code, class…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-slate-500 shadow-sm"
        />
      </div>

      {pageRows.length === 0 && filteredAccounts.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          No accounts on this page.
        </div>
      )}
      {filteredAccounts.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          No accounts match &ldquo;{searchQuery}&rdquo;.
        </div>
      )}

      {view === 'table' ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-sm font-semibold text-slate-800 flex justify-between items-center">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-crimson-600" />
              {t('accounts.allAccounts', 'All Accounts')}
            </span>
            <span className="text-xs font-normal text-slate-400">
              {pageRows.length} account{pageRows.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full text-left text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40 text-xs uppercase tracking-wide text-slate-500 font-medium">
                  <th className="w-24 px-4 py-2">Code</th>
                  <th className="min-w-[180px] px-4 py-2">Account Name</th>
                  <th className="w-24 px-4 py-2">Type</th>
                  <th className="w-28 px-4 py-2">Group</th>
                  <th className="w-20 px-4 py-2">{t('accounts.currency', 'Currency')}</th>
                  <th className="min-w-[160px] px-4 py-2">Description</th>
                  <th className="w-28 px-4 py-2 text-right">Opening (FY)</th>
                  <th className="w-20 px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((a) => {
                  const opening = openings[a.id] ?? a.openingBalance ?? 0
                  const g = typeof a.group === 'object' && a.group !== null ? a.group : groups.find((x) => x.id === a.group)
                  return (
                    <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{a.code || '—'}</td>
                      <td className="px-4 py-2 text-slate-700">
                        <div className="flex items-center gap-2">
                          <FileText size={13} className="text-slate-300 shrink-0" />
                          <span className="font-medium text-slate-800">{a.name}</span>
                        </div>
                      </td>
                    <td className="px-4 py-2 text-xs text-slate-500 capitalize">{a.type}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{g?.name || '—'}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{a.currency || 'NPR'}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{a.description || '—'}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-slate-700 font-medium">{opening.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
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
        </div>
      ) : (
        types.map((type) => {
          const typeAccts = filteredAccounts.filter((a) => a.type === type)
          const typeGroups = Array.from(
            new Map(groups.filter((g) => g.type === type).map((g) => [g.id, g])).values()
          )
          if (typeAccts.length === 0 && typeGroups.length === 0) return null

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

              <div className="overflow-x-auto overscroll-x-contain">
                <table className="w-full text-left text-sm min-w-[850px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/40 text-xs uppercase tracking-wide text-slate-500 font-medium">
                      <th className="w-24 px-4 py-2">Code</th>
                      <th className="min-w-[260px] px-4 py-2">Account Heading / Subheading</th>
                      <th className="w-28 px-4 py-2">Class</th>
                      <th className="w-20 px-4 py-2">{t('accounts.currency', 'Currency')}</th>
                      <th className="min-w-[160px] px-4 py-2">Description</th>
                      <th className="w-36 px-4 py-2 text-right">Opening (FY)</th>
                      <th className="w-14 px-4 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 1. Group Headings */}
                    {typeGroups.map((group) => {
                      const groupAccts = typeAccts.filter((a) => {
                        const gid = typeof a.group === 'object' && a.group !== null ? a.group.id : a.group ? Number(a.group) : null
                        return gid === group.id
                      })
                      const groupRoots = groupAccts.filter((a) => !parentIdOf(a))
                      const isCollapsed = isGroupCollapsed(group.id)
                      const groupTotalOpening = groupAccts.reduce(
                        (sum, a) => sum + (openings[a.id] ?? a.openingBalance ?? 0),
                        0,
                      )

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
                                  ({groupRoots.length})
                                </span>
                              </button>
                            </td>
                            <td className="px-4 py-2 text-xs text-slate-500 italic">Heading</td>
                            <td className="px-4 py-2 text-xs text-slate-500">—</td>
                            <td className="px-4 py-2 text-xs text-slate-500">—</td>
                            <td className="px-4 py-2 text-xs text-slate-500">—</td>
                            <td className="px-4 py-2 text-right font-mono text-xs font-medium text-slate-500">
                              {groupRoots.length > 0 ? groupTotalOpening.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <ActionMenu
                                items={[
                                  {
                                    label: 'Edit',
                                    icon: <Pencil size={13} />,
                                    onClick: () => onEditGroup(group),
                                  },
                                  {
                                    label: 'Delete',
                                    icon: <Trash2 size={13} />,
                                    danger: true,
                                    onClick: () => onDelete(group.id, true),
                                  },
                                ]}
                              />
                            </td>
                          </tr>

                          {/* Subheading accounts (roots within group, rendered as collapsible trees) */}
                          {!isCollapsed &&
                            groupRoots.map((a) => renderTreeRow(a, 0, childrenByParent, openings, onEdit, onDelete, isAccountExpanded, toggleAccountCollapse))}
                        </React.Fragment>
                      )
                    })}

                    {/* 2. Unassigned Root Accounts (no group, no parent) */}
                    {typeAccts
                      .filter((a) => {
                        const gid = typeof a.group === 'object' && a.group !== null ? a.group.id : a.group ? Number(a.group) : null
                        return gid === null && !parentIdOf(a)
                      })
                      .map((a) => renderTreeRow(a, 0, childrenByParent, openings, onEdit, onDelete, isAccountExpanded, toggleAccountCollapse))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )
      }
      {pagState.total > 0 && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            Page {pagState.page} of {pagState.totalPages} ({pagState.total} accounts)
          </span>
          <Pagination state={pagState} actions={pagActions} />
        </div>
      )}
    </div>
  )
}

/** Render an account row and its descendants recursively (tree view). */
function renderTreeRow(
  account: Account,
  depth: number,
  childrenByParent: Map<number | null, Account[]>,
  openings: Record<number, number>,
  onEdit: (account: Account) => void,
  onDelete: (id: number) => void,
  isExpanded: (id: number) => boolean,
  toggleCollapse: (id: number) => void,
): React.ReactElement | null {
  const children = childrenByParent.get(account.id) || []
  const expanded = isExpanded(account.id)
  const hasChildren = children.length > 0

  const opening = openings[account.id] ?? account.openingBalance ?? 0
  const indent = depth * 18

  return (
    <React.Fragment key={`tree-acct-${account.id}`}>
      <tr className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
        <td className="px-4 py-2 font-mono text-xs text-slate-500">
          {account.code || '—'}
        </td>
        <td className="px-4 py-2 text-slate-700">
          <div className="flex items-center gap-2" style={{ paddingLeft: indent }}>
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleCollapse(account.id)}
                className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-900"
              >
                {expanded ? (
                  <ChevronDown size={12} className="text-slate-600" />
                ) : (
                  <ChevronRight size={12} className="text-slate-600" />
                )}
              </button>
            ) : (
              <div className="w-5 h-5 shrink-0" />
            )}
            <FileText size={12} className="text-slate-300 shrink-0" />
            <span className="font-medium text-slate-800">{account.name}</span>
            {hasChildren && (
              <span className="ml-1 text-[11px] font-normal text-slate-400">
                ({children.length})
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-2 text-xs text-slate-500 capitalize">
          {account.class || 'other'}
        </td>
        <td className="px-4 py-2 text-xs text-slate-500">
          {account.currency || 'NPR'}
        </td>
        <td className="px-4 py-2 text-xs text-slate-500">
          {account.description || '—'}
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
                onClick: () => onEdit(account),
              },
              {
                label: 'Delete',
                icon: <Trash2 size={13} />,
                danger: true,
                onClick: () => onDelete(account.id),
              },
            ]}
          />
        </td>
      </tr>
      {expanded &&
        hasChildren &&
        children.map((child) => renderTreeRow(child, depth + 1, childrenByParent, openings, onEdit, onDelete, isExpanded, toggleCollapse))}
    </React.Fragment>
  )
}
