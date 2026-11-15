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
    <div className="w-full min-h-screen bg-slate-50">
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Header bar */}
        <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/vouchers')} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" aria-label="Back to All Transactions">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-sm font-bold text-slate-900">{t('vouchers.newTransaction', 'New Transaction')}</h1>
              <p className="text-[11px] text-slate-500">{t('vouchers.draftVoucher', 'Draft voucher')} · {activeTenantName || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold border-slate-200 text-slate-600 bg-slate-50`}>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              {t('vouchers.statusDraft', 'Draft')}
            </span>
          </div>
        </header>

        {/* Workspace: left panel (details) + right panel (lines) */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left panel: voucher details */}
          <aside className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dr / Cr</span>
              </div>
              <div className="grid gap-2 text-sm font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs uppercase">{t('common.debit', 'Debit')}</span>
                  <span className="text-slate-700 font-bold">{fmt(debitTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs uppercase">{t('common.credit', 'Credit')}</span>
                  <span className="text-slate-700 font-bold">{fmt(creditTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 text-xs uppercase">{t('vouchers.difference', 'Difference')}</span>
                  <span className={`font-bold ${Math.abs(debitTotal - creditTotal) < 0.0051 ? 'text-emerald-700' : 'text-crimson-600'}`}>
                    {Math.abs(debitTotal - creditTotal) < 0.0051 ? t('vouchers.balanced', '✓ balanced') : fmt(Math.abs(debitTotal - creditTotal))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Doc type selector */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  {t('vouchers.docType', 'Voucher type')}
                </label>
                <div className="space-y-1.5">
                  {STEPS.map((dt) => {
                    const active = docType === dt.value
                    return (
                      <button
                        key={dt.value}
                        onClick={() => setDocType(dt.value)}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                          active
                            ? 'bg-crimson-50 text-crimson-700 font-semibold border border-crimson-200'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <span className="shrink-0 text-crimson-500">{dt.value === 'journal-voucher' ? '📒' : dt.value === 'contra' ? '🔄' : dt.value.startsWith('sales') ? '🧾' : dt.value.startsWith('purchase') ? '📥' : dt.value === 'payment-voucher' ? '💸' : dt.value === 'receipt-voucher' ? '💰' : '📄'}</span>
                        <span className="truncate">{t(`vouchers.${dt.labelKey}`, DOC_TYPE_LABELS[dt.value])}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {partyRequired && (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    {t('vouchers.columnParty', 'Party')}
                  </label>
                  <select
                    value={String(partyId ?? '')}
                    onChange={(e) => setPartyId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-crimson-500"
                  >
                    <option value="">{t('vouchers.select', '— select —')}</option>
                    {parties.map((p) => (
                      <option key={p.id} value={String(p.id)}>{p.name}</option>
                    ))}
                  </select>
                  {!partyId && <p className="mt-1 text-xs text-red-600">{t('vouchers.partyRequired', 'Party is required')}</p>}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  {t('common.date', 'Date')}
                </label>
                <NepaliDateInput value={date} onChange={setDate} />
                {!date && <p className="mt-1 text-xs text-red-600">{t('vouchers.dateRequired', 'Date is required')}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  {t('common.currency', 'Currency')}
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-crimson-500"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              {currency !== 'NPR' && (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    {t('common.exchangeRate', 'Exchange rate')}
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={exchangeRate ?? ''}
                    onChange={(e) => setExchangeRate(e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-right outline-none focus:border-crimson-500"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  {t('common.memo', 'Narration')}
                </label>
                <textarea
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder={t('vouchers.narrationPlaceholder', 'Description of the transaction…')}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-crimson-500"
                  rows={2}
                />
              </div>

              {/* Preview card */}
              <div className="border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Preview</span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-xs uppercase">{t('vouchers.tabNewTransaction', 'Voucher type')}</span>
                    <span className="text-slate-700 font-medium">{t(`vouchers.${STEPS.find((d) => d.value === docType)?.labelKey ?? ''}`, DOC_TYPE_LABELS[docType])}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-xs uppercase">{t('vouchers.columnParty', 'Party')}</span>
                    <span className="text-slate-700">{party?.name ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-xs uppercase">{t('common.date', 'Date')}</span>
                    <span className="text-slate-700 font-mono">{date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-xs uppercase">{t('common.currency', 'Currency')}</span>
                    <span className="text-slate-700 font-mono">{currency}</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Right panel: lines (always visible) */}
          <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                {t('vouchers.newTransaction', 'New Transaction')}
              </h2>
              <button type="button" onClick={
                isJournal ? addJLine : isContra ? () => {} : addILine
              } className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
                <span>+</span> {t('vouchers.addLine', 'Add line')}
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}
            {draftId && lastSaved && !error && (
              <div className="mb-4 flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <span className="text-[10px]">●</span>
                {t('vouchers.draftSaved', 'Draft saved')} · {lastSaved}
              </div>
            )}

            {isJournal ? (
              <>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b text-[10px] uppercase text-slate-500">
                        <th className="text-left px-3 py-2.5">{t('common.account', 'Account')}</th>
                        <th className="text-right px-3 py-2.5">{t('common.debit', 'Debit')}</th>
                        <th className="text-right px-3 py-2.5">{t('common.credit', 'Credit')}</th>
                        <th className="text-left px-3 py-2.5">{t('common.memo', 'Memo')}</th>
                        <th className="text-center px-3 py-2.5 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {jLines.map((l, i) => (
                        <tr key={i} className="border-b border-slate-100 bg-white">
                          <td className="px-3 py-2">
                            <AccountSelect
                              accounts={accounts}
                              value={l.account ?? ''}
                              onChange={(id) => setJLine(i, { account: Number(id) })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="0.01" value={l.debit}
                              onChange={(e) => setJLine(i, { debit: Math.max(0, Number(e.target.value) || 0) })}
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-right outline-none focus:border-crimson-500" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="0.01" value={l.credit}
                              onChange={(e) => setJLine(i, { credit: Math.max(0, Number(e.target.value) || 0) })}
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-right outline-none focus:border-crimson-500" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={l.memo}
                              onChange={(e) => setJLine(i, { memo: e.target.value })}
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-crimson-500" />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button type="button" onClick={() => removeJLine(i)} disabled={jLines.length === 1}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-40" aria-label="Remove line">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={addJLine} className="text-xs font-semibold text-slate-600 underline underline-offset-4 hover:text-crimson-600">
                  + {t('vouchers.addLine', 'Add line')}
                </button>
                <div className="mt-2 flex items-end justify-between gap-2 text-xs">
                  <span className="font-mono text-right">Dr {fmt(debitTotal)}</span>
                  <span className="font-mono text-right">Cr {fmt(creditTotal)}</span>
                  <span className={`font-medium ${Math.abs(debitTotal - creditTotal) < 0.0051 ? 'text-emerald-700' : 'text-crimson-600'}`}>
                    {Math.abs(debitTotal - creditTotal) < 0.0051 ? t('vouchers.balanced', '✓ balanced')
                      : t('vouchers.difference', 'Difference') + ': ' + fmt(Math.abs(debitTotal - creditTotal))}
                  </span>
                </div>
              </>
            ) : isContra ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      {t('vouchers.fromAccount', 'From account (credited)')}
                    </label>
                    <AccountSelect accounts={accounts} value={String(fromAccount ?? '')}
                      onChange={(id) => setFromAccount(Number(id))} placeholder={t('vouchers.selectAccount', '— select account —')} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      {t('vouchers.toAccount', 'To account (debited)')}
                    </label>
                    <AccountSelect accounts={accounts} value={String(toAccount ?? '')}
                      onChange={(id) => setToAccount(Number(id))} placeholder={t('vouchers.selectAccount', '— select account —')} />
                  </div>
                  <div className="flex items-end">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      {t('common.amount', 'Amount')}
                    </label>
                    <input type="number" min="0" step="0.01" value={contraAmount}
                      onChange={(e) => setContraAmount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-right font-mono outline-none focus:border-crimson-500" />
                  </div>
                </div>
                <div className="mt-2 flex justify-end text-xs">
                  <span className="font-mono text-right font-medium">Transfer {fmt(contraAmount)}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b text-[10px] uppercase text-slate-500">
                        <th className="text-left px-3 py-2.5">{t('common.description', 'Description')}</th>
                        <th className="text-right px-3 py-2.5">{t('vouchers.qty', 'Qty')}</th>
                        <th className="text-right px-3 py-2.5">{t('vouchers.rate', 'Rate')}</th>
                        <th className="text-right px-3 py-2.5">{t('common.amount', 'Amount')}</th>
                        <th className="text-center px-3 py-2.5 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {iLines.map((l, i) => (
                        <tr key={i} className="border-b border-slate-100 bg-white">
                          <td className="px-3 py-2">
                            <input value={l.description}
                              onChange={(e) => setILine(i, { description: e.target.value })}
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-crimson-500" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="any" value={l.qty}
                              onChange={(e) => setILine(i, { qty: Math.max(0, Number(e.target.value) || 0) })}
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-right outline-none focus:border-crimson-500" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="0.01" value={l.rate}
                              onChange={(e) => setILine(i, { rate: Math.max(0, Number(e.target.value) || 0) })}
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-right outline-none focus:border-crimson-500" />
                          </td>
                          <td className="px-3 py-2">
                            <span className="block rounded border border-slate-300 bg-white px-2 py-1 text-xs text-right font-mono">
                              {fmt(l.amount)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button type="button" onClick={() => removeILine(i)} disabled={iLines.length === 1}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-40" aria-label="Remove line">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={addILine} className="text-xs font-semibold text-slate-600 underline underline-offset-4 hover:text-crimson-600">
                  + {t('vouchers.addLine', 'Add line')}
                </button>
                <div className="mt-2 flex justify-end text-xs">
                  <span className="font-mono text-right font-medium">Total {fmt(itemTotal)}</span>
                </div>
              </>
            )}

            <div className="mt-6 flex items-end justify-between gap-4 border-t border-slate-200 pt-4">
              <div className="text-right">
                {isJournal ? (
                  <div className="space-y-1">
                    <div className="text-sm text-slate-600">Total debit <span className="font-mono ml-2">{fmt(debitTotal)}</span></div>
                    <div className="text-sm text-slate-600">Total credit <span className="font-mono ml-2">{fmt(creditTotal)}</span></div>
                  </div>
                ) : isContra ? (
                  <div className="text-sm text-slate-600">Transfer <span className="font-mono ml-2">{fmt(contraAmount)}</span></div>
                ) : (
                  <>
                    <div className="text-sm text-slate-600">Total <span className="font-mono ml-2">{fmt(itemTotal)}</span></div>
                    {currency !== 'NPR' && (
                      <div className="text-sm text-slate-600">{t('reports.totalBase', 'Total (base currency)')} <span className="font-mono ml-2">{fmt(toBaseCurrency(itemTotal, { currency, exchangeRate: exchangeRate ?? undefined }, 'NPR'))}</span></div>
                    )}
                  </>
                )}
                {isJournal && (
                  <div className={`text-xs font-medium ${Math.abs(debitTotal - creditTotal) < 0.0051 ? 'text-emerald-700' : 'text-crimson-600'}`}>
                    {Math.abs(debitTotal - creditTotal) < 0.0051 ? t('vouchers.balanced', '✓ balanced')
                      : t('vouchers.difference', 'Difference') + ': ' + fmt(Math.abs(debitTotal - creditTotal))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { void saveDraft() }} disabled={saving}
                  className="rounded border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                  {t('vouchers.saveDraft', 'Save draft')}
                </button>
                {!isQuote && (
                  <button onClick={postVoucher} disabled={saving}
                    className="rounded bg-crimson-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50 transition-colors"
                    title={!isJournal && (!iLines.some((l) => l.description && (l.amount || 0) > 0))
                      ? t('vouchers.linesRequired', 'Add at least one line')
                      : isJournal && Math.abs(debitTotal - creditTotal) >= 0.0051
                        ? t('vouchers.unbalancedHint', 'Debit and credit must match before saving')
                        : undefined}>
                    {saving
                      ? t('vouchers.posting', 'Posting…')
                      : isOrder
                        ? t('vouchers.confirmOrder', 'Confirm order')
                        : t('vouchers.post', 'Post')}
                  </button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
