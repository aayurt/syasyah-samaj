import React, { useMemo, useState } from 'react'
import { Account, AccountGroup, AccountType } from '../lib/types'
import SortableTh from './SortableTh'
import ActionMenu from './ActionMenu'
import { Pencil, Trash2, ChevronRight, ChevronDown } from 'lucide-react'
import { LiquidButton } from './ui/LiquidButton'

type AccountsTableProps = {
  accounts: Account[]
  groups: AccountGroup[]
  openings: Record<number, number>
  onEdit: (account: Account) => void
  onDelete: (id: number) => void
  className?: string
}

const TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expense',
}

type FlatAccount = Account & {
  level: number
  parentName?: string
}

/** Build a flat list with level info from accounts + groups. */
function buildFlatList(
  accounts: Account[],
  groups: AccountGroup[],
): FlatAccount[] {
  const groupMap = new Map(groups.map((g) => [g.id, g]))

  // Determine each account's parent (group id or null)
  const parentOfAccount = new Map<number, number | null>()

  for (const a of accounts) {
    let g: AccountGroup | undefined
    if (typeof a.group === 'object' && a.group !== null) {
      g = a.group
    } else if (a.group) {
      g = groupMap.get(Number(a.group))
    }
    parentOfAccount.set(a.id, g ? g.id : null)
  }

  // Build level for each account by walking up group hierarchy
  const levelCache = new Map<number, number>()
  function getLevel(groupId: number | null): number {
    if (!groupId) return 0
    if (levelCache.has(groupId)) return levelCache.get(groupId)!
    const g = groupMap.get(groupId)
    const parentId = g?.parent
      ? typeof g.parent === 'object'
        ? g.parent.id
        : g.parent
      : null
    const level = parentId ? getLevel(parentId) + 1 : 0
    levelCache.set(groupId, level)
    return level
  }

  return accounts.map((a): FlatAccount => {
    let g: AccountGroup | undefined
    if (typeof a.group === 'object' && a.group !== null) {
      g = a.group
    } else if (a.group) {
      g = groupMap.get(Number(a.group))
    }
    const level = g ? getLevel(g.id) : 0
    return {
      ...a,
      level,
      parentName: g?.name,
    }
  })
}

export default function AccountsTable({
  accounts,
  groups,
  openings,
  onEdit,
  onDelete,
  className,
}: AccountsTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const flat = useMemo(() => buildFlatList(accounts, groups), [accounts, groups])

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return flat.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.code || '').toLowerCase().includes(q) ||
        (a.class || '').toLowerCase().includes(q),
    )
  }, [flat, searchQuery])

  const toggleGroup = (groupId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const isGroupExpanded = (groupId: number) => expandedGroups.has(groupId)

  // Group accounts by type
  const typeGroups = useMemo(() => {
    const map = new Map<AccountType, FlatAccount[]>()
    for (const t of ['asset', 'liability', 'equity', 'income', 'expense'] as AccountType[]) {
      map.set(t, filtered.filter((a) => a.type === t))
    }
    return map
  }, [filtered])

  return (
    <div className={`mx-auto max-w-5xl space-y-4 ${className || ''}`}>
      {/* Search */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">
          {filtered.length} of {accounts.length} accounts
        </span>
        <input
          type="text"
          placeholder="Search name, code, class…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64 rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        />
      </div>

      {filtered.length === 0 && (
        <p className="mt-6 text-center text-sm text-slate-400">
          No accounts found.
        </p>
      )}

      {[...typeGroups.entries()].map(([type, rows]) => {
        if (rows.length === 0) return null

        // Build tree structure: map parentId -> children
        const childrenMap = new Map<number | null, FlatAccount[]>()

        for (const a of rows) {
          let parentId: number | null = null
          if (typeof a.group === 'object' && a.group !== null) {
            parentId = a.group.id
          } else if (a.group) {
            parentId = Number(a.group)
          }
          if (!childrenMap.has(parentId)) childrenMap.set(parentId, [])
          childrenMap.get(parentId)!.push(a)
        }

        const topLevel = childrenMap.get(null) ?? []

        const renderRow = (
          a: FlatAccount,
          depth: number,
        ) => {
          const children = childrenMap.get(a.id)
          const hasChildren = children && children.length > 0
          const indent = depth * 24 // px
          const opening = openings[a.id] ?? a.openingBalance ?? 0
          let g: AccountGroup | undefined
          if (typeof a.group === 'object' && a.group !== null) {
            g = a.group
          } else if (a.group) {
            g = groups.find((x) => x.id === Number(a.group))
          }

          return (
            <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-25 transition-colors">
              <td className="px-4 py-2 font-mono text-slate-500">
                {a.code || '—'}
              </td>
              <td className="px-4 py-2 text-slate-800" style={{ paddingLeft: `${indent}px` }}>
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(a.id)}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    {isGroupExpanded(a.id) ? (
                      <ChevronDown size={12} />
                    ) : (
                      <ChevronRight size={12} />
                    )}
                    {a.name}
                  </button>
                ) : (
                  <span>{a.name}</span>
                )}
              </td>
              <td className="px-4 py-2 text-slate-500">
                {g ? g.name : '—'}
              </td>
              <td className="px-4 py-2 text-slate-500">{a.class || 'other'}</td>
              <td className="px-4 py-2 text-right font-mono text-slate-700">
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
        }

        const renderChildren = (parentId: number | null, depth: number) => {
          const kids = childrenMap.get(parentId)
          if (!kids || kids.length === 0) return null
          const show = parentId === null || isGroupExpanded(parentId)
          if (!show) return null

          return kids.map((child) => (
            <React.Fragment key={child.id}>
              {renderRow(child, depth + 1)}
              {renderChildren(child.id, depth + 1)}
            </React.Fragment>
          ))
        }

        return (
          <div key={type} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 flex justify-between items-center">
              <span>{TYPE_LABELS[type]}</span>
              <span className="ml-2 text-xs font-normal text-slate-400">{rows.length}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Group</th>
                  <th className="px-4 py-2">Class</th>
                  <th className="px-4 py-2 text-right">Opening (FY)</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {topLevel.map((a) => (
                  <React.Fragment key={a.id}>
                    {renderRow(a, 0)}
                    {renderChildren(a.id, 0)}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
