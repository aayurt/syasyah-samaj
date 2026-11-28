import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LiquidButton } from '../components/ui/LiquidButton'
import { Download, FolderTree, Pencil, Plus, Sparkles, Trash2, Upload } from 'lucide-react'
import { api, list, useSyncState } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { parseImportFile, validateImportRows, type ValidationError } from '../lib/importExport'
import ImportPreviewModal from '../components/ImportPreviewModal'
import ExportModal from '../components/ExportModal'
import { pushToast } from '../lib/toast'
import DataStatus from '../components/DataStatus'
import AccountsTable from '../components/AccountsTable'
import CoaSetupModal from '../components/CoaSetupModal'
import PageGuide from '../components/PageGuide'
import { type SortState, useSortSearch } from '../lib/useSortSearch'
import { useSearchParams } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { useFiscalYear } from '../lib/fiscalYear'
import { Account, AccountGroup, AccountType, Currency, CURRENCIES, OpeningBalance } from '../lib/types'

const TYPES: AccountType[] = ['asset', 'liability', 'equity', 'income', 'expense']
const TYPE_I18N_KEYS: Record<AccountType, string> = {
  asset: 'trialBalance.typeAssets',
  liability: 'trialBalance.typeLiabilities',
  equity: 'trialBalance.typeEquity',
  income: 'trialBalance.typeIncome',
  expense: 'trialBalance.typeExpenses',
}

const emptyForm = {
  name: '',
  code: '',
  type: 'asset' as AccountType,
  class: 'other',
  group: '',
  description: '',
  parent: '',
  currency: 'NPR' as Currency,
}

export default function Accounts() {
  const t = useT()
  const { cacheVersion } = useSyncState()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [groups, setGroups] = useState<AccountGroup[]>([])
  const [openings, setOpenings] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [groupToEdit, setGroupToEdit] = useState<AccountGroup | undefined>(undefined)
  const [importData, setImportData] = useState<{ collection: string; docs: Record<string, unknown>[]; rowErrors: ValidationError[] } | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showCoaSetup, setShowCoaSetup] = useState(false)
  const [seedingCoa, setSeedingCoa] = useState(false)
  const [view, setView] = useState<'tree' | 'table'>('tree')

// Hierarchy selection state for New / Edit Account form
const [formClass, setFormClass] = useState<AccountType>('asset')
const [formCategory, setFormCategory] = useState<string>('')
const [formGroup, setFormGroup] = useState<string>('')
const [formSubgroup, setFormSubgroup] = useState<string>('')
const [showAddGroup, setShowAddGroup] = useState(false)
const [showAddSubgroup, setShowAddSubgroup] = useState(false)
const [newGroupName, setNewGroupName] = useState('')
const [newSubgroupName, setNewSubgroupName] = useState('')

// Translated label for each account type, with count of groups under that type
const typeLabels = useMemo(() => {
  const labels: Record<AccountType, string> = {} as Record<AccountType, string>
  for (const type of TYPES) {
    const label = t(TYPE_I18N_KEYS[type])
    const count = groups.filter((g) => g.type === type).length
    labels[type] = `${label} (${count})`
  }
  return labels
}, [groups, t])

// Derived hierarchy options from loaded account groups
const accountCategories = useMemo(
  () => groups.filter((g) => (g.level ?? 0) === 0 && g.type === formClass),
  [groups, formClass],
)
// Resolve parent id from a group (Payload may return object at depth:1 or raw id)
const groupParentId = (g: AccountGroup): number | null => {
  const p = g.parent
  if (p === null || p === undefined) return null
  return typeof p === 'object' ? p.id : p
}

// Count of level-1 groups under each category (for badge display)
const categoryChildCounts = useMemo(
  () =>
    Object.fromEntries(
      accountCategories.map((cat) => [
        String(cat.id),
        groups.filter(
          (g) => (g.level ?? 0) === 1 && g.type === formClass && groupParentId(g) === cat.id,
        ).length,
      ]),
    ),
  [accountCategories, groups, formClass],
)
const accountGroups = useMemo(
  () =>
    groups.filter(
      (g) =>
        (g.level ?? 0) === 1 &&
        g.type === formClass &&
        groupParentId(g) === (formCategory ? Number(formCategory) : null),
    ),
  [groups, formClass, formCategory],
)
const accountSubgroups = useMemo(
  () =>
    groups.filter(
      (g) =>
        (g.level ?? 0) >= 2 &&
        g.type === formClass &&
        groupParentId(g) === (formGroup ? Number(formGroup) : null),
    ),
  [groups, formClass, formGroup],
)

// Most specific group selected (subgroup > group > category)
const selectedGroupId = useMemo(
  () => (formSubgroup ? Number(formSubgroup) : formGroup ? Number(formGroup) : formCategory ? Number(formCategory) : undefined),
  [formSubgroup, formGroup, formCategory],
)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { selectedYear } = useFiscalYear()

  const seedRecommendedCoa = async () => {
    setSeedingCoa(true)
    try {
      await api('/data-ops/seed-demo', {
        method: 'POST',
        body: {
          chartOnly: false,
          seeds: ['accountGroups', 'accounts', 'taxTypes', 'parties', 'items', 'vouchers', 'fiscalYears'],
          tenant: tenantId ? String(tenantId) : undefined,
        },
      })
      pushToast('success', 'Demo Data Initialized', 'Groups, accounts, tax types, parties, items, fiscal year, and draft vouchers loaded.')
      await load()
    } catch (err) {
      pushToast('error', 'Initialization failed', err instanceof Error ? err.message : String(err))
    } finally {
      setSeedingCoa(false)
    }
  }

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [a, g, o] = await Promise.all([
        list<Account>('gl-accounts', { depth: 0, sort: 'name', ...tenantQuery }),
        list<AccountGroup>('account-groups', { depth: 0, sort: 'name' }),
        selectedYear
          ? api<{ docs: OpeningBalance[] }>('/opening-balances/for-year', {
              query: { fiscalYear: String(selectedYear.id), ...tenantQuery },
            })
          : Promise.resolve({ docs: [] }),
      ])
      setAccounts(a.docs)
      setGroups(g.docs)
      const map: Record<number, number> = {}
      for (const b of o.docs || []) {
        const id = typeof b.account === 'object' ? b.account.id : b.account
        map[id] = Number(b.amount || 0)
      }
      setOpenings(map)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // reload when the working fiscal year changes — the opening column is FY-scoped
  }, [cacheVersion, tenantId, selectedYear?.id])

  const openNew = () => {
    setForm(emptyForm)
    setEditing(null)
    setFormClass('asset')
    setFormCategory('')
    setFormGroup('')
    setFormSubgroup('')
    setShowAddGroup(false)
    setShowAddSubgroup(false)
    setNewGroupName('')
    setNewSubgroupName('')
    setShowForm((s) => !s)
  }

  const startEdit = (a: Account) => {
    const p = a.parent && typeof a.parent !== 'number' ? (a.parent as Account).id : a.parent
    const groupId = a.group ? (typeof a.group === 'object' ? (a.group as AccountGroup).id : a.group) : undefined
    const selectedGroup = groupId ? groups.find((g) => g.id === groupId) : undefined

    // Walk up the group hierarchy to find category (level 0), group (level 1), subgroup (level 2+)
    let categoryId: string = ''
    let groupHierarchyId: string = ''
    let subgroupId: string = ''

    if (selectedGroup) {
      const selLevel = selectedGroup.level ?? 0
      if (selLevel >= 2) {
        subgroupId = String(selectedGroup.id)
        const parentId =
          typeof selectedGroup.parent === 'number'
            ? selectedGroup.parent
            : selectedGroup.parent?.id
        const parentGroup = parentId ? groups.find((g) => g.id === parentId) : undefined
        if (parentGroup) {
          groupHierarchyId = String(parentGroup.id)
          const catId =
            typeof parentGroup.parent === 'number'
              ? parentGroup.parent
              : parentGroup.parent?.id
          const category = catId ? groups.find((g) => g.id === catId) : undefined
          if (category) categoryId = String(category.id)
        }
      } else if (selLevel === 1) {
        groupHierarchyId = String(selectedGroup.id)
        const catId =
          typeof selectedGroup.parent === 'number'
            ? selectedGroup.parent
            : selectedGroup.parent?.id
        const category = catId ? groups.find((g) => g.id === catId) : undefined
        if (category) categoryId = String(category.id)
      } else if (selLevel === 0) {
        categoryId = String(selectedGroup.id)
      }
    }

    setForm({
      name: a.name,
      code: a.code || '',
      type: a.type,
      class: a.class || 'other',
      group: groupId ? String(groupId) : '',
      description: a.description || '',
      parent: p ? String(p) : '',
      currency: a.currency || 'NPR',
    })
    setFormClass(a.type)
    setFormCategory(categoryId)
    setFormGroup(groupHierarchyId)
    setFormSubgroup(subgroupId)
    setEditing(a.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleEditGroup = (g: AccountGroup) => {
    setGroupToEdit(g)
    setShowCoaSetup(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = {
        name: form.name,
        code: form.code || undefined,
        type: formClass,
        class: form.class,
        group: selectedGroupId,
        currency: form.currency || undefined,
        ...(form.parent ? { parent: Number(form.parent) } : {}),
        ...(tenantId ? { tenant: tenantId } : {}),
      }
      if (editing) {
        await api(`/gl-accounts/${editing}`, { method: 'PATCH', body })
      } else {
        await api('/gl-accounts', { method: 'POST', body })
      }
      setForm(emptyForm)
      setEditing(null)
      setShowForm(false)
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : editing ? 'Failed to update account' : 'Failed to create account')
    }
    setSaving(false)
  }

  const remove = async (id: number, isGroup = false) => {
    if (!window.confirm('Delete this account?')) return
    try {
      // Check for dependencies before deleting
      const balanceDep = await api<{ count: number }>('/gl-accounts/balances', {
        query: { depth: 0, 'account[id][equals]': String(id) },
      })
      const openingDep = await api<{ count: number }>('/opening-balances/for-year', {
        query: { depth: 0, 'account[id][equals]': String(id), fiscalYear: String(selectedYear?.id) },
      })
      const hasDep = (balanceDep.count || 0) > 0 || (openingDep.count || 0) > 0
      if (hasDep) {
        setError(
          'Cannot delete account — it is referenced by posted journal entries or opening balances. Remove those first.'
        )
        return
      }
      // Groups with child accounts cannot be deleted — move or delete
      // the sub-items first so no account is left pointing at a dead group.
      if (isGroup) {
        const children = accounts.filter((a) => {
          const g = a.group
          return g && (typeof g === 'object' ? g.id === id : g === id)
        })
        if (children.length > 0) {
          setError(
            `Cannot delete heading — ${children.length} account${children.length === 1 ? '' : 's'} still assigned to it. Move or delete them first.`
          )
          return
        }
      }
      // Queued to the offline outbox — flushes on reconnect when offline.
      await api(isGroup ? `/account-groups/${id}` : `/gl-accounts/${id}`, { method: 'DELETE' })
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
    }
  }

  const groupName = (a: Account) => {
    const g = a.group && typeof a.group === 'object' ? a.group : groups.find((x) => x.id === a.group)
    return g ? `${g.name}${g.code ? ` (${g.code})` : ''}` : '—'
  }

  // Resolve parent id from an account (Payload may return object at depth:1 or raw id)
  const parentIdOf = (a: Account): number | null => {
    const p = a.parent
    if (p === null || p === undefined) return null
    return typeof p === 'object' ? p.id : p
  }

  // Compute depth (level) of an account by walking up the parent chain.
  // Depth 0 = root, Depth 1 = child, Depth 2 = grandchild, etc.
  const accountDepth = useMemo(() => {
    const cache = new Map<number, number>()
    const getDepth = (id: number): number => {
      if (cache.has(id)) return cache.get(id)!
      const a = accounts.find((x) => x.id === id)
      if (!a) return 0
      const p = parentIdOf(a)
      const d = p === null ? 0 : getDepth(p) + 1
      cache.set(id, d)
      return d
    }
    const depths = new Map<number, number>()
    for (const a of accounts) {
      depths.set(a.id, getDepth(a.id))
    }
    return depths
  }, [accounts])

  // All descendant ids of the account being edited — excluded from parent options to prevent cycles
  const descendantIds = useMemo(() => {
    if (editing === null) return new Set<number>()
    const seen = new Set<number>()
    const queue = [editing]
    while (queue.length) {
      const cur = queue.shift()!
      if (seen.has(cur)) continue
      seen.add(cur)
      for (const a of accounts) {
        const p = parentIdOf(a)
        if (p === cur) {
          seen.add(a.id)
          queue.push(a.id)
        }
      }
    }
    seen.delete(editing)
    return seen
  }, [accounts, editing])

  const parentOptions = useMemo(() => {
    if (editing === null) return accounts
    return accounts.filter((a) => a.id !== editing && !descendantIds.has(a.id))
  }, [accounts, editing, descendantIds])
  const handleClassChange = (type: AccountType) => {
    setFormClass(type)
    setForm((f) => ({ ...f, type }))
    setFormCategory('')
    setFormGroup('')
    setFormSubgroup('')
  }

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormCategory(e.target.value)
    setFormSubgroup('')
    // Auto-fill the account group with the first group under the chosen category
    const catId = Number(e.target.value)
    const firstGroup = groups.find(
      (g) => (g.level ?? 0) === 1 && g.type === formClass && groupParentId(g) === catId,
    )
    if (firstGroup) {
      setFormGroup(String(firstGroup.id))
    } else {
      setFormGroup('')
    }
  }

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormGroup(e.target.value)
    setFormSubgroup('')
    // Auto-fill the account subgroup with the first subgroup under the chosen group
    const grpId = e.target.value ? Number(e.target.value) : null
    const firstSubgroup = grpId
      ? groups.find(
          (g) =>
            (g.level ?? 0) >= 2 && g.type === formClass && groupParentId(g) === grpId,
        )
      : undefined
    if (firstSubgroup) {
      setFormSubgroup(String(firstSubgroup.id))
    }
  }

  const handleSubgroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormSubgroup(e.target.value)
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !formCategory) return
    try {
      const created = await api('/account-groups', {
        method: 'POST',
        body: {
          name: newGroupName.trim(),
          type: formClass,
          parent: Number(formCategory),
          level: 1,
          ...(tenantId ? { tenant: tenantId } : {}),
        },
      })
      setNewGroupName('')
      setShowAddGroup(false)
      await load()
      // Select the newly created group
      if (created && typeof created === 'object' && 'id' in created) {
        setFormGroup(String((created as any).id))
      }
    } catch (err) {
      pushToast('error', 'Failed to create group', err instanceof Error ? err.message : String(err))
    }
  }

  const handleCreateSubgroup = async () => {
    if (!newSubgroupName.trim() || !formGroup) return
    try {
      const parentGroup = groups.find((g) => g.id === Number(formGroup))
      const created = await api('/account-groups', {
        method: 'POST',
        body: {
          name: newSubgroupName.trim(),
          type: formClass,
          parent: Number(formGroup),
          level: (parentGroup?.level ?? 0) + 1,
          ...(tenantId ? { tenant: tenantId } : {}),
        },
      })
      setNewSubgroupName('')
      setShowAddSubgroup(false)
      await load()
      if (created && typeof created === 'object' && 'id' in created) {
        setFormSubgroup(String((created as any).id))
      }
    } catch (err) {
      pushToast('error', 'Failed to create subgroup', err instanceof Error ? err.message : String(err))
    }
  }

  const [searchParams, setSearchParams] = useSearchParams()
  const urlSortKey = searchParams.get('sort') || 'name'
  const urlSortDir = (searchParams.get('dir') as 'asc' | 'desc') || 'asc'
  const urlQuery = searchParams.get('q') || ''

  const syncToUrl = useCallback((_q: string, s: SortState) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (_q) params.set('q', _q); else params.delete('q')
      if (s.key && s.key !== 'name') params.set('sort', s.key); else params.delete('sort')
      if (s.key && s.dir !== 'asc') params.set('dir', s.dir); else params.delete('dir')
      return params
    }, { replace: true })
  }, [setSearchParams])

  const { query, setQuery, sort, toggleSort, visible } = useSortSearch(accounts, {
    searchable: (a) =>
      [a.name, a.code || '', groupName(a), a.class || ''].join(' '),
    valueOf: (a, key) => {
        switch (key) {
          case 'group':
            return groupName(a)
          case 'opening':
            return Number(a.openingBalance) || 0
          default:
            return (a as unknown as Record<string, unknown>)[key] as
              | string
              | number
              | undefined
        }
      },
      defaultSort: { key: 'name', dir: 'asc' },
      initialQuery: urlQuery,
      initialSort: { key: urlSortKey, dir: urlSortDir },
      onChange: syncToUrl,
    })

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">{t('accounts.title', 'Chart of Accounts')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {accounts.length === 0 && (
            <LiquidButton
              onClick={seedRecommendedCoa}
              disabled={seedingCoa}
              variant="primary"
              size="sm"
              className="!bg-emerald-600 hover:!bg-emerald-700 !border-emerald-600"
            >
              <Sparkles size={14} /> {seedingCoa ? 'Initializing…' : 'Seed Demo Data'}
            </LiquidButton>
          )}
          <LiquidButton
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            size="sm"
          >
            <Upload size={14} /> {t('import.button', 'Import')}
          </LiquidButton>
          <LiquidButton
            onClick={() => setShowExportModal(true)}
            variant="outline"
            size="sm"
          >
            <Download size={14} /> {t('export.button', 'Export')}
          </LiquidButton>
          <LiquidButton
            onClick={() => setShowCoaSetup(true)}
            variant="outline"
            size="sm"
            title="Configure account headings, custom categories, or apply standard structure"
          >
            <FolderTree size={14} /> Structure & Headings
          </LiquidButton>
          <LiquidButton
            onClick={openNew}
            variant="accent"
            size="sm"
          >
            <Plus size={14} />
            New account
          </LiquidButton>
        </div>
      </div>

      <div className="mt-3">
        <PageGuide
          storageKey="accounts-page"
          title="Chart of Accounts Guide"
          description="The Chart of Accounts organizes your financial records into 5 standard classes: Assets, Liabilities, Equity, Income, and Expenses. Groups define broad headings, while accounts track double-entry transaction balances."
          tips={[
            "Click 'Seed Recommended Chart' to populate standard organization groups & accounts in 1 click.",
            "Switch between Tree and Table view to inspect hierarchical account structures.",
            "Assign default accounts in Settings to enable automated posting for Sales, Purchases, and Receipts.",
            "Use Excel Import/Export to manage or backup your chart of accounts."
          ]}
        />
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="text-slate-500">{t('accounts.view', 'View:')}</span>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setView('tree')}
            className={`px-3 py-1.5 rounded-l-lg text-sm font-medium transition-colors ${
              view === 'tree'
                ? 'bg-slate-100 text-slate-900 border-r border-slate-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t('accounts.viewTree', 'Tree')}
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className={`px-3 py-1.5 rounded-r-lg text-sm font-medium transition-colors ${
              view === 'table'
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t('accounts.viewTable', 'Table')}
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv,.xlsx,.xls"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          try {
            const parsed = await parseImportFile<Record<string, unknown>>(file, 'gl-accounts')
            const { errors: rowErrors } = validateImportRows(parsed.docs, parsed.collection)
            setImportData({ collection: parsed.collection, docs: parsed.docs, rowErrors })
          } catch (err) {
            pushToast('error', 'Parse failed', err instanceof Error ? err.message : String(err))
          }
          e.target.value = ''
        }}
      />

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={save}
          className="mt-4 rounded-lg border border-slate-200 bg-white p-5 space-y-6"
        >
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            {editing ? 'Edit Account' : 'New Account'}
          </h3>

          {/* Section 1: Account Classification */}
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              1. Account Classification
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Account Class */}
              <label className="text-sm text-slate-700">
                Account Class *
                <select
                  value={formClass}
                  onChange={(e) => handleClassChange(e.target.value as AccountType)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {typeLabels[t]}
                    </option>
                  ))}
                </select>
              </label>

              {/* Account Category (level 0) */}
              <label className="text-sm text-slate-700">
                Account Category *
                <select
                  value={formCategory}
                  onChange={handleCategoryChange}
                  disabled={!formClass}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">— select category —</option>
                  {accountCategories.length === 0 ? (
                    <option value="__no-categories__" disabled>
                      No {typeLabels[formClass].toLowerCase()} categories yet
                    </option>
                  ) : (
                    accountCategories.map((cat) => {
                      const childCount = categoryChildCounts[String(cat.id)] ?? 0
                      return (
                        <option key={cat.id} value={String(cat.id)}>
                          {cat.name} ({childCount})
                        </option>
                      )
                    })
                  )}
                </select>
              </label>

              {/* Account Group (level 1) */}
              <label className="text-sm text-slate-700">
                Account Group
                <div className="flex flex-col sm:flex-row items-end gap-2">
                  <select
                    value={formGroup}
                    onChange={handleGroupChange}
                    disabled={!formCategory}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">— select category first —</option>
                    {accountGroups.length === 0 ? (
                      <option value="__no-groups__" disabled>
                        No groups under this category
                      </option>
                    ) : (
                      accountGroups.map((grp) => (
                        <option key={grp.id} value={String(grp.id)}>
                          {grp.name}
                        </option>
                      ))
                    )}
                  </select>
                  {formCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddGroup(true)
                        setNewGroupName('')
                      }}
                      disabled={saving || !formCategory}
                      className="px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 hover:border-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Add
                    </button>
                  )}
                </div>
              </label>

              {/* Account Subgroup (level 2+) */}
              <label className="text-sm text-slate-700">
                Account Subgroup
                <div className="flex flex-col sm:flex-row items-end gap-2">
                  <select
                    value={formSubgroup}
                    onChange={handleSubgroupChange}
                    disabled={!formGroup}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">— select group first —</option>
                    {accountSubgroups.length === 0 ? (
                      <option value="__no-subgroups__" disabled>
                        No subgroups under this group
                      </option>
                    ) : (
                      accountSubgroups.map((sub) => (
                        <option key={sub.id} value={String(sub.id)}>
                          {sub.name}
                        </option>
                      ))
                    )}
                  </select>
                  {formGroup && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddSubgroup(true)
                        setNewSubgroupName('')
                      }}
                      disabled={saving || !formGroup}
                      className="px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 hover:border-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Add
                    </button>
                  )}
                </div>
              </label>
            </div>
          </section>

          {/* Section 2: Ledger Account Details */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              2. Ledger Account Details
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm text-slate-700">
                Name *
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm text-slate-700">
                Code
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
              </label>
              <label className="text-sm text-slate-700">
                Class
                <select
                  value={form.class}
                  onChange={(e) => setForm({ ...form, class: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                  <option value="other">{t('accounts.classOther', 'Other')}</option>
                  <option value="cash">{t('accounts.classCash', 'Cash')}</option>
                  <option value="bank">{t('accounts.classBank', 'Bank')}</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">
                {t('accounts.currency', 'Currency')}
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value as Currency })}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Description
                <textarea
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  rows={2}
                />
              </label>
            </div>
          </section>

          {/* Section 3: Parent Account (optional) */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              3. Parent Account (optional)
            </h4>
            <label className="text-sm text-slate-700">
              Parent
              <select
                value={form.parent}
                onChange={(e) => setForm({ ...form, parent: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                <option value="">— none —</option>
                {parentOptions.length === 0 ? (
                  <option value="__no-parents__" disabled>No parent accounts available</option>
                ) : (
                  parentOptions.map((a) => {
                    const depth = accountDepth.get(a.id) ?? 0
                    return (
                      <option key={a.id} value={String(a.id)}>
                        {depth > 0 ? '  '.repeat(depth) + '└─ ' : ''}
                        {a.code ? `[${a.code}] ` : ''}{a.name}
                      </option>
                    )
                  })
                )}
              </select>
            </label>
          </section>

          {/* Inline Add Group form */}
          {showAddGroup && (
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Add Account Group
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-slate-600">Group Name <span className="text-crimson-600 font-bold ml-0.5">*</span></label>
                  <input
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Current Assets"
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  />
                </div>
                <div className="col-span-2 text-xs text-slate-500">
                  Will be created under the selected category as a level-1 group.
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddGroup(false)}
                  disabled={saving}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={saving || !newGroupName.trim() || !formCategory}
                  className="px-3 py-1.5 rounded bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-50"
                >
                  Create Group
                </button>
              </div>
            </section>
          )}

          {/* Inline Add Subgroup form */}
          {showAddSubgroup && (
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Add Account Subgroup
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-slate-600">Subgroup Name <span className="text-crimson-600 font-bold ml-0.5">*</span></label>
                  <input
                    required
                    value={newSubgroupName}
                    onChange={(e) => setNewSubgroupName(e.target.value)}
                    placeholder="e.g. Bank Accounts"
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  />
                </div>
                <div className="col-span-2 text-xs text-slate-500">
                  Will be created under the selected group.
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubgroup(false)}
                  disabled={saving}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-600 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateSubgroup}
                  disabled={saving || !newSubgroupName.trim() || !formGroup}
                  className="px-3 py-1.5 rounded bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-50"
                >
                  Create Subgroup
                </button>
              </div>
            </section>
          )}

          <div className="mt-4 flex gap-2">
            <LiquidButton
              type="submit"
              disabled={saving}
              variant="accent"
              size="sm"
            >
              {saving ? 'Saving…' : editing ? 'Update' : 'Save'}
            </LiquidButton>
            <LiquidButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { setShowForm(false); setEditing(null) }}
            >
              Cancel
            </LiquidButton>
          </div>
        </form>
      )}

      <div className="mt-2">
        <DataStatus />
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Loading accounts…</div>
      ) : (
        <div className="overflow-x-auto">
          <AccountsTable
            accounts={accounts}
            groups={groups}
            openings={openings}
            onEdit={startEdit}
            onEditGroup={handleEditGroup}
            onDelete={remove}
            onConfigureCoa={() => setShowCoaSetup(true)}
            onSeedCoa={seedRecommendedCoa}
            seeding={seedingCoa}
            view={view}
          />
        </div>
      )}

      <CoaSetupModal
        isOpen={showCoaSetup}
        onClose={() => {
          setShowCoaSetup(false)
          setGroupToEdit(undefined)
        }}
        onEditGroup={handleEditGroup}
        groupToEdit={groupToEdit}
        onSuccess={() => {
          load()
          setGroupToEdit(undefined)
          pushToast('success', 'Chart of Accounts configured successfully')
        }}
      />

      {showExportModal && (
        <ExportModal
          defaultCollection="gl-accounts"
          onClose={() => setShowExportModal(false)}
        />
      )}

      {importData && (
        <ImportPreviewModal
          collection={importData.collection}
          docs={importData.docs}
          rowErrors={importData.rowErrors}
          onClose={() => setImportData(null)}
          onImported={() => {
            setImportData(null)
            load()
          }}
        />
      )}
    </div>
  )
}
