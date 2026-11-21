/* ================================================================
 * Shared transaction-line component.
 *
 * Reusable across sales-invoice, purchase-invoice, payment-voucher,
 * receipt-voucher, journal-voucher, GRN, delivery-challan, etc.
 *
 * Provides:
 *   - Item picker → auto-resolves GL account (salesAccount on sales,
 *     purchaseAccount on purchases), default rate/unit/description
 *   - Account picker (fallback when no item or item has no account)
 *   - Conditional subledger selector based on account type:
 *     asset/liability → Party; income/expense → Item/Project
 *   - Calculation via transactionCalc (qty, rate, discount, tax)
 *   - Emits { key, ...patch } on every change for the parent to own state
 * ================================================================ */

import { useCallback, useMemo, useState } from 'react'
import { Plus, Search, Trash2, ChevronDown, X, Users, Building2, Wallet, CreditCard } from 'lucide-react'
import { api } from '../lib/api'
import { calcLine, type LineInput, type LineResult } from '../lib/transactionCalc'
import AccountSelect from './AccountSelect'
import { useT } from '../lib/i18n'
import type { Account, Item, Party, TaxType } from '../lib/types'

interface TransactionLineProps {
  line: LineInput
  index: number
  items: Item[]
  parties: Party[]
  accounts: Account[]
  taxTypes: TaxType[]
  transactionType: 'sales' | 'purchase' | 'payment' | 'receipt' | 'journal' | 'other'
  disabled?: boolean
  showSubledger?: boolean
  onTabLast?: () => void
  onChange: (key: string | undefined, patch: Partial<LineInput>) => void
  onRemove: (key: string | undefined) => void
}

interface SubledgerOption {
  id: string | number
  label: string
}

function resolveAccountForItem(item: Item | undefined, transactionType: 'sales' | 'purchase' | 'payment' | 'receipt' | 'journal' | 'other'): number | null {
  if (!item) return null
  if (transactionType === 'sales' || transactionType === 'receipt') return item.salesAccount ?? null
  if (transactionType === 'purchase' || transactionType === 'payment') return item.purchaseAccount ?? null
  return null
}

function resolveTaxForItem(item: Item | undefined, transactionType: 'sales' | 'purchase' | 'payment' | 'receipt' | 'journal' | 'other'): number | null {
  if (!item) return null
  if (transactionType === 'sales' || transactionType === 'receipt') return item.salesTaxCode ?? null
  if (transactionType === 'purchase' || transactionType === 'payment') return item.purchaseTaxCode ?? null
  return null
}

export function subledgerSelectorForAccount(account: Account | undefined, hasItemPicker: boolean = false): 'party' | 'item' | 'project' | null {
  if (!account) return null
  switch (account.type) {
    case 'asset':
    case 'liability':
      return 'party'
    case 'income':
    case 'expense':
      return hasItemPicker ? null : 'item'
    default:
      return null
  }
}

export default function TransactionLine({
  line,
  index,
  items,
  parties,
  accounts,
  taxTypes,
  transactionType,
  disabled = false,
  showSubledger = false,
  onTabLast,
  onChange,
  onRemove,
}: TransactionLineProps) {
  const t = useT()

  const itemKey = String(line.item || '')
  const [createdItems, setCreatedItems] = useState<Item[]>([])
  const allItems = useMemo(() => items.concat(createdItems), [items, createdItems])
  const selectedItem = allItems.find((it) => String(it.id) === itemKey)
  const accountKey = String(line.account || '')
  const selectedAccount = accounts.find((a) => String(a.id) === accountKey)
  const taxKey = String(line.taxType || '')
  const selectedTaxType = taxTypes.find((t) => String(t.id) === taxKey)

  const [subledgerOpen, setSubledgerOpen] = useState(false)
  const [subledgerQuery, setSubledgerQuery] = useState('')
  const [itemDropdownOpen, setItemDropdownOpen] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [creating, setCreating] = useState(false)
  const [addItemError, setAddItemError] = useState('')
  const [addItemForm, setAddItemForm] = useState({
    name: '',
    code: '',
    unit: '',
    itemType: 'non-inventory' as ('non-inventory' | 'inventory'),
    salesAccount: '',
    purchaseAccount: '',
    salesTaxCode: '',
    purchaseTaxCode: '',
    defaultDescription: '',
    salePrice: '',
    purchasePrice: '',
  })

  const subledgerKind = useMemo(() => subledgerSelectorForAccount(selectedAccount, true), [selectedAccount])

  // When an item is picked, auto-fill account/rate/unit/description/tax.
  const handleItemChange = useCallback(
    (id: string) => {
      const it = allItems.find((i) => String(i.id) === id)
      if (!it) return
      const acct = resolveAccountForItem(it, transactionType)
      const tax = resolveTaxForItem(it, transactionType)
      const patch: Partial<LineInput> = {
        item: id,
        description: it.defaultDescription || it.name,
        unit: it.unit || '',
        rate: it.salePrice ? String(it.salePrice) : String(it.purchasePrice || 0),
        amount: '',
        account: acct ? String(acct) : '',
        taxType: tax ? String(tax) : '',
        taxRate: '',
        // Clear subaccount when item auto-resolves to a different account —
        // a subaccount valid for the old account may be invalid for the new one.
        ...(acct && String(acct) !== String(line.account || '') ? { subAccount: '' } : {}),
      }
      onChange(line.key, patch)
    },
    [allItems, transactionType, line.key, onChange],
  )

  // Re-resolve defaults when transactionType changes (e.g. sales→purchase).
  // ponytail: only re-resolve if no manual account override has been made.
  // This keeps explicit user choices intact.

  const handleAccountChange = useCallback(
    (id: string) => {
      const acct = accounts.find((a) => String(a.id) === id)
      onChange(line.key, { account: id, subAccount: '' })
      setSubledgerOpen(!!acct)
    },
    [accounts, line.key, onChange],
  )

  const handleSubledgerChange = useCallback((id: string) => {
    onChange(line.key, { subAccount: id })
    setSubledgerOpen(false)
  }, [line.key, onChange])

  const calc = useMemo(() => calcLine(line), [line.qty, line.rate, line.amount, line.discountPct, line.discountAmt, line.taxRate, line.taxNature])

  const subledgerOptions = useMemo((): SubledgerOption[] => {
    if (!subledgerKind) return []
    let pool: { id: string | number; label: string }[] = []
    if (subledgerKind === 'party') {
      pool = parties.map((p) => ({ id: p.id, label: p.name }))
    } else if (subledgerKind === 'item') {
      pool = allItems.slice(0, 30).map((it) => ({ id: it.id, label: it.name }))
    } else {
      pool = []
    }
    const q = subledgerQuery.toLowerCase()
    return pool.filter((o) => o.label.toLowerCase().includes(q))
  }, [subledgerKind, subledgerQuery, allItems])

  const selectedSubAccountName = useMemo(() => {
    if (!line.subAccount) return ''
    if (subledgerKind === 'party') {
      const p = parties.find((p) => String(p.id) === String(line.subAccount))
      return p ? p.name : ''
    }
    if (subledgerKind === 'item') {
      const it = items.find((it) => String(it.id) === String(line.subAccount))
      return it ? it.name : ''
    }
    return ''
  }, [line.subAccount, subledgerKind, parties, items])

  const emptyAddForm = {
    name: '',
    code: '',
    unit: '',
    itemType: 'non-inventory' as ('non-inventory' | 'inventory'),
    salesAccount: '',
    purchaseAccount: '',
    salesTaxCode: '',
    purchaseTaxCode: '',
    defaultDescription: '',
    salePrice: '',
    purchasePrice: '',
  }

  const saveAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setAddItemError('')
    try {
      const body: Record<string, unknown> = {
        name: addItemForm.name,
        code: addItemForm.code || undefined,
        unit: addItemForm.unit || undefined,
        itemType: addItemForm.itemType,
        salesAccount: addItemForm.salesAccount ? Number(addItemForm.salesAccount) : undefined,
        purchaseAccount: addItemForm.purchaseAccount ? Number(addItemForm.purchaseAccount) : undefined,
        salesTaxCode: addItemForm.salesTaxCode ? Number(addItemForm.salesTaxCode) : undefined,
        purchaseTaxCode: addItemForm.purchaseTaxCode ? Number(addItemForm.purchaseTaxCode) : undefined,
        defaultDescription: addItemForm.defaultDescription || undefined,
        salePrice: addItemForm.salePrice ? Number(addItemForm.salePrice) : undefined,
        purchasePrice: addItemForm.purchasePrice ? Number(addItemForm.purchasePrice) : undefined,
      }
      const res = await api<{ doc: Item }>('/items', { method: 'POST', body })
      const it = res.doc
      setCreatedItems((prev) => [...prev, it])
      setAddItemForm(emptyAddForm)
      setShowAddItem(false)
      setAddItemError('')
      await handleItemChange(String(it.id))
    } catch (err) {
      setAddItemError(err instanceof Error ? err.message : 'Failed to create item')
    } finally {
      setCreating(false)
    }
  }

  return (<>
    <tr key={line.key} className="border-b border-slate-50">
      <td className="px-2 py-2 text-center text-slate-400">{index + 1}</td>

      {/* Item / description */}
      <td className="min-w-[220px] px-2 py-2">
        <div className="relative">
          <input
            type="text"
            value={selectedItem ? selectedItem.name : (line.description || '')}
            onChange={(e) => {
              const q = e.target.value
              onChange(line.key, { description: q, item: '', account: '' })
              setSubledgerOpen(false)
              setItemDropdownOpen(true)
            }}
            onFocus={() => {
              setSubledgerOpen(false)
              setItemDropdownOpen(true)
            }}
            onBlur={() => {
              setTimeout(() => setItemDropdownOpen(false), 200)
            }}
            placeholder={t('vouchers.enterItemName', 'Enter item')}
            className="w-full rounded border border-slate-200 px-2 py-2 text-sm outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => {}}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-40"
            disabled
            aria-label="Search items"
          >
            <Search size={14} />
          </button>
          {/* Item results dropdown (show matches by name or code) */}
          {(itemDropdownOpen && !selectedItem && line.description && line.description.length > 0) && (
            <div className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto overscroll-y-contain rounded border border-slate-200 bg-white shadow-lg">
              {allItems
                .filter((it) => {
                  const q = line.description!.toLowerCase()
                  return it.name.toLowerCase().includes(q) || (it.code && it.code.toLowerCase().includes(q))
                })
                .slice(0, 8)
                .map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setItemDropdownOpen(false)
                      handleItemChange(String(it.id))
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
                  >
                    {it.code ? <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">{it.code}</span> : null}
                    <span className="flex-1 truncate">{it.name}</span>
                  </button>
                ))}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setItemDropdownOpen(false)
                  setShowAddItem(true)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 border-t border-slate-100"
              >
                <Plus size={14} /> {t('vouchers.addItem', 'Add Item')}
              </button>
            </div>
          )}
        </div>
        {selectedItem && (
          <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
              {t('vouchers.itemType', 'Type')}: {selectedItem.itemType === 'inventory' ? t('items.inventoryItem', 'Inventory') : t('items.nonInventoryItem', 'Non-inventory')}
            </span>
            {selectedAccount && (
              <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700">
                {t('vouchers.account', 'Account')}: {selectedAccount.code ? `${selectedAccount.code} · ` : ''}{selectedAccount.name}
              </span>
            )}
          </div>
        )}
      </td>

      {/* Account */}
      <td className="min-w-[180px] px-2 py-2">
        <AccountSelect
          accounts={accounts}
          value={String(line.account ?? '')}
          onChange={handleAccountChange}
          disabled={disabled}
        />
      </td>

      {/* Conditional subledger selector */}
      {showSubledger && (
        <td className="min-w-[140px] px-2 py-2">
          {subledgerKind ? (
            subledgerOpen ? (
              <div className="relative">
                <input
                  type="text"
                  value={subledgerQuery}
                  onChange={(e) => setSubledgerQuery(e.target.value)}
                  placeholder={t('vouchers.selectSubledger', 'Select subledger')}
                  className="w-full rounded border border-slate-200 px-2 py-2 text-sm outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
                  disabled={disabled}
                />
                <div className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto overscroll-y-contain rounded border border-slate-200 bg-white shadow-lg">
                  {subledgerOptions.length === 0 ? (
                    <p className="px-3 py-3 text-center text-xs text-slate-400">{t('vouchers.noSubledgerMatch', 'No matches')}</p>
                  ) : (
                    subledgerOptions.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => handleSubledgerChange(String(o.id))}
                        className="flex w-full items-center px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
                      >
                        <span className="flex-1 truncate">{o.label}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSubledgerOpen(true)}
                disabled={disabled}
                className="flex items-center gap-1 px-2 py-2 rounded border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                {subledgerKind === 'party' ? <Users size={12} /> : subledgerKind === 'item' ? <Building2 size={12} /> : <Wallet size={12} />}
                <span>{selectedSubAccountName || (subledgerKind === 'party' ? t('vouchers.party', 'Party') : subledgerKind === 'item' ? t('vouchers.item', 'Item') : t('vouchers.project', 'Project'))}</span>
                <ChevronDown size={10} className="ml-0.5" />
              </button>
            )
          ) : (
            <span className="text-slate-300 text-xs">—</span>
          )}
        </td>
      )}

      {/* Qty */}
      <td className="px-2 py-2 text-right">
        <input
          type="number"
          step="any"
          min="0"
          value={String(line.qty ?? '')}
          onChange={(e) => onChange(line.key, { qty: e.target.value })}
          className="w-full rounded border border-slate-200 px-2 py-2 text-sm text-right outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
          disabled={disabled}
        />
      </td>

      {/* Rate */}
      <td className="px-2 py-2 text-right">
        <input
          type="number"
          step="0.01"
          min="0"
          value={String(line.rate ?? '')}
          onChange={(e) => onChange(line.key, { rate: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && !e.shiftKey && taxTypes.length === 0 && onTabLast) {
              onTabLast()
            }
          }}
          className="w-full rounded border border-slate-200 px-2 py-2 text-sm text-right outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
          disabled={disabled}
        />
      </td>

      {/* Discount */}
      <td className="px-2 py-2 text-right">
        <input
          type="number"
          step="0.01"
          min="0"
          value={String(line.discountAmt ?? '')}
          onChange={(e) => onChange(line.key, { discountAmt: e.target.value })}
          className="w-full rounded border border-slate-200 px-2 py-2 text-sm text-right outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
          disabled={disabled}
        />
      </td>

      {/* Amount */}
      <td className="px-2 py-2 text-right font-mono text-xs">
        {calc.subtotal.toFixed(2)}
      </td>

      {/* Tax code */}
      <td className="px-2 py-2">
        <AccountSelect
          accounts={taxTypes.map((t) => ({ id: t.id, code: t.code, name: t.name, type: 'expense' as const }))}
          value={String(line.taxType ?? '')}
          onChange={(id) => onChange(line.key, { taxType: id })}
          placeholder={t('vouchers.taxCode', 'Tax code')}
          disabled={disabled}
        />
      </td>

      {/* Tax rate */}
      <td className="px-2 py-2 text-right">
        <input
          type="number"
          step="0.01"
          min="0"
          value={String(line.taxRate ?? '')}
          onChange={(e) => onChange(line.key, { taxRate: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Tab' && !e.shiftKey && onTabLast) {
              onTabLast()
            }
          }}
          className="w-full rounded border border-slate-200 px-2 py-2 text-sm text-right outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
          disabled={disabled}
        />
      </td>

      {/* Tax amt */}
      <td className="px-2 py-2 text-right font-mono text-xs">
        {calc.taxAmt.toFixed(2)}
      </td>

      {/* Total */}
      <td className="px-2 py-2 text-right font-medium font-mono text-xs">
        {calc.total.toFixed(2)}
      </td>

      {/* Remove */}
      <td className="px-2 py-2 text-center">
        <button
          type="button"
          onClick={() => onRemove(line.key)}
          disabled={disabled}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:opacity-40"
          aria-label={t('vouchers.removeLine', 'Remove line')}
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
    {showAddItem && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t('items.addItem', 'Add Item')}>
        <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{t('items.addItem', 'Add Item')}</h2>
            <button
              type="button"
              onClick={() => { setShowAddItem(false); setAddItemError('') }}
              className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          <form onSubmit={saveAddItem} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('items.name', 'Item name')}</label>
                <input
                  name="name"
                  value={addItemForm.name}
                  onChange={(e) => setAddItemForm({ ...addItemForm, name: e.target.value })}
                  className="w-full rounded border border-slate-200 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('items.code', 'Code')}</label>
                <input
                  name="code"
                  value={addItemForm.code}
                  onChange={(e) => setAddItemForm({ ...addItemForm, code: e.target.value })}
                  className="w-full rounded border border-slate-200 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('items.unit', 'Unit')}</label>
                <input
                  name="unit"
                  value={addItemForm.unit}
                  onChange={(e) => setAddItemForm({ ...addItemForm, unit: e.target.value })}
                  className="w-full rounded border border-slate-200 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('items.itemType', 'Item type')}</label>
                <select
                  name="itemType"
                  value={addItemForm.itemType}
                  onChange={(e) => setAddItemForm({ ...addItemForm, itemType: e.target.value as 'non-inventory' | 'inventory' })}
                  className="w-full rounded border border-slate-200 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="non-inventory">{t('items.nonInventory', 'Non-inventory')}</option>
                  <option value="inventory">{t('items.inventory', 'Inventory')}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('items.salesAccount', 'Sales account')}</label>
                <AccountSelect value={addItemForm.salesAccount} onChange={(v) => setAddItemForm({ ...addItemForm, salesAccount: v })} accounts={accounts} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('items.purchaseAccount', 'Purchase account')}</label>
                <AccountSelect value={addItemForm.purchaseAccount} onChange={(v) => setAddItemForm({ ...addItemForm, purchaseAccount: v })} accounts={accounts} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('items.salesTaxCode', 'Sales tax')}</label>
                <select
                  name="salesTaxCode"
                  value={addItemForm.salesTaxCode}
                  onChange={(e) => setAddItemForm({ ...addItemForm, salesTaxCode: e.target.value })}
                  className="w-full rounded border border-slate-200 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">{t('items.none', 'None')}</option>
                  {taxTypes.map((t) => (
                    <option key={String(t.id)} value={String(t.id)}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('items.purchaseTaxCode', 'Purchase tax')}</label>
                <select
                  name="purchaseTaxCode"
                  value={addItemForm.purchaseTaxCode}
                  onChange={(e) => setAddItemForm({ ...addItemForm, purchaseTaxCode: e.target.value })}
                  className="w-full rounded border border-slate-200 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">{t('items.none', 'None')}</option>
                  {taxTypes.map((t) => (
                    <option key={String(t.id)} value={String(t.id)}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('items.defaultDescription', 'Default description')}</label>
              <textarea
                name="defaultDescription"
                value={addItemForm.defaultDescription}
                onChange={(e) => setAddItemForm({ ...addItemForm, defaultDescription: e.target.value })}
                rows={2}
                className="w-full rounded border border-slate-200 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={t('items.defaultDescriptionPlaceholder', 'e.g. Consulting service')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('items.salePrice', 'Sale price')}</label>
                <input
                  name="salePrice"
                  type="number"
                  step="0.01"
                  value={addItemForm.salePrice}
                  onChange={(e) => setAddItemForm({ ...addItemForm, salePrice: e.target.value })}
                  className="w-full rounded border border-slate-200 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('items.purchasePrice', 'Purchase price')}</label>
                <input
                  name="purchasePrice"
                  type="number"
                  step="0.01"
                  value={addItemForm.purchasePrice}
                  onChange={(e) => setAddItemForm({ ...addItemForm, purchasePrice: e.target.value })}
                  className="w-full rounded border border-slate-200 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            {addItemError && (
              <div className="rounded bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">{addItemError}</div>
            )}
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowAddItem(false); setAddItemError('') }}
                disabled={creating}
                className="px-4 py-2 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
              >
                {t('vouchers.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={creating || !addItemForm.name}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
              >
                {creating ? t('vouchers.creating', 'Creating…') : t('vouchers.save', 'Save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
  </>
)}

/* ================================================================
 * Document-level total row (shared).
 * ================================================================ */

interface DocTotalsProps {
  subtotal: number
  discountTotal: number
  taxTotal: number
  grandTotal: number
}

export function DocTotals({ subtotal, discountTotal, taxTotal, grandTotal }: DocTotalsProps) {
  const t = useT()
  return (
    <tfoot className="border-t border-slate-200">
      <tr>
        <td colSpan={7} className="px-2 py-2 text-right text-sm font-medium text-slate-600">
          {t('vouchers.subtotal', 'Subtotal')}
        </td>
        <td className="px-2 py-2 text-right font-mono text-xs text-slate-800">{subtotal.toFixed(2)}</td>
        <td colSpan={3} className="px-2 py-2"></td>
      </tr>
      {discountTotal > 0 && (
        <tr>
          <td colSpan={7} className="px-2 py-2 text-right text-sm font-medium text-slate-600">
            {t('vouchers.discountTotal', 'Discount')}
          </td>
          <td className="px-2 py-2 text-right font-mono text-xs text-slate-800">-{discountTotal.toFixed(2)}</td>
          <td colSpan={3} className="px-2 py-2"></td>
        </tr>
      )}
      {taxTotal !== 0 && (
        <tr>
          <td colSpan={7} className="px-2 py-2 text-right text-sm font-medium text-slate-600">
            {t('vouchers.taxTotal', 'Tax')}
          </td>
          <td className="px-2 py-2 text-right font-mono text-xs text-slate-800">{taxTotal > 0 ? '+' : ''}{taxTotal.toFixed(2)}</td>
          <td colSpan={3} className="px-2 py-2"></td>
        </tr>
      )}
      <tr className="font-semibold border-t border-slate-100 bg-slate-50">
        <td colSpan={7} className="px-2 py-2 text-right text-sm text-slate-900">
          {t('vouchers.grandTotal', 'Total')}
        </td>
        <td className="px-2 py-2 text-right font-mono text-sm text-slate-900">{grandTotal.toFixed(2)}</td>
        <td colSpan={3} className="px-2 py-2"></td>
      </tr>
    </tfoot>
  )
}
