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
import { useTenantQuery } from '../lib/tenant'
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
] as const

interface JLine { account: number | null; debit: number; credit: number; memo: string }
interface ILine { description: string; qty: number; rate: number; amount: number }

const blankJLine: JLine = { account: null, debit: 0, credit: 0, memo: '' }
const blankILine: ILine = { description: '', qty: 1, rate: 0, amount: 0 }

export default function VoucherStepper({ mode = 'create' }: VoucherStepperProps) {
  const navigate = useNavigate()
  const { docType: routeDocType } = useParams<{ docType?: string }>()
  const t = useT()
  const tenantQuery = useTenantQuery()
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

  const isJournal = docType === 'journal-voucher'
  const isContra = docType === 'contra'
  const isQuote = docType === 'sales-quote'
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

  const saveDraft = useCallback(async () => {
    setError('')
    setSaving(true)
    try {
      const body = buildDraftBody()
      if (draftId) {
        await api(`/documents/${draftId}`, { method: 'PATCH', body, query: tenantQuery })
      } else {
        const created = await api<{ doc: { id: number } } | { id: number }>('/documents', {
          method: 'POST', body, query: tenantQuery,
        })
        setDraftId('doc' in created ? created.doc.id : created.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft')
    } finally {
      setSaving(false)
    }
  }, [buildDraftBody, draftId, tenantQuery])

  const postVoucher = useCallback(async () => {
    setError('')
    if (!step2Valid) {
      setError(isJournal ? t('vouchers.unbalanced', 'Debits and credits must match')
        : t('vouchers.linesRequired', 'Add at least one line'))
      return
    }
    await saveDraft()
    if (error || !draftId) return
    setSaving(true)
    try {
      await api(`/documents/${draftId}/post`, { method: 'POST' })
      navigate('/vouchers')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Post failed')
      setSaving(false)
    }
  }, [draftId, error, isJournal, navigate, saveDraft, step2Valid])

  const goNext = useCallback(async () => {
    setError('')
    if (step === 1) {
      if (!step1Valid) {
        setError(partyRequired && !partyId ? t('vouchers.partyRequired', 'Party is required')
          : t('vouchers.dateRequired', 'Date is required'))
        return
      }
      await saveDraft()
      if (error) return
      setStep(2)
    } else if (step === 2) {
      if (!step2Valid) {
        setError(isJournal ? t('vouchers.unbalanced', 'Debits and credits must match')
          : t('vouchers.linesRequired', 'Add at least one line'))
        return
      }
      await saveDraft()
      if (error) return
      setStep(3)
    }
  }, [error, isJournal, partyRequired, partyId, step, step1Valid, step2Valid, saveDraft])

  const goPrev = () => { setError(''); setStep((s) => s - 1) }

  const stepLabel = (n: number) => {
    const key = n === 1 ? 'stepDetails' : n === 2 ? 'stepLines' : 'stepReview'
    return t(`vouchers.${key}`, key === 'stepDetails' ? 'Voucher details' : key === 'stepLines' ? 'Lines' : 'Review & post')
  }

  const selectCls = 'mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-crimson-500'
  const inputCls = 'mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-crimson-500 text-right'
  const numCls = inputCls + ' font-mono'

  return (
    <div className="mx-auto max-w-4xl pb-28">
      <div className="flex items-center justify-between py-4">
        <button onClick={() => navigate('/vouchers')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold text-slate-900">{t('vouchers.newTransaction', 'New Transaction')}</h1>
      </div>

      {error && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Stepper header */}
      <div className="mt-4 flex items-center gap-2 px-1">
        {[1, 2, 3].map((n) => (
          <React.Fragment key={n}>
            <div className="flex flex-col items-center gap-1">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${
                n === step ? 'border-crimson-600 bg-crimson-50 text-crimson-700'
                  : 'border-slate-200 text-slate-400'
              }`}>{n}</span>
              <span className="text-[10px] font-medium text-slate-500">{stepLabel(n)}</span>
            </div>
            {n < 3 && <div className="h-px w-4 bg-slate-200 shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* ── Step 1: voucher details ── */}
      {step === 1 && (
        <section className="mt-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700">{t('vouchers.docType', 'Voucher type')}</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
              className={selectCls}
            >
              <option value="">{t('vouchers.select', '— select —')}</option>
              {STEPS.map((dt) => (
                <option key={dt.value} value={dt.value}>
                  {t(`vouchers.${dt.labelKey}`, DOC_TYPE_LABELS[dt.value])}
                </option>
              ))}
            </select>
          </div>

          {partyRequired && (
            <div>
              <label className="block text-sm font-medium text-slate-700">{t('vouchers.columnParty', 'Party')}</label>
              <select
                value={String(partyId ?? '')}
                onChange={(e) => setPartyId(e.target.value ? Number(e.target.value) : null)}
                className={selectCls}
              >
                <option value="">{t('vouchers.select', '— select —')}</option>
                {parties.map((p) => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </select>
              {!partyId && <p className="mt-1 text-xs text-red-600">{t('vouchers.partyRequired', 'Party is required')}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">{t('common.date', 'Date')}</label>
            <NepaliDateInput value={date} onChange={setDate} />
            {!date && <p className="mt-1 text-xs text-red-600">{t('vouchers.dateRequired', 'Date is required')}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">{t('common.currency', 'Currency')}</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className={selectCls}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          {currency !== 'NPR' && (
            <div>
              <label className="block text-sm font-medium text-slate-700">{t('common.exchangeRate', 'Exchange rate')}</label>
              <input
                type="number"
                step="any"
                min="0"
                value={exchangeRate ?? ''}
                onChange={(e) => setExchangeRate(e.target.value ? parseFloat(e.target.value) : null)}
                className={inputCls}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">{t('common.memo', 'Narration')}</label>
            <textarea
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder={t('vouchers.narrationPlaceholder', 'Description of the transaction…')}
              className={inputCls}
              rows={2}
            />
          </div>

          <div className="flex justify-between">
            <button onClick={goNext} disabled={saving || !step1Valid}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              title={!step1Valid ? (partyRequired && !partyId ? t('vouchers.partyRequired', 'Party is required')
                : t('vouchers.dateRequired', 'Date is required')) : undefined}>
              {t('common.next', 'Next')}
            </button>
          </div>
        </section>
      )}

      {/* ── Step 2: lines ── */}
      {step === 2 && (
        <section className="mt-6 space-y-4">
          {isJournal && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b text-xs uppercase text-slate-500">
                      <th className="text-left px-3 py-2">{t('common.account', 'Account')}</th>
                      <th className="text-right px-3 py-2">{t('common.debit', 'Debit')}</th>
                      <th className="text-right px-3 py-2">{t('common.credit', 'Credit')}</th>
                      <th className="text-left px-3 py-2">{t('common.memo', 'Memo')}</th>
                      <th className="text-center px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {jLines.map((l, i) => (
                      <tr key={i} className="border-b border-slate-100">
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
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm text-right outline-none focus:border-crimson-500" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="0.01" value={l.credit}
                            onChange={(e) => setJLine(i, { credit: Math.max(0, Number(e.target.value) || 0) })}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm text-right outline-none focus:border-crimson-500" />
                        </td>
                        <td className="px-3 py-2">
                          <input value={l.memo}
                            onChange={(e) => setJLine(i, { memo: e.target.value })}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-crimson-500" />
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
              <button type="button" onClick={addJLine} className="text-sm text-slate-600 underline underline-offset-4 hover:text-crimson-600">
                + {t('vouchers.addLine', '+ Add line')}
              </button>
              <div className="mt-2 flex items-end justify-between gap-2 text-sm">
                <span className="font-mono text-right">Dr {fmt(debitTotal)}</span>
                <span className="font-mono text-right">Cr {fmt(creditTotal)}</span>
                <span className={`text-xs font-medium ${
                  Math.abs(debitTotal - creditTotal) < 0.0051 ? 'text-emerald-700' : 'text-crimson-600'
                }`}>
                  {Math.abs(debitTotal - creditTotal) < 0.0051 ? t('vouchers.balanced', '✓ balanced')
                    : t('vouchers.difference', 'Difference') + ': ' + fmt(Math.abs(debitTotal - creditTotal))}
                </span>
              </div>
            </>
            )}

          {isContra && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">{t('vouchers.fromAccount', 'From account (credited)')}</label>
                <AccountSelect accounts={accounts} value={String(fromAccount ?? '')}
                  onChange={(id) => setFromAccount(Number(id))} placeholder={t('vouchers.selectAccount', '— select account —')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">{t('vouchers.toAccount', 'To account (debited)')}</label>
                <AccountSelect accounts={accounts} value={String(toAccount ?? '')}
                  onChange={(id) => setToAccount(Number(id))} placeholder={t('vouchers.selectAccount', '— select account —')} />
              </div>
              <div className="flex items-end">
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('common.amount', 'Amount')}</label>
                <input type="number" min="0" step="0.01" value={contraAmount}
                  onChange={(e) => setContraAmount(Math.max(0, Number(e.target.value) || 0))}
                  className={numCls} />
              </div>
            </div>
          )}

          {!isJournal && !isContra && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b text-xs uppercase text-slate-500">
                      <th className="text-left px-3 py-2">{t('common.description', 'Description')}</th>
                      <th className="text-right px-3 py-2">{t('vouchers.qty', 'Qty')}</th>
                      <th className="text-right px-3 py-2">{t('vouchers.rate', 'Rate')}</th>
                      <th className="text-right px-3 py-2">{t('common.amount', 'Amount')}</th>
                      <th className="text-center px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {iLines.map((l, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-3 py-2">
                          <input value={l.description}
                            onChange={(e) => setILine(i, { description: e.target.value })}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-crimson-500" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="any" value={l.qty}
                            onChange={(e) => setILine(i, { qty: Math.max(0, Number(e.target.value) || 0) })}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm text-right outline-none focus:border-crimson-500" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="0.01" value={l.rate}
                            onChange={(e) => setILine(i, { rate: Math.max(0, Number(e.target.value) || 0) })}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm text-right outline-none focus:border-crimson-500" />
                        </td>
                        <td className="px-3 py-2">
                          <span className="block rounded border border-slate-300 bg-white px-2 py-1 text-sm text-right font-mono">
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
              <button type="button" onClick={addILine} className="text-sm text-slate-600 underline underline-offset-4 hover:text-crimson-600">
                + {t('vouchers.addLine', '+ Add line')}
              </button>
              <div className="mt-2 flex justify-end text-sm">
                <span className="font-mono text-right font-medium">Total {fmt(itemTotal)}</span>
              </div>
            </>
            )}

          <div className="flex justify-between">
            <button onClick={goPrev} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              {t('common.back', 'Back')}
            </button>
            <button onClick={goNext} disabled={saving || !step2Valid}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              title={!step2Valid ? (isJournal ? t('vouchers.unbalancedHint', 'Debit and credit must match before saving')
                : t('vouchers.linesRequired', 'Add at least one line')) : undefined}>
              {t('vouchers.stepReview', 'Review & post')}
            </button>
          </div>
        </section>
      )}

      {/* ── Step 3: review & post ── */}
      {step === 3 && (
        <section className="mt-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-500">{t('vouchers.tabNewTransaction', 'Voucher type')}</p>
              <p className="text-sm font-medium text-slate-900">
                {t(`vouchers.${STEPS.find((d) => d.value === docType)?.labelKey ?? ''}`, DOC_TYPE_LABELS[docType])}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">{t('vouchers.columnParty', 'Party')}</p>
              <p className="text-sm text-slate-700">{party?.name ?? '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">{t('common.date', 'Date')}</p>
              <p className="text-sm font-mono text-slate-700">{date}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">{t('common.currency', 'Currency')}</p>
              <p className="text-sm font-mono text-slate-700">{currency}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">{t('common.memo', 'Narration')}</p>
              <p className="text-sm text-slate-700">{narration || '—'}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  {isJournal ? (
                    <>
                      <th className="text-left px-3 py-2">{t('common.account', 'Account')}</th>
                      <th className="text-right px-3 py-2">{t('common.debit', 'Debit')}</th>
                      <th className="text-right px-3 py-2">{t('common.credit', 'Credit')}</th>
                      <th className="text-left px-3 py-2">{t('common.memo', 'Memo')}</th>
                    </>
                  ) : isContra ? (
                    <>
                      <th className="text-left px-3 py-2">{t('vouchers.fromAccount', 'From account (credited)')}</th>
                      <th className="text-left px-3 py-2">{t('vouchers.toAccount', 'To account (debited)')}</th>
                      <th className="text-right px-3 py-2">{t('common.amount', 'Amount')}</th>
                    </>
                  ) : (
                    <>
                      <th className="text-left px-3 py-2">{t('common.description', 'Description')}</th>
                      <th className="text-right px-3 py-2">{t('vouchers.qty', 'Qty')}</th>
                      <th className="text-right px-3 py-2">{t('vouchers.rate', 'Rate')}</th>
                      <th className="text-right px-3 py-2">{t('common.amount', 'Amount')}</th>
                    </>
                    )}
                </tr>
              </thead>
              <tbody>
                {isJournal ? jLines.filter((l) => l.account != null).map((l, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <span className="text-slate-700">
                        {(accounts.find((a) => a.id === l.account)?.name) || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(l.debit)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(l.credit)}</td>
                    <td className="px-3 py-2 text-slate-500">{l.memo || '—'}</td>
                  </tr>
                )) : isContra ? (
                  <tr className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <span className="text-slate-700">
                        {(accounts.find((a) => a.id === fromAccount)?.name) || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-slate-700">
                        {(accounts.find((a) => a.id === toAccount)?.name) || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(contraAmount)}</td>
                  </tr>
                ) : (
                  iLines.filter((l) => l.description && (l.amount || 0) > 0).map((l, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{l.description}</td>
                      <td className="px-3 py-2 text-right">{l.qty}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(l.rate)}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(l.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-end justify-between gap-4 border-t border-slate-200 pt-3">
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
              <button onClick={goPrev} className="rounded border border-slate-300 px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                {t('common.back', 'Back')}
              </button>
              <LiquidButton variant="outline" onClick={saveDraft} disabled={saving}>
                {saving ? t('common.saving', 'Saving…') : t('vouchers.saveDraft', 'Save draft')}
              </LiquidButton>
              {!isQuote && (
                <LiquidButton onClick={postVoucher} disabled={saving || !step2Valid}
                  title={!step2Valid ? (isJournal ? t('vouchers.unbalancedHint', 'Debit and credit must match before saving')
                    : t('vouchers.linesRequired', 'Add at least one line')) : undefined}>
                  {saving ? t('vouchers.posting', 'Posting…') : t('vouchers.post', 'Post')}
                </LiquidButton>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
