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
import { Plus, Search, Trash2, ChevronDown, Users, Building2, Wallet, CreditCard } from 'lucide-react'
import { calcLine, type LineInput, type LineResult } from '../lib/transactionCalc'
import AccountSelect from './AccountSelect'
import { useT } from '../lib/i18n'
import type { Account, Item, TaxType } from '../lib/types'

interface TransactionLineProps {
  line: LineInput
  index: number
  items: Item[]
  accounts: Account[]
  taxTypes: TaxType[]
  transactionType: 'sales' | 'purchase' | 'payment' | 'receipt' | 'journal' | 'other'
  disabled?: boolean
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

function subledgerSelectorForAccount(account: Account | undefined): 'party' | 'item' | 'project' | null {
  if (!account) return null
  switch (account.type) {
    case 'asset':
    case 'liability':
      return 'party'
    case 'income':
    case 'expense':
      return 'item'
    default:
      return null
  }
}

export default function TransactionLine({
  line,
  index,
  items,
  accounts,
  taxTypes,
  transactionType,
  disabled = false,
  onChange,
  onRemove,
}: TransactionLineProps) {
  const t = useT()

  const itemKey = String(line.item || '')
  const selectedItem = items.find((it) => String(it.id) === itemKey)
  const accountKey = String(line.account || '')
  const selectedAccount = accounts.find((a) => String(a.id) === accountKey)
  const taxKey = String(line.taxType || '')
  const selectedTaxType = taxTypes.find((t) => String(t.id) === taxKey)

  const [subledgerOpen, setSubledgerOpen] = useState(false)
  const [subledgerQuery, setSubledgerQuery] = useState('')

  const subledgerKind = useMemo(() => subledgerSelectorForAccount(selectedAccount), [selectedAccount])

  // When an item is picked, auto-fill account/rate/unit/description/tax.
  const handleItemChange = useCallback(
    (id: string) => {
      const it = items.find((i) => String(i.id) === id)
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
      }
      onChange(line.key, patch)
    },
    [items, transactionType, line.key, onChange],
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
      pool = items // parties aren't loaded here; fall back to item names as party-ish options
        .slice(0, 20)
        .map((it) => ({ id: it.id, label: it.name }))
    } else if (subledgerKind === 'item') {
      pool = items.slice(0, 30).map((it) => ({ id: it.id, label: it.name }))
    } else {
      pool = []
    }
    const q = subledgerQuery.toLowerCase()
    return pool.filter((o) => o.label.toLowerCase().includes(q))
  }, [subledgerKind, subledgerQuery, items])

  return (
    <tr key={line.key} className="border-b border-slate-50">
      <td className="px-2 py-2 text-center text-slate-400">{index + 1}</td>

      {/* Item / description */}
      <td className="px-2 py-2">
        <div className="relative">
          <input
            type="text"
            value={selectedItem ? selectedItem.name : (line.description || '')}
            onChange={(e) => {
              const q = e.target.value
              onChange(line.key, { description: q, item: '', account: '' })
              setSubledgerOpen(false)
            }}
            onFocus={() => setSubledgerOpen(false)}
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
          {/* Item results dropdown (simplified: show first 5 matches of description) */}
          {(!selectedItem && line.description && line.description.length > 0) && (
            <div className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
              {items
                .filter((it) => it.name.toLowerCase().includes(line.description!.toLowerCase()))
                .slice(0, 5)
                .map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => handleItemChange(String(it.id))}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
                  >
                    {it.code ? <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">{it.code}</span> : null}
                    <span className="flex-1 truncate">{it.name}</span>
                  </button>
                ))}
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
      <td className="px-2 py-2">
        <AccountSelect
          accounts={accounts}
          value={String(line.account ?? '')}
          onChange={handleAccountChange}
          disabled={disabled || Boolean(selectedItem && selectedItem.salesAccount && transactionType === 'sales')}
        />
      </td>

      {/* Conditional subledger selector */}
      {subledgerKind && subledgerOpen ? (
        <td className="px-2 py-2">
          <div className="relative">
            <input
              type="text"
              value={subledgerQuery}
              onChange={(e) => setSubledgerQuery(e.target.value)}
              placeholder={t('vouchers.selectSubledger', 'Select subledger')}
              className="w-full rounded border border-slate-200 px-2 py-2 text-sm outline-none focus:border-slate-500 disabled:bg-slate-50 disabled:text-slate-400"
              disabled={disabled}
            />
            <div className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
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
        </td>
      ) : (
        <td className="px-2 py-2">
          {subledgerKind ? (
            <button
              type="button"
              onClick={() => setSubledgerOpen(true)}
              disabled={disabled}
              className="flex items-center gap-1 px-2 py-2 rounded border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              {subledgerKind === 'party' ? <Users size={12} /> : subledgerKind === 'item' ? <Building2 size={12} /> : <Wallet size={12} />}
              <span>{subledgerKind === 'party' ? t('vouchers.party', 'Party') : subledgerKind === 'item' ? t('vouchers.item', 'Item') : t('vouchers.project', 'Project')}</span>
              <ChevronDown size={10} className="ml-0.5" />
            </button>
          ) : null}
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
  )
}

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
