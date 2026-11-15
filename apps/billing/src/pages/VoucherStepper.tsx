import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
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

/**
 * Order document types — confirmed, never posted. The server's /post handler
 * rejects them outright ("Orders are status-only documents"); /confirm assigns
 * the order number and locks it.
 */
const ORDER_TYPES = ['sales-order', 'purchase-order'] as const

interface JLine { account: number | null; debit: number; credit: number; memo: string }
interface ILine { description: string; qty: number; rate: number; amount: number }

const blankJLine: JLine = { account: null, debit: 0, credit: 0, memo: '' }
const blankILine: ILine = { description: '', qty: 1, rate: 0, amount: 0 }

export default function VoucherStepper({ mode = 'create' }: VoucherStepperProps) {
  const navigate = useNavigate()
  const { docType: routeDocType } = useParams<{ docType?: string }>()
  const t = useT()
  const tenantQuery = useTenantQuery()
  const { tenantId, tenants } = useTenant()
  const activeTenantName = tenants.find((t) => t.id === tenantId)?.name
  const { docs: parties } = useCachedList<Party>('parties', { sort: 'name', ...tenantQuery })
  const { docs: accounts } = useCachedList<Account>('gl-accounts', { sort: 'name', ...tenantQuery })

  const [step, setStep] = useState(1)
  const defaultDocType = (routeDocType && DOC_TYPE_LABELS[routeDocType]
    ? (routeDocType as DocType)
    : 'journal-voucher')
  const [docType, setDocType] = useState<DocType>(defaultDocType)
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

  const step1Valid = !!date && (!partyRequired || !!partyId)
  const step2Valid = isJournal
    ? jLines.some((l) => l.account != null) && Math.abs(debitTotal - creditTotal) < 0.0051
    : isContra
      ? !!fromAccount && !!toAccount && fromAccount !== toAccount && contraAmount > 0
      : iLines.some((l) => l.description && (l.amount || 0) > 0)

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

  /**
   * Save the draft and return the document id. The id is returned rather than
   * read from state so the caller always gets the fresh value — reading
   * `draftId` straight after `await saveDraft()` would see the stale closure
   * value on the very first save and skip the post.
   */
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
    if (!step2Valid) {
      setError(isJournal ? t('vouchers.unbalanced', 'Debits and credits must match')
        : t('vouchers.linesRequired', 'Add at least one line'))
      return
    }
    const savedId = await saveDraft()
    if (!savedId) return
    setSaving(true)
    try {
      // Orders are confirmed, not posted — the server rejects /post for them.
      if (isOrder) {
        await api(`/documents/${savedId}/confirm`, { method: 'POST' })
      } else {
        await api(`/documents/${savedId}/post`, { method: 'POST' })
      }
      navigate('/vouchers')
    } catch (err) {
      setError(err instanceof Error ? err.message : (isOrder ? 'Confirm failed' : 'Post failed'))
      setSaving(false)
    }
  }, [isJournal, isOrder, navigate, saveDraft, step2Valid])

  const goNext = useCallback(async () => {
    setError('')
    if (step === 1) {
      if (!step1Valid) {
        setError(partyRequired && !partyId ? t('vouchers.partyRequired', 'Party is required')
          : t('vouchers.dateRequired', 'Date is required'))
        return
      }
      // saveDraft returns null when the save failed — checking the `error`
      // state here would read a stale value and advance anyway.
      const savedId = await saveDraft()
      if (!savedId) return
      setStep(2)
    } else if (step === 2) {
      if (!step2Valid) {
        setError(isJournal ? t('vouchers.unbalanced', 'Debits and credits must match')
          : t('vouchers.linesRequired', 'Add at least one line'))
        return
      }
      const savedId = await saveDraft()
      if (!savedId) return
      setStep(3)
    }
  }, [isJournal, partyRequired, partyId, step, step1Valid, step2Valid, saveDraft])

  const goPrev = () => { setError(''); setStep((s) => s - 1) }

  const stepLabel = (n: number) => {
    if (n === 3 && isOrder) return t('vouchers.stepReviewConfirm', 'Review & confirm')
    const key = n === 1 ? 'stepDetails' : n === 2 ? 'stepLines' : 'stepReview'
    return t(`vouchers.${key}`, key === 'stepDetails' ? 'Voucher details' : key === 'stepLines' ? 'Lines' : 'Review & post')
  }

  const selectCls = 'mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-crimson-500'
  const inputCls = 'mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-crimson-500 text-right'
  const numCls = inputCls + ' font-mono'

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/vouchers')}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="Back to All Transactions"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-slate-900 tracking-tight">
                {t('vouchers.newTransaction', 'New Transaction')}
              </h1>
              <p className="text-[11px] text-slate-500">{t('vouchers.draftVoucher', 'Draft voucher')} · {activeTenantName || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-crimson-500" />
              {t('vouchers.statusDraft', 'Draft')}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <div className="flex h-full overflow-hidden">
          {/* Left panel: details card */}
          <aside className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col z-20">
            <div className="overflow-y-auto p-6 space-y-6">
              {/* Doc type - segmented control */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('vouchers.docType', 'Voucher type')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STEPS.map((dt) => {
                    const active = docType === dt.value
                    return (
                      <button
                        key={dt.value}
                        onClick={() => setDocType(dt.value)}
                        className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                          active
                            ? 'bg-crimson-600 border-crimson-600 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-xs">
                          {dt.value === 'journal-voucher' ? '📒' : dt.value === 'contra' ? '🔄' : dt.value.startsWith('sales') ? '🧾' : dt.value.startsWith('purchase') ? '📥' : dt.value === 'payment-voucher' ? '💸' : dt.value === 'receipt-voucher' ? '💰' : '📄'}
                        </span>
                        <span className="hidden sm:inline truncate max-w-[70px]">
                          {t(`vouchers.${dt.labelKey}`, DOC_TYPE_LABELS[dt.value])}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-4">
                {partyRequired && (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {t('vouchers.columnParty', 'Party')}
                    </label>
                    <select
                      value={String(partyId ?? '')}
                      onChange={(e) => setPartyId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-crimson-500 focus:border-crimson-500 transition-colors"
                    >
                      <option value="">{t('vouchers.select', '— select —')}</option>
                      {parties.map((p) => (
                        <option key={p.id} value={String(p.id)}>{p.name}</option>
                      ))}
                    </select>
                    {!partyId && <p className="mt-1 text-[10px] text-red-500">{t('vouchers.partyRequired', 'Party is required')}</p>}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {t('common.date', 'Date')}
                  </label>
                  <NepaliDateInput value={date} onChange={setDate} />
                  {!date && <p className="mt-1 text-[10px] text-red-500">{t('vouchers.dateRequired', 'Date is required')}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {t('common.currency', 'Currency')}
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-crimson-500 focus:border-crimson-500 transition-colors"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
                {currency !== 'NPR' && (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {t('common.exchangeRate', 'Exchange rate')}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={exchangeRate ?? ''}
                      onChange={(e) => setExchangeRate(e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-right text-slate-700 font-mono outline-none focus:ring-2 focus:ring-crimson-500 focus:border-crimson-500 transition-colors"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {t('common.memo', 'Narration')}
                  </label>
                  <textarea
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    placeholder={t('vouchers.narrationPlaceholder', 'Description of the transaction…')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-crimson-500 focus:border-crimson-500 transition-colors"
                    rows={2}
                  />
                </div>
              </div>

              {/* Live balance stat card */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                  {t('vouchers.balance', 'Balance')}
                </p>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-slate-500">{t('common.debit', 'Debit')}</span>
                    <span className="text-sm font-mono font-semibold text-slate-900">{fmt(debitTotal)}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-slate-500">{t('common.credit', 'Credit')}</span>
                    <span className="text-sm font-mono font-semibold text-slate-900">{fmt(creditTotal)}</span>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className={`flex items-baseline justify-between gap-2 pt-2 text-sm font-mono ${
                    Math.abs(debitTotal - creditTotal) < 0.0051 ? 'text-emerald-600 font-bold' : 'text-crimson-600 font-bold'
                  }`}>
                    <span>{t('vouchers.difference', 'Difference')}</span>
                    <span>
                      {Math.abs(debitTotal - creditTotal) < 0.0051
                        ? t('vouchers.balanced', '✓ balanced')
                        : t('vouchers.difference', 'Difference') + ': ' + fmt(Math.abs(debitTotal - creditTotal))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Right panel: lines workspace */}
          <main className="flex-1 overflow-y-auto bg-slate-50 p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
                  {t('vouchers.newTransaction', 'New Transaction')}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {isJournal ? t('vouchers.subtitleJournal', 'Record debits and credits') : isContra ? t('vouchers.subtitleContra', 'Transfer between accounts') : t('vouchers.subtitleItem', 'Item lines with qty & rate')}
                </p>
              </div>
              <button
                type="button"
                onClick={isJournal ? addJLine : isContra ? () => {} : addILine}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:ring-2 focus:ring-crimson-500 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                <span>+</span> {t('vouchers.addLine', 'Add line')}
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
                {error}
              </div>
            )}
            {draftId && lastSaved && !error && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{t('vouchers.draftSaved', 'Draft saved')}</span>
                <span className="text-slate-400">·</span>
                <span>{lastSaved}</span>
              </div>
            )}

            {/* Lines table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              {isJournal ? (
                <>
                  <div className="overflow-x-auto border-b border-slate-100">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {t('common.account', 'Account')}
                          </th>
                          <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {t('common.debit', 'Debit')}
                          </th>
                          <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {t('common.credit', 'Credit')}
                          </th>
                          <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {t('common.memo', 'Memo')}
                          </th>
                          <th className="text-center px-4 py-3 w-10" />
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
                                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-right text-slate-700 font-mono outline-none focus:ring-1 focus:ring-crimson-500" />
                            </td>
                            <td className="px-4 py-3">
                              <input type="number" min="0" step="0.01" value={l.credit}
                                onChange={(e) => setJLine(i, { credit: Math.max(0, Number(e.target.value) || 0) })}
                                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-right text-slate-700 font-mono outline-none focus:ring-1 focus:ring-crimson-500" />
                            </td>
                            <td className="px-4 py-3">
                              <input value={l.memo}
                                onChange={(e) => setJLine(i, { memo: e.target.value })}
                                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-crimson-500" />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button type="button" onClick={() => removeJLine(i)} disabled={jLines.length === 1}
                                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-crimson-600 disabled:opacity-40 disabled:pointer-events-none transition-colors" aria-label="Remove line">
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                        {jLines.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                              No lines yet. Add a line to begin.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={addJLine}
                      className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <span>+</span> {t('vouchers.addLine', 'Add line')}
                    </button>
                    <div className="flex items-end gap-3 text-xs font-mono">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-slate-500">Dr</span>
                        <span className="text-slate-900 font-bold">{fmt(debitTotal)}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-slate-500">Cr</span>
                        <span className="text-slate-900 font-bold">{fmt(creditTotal)}</span>
                      </div>
                      <div className={`flex flex-col items-end gap-1 text-sm ${
                        Math.abs(debitTotal - creditTotal) < 0.0051 ? 'text-emerald-600 font-bold' : 'text-crimson-600 font-bold'
                      }`}>
                        <span className="text-[10px] uppercase">{t('vouchers.difference', 'Difference')}</span>
                        <span>
                          {Math.abs(debitTotal - creditTotal) < 0.0051
                            ? t('vouchers.balanced', '✓ balanced')
                            : t('vouchers.difference', 'Difference') + ': ' + fmt(Math.abs(debitTotal - creditTotal))}
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
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-right text-slate-700 font-mono outline-none focus:ring-2 focus:ring-crimson-500" />
                    </div>
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-4 flex justify-end gap-2 text-sm font-mono">
                    <span className="text-slate-500">Transfer</span>
                    <span className="text-slate-900 font-bold">{fmt(contraAmount)}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto border-b border-slate-100">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {t('common.description', 'Description')}
                          </th>
                          <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {t('vouchers.qty', 'Qty')}
                          </th>
                          <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {t('vouchers.rate', 'Rate')}
                          </th>
                          <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {t('common.amount', 'Amount')}
                          </th>
                          <th className="text-center px-4 py-3 w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {iLines.map((l, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <input value={l.description}
                                onChange={(e) => setILine(i, { description: e.target.value })}
                                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-crimson-500" />
                            </td>
                            <td className="px-4 py-3">
                              <input type="number" min="0" step="any" value={l.qty}
                                onChange={(e) => setILine(i, { qty: Math.max(0, Number(e.target.value) || 0) })}
                                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-right text-slate-700 font-mono outline-none focus:ring-1 focus:ring-crimson-500" />
                            </td>
                            <td className="px-4 py-3">
                              <input type="number" min="0" step="0.01" value={l.rate}
                                onChange={(e) => setILine(i, { rate: Math.max(0, Number(e.target.value) || 0) })}
                                className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-right text-slate-700 font-mono outline-none focus:ring-1 focus:ring-crimson-500" />
                            </td>
                            <td className="px-4 py-3">
                              <span className="block rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-right text-slate-700 font-mono">
                                {fmt(l.amount)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button type="button" onClick={() => removeILine(i)} disabled={iLines.length === 1}
                                className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-crimson-600 disabled:opacity-40 disabled:pointer-events-none transition-colors" aria-label="Remove line">
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                        {iLines.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                              No lines yet. Add a line to begin.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 flex items-end justify-between gap-3">
                    <button
                      type="button"
                      onClick={addILine}
                      className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <span>+</span> {t('vouchers.addLine', 'Add line')}
                    </button>
                    <div className="flex flex-col items-end gap-1 text-sm font-mono">
                      <span className="text-slate-500 uppercase text-[10px]">Total</span>
                      <span className="text-slate-900 font-bold">{fmt(itemTotal)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer actions */}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <button
                onClick={() => { void saveDraft() }}
                disabled={saving}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-all focus:ring-2 focus:ring-crimson-500"
              >
                {t('vouchers.saveDraft', 'Save draft')}
              </button>
              {!isQuote && (
                <button
                  onClick={postVoucher}
                  disabled={saving || (!isJournal && (!iLines.some((l) => l.description && (l.amount || 0) > 0)))
                  || (isJournal && Math.abs(debitTotal - creditTotal) >= 0.0051)}
                  className="rounded-lg bg-crimson-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-crimson-700 disabled:opacity-60 disabled:pointer-events-none transition-all focus:ring-2 focus:ring-crimson-300"
                >
                  {saving
                    ? t('vouchers.posting', 'Posting…')
                    : isOrder
                      ? t('vouchers.confirmOrder', 'Confirm order')
                      : t('vouchers.post', 'Post')}
                </button>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
