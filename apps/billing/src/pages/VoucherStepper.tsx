import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { BookOpen, ArrowRightLeft, FileText, ShoppingCart, CreditCard, FileMinus, FilePlus, Wallet, PackageCheck, Truck, UserCheck, Heart, Package } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { LiquidButton } from '../components/ui/LiquidButton'
import AccountSelect from '../components/AccountSelect'
import NepaliDateInput from '../components/NepaliDateInput'
import { api, fmt } from '../lib/api'
import { useT } from '../lib/i18n'
import { CURRENCIES, DOC_TYPE_LABELS, type Account, type Currency, type DocType, type Party } from '../lib/types'
import { useCachedList } from '../lib/useCachedList'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { todayAD } from '../lib/nepaliDate'
import { toBaseCurrency } from '../lib/types'

/* ponytail: create-only wizard (no edit mode, no taxes, no payment-method/bank fields).
 * Ceiling: full VoucherForm parity. Upgrade path: add mode='edit', tax lines, cash/bank fields. */

interface VoucherStepperProps {
  mode?: 'create'
  inline?: boolean
  onDocTypeChange?: (dt: DocType) => void
  onSaved?: (id: number) => void
}

const STEPS = [
  { value: 'journal-voucher', labelKey: 'shortLabelJournalEntry' },
  { value: 'contra', labelKey: 'shortLabelContraEntry' },
  { value: 'sales-invoice', labelKey: 'shortLabelSalesInvoice' },
  { value: 'purchase-invoice', labelKey: 'shortLabelPurchaseInvoice' },
  { value: 'payment-voucher', labelKey: 'shortLabelPayment' },
  { value: 'receipt-voucher', labelKey: 'shortLabelReceipt' },
  { value: 'credit-note', labelKey: 'shortLabelCreditNote' },
  { value: 'debit-note', labelKey: 'shortLabelDebitNote' },
  { value: 'petty-cash-voucher', labelKey: 'shortLabelPettyCash' },
  { value: 'grn', labelKey: 'shortLabelGrn' },
  { value: 'delivery-challan', labelKey: 'shortLabelDeliveryChallan' },
  { value: 'membership-receipt', labelKey: 'shortLabelMembershipReceipt' },
  { value: 'donation-receipt', labelKey: 'shortLabelDonationReceipt' },
  { value: 'sales-quote', labelKey: 'shortLabelQuote' },
  { value: 'sales-order', labelKey: 'shortLabelSalesOrder' },
  { value: 'purchase-order', labelKey: 'shortLabelPurchaseOrder' },
] as const

const ORDER_TYPES = ['sales-order', 'purchase-order'] as const

interface JLine { account: number | null; debit: number; credit: number; memo: string }
interface ILine { description: string; qty: number; rate: number; amount: number }

const blankJLine: JLine = { account: null, debit: 0, credit: 0, memo: '' }
const blankILine: ILine = { description: '', qty: 1, rate: 0, amount: 0 }

const CHIP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'journal-voucher': BookOpen,
  contra: ArrowRightLeft,
  'sales-invoice': FileText,
  'purchase-invoice': ShoppingCart,
  'payment-voucher': CreditCard,
  'receipt-voucher': CreditCard,
  'credit-note': FileMinus,
  'debit-note': FilePlus,
  'petty-cash-voucher': Wallet,
  grn: PackageCheck,
  'delivery-challan': Truck,
  'membership-receipt': UserCheck,
  'donation-receipt': Heart,
  'sales-quote': FileText,
  'sales-order': Package,
  'purchase-order': Package,
}

export default function VoucherStepper({ mode = 'create', inline, onDocTypeChange, onSaved }: VoucherStepperProps) {
  const navigate = useNavigate()
  const { docType: routeDocType } = useParams<{ docType?: string }>()
  const t = useT()
  const tenantQuery = useTenantQuery()
  const { tenantId, tenants } = useTenant()
  const activeTenantName = tenants.find((t) => t.id === tenantId)?.name
  const { docs: parties } = useCachedList<Party>('parties', { sort: 'name', ...tenantQuery })
  const { docs: accounts } = useCachedList<Account>('gl-accounts', { sort: 'name', ...tenantQuery })

  const defaultDocType = (routeDocType && DOC_TYPE_LABELS[routeDocType]
    ? (routeDocType as DocType)
    : 'journal-voucher')
  const [docType, setDocType] = useState<DocType>(defaultDocType)
  const [confirmSwitchTo, setConfirmSwitchTo] = useState<DocType | null>(null)
  const [partyId, setPartyId] = useState<number | null>(null)
  const [date, setDate] = useState(todayAD())
  const [currency, setCurrency] = useState<Currency>('NPR')
  const [exchangeRate, setExchangeRate] = useState<number | null>(null)
  const [narration, setNarration] = useState('')
  const [jLines, setJLines] = useState<JLine[]>([blankJLine])
  const [iLines, setILines] = useState<ILine[]>([blankILine])
  const [fromAccount, setFromAccount] = useState<number | null>(null)
  const [toAccount, setToAccount] = useState<number | null>(null)
  const [contraAmount, setContraAmount] = useState(0)
  const [draftId, setDraftId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  const isJournal = docType === 'journal-voucher'
  const isContra = docType === 'contra'
  const isQuote = docType === 'sales-quote'
  const isOrder = (ORDER_TYPES as readonly string[]).includes(docType)
  const partyRequired = docType !== 'petty-cash-voucher'
  const party = useMemo(() => parties.find((p) => p.id === partyId), [parties, partyId])

  const { debitTotal, creditTotal } = useMemo(() => {
    let dr = 0, cr = 0
    for (const l of jLines) { dr += l.debit || 0; cr += l.credit || 0 }
    return { debitTotal: dr, creditTotal: cr }
  }, [jLines])

  const itemTotal = useMemo(() => iLines.reduce((s, l) => s + (l.amount || 0), 0), [iLines])
  const balanced = Math.abs(debitTotal - creditTotal) < 0.0051

  const today = todayAD()
  const dirty =
    jLines.some((l) => l.account != null || l.debit || l.credit || l.memo) ||
    iLines.some((l) => l.description || l.qty !== 1 || l.rate || l.amount) ||
    partyId != null ||
    narration !== '' ||
    date !== today ||
    currency !== 'NPR' ||
    exchangeRate != null ||
    fromAccount != null ||
    toAccount != null ||
    contraAmount > 0

  // Reset line state when the doc type changes
  useEffect(() => {
    if (isJournal) setJLines([blankJLine])
    else if (isContra) { setFromAccount(null); setToAccount(null); setContraAmount(0) }
    else setILines([blankILine])
  }, [docType, isContra, isJournal])

  const setJLine = useCallback((index: number, patch: Partial<JLine>) =>
    setJLines((ls) => ls.map((l, i) => (i === index ? { ...l, ...patch } : l))), [])
  const addJLine = useCallback(() => setJLines((ls) => [...ls, blankJLine]), [])
  const removeJLine = useCallback((index: number) => setJLines((ls) => ls.length > 1
    ? ls.filter((_, i) => i !== index) : ls), [])
  const setILine = useCallback((index: number, patch: Partial<ILine>) =>
    setILines((ls) => ls.map((l, i) => {
      const next = { ...l, ...patch }
      if (patch.qty !== undefined || patch.rate !== undefined) next.amount = (next.qty || 0) * (next.rate || 0)
      return next
    })), [])
  const addILine = useCallback(() => setILines((ls) => [...ls, blankILine]), [])
  const removeILine = useCallback((index: number) => setILines((ls) => ls.length > 1
    ? ls.filter((_, i) => i !== index) : ls), [])

  const buildDraftBody = useCallback(() => {
    const base: Record<string, unknown> = {
      docType,
      date,
      currency,
      ...(exchangeRate != null ? { exchangeRate } : {}),
      narration: narration || undefined,
      party: partyRequired ? (partyId ?? undefined) : undefined,
      status: 'draft',
      ...(tenantQuery.tenant != null ? { tenant: tenantQuery.tenant } : {}),
    }
    if (isJournal) {
      base.journalLines = jLines.filter((l) => l.account != null).map((l) => ({
        account: l.account,
        debit: l.debit || undefined,
        credit: l.credit || undefined,
        memo: l.memo || undefined,
      }))
    } else if (isContra) {
      base.fromAccount = fromAccount
      base.toAccount = toAccount
      base.netTotal = contraAmount
      base.grossTotal = contraAmount
      base.taxTotal = 0
      base.taxRate = 0
    } else {
      base.lines = iLines.filter((l) => l.description && (l.amount || 0) > 0).map((l) => ({
        description: l.description,
        qty: l.qty || 1,
        rate: l.rate || 0,
        amount: l.amount || 0,
      }))
    }
    return base
  }, [contraAmount, currency, date, docType, exchangeRate, fromAccount, isContra, isJournal, jLines, narration,
    partyId, partyRequired, tenantQuery.tenant, toAccount, iLines])

  const saveDraft = useCallback(async (): Promise<number | null> => {
    setError('')
    setSaving(true)
    try {
      const body = buildDraftBody()
      if (draftId) {
        await api(`/documents/${draftId}`, { method: 'PATCH', body, query: tenantQuery })
        return draftId
      }
      const created = await api<{ doc: { id: number } } | { id: number }>('/documents', {
        method: 'POST', body, query: tenantQuery,
      })
      const newId = 'doc' in created ? created.doc.id : created.id
      setDraftId(newId)
      return newId
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft')
      return null
    } finally {
      setSaving(false)
      setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }
  }, [buildDraftBody, draftId, tenantQuery])

  const postVoucher = useCallback(async () => {
    setError('')
    if (!date) {
      setError(t('vouchers.dateRequired', 'Date is required'))
      return
    }
    if (partyRequired && !partyId) {
      setError(t('vouchers.partyRequired', 'Party is required'))
      return
    }
    if (isJournal && jLines.some((l) => l.account == null)) {
      setError(t('vouchers.accountRequired', 'Account is required for each line'))
      return
    }
    if (isContra && (!fromAccount || !toAccount || contraAmount <= 0)) {
      setError(t('vouchers.contraRequired', 'From account, to account, and amount are required'))
      return
    }
    const hasLines = isJournal
      ? jLines.some((l) => l.account != null && (l.debit || 0) > 0 || (l.credit || 0) > 0)
      : isContra
        ? !!fromAccount && !!toAccount && fromAccount !== toAccount && contraAmount > 0
        : iLines.some((l) => l.description && (l.amount || 0) > 0)
    if (!hasLines) {
      setError(t('vouchers.linesRequired', 'Add at least one line'))
      return
    }
    if (isJournal && !balanced) {
      setError(t('vouchers.unbalanced', 'Debits and credits must match'))
      return
    }
    const savedId = await saveDraft()
    if (!savedId) return
    setSaving(true)
    try {
      if (isOrder) {
        await api(`/documents/${savedId}/confirm`, { method: 'POST' })
      } else {
        await api(`/documents/${savedId}/post`, { method: 'POST' })
      }
      inline ? onSaved?.(savedId) : navigate('/vouchers?tab=all')
    } catch (err) {
      setError(err instanceof Error ? err.message : (isOrder ? 'Confirm failed' : 'Post failed'))
      setSaving(false)
    }
  }, [isJournal, isOrder, navigate, saveDraft, balanced, jLines, fromAccount, toAccount, contraAmount, iLines, onSaved])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/vouchers')}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Back to All Transactions"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-slate-900 tracking-tight">
                {t('vouchers.newTransaction', 'New Transaction')}
              </h1>
              <p className="text-[11px] text-slate-500">
                {t('vouchers.createVoucher', 'Create a new accounting voucher')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
              <span className="w-1 h-1 rounded-full bg-crimson-500" />
              Draft
            </span>
            <span className="text-[11px] font-medium text-slate-600">{lastSaved || 'unsaved'}</span>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex-1 min-w-0 mb-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t('vouchers.chooseType', 'Voucher type')}
            </label>
            <p className="text-sm text-slate-600">
              {t('vouchers.typeDetermines', 'Pick the kind of transaction. The fields below adapt to your selection.')}
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 py-2 rounded-xl border border-slate-200 bg-white scrollbar-hide">
            {STEPS.map((dt) => {
              const Icon = CHIP_ICONS[dt.value]
              const active = docType === dt.value
              return (
                <button
                  key={dt.value}
                  onClick={() => {
                    if (dirty && docType !== dt.value) { setConfirmSwitchTo(dt.value); return }
                    setDocType(dt.value)
                    inline ? onDocTypeChange?.(dt.value) : navigate(`/vouchers/new/${dt.value}`)
                  }}
                  className={`flex flex-col items-center justify-center gap-1 flex-1 min-w-[110px] max-w-[140px] rounded-xl border transition-all ${active
                    ? 'border-crimson-600 bg-crimson-50/40 shadow-[0_0_0_3px_rgba(185,28,28,0.08)]'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`h-6 w-6 ${active ? 'text-crimson-600' : 'text-slate-500'}`} />
                  <span className={`block text-[9px] font-semibold leading-none text-center whitespace-normal ${active ? 'text-slate-900' : 'text-slate-700'}`}>
                    {t(`vouchers.${dt.labelKey}`, DOC_TYPE_LABELS[dt.value])}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <div className="p-6 lg:p-10">
          <div className="mx-auto space-y-8">
            {/* Live balance strip */}
            {isJournal && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-center gap-4 border-t border-slate-100">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Balance</p>
                    <p className="text-xs font-semibold text-slate-900">
                      {t('common.debitTotal', 'Debit total')} {fmt(debitTotal)} · {t('common.creditTotal', 'Credit total')} {fmt(creditTotal)}
                    </p>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${balanced
                    ? 'border-emerald-200 text-emerald-600 bg-emerald-50'
                    : 'border-slate-200 text-slate-500 bg-white'}`}>
                    {balanced ? '✓' : '⚖'}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-5">
              {/* Meta fields starting from date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2 lg:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {t('common.date', 'Date')}
                  </label>
                  <NepaliDateInput value={date} onChange={setDate} />
                  {!date && <p className="mt-1 text-[10px] text-red-500">{t('vouchers.dateRequired', 'Date is required')}</p>}
                </div>

                {partyRequired && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {t('vouchers.columnParty', 'Party')} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={String(partyId ?? '')}
                      onChange={(e) => setPartyId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-crimson-600 focus:ring-1 focus:ring-crimson-50/20"
                    >
                      <option value="">{t('vouchers.select', '— select —')}</option>
                      {parties.map((p) => (
                        <option key={p.id} value={String(p.id)}>{p.name}</option>
                      ))}
                    </select>
                    {!partyId && <p className="mt-1 text-[10px] text-red-500">{t('vouchers.partyRequired', 'Party is required')}</p>}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {t('common.currency', 'Currency')}
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-crimson-600 focus:ring-1 focus:ring-crimson-50/20"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {currency !== 'NPR' && (
                  <div className="space-y-2 lg:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {t('common.exchangeRate', 'Exchange rate')}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={exchangeRate ?? ''}
                      onChange={(e) => setExchangeRate(e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-right text-slate-700 outline-none focus:border-crimson-600 focus:ring-1 focus:ring-crimson-50/20"
                    />
                  </div>
                )}

                <div className="space-y-2 lg:col-span-3">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {t('common.memo', 'Narration')}
                  </label>
                  <textarea
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    placeholder={t('vouchers.narrationPlaceholder', 'Transaction description…')}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-crimson-600 focus:ring-1 focus:ring-crimson-50/20"
                    rows={2}
                  />
                </div>
              </div>

              {/* Lines table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {t('vouchers.entryLines', 'Entry lines')}
                  </h2>
                  <button
                    type="button"
                    onClick={isJournal ? addJLine : isContra ? () => { } : addILine}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    disabled={isContra}
                  >
                    <span>+</span> {t('vouchers.addLine', 'Add line')}
                  </button>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  {isJournal ? (
                    <>
                      <div className="overflow-x-auto border-b border-slate-100">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-slate-400">
                                {t('common.account', 'Account')}
                              </th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-slate-400 text-right">
                                {t('common.debit', 'Debit')}
                              </th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-slate-400 text-right">
                                {t('common.credit', 'Credit')}
                              </th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-slate-400">
                                {t('common.memo', 'Memo')}
                              </th>
                              <th className="px-4 py-3 text-center" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {jLines.map((l, i) => (
                              <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                  <AccountSelect
                                    accounts={accounts}
                                    value={l.account ?? ''}
                                    onChange={(id) => setJLine(i, { account: Number(id) })}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input type="number" min="0" step="0.01" value={l.debit}
                                    onChange={(e) => setJLine(i, { debit: Math.max(0, Number(e.target.value) || 0) })}
                                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-right text-slate-700 outline-none focus:border-crimson-600 focus:ring-1 focus:ring-crimson-50/20" />
                                </td>
                                <td className="px-4 py-3">
                                  <input type="number" min="0" step="0.01" value={l.credit}
                                    onChange={(e) => setJLine(i, { credit: Math.max(0, Number(e.target.value) || 0) })}
                                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-right text-slate-700 outline-none focus:border-crimson-600 focus:ring-1 focus:ring-crimson-50/20" />
                                </td>
                                <td className="px-4 py-3">
                                  <input value={l.memo}
                                    onChange={(e) => setJLine(i, { memo: e.target.value })}
                                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-crimson-600 focus:ring-1 focus:ring-crimson-50/20" />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button type="button" onClick={() => removeJLine(i)} disabled={jLines.length === 1}
                                    className="p-2 min-w-[28px] min-h-[28px] text-slate-400 hover:bg-slate-100 hover:text-crimson-600 disabled:opacity-40 disabled:pointer-events-none transition-colors" aria-label="Remove line">
                                    ×
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {jLines.length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-xs">
                                  No lines yet. Add a line to begin.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 flex items-end gap-3">
                        <div className="flex items-end gap-3 text-xs font-medium">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-slate-500 uppercase text-[10px]">Dr</span>
                            <span className="text-slate-900">{fmt(debitTotal)}</span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-slate-500 uppercase text-[10px]">Cr</span>
                            <span className="text-slate-900">{fmt(creditTotal)}</span>
                          </div>
                          <div className={`flex flex-col items-end gap-1 ${balanced ? 'text-emerald-600' : 'text-crimson-600'}`}>
                            <span className="text-[10px] uppercase">{t('vouchers.difference', 'Difference')}</span>
                            <span>
                              {balanced ? t('vouchers.balanced', '✓ balanced') : t('vouchers.difference', 'Difference') + ': ' + fmt(Math.abs(debitTotal - creditTotal))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : isContra ? (
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {t('vouchers.fromAccount', 'From account (credited)')}
                          </label>
                          <AccountSelect accounts={accounts} value={String(fromAccount ?? '')}
                            onChange={(id) => setFromAccount(Number(id))} placeholder={t('vouchers.selectAccount', '— select account —')} />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {t('vouchers.toAccount', 'To account (debited)')}
                          </label>
                          <AccountSelect accounts={accounts} value={String(toAccount ?? '')}
                            onChange={(id) => setToAccount(Number(id))} placeholder={t('vouchers.selectAccount', '— select account —')} />
                        </div>
                        <div className="flex h-[138px] flex-col justify-end">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {t('common.amount', 'Amount')}
                          </label>
                          <input type="number" min="0" step="0.01" value={contraAmount}
                            onChange={(e) => setContraAmount(Math.max(0, Number(e.target.value) || 0))}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-right text-slate-700 outline-none focus:ring-2 focus:ring-crimson-600" />
                        </div>
                      </div>
                      <div className="mt-4 border-t border-slate-100 pt-4 flex justify-end gap-2 text-sm font-medium">
                        <span className="text-slate-500 uppercase text-[10px]">Transfer</span>
                        <span className="text-slate-900">{fmt(contraAmount)}</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto border-b border-slate-100">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-slate-400">
                                {t('common.description', 'Description')}
                              </th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-slate-400 text-right">
                                {t('vouchers.qty', 'Qty')}
                              </th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-slate-400 text-right">
                                {t('vouchers.rate', 'Rate')}
                              </th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-slate-400 text-right">
                                {t('common.amount', 'Amount')}
                              </th>
                              <th className="px-4 py-3 text-center" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {iLines.map((l, i) => (
                              <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                  <input value={l.description}
                                    onChange={(e) => setILine(i, { description: e.target.value })}
                                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-crimson-600 focus:ring-1 focus:ring-crimson-50/20" />
                                </td>
                                <td className="px-4 py-3">
                                  <input type="number" min="0" step="any" value={l.qty}
                                    onChange={(e) => setILine(i, { qty: Math.max(0, Number(e.target.value) || 0) })}
                                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-right text-slate-700 outline-none focus:border-crimson-600 focus:ring-1 focus:ring-crimson-50/20" />
                                </td>
                                <td className="px-4 py-3">
                                  <input type="number" min="0" step="0.01" value={l.rate}
                                    onChange={(e) => setILine(i, { rate: Math.max(0, Number(e.target.value) || 0) })}
                                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-right text-slate-700 outline-none focus:border-crimson-600 focus:ring-1 focus:ring-crimson-50/20" />
                                </td>
                                <td className="px-4 py-3">
                                  <span className="block rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-right text-slate-700">
                                    {fmt(l.amount)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <button type="button" onClick={() => removeILine(i)} disabled={iLines.length === 1}
                                    className="p-2 min-w-[28px] min-h-[28px] text-slate-400 hover:bg-slate-100 hover:text-crimson-600 disabled:opacity-40 disabled:pointer-events-none transition-colors" aria-label="Remove line">
                                    ×
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {iLines.length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-xs">
                                  No lines yet. Add a line to begin.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 flex items-end gap-3">
                        <div className="flex flex-col items-end gap-1 text-sm font-medium">
                          <span className="text-slate-500 uppercase text-[10px]">Total</span>
                          <span className="text-slate-900">{fmt(itemTotal)}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-8 border-t border-slate-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  {error && (
                    <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}
                  {draftId && lastSaved && !error && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{t('vouchers.draftSaved', 'Draft saved')}</span>
                      <span className="text-slate-400">·</span>
                      <span>{lastSaved}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => { void saveDraft() }}
                      disabled={saving}
                      className="flex-1 sm:flex-none border border-slate-200 bg-white px-5 py-2.5 rounded-lg text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-all focus:ring-2 focus:ring-crimson-600"
                    >
                      {t('vouchers.saveDraft', 'Save draft')}
                    </button>
                    {!isQuote && (
                      <button
                        onClick={postVoucher}
                        disabled={saving || (!isJournal && (!iLines.some((l) => l.description && (l.amount || 0) > 0)))
                          || (isJournal && !balanced)}
                        className={`flex-1 sm:flex-none bg-crimson-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider shadow-sm disabled:opacity-60 disabled:pointer-events-none transition-all focus:ring-2 focus:ring-crimson-600 ${!saving ? 'hover:bg-crimson-700' : ''}`}
                      >
                        {saving
                          ? t('vouchers.posting', 'Posting…')
                          : isOrder
                            ? t('vouchers.confirmOrder', 'Confirm order')
                            : t('vouchers.post', 'Post')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {confirmSwitchTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setConfirmSwitchTo(null)}
          />
          <div className="relative bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-xl">
            <h2 className="text-sm font-semibold text-slate-900">
              {t('vouchers.confirmTypeChange', 'Change voucher type?')}
            </h2>
            <p className="text-[12px] text-slate-600 mt-2">
              {t('vouchers.confirmTypeChangeBody', 'Filled contents will be removed. Continue?')}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmSwitchTo(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
              >
                {t('vouchers.cancel', 'Cancel')}
              </button>
              <button
                onClick={() => {
                  const next = confirmSwitchTo
                  setConfirmSwitchTo(null)
                  setDocType(next)
                  inline ? onDocTypeChange?.(next) : navigate(`/vouchers/new/${next}`)
                }}
                className="px-4 py-2 rounded-lg bg-crimson-600 text-sm text-white hover:bg-crimson-700"
              >
                {t('vouchers.continueAnyway', 'Continue')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
