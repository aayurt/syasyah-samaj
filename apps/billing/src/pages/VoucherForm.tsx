import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Camera,
  FilePenLine,
  Minus,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react'
import { api, fmt, list } from '../lib/api'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import {
  DOC_TYPE_LABELS,
  type Account,
  type DocType,
  type Document,
  type Item,
  type Party,
  type TaxNature,
  type TaxType,
} from '../lib/types'

/* ── Types ─────────────────────────────────────────────────────── */

interface LineDraft {
  key: string; id?: string; item: string; description: string
  qty: string; rate: string; amount: string; discountPct: string; discountAmt: string
}
interface JLineDraft {
  key: string; id?: string; account: string; debit: string; credit: string; memo: string
}
interface TaxLineDraft {
  key: string; id?: string; taxType: string; nature: TaxNature; rate: string
}

const emptyLine = (): LineDraft => ({
  key: crypto.randomUUID(), item: '', description: '', qty: '', rate: '',
  amount: '', discountPct: '', discountAmt: '',
})
const emptyJLine = (): JLineDraft => ({
  key: crypto.randomUUID(), account: '', debit: '', credit: '', memo: '',
})

/* ── Helpers ───────────────────────────────────────────────────── */

const INVENTORY_TYPES = ['sales-invoice', 'delivery-challan', 'grn']
const CASH_TYPES = ['payment-voucher', 'receipt-voucher']

type Props = { mode: 'create' | 'edit' }

/* ── Component ─────────────────────────────────────────────────── */

export default function VoucherForm({ mode }: Props) {
  const navigate = useNavigate()
  const { id } = useParams()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()

  // Data
  const [parties, setParties] = useState<Party[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [taxTypes, setTaxTypes] = useState<TaxType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [docType, setDocType] = useState<DocType>('sales-invoice')
  // Sync prefix when docType changes
  const updateDocType = (dt: DocType) => {
    setDocType(dt)
    setInvoicePrefix(DOC_PREFIXES[dt] || 'INV')
    setManualNumber('')
    setNumberManual(false)
  }
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [party, setParty] = useState('')
  const [partySearch, setPartySearch] = useState('')
  const [narration, setNarration] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()])
  const [journalLines, setJournalLines] = useState<JLineDraft[]>([emptyJLine(), emptyJLine()])
  const [paymentMethod, setPaymentMethod] = useState('bank')
  const [bankAccount, setBankAccount] = useState('')
  const [fromAccount, setFromAccount] = useState('')
  const [toAccount, setToAccount] = useState('')
  const [contraAmount, setContraAmount] = useState('')
  const [taxRate, setTaxRate] = useState('0')
  const [taxLines, setTaxLines] = useState<TaxLineDraft[]>([])

  // TDS toggle
  const [tdsEnabled, setTdsEnabled] = useState(false)
  const [tdsAccountId, setTdsAccountId] = useState('')
  const [tdsTypeId, setTdsTypeId] = useState('')
  const [tdsAmountManual, setTdsAmountManual] = useState('')

  // Invoice number
  const DOC_PREFIXES: Record<string, string> = {
    'sales-invoice': 'SI', 'purchase-invoice': 'PI', 'payment-voucher': 'PV',
    'receipt-voucher': 'RV', 'credit-note': 'CN', 'debit-note': 'DN',
    'petty-cash-voucher': 'PC', grn: 'GRN', 'delivery-challan': 'DC',
    'journal-voucher': 'JV', contra: 'CT',
  }
  const [invoicePrefix, setInvoicePrefix] = useState(() => DOC_PREFIXES['sales-invoice'] || 'INV')
  const [numberManual, setNumberManual] = useState(false)
  const [manualNumber, setManualNumber] = useState('')
  const [nextNumberPreview, setNextNumberPreview] = useState('')

  // Add party popup
  const [showPartyPopup, setShowPartyPopup] = useState(false)
  const [newPartyName, setNewPartyName] = useState('')
  const [newPartyType, setNewPartyType] = useState<'customer' | 'vendor'>('customer')
  const [newPartyPhone, setNewPartyPhone] = useState('')
  const [newPartyEmail, setNewPartyEmail] = useState('')
  const [newPartySaving, setNewPartySaving] = useState(false)

  // Party search dropdown
  const [showPartyDropdown, setShowPartyDropdown] = useState(false)
  const partyRef = useRef<HTMLDivElement>(null)

  // Discount mode: toggle between percentage and flat amount
  const [discountMode, setDiscountMode] = useState<'pct' | 'amt'>('pct')

  // Item search per row (separate from party search)
  const [itemSearchRow, setItemSearchRow] = useState<string | null>(null)
  const [itemSearchText, setItemSearchText] = useState('')

  // Add item popup
  const [showItemPopup, setShowItemPopup] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemCode, setNewItemCode] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('')
  const [newItemSalePrice, setNewItemSalePrice] = useState('')
  const [newItemPurchasePrice, setNewItemPurchasePrice] = useState('')
  const [newItemSaving, setNewItemSaving] = useState(false)
  const [newItemTargetLine, setNewItemTargetLine] = useState<string | null>(null)

  /* ── Load data ──────────────────────────────────────────────── */
  useEffect(() => {
    ;(async () => {
      try {
        const [p, a, it, tx] = await Promise.all([
          list<Party>('parties', { depth: 0, sort: 'name', ...tenantQuery }),
          list<Account>('gl-accounts', { depth: 0, sort: 'name', ...tenantQuery }),
          list<Item>('items', { depth: 0, sort: 'name', ...tenantQuery }),
          list<TaxType>('tax-types', { depth: 0, ...tenantQuery }),
        ])
        setParties(p.docs); setAccounts(a.docs); setItems(it.docs)
        setTaxTypes(tx.docs.filter((t) => t.active !== false))
      } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to load') }
      finally { setLoading(false) }
    })()
  }, [tenantId])

  /* ── Load existing doc for edit ─────────────────────────────── */
  useEffect(() => {
    if (mode !== 'edit' || !id) return
    ;(async () => {
      try {
        const d = await api<Document>(`/documents/${id}`, { query: { depth: 1, ...tenantQuery } })
        setDocType(d.docType); setInvoicePrefix(DOC_PREFIXES[d.docType] || 'INV')
        setDate(d.date?.slice(0, 10) || new Date().toISOString().slice(0, 10))
        setNarration(d.narration || '')
        setTaxRate(String(d.taxRate ?? 0))
        setPaymentMethod(d.paymentMethod || 'bank')
        const idOf = (v: unknown): string => v && typeof v === 'object' ? String((v as { id: unknown }).id) : String(v ?? '')
        setParty(idOf(d.party))
        setBankAccount(idOf(d.bankAccount))
        setFromAccount(idOf(d.fromAccount))
        setToAccount(idOf(d.toAccount))
        setContraAmount(d.grossTotal !== undefined ? String(d.grossTotal) : '')
        if (d.lines?.length) {
          setLines(d.lines.map((l) => ({
            key: crypto.randomUUID(), id: l.id, item: idOf(l.item),
            description: l.description || '', qty: l.qty != null ? String(l.qty) : '',
            rate: l.rate != null ? String(l.rate) : '', amount: l.amount != null ? String(l.amount) : '',
            discountPct: '', discountAmt: '',
          })))
        }
        if (d.journalLines?.length) {
          setJournalLines(d.journalLines.map((l) => ({
            key: crypto.randomUUID(), id: l.id, account: idOf(l.account),
            debit: l.debit != null ? String(l.debit) : '', credit: l.credit != null ? String(l.credit) : '',
            memo: l.memo || '',
          })))
        }
        if (d.taxLines?.length) {
          const wh = d.taxLines.find((tl) => tl.nature === 'withholding')
          if (wh) {
            setTdsEnabled(true); setTdsTypeId(idOf(wh.taxType)); setTdsAmountManual('')
          }
          setTaxLines(d.taxLines.map((tl) => ({
            key: crypto.randomUUID(), id: tl.id, taxType: idOf(tl.taxType),
            nature: tl.nature || 'additive', rate: tl.rate != null ? String(tl.rate) : '',
          })))
        }
      } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to load voucher') }
    })()
  }, [mode, id, tenantId])

  /* ── Close party dropdown on outside click ──────────────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (partyRef.current && !partyRef.current.contains(e.target as Node)) setShowPartyDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ── Derived ────────────────────────────────────────────────── */
  const meta = DOC_TYPE_LABELS[docType] || docType
  const isItem = ['sales-invoice', 'purchase-invoice', 'payment-voucher', 'receipt-voucher',
    'credit-note', 'debit-note', 'petty-cash-voucher', 'grn', 'delivery-challan'].includes(docType)
  const isContra = docType === 'contra'
  const isJournal = docType === 'journal-voucher'
  const isCash = CASH_TYPES.includes(docType)
  const isInventory = INVENTORY_TYPES.includes(docType)
  const isTaxable = ['sales-invoice', 'purchase-invoice', 'payment-voucher', 'receipt-voucher'].includes(docType)
  const bankAccounts = accounts.filter((a) => a.class === 'bank')
  const cashBankAccounts = accounts.filter((a) => a.class === 'cash' || a.class === 'bank')
  const taxOptions = taxTypes.filter((t) => isCash ? t.nature === 'withholding' : true)

  const filteredParties = useMemo(() => {
    if (!partySearch) return parties
    const q = partySearch.toLowerCase()
    return parties.filter((p) => p.name.toLowerCase().includes(q))
  }, [parties, partySearch])

  const selectedParty = parties.find((p) => String(p.id) === party)

  // Line calculations
  const lineTotals = useMemo(() => {
    let net = 0
    for (const l of lines) {
      const base = l.amount !== '' ? parseFloat(l.amount) || 0 : (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0)
      const discPct = parseFloat(l.discountPct) || 0
      const discAmt = parseFloat(l.discountAmt) || 0
      const afterPct = discPct > 0 ? base * (1 - discPct / 100) : base
      const afterDisc = afterPct - discAmt
      net += Math.max(afterDisc, 0)
    }
    return net
  }, [lines])

  // Contra totals
  const contraTotal = parseFloat(contraAmount) || 0

  // Tax calculation
  const tdsTaxType = taxTypes.find((t) => String(t.id) === tdsTypeId)
  const tdsRate = tdsTaxType ? Number(tdsTaxType.rate) || 0 : 0
  const tdsAutoAmount = lineTotals > 0 && tdsRate > 0 ? (lineTotals * tdsRate) / 100 : 0
  const tdsAmount = tdsAmountManual ? parseFloat(tdsAmountManual) || 0 : tdsAutoAmount

  // Journal totals
  const jTotals = useMemo(() => {
    let debit = 0; let credit = 0
    for (const l of journalLines) { debit += parseFloat(l.debit) || 0; credit += parseFloat(l.credit) || 0 }
    return { debit, credit, diff: debit - credit }
  }, [journalLines])

  // VAT / additive tax total
  const vatTotal = useMemo(() => {
    let total = 0
    for (const tl of taxLines) {
      if (tl.nature === 'additive') {
        const txType = taxTypes.find((t) => String(t.id) === tl.taxType)
        const rate = txType ? Number(txType.rate) || parseFloat(tl.rate) || 0 : parseFloat(tl.rate) || 0
        total += (lineTotals * rate) / 100
      }
    }
    return total
  }, [taxLines, taxTypes, lineTotals])

  // Grand total
  const grandTotal = isContra ? contraTotal : lineTotals + vatTotal

  /* ── Line setters ───────────────────────────────────────────── */
  const setLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l) => l.key === key ? { ...l, ...patch } : l))
  const setJLine = (key: string, patch: Partial<JLineDraft>) =>
    setJournalLines((ls) => ls.map((l) => l.key === key ? { ...l, ...patch } : l))
  const removeLine = (key: string) => setLines((ls) => ls.length > 1 ? ls.filter((l) => l.key !== key) : ls)
  const removeJLine = (key: string) => setJournalLines((ls) => ls.length > 2 ? ls.filter((l) => l.key !== key) : ls)

  /* ── Discount toggle with auto-conversion ─────────────────── */
  const toggleDiscountMode = () => {
    const next = discountMode === 'pct' ? 'amt' : 'pct'
    setLines((ls) => ls.map((l) => {
      const base = (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0)
      if (next === 'amt') {
        // % → Rs.: convert current % to flat amount
        const pct = parseFloat(l.discountPct) || 0
        const amt = base > 0 && pct > 0 ? base * (pct / 100) : 0
        return { ...l, discountAmt: amt > 0 ? amt.toFixed(2) : '', discountPct: '' }
      } else {
        // Rs. → %: convert current flat amount to %
        const amt = parseFloat(l.discountAmt) || 0
        const pct = base > 0 && amt > 0 ? (amt / base) * 100 : 0
        return { ...l, discountPct: pct > 0 ? (Math.round(pct * 100) / 100) + '' : '', discountAmt: '' }
      }
    }))
    setDiscountMode(next)
  }

  /* ── Submit ─────────────────────────────────────────────────── */
  const buildBody = () => {
    const finalNumber = numberManual ? manualNumber : nextNumberPreview
    const base: Record<string, unknown> = {
      docType, date, narration: narration || undefined,
      party: party ? Number(party) : undefined, status: 'draft',
      number: finalNumber || undefined,
      ...(tenantId ? { tenant: tenantId } : {}),
    }
    if (isItem) {
      base.lines = lines.map((l) => ({
        ...(l.id ? { id: l.id } : {}),
        item: l.item ? Number(l.item) : undefined, description: l.description,
        qty: l.qty !== '' ? Number(l.qty) : undefined,
        rate: l.rate !== '' ? Number(l.rate) : undefined,
        amount: l.amount !== '' ? Number(l.amount) : undefined,
      }))
      base.taxRate = parseFloat(taxRate) || 0
    } else if (isContra) {
      base.fromAccount = fromAccount ? Number(fromAccount) : undefined
      base.toAccount = toAccount ? Number(toAccount) : undefined
      base.netTotal = contraTotal; base.grossTotal = contraTotal; base.taxTotal = 0; base.taxRate = 0
    } else if (isJournal) {
      base.journalLines = journalLines.map((l) => ({
        ...(l.id ? { id: l.id } : {}), account: Number(l.account),
        debit: l.debit ? parseFloat(l.debit) : undefined,
        credit: l.credit ? parseFloat(l.credit) : undefined,
        memo: l.memo || undefined,
      }))
    }
    // Tax lines + TDS
    const allTaxLines = [...taxLines]
    if (tdsEnabled && tdsAmount > 0 && tdsTypeId) {
      allTaxLines.push({ key: '__tds__', taxType: tdsTypeId, nature: 'withholding' as TaxNature, rate: String(tdsRate) })
    }
    if (allTaxLines.length > 0) {
      base.taxLines = allTaxLines.map((tl) => ({
        ...(tl.id ? { id: tl.id } : {}), taxType: Number(tl.taxType), nature: tl.nature, rate: parseFloat(tl.rate) || 0,
      }))
    }
    if (isCash) {
      base.paymentMethod = paymentMethod || 'bank'
      if (bankAccount) base.bankAccount = Number(bankAccount)
    }
    return base
  }

  const submit = async (post: boolean) => {
    setSaving(true); setError('')
    try {
      if (mode === 'edit' && id) {
        await api(`/documents/${id}`, { method: 'PATCH', body: buildBody() })
        if (post) await api(`/documents/${id}/post`, { method: 'POST' })
      } else {
        const created = await api<{ doc: Document }>('/documents', { method: 'POST', body: buildBody() })
        if (post) await api(`/documents/${created.doc.id}/post`, { method: 'POST' })
      }
      navigate('/vouchers')
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to save') }
    setSaving(false)
  }

  /* ── Loading ────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center gap-3 py-4">
          <button onClick={() => navigate('/vouchers')} className="rounded p-1 text-slate-400 hover:bg-slate-100"><ArrowLeft size={18} /></button>
          <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />)}
        </div>
      </div>
    )
  }

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="mx-auto max-w-5xl pb-24">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/vouchers')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-semibold text-slate-900">
            {mode === 'edit' ? `Edit ${meta}` : `Create ${meta}`}
          </h1>
        </div>
        <button className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Settings2 size={18} /></button>
      </div>

      {error && <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* ── Top row: Party, Invoice No, Date ──────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {/* Party (searchable) */}
          {(isItem || isCash) && (
            <div ref={partyRef} className="relative">
              <label className="text-sm font-medium text-slate-700">Select Party</label>
              <div className="relative mt-1">
                <input
                  type="text"
                  value={showPartyDropdown ? partySearch : (selectedParty?.name || partySearch)}
                  onChange={(e) => { setPartySearch(e.target.value); setShowPartyDropdown(true); setParty('') }}
                  onFocus={() => { setShowPartyDropdown(true); setPartySearch('') }}
                  placeholder="Search for party"
                  className="w-full rounded border border-slate-300 px-3 min-h-[40px] py-2.5 pr-8 text-sm outline-none focus:border-slate-500"
                />
                <svg className="pointer-events-none absolute right-2.5 top-[11px] h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
              {showPartyDropdown && (
                <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {filteredParties.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">No parties found</div>}
                  <button type="button" onClick={() => { setShowPartyPopup(true); setShowPartyDropdown(false) }}
                    className="w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-emerald-600 hover:bg-emerald-50">
                    + Add new party
                  </button>
                  {filteredParties.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setParty(String(p.id)); setPartySearch(p.name); setShowPartyDropdown(false) }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${String(p.id) === party ? 'bg-crimson-50 text-crimson-700' : 'text-slate-700'}`}
                    >
                      <span>{p.name}</span>
                      <span className="text-xs text-slate-400">{p.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Invoice No with prefix + manual toggle */}
          <div>
            <label className="text-sm font-medium text-slate-700">Invoice No</label>
            <div className="mt-1 grid grid-cols-[auto_1fr] gap-2">
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                className="w-20 rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-center font-mono text-sm font-semibold uppercase outline-none focus:border-slate-500"
                maxLength={8}
                placeholder="Prefix"
              />
              <div className="flex items-center gap-2">
                {numberManual ? (
                  <input
                    type="text"
                    value={manualNumber}
                    onChange={(e) => setManualNumber(e.target.value)}
                    placeholder="Type invoice number"
                    className="w-full rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-sm font-mono outline-none focus:border-slate-500"
                  />
                ) : (
                  <div className="flex-1 rounded border border-slate-200 bg-slate-50 px-3 min-h-[40px] py-2.5 font-mono text-sm text-slate-600">
                    {nextNumberPreview || `${invoicePrefix}-...`}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setNumberManual((m) => !m); setManualNumber('') }}
                  className={`shrink-0 rounded px-2 min-h-[40px] py-2.5 text-xs font-medium transition-colors ${
                    numberManual
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {numberManual ? 'Manual' : 'Auto'}
                </button>
              </div>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="text-sm font-medium text-slate-700">Invoice Date</label>
            <div className="relative mt-1">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 min-h-[40px] py-2.5 pr-10 text-sm outline-none focus:border-slate-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Item lines table ──────────────────────────────────── */}
      {isItem && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="w-12 px-4 py-3">S.N.</th>
                <th className="px-4 py-3">Name</th>
                <th className="w-20 px-4 py-3 text-right">Quantity</th>
                <th className="w-28 px-4 py-3 text-right">Rate</th>
                <th className="w-28 px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Discount</span>
                    <button type="button" onClick={toggleDiscountMode}
                      className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100">
                      {discountMode === 'pct' ? 'Rs.' : '%'}
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    </button>
                  </div>
                </th>
                <th className="w-28 px-4 py-3 text-right">Amount</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const base = l.amount !== '' ? parseFloat(l.amount) || 0 : (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0)
                const discPct = parseFloat(l.discountPct) || 0
                const discAmt = parseFloat(l.discountAmt) || 0
                const afterPct = discPct > 0 ? base * (1 - discPct / 100) : base
                const finalAmt = afterPct - discAmt
                return (
                  <tr key={l.key} className="border-b border-slate-50">
                    <td className="px-4 py-2 text-center text-slate-400">{i + 1}</td>
                    <td className="px-2 py-2">
                      {isInventory ? (
                        <div className="relative">
                          <input
                            type="text"
                            value={itemSearchRow === l.key ? itemSearchText : (items.find((it) => String(it.id) === l.item)?.name || '')}
                            onChange={(e) => {
                              setItemSearchRow(l.key); setItemSearchText(e.target.value)
                              setLine(l.key, { item: '', description: e.target.value })
                            }}
                            onFocus={() => { setItemSearchRow(l.key); setItemSearchText('') }}
                            placeholder="Enter Item name"
                            className="w-full rounded border border-slate-200 px-2 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500"
                          />
                          {itemSearchRow === l.key && (
                            <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
                              <button type="button" onClick={() => { setNewItemTargetLine(l.key); setShowItemPopup(true); setItemSearchRow(null) }}
                                className="w-full border-b border-slate-100 px-3 py-2 text-left text-sm font-medium text-emerald-600 hover:bg-emerald-50">
                                + Add new item
                              </button>
                              {itemSearchText && items.filter((it) => it.name.toLowerCase().includes(itemSearchText.toLowerCase())).slice(0, 5).map((it) => (
                                <button key={it.id} type="button" onClick={() => {
                                  setLine(l.key, { item: String(it.id), description: it.name, rate: String(it.salePrice || '') })
                                  setItemSearchRow(null); setItemSearchText('')
                                }} className="block w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                                  {it.code ? `${it.code} · ` : ''}{it.name}
                                </button>
                              ))}
                              {!itemSearchText && items.slice(0, 5).map((it) => (
                                <button key={it.id} type="button" onClick={() => {
                                  setLine(l.key, { item: String(it.id), description: it.name, rate: String(it.salePrice || '') })
                                  setItemSearchRow(null); setItemSearchText('')
                                }} className="block w-full px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                                  {it.code ? `${it.code} · ` : ''}{it.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text" value={l.description}
                          onChange={(e) => setLine(l.key, { description: e.target.value })}
                          placeholder="Enter Item name"
                          className="w-full rounded border border-slate-200 px-2 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500"
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" min="0" step="any" value={l.qty}
                        onChange={(e) => setLine(l.key, { qty: e.target.value })}
                        className="w-full rounded border border-slate-200 px-2 min-h-[40px] py-2.5 text-right font-mono text-sm outline-none focus:border-slate-500" />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center">
                        <span className="mr-1 text-xs text-slate-400">Rs.</span>
                        <input type="number" min="0" step="0.01" value={l.rate}
                          onChange={(e) => setLine(l.key, { rate: e.target.value })}
                          className="w-full rounded border border-slate-200 px-2 min-h-[40px] py-2.5 text-right font-mono text-sm outline-none focus:border-slate-500" />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center">
                        {discountMode === 'pct' ? (
                          <>
                            <input type="number" min="0" max="100" step="0.01" value={l.discountPct}
                              onChange={(e) => setLine(l.key, { discountPct: e.target.value, discountAmt: '' })}
                              className="w-full rounded border border-slate-200 px-2 min-h-[40px] py-2.5 text-right font-mono text-sm outline-none focus:border-slate-500" />
                            <span className="ml-1 text-xs text-slate-400">%</span>
                          </>
                        ) : (
                          <>
                            <span className="mr-1 text-xs text-slate-400">Rs.</span>
                            <input type="number" min="0" step="0.01" value={l.discountAmt}
                              onChange={(e) => setLine(l.key, { discountAmt: e.target.value, discountPct: '' })}
                              className="w-full rounded border border-slate-200 px-2 min-h-[40px] py-2.5 text-right font-mono text-sm outline-none focus:border-slate-500" />
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-medium text-slate-800">
                      {fmt(Math.max(finalAmt, 0))}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button type="button" onClick={() => removeLine(l.key)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50">
                <td colSpan={5} className="px-4 py-3 text-right text-sm font-medium text-slate-600">Sub Total</td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">{fmt(lineTotals)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          <div className="border-t border-slate-100 px-4 py-2">
            <button type="button" onClick={() => setLines((ls) => [...ls, emptyLine()])}
              className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700">
              <Plus size={14} /> Add Billing Item
            </button>
          </div>
        </div>
      )}

      {/* ── Journal lines ─────────────────────────────────────── */}
      {isJournal && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Account</th>
                <th className="w-32 px-4 py-3 text-right">Debit</th>
                <th className="w-32 px-4 py-3 text-right">Credit</th>
                <th className="px-4 py-3">Memo</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {journalLines.map((l) => (
                <tr key={l.key} className="border-b border-slate-50">
                  <td className="px-2 py-2">
                    <select value={l.account} onChange={(e) => setJLine(l.key, { account: e.target.value })}
                      className="w-full rounded border border-slate-200 px-2 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500">
                      <option value="">— select —</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ''}{a.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2"><input type="number" step="0.01" min="0" value={l.debit}
                    onChange={(e) => setJLine(l.key, { debit: e.target.value, credit: '' })}
                    className="w-full rounded border border-slate-200 px-2 min-h-[40px] py-2.5 text-right font-mono text-sm outline-none focus:border-slate-500" /></td>
                  <td className="px-2 py-2"><input type="number" step="0.01" min="0" value={l.credit}
                    onChange={(e) => setJLine(l.key, { credit: e.target.value, debit: '' })}
                    className="w-full rounded border border-slate-200 px-2 min-h-[40px] py-2.5 text-right font-mono text-sm outline-none focus:border-slate-500" /></td>
                  <td className="px-2 py-2"><input type="text" value={l.memo}
                    onChange={(e) => setJLine(l.key, { memo: e.target.value })}
                    className="w-full rounded border border-slate-200 px-2 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500" /></td>
                  <td className="px-2 py-2 text-center">
                    <button type="button" onClick={() => removeJLine(l.key)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-100 px-4 py-2">
            <button type="button" onClick={() => setJournalLines((ls) => [...ls, emptyJLine()])}
              className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700">
              <Plus size={14} /> Add line
            </button>
          </div>
          <div className="flex justify-between border-t border-slate-200 px-4 py-3 text-sm font-medium">
            <span className="text-slate-500">Totals</span>
            <div className="flex gap-8 font-mono">
              <span>Dr {fmt(jTotals.debit)}</span>
              <span>Cr {fmt(jTotals.credit)}</span>
              <span className={Math.abs(jTotals.diff) < 0.001 ? 'text-emerald-600' : 'text-red-600'}>
                {Math.abs(jTotals.diff) < 0.001 ? '✓ balanced' : `diff ${fmt(jTotals.diff)}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Contra fields ─────────────────────────────────────── */}
      {isContra && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="text-sm text-slate-700">
              From account (credited)
              <select value={fromAccount} onChange={(e) => setFromAccount(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500">
                <option value="">— select —</option>
                {cashBankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-700">
              To account (debited)
              <select value={toAccount} onChange={(e) => setToAccount(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500">
                <option value="">— select —</option>
                {cashBankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Amount
              <input type="number" min="0" step="0.01" value={contraAmount}
                onChange={(e) => setContraAmount(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 min-h-[40px] py-2.5 font-mono text-sm outline-none focus:border-slate-500" placeholder="0.00" />
            </label>
          </div>
        </div>
      )}

      {/* ── VAT / Additive Tax Lines ─────────────────────────── */}
      {isTaxable && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-700">Tax Lines</h3>
            <button type="button" onClick={() => setTaxLines((ts) => [...ts, { key: crypto.randomUUID(), taxType: '', nature: 'additive' as TaxNature, rate: '' }])}
              className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700">
              <Plus size={14} /> Add Tax Line
            </button>
          </div>
          {taxLines.filter((tl) => tl.nature === 'additive').length > 0 && (
            <div className="mt-3 space-y-2">
              {taxLines.filter((tl) => tl.nature === 'additive').map((tl) => {
                const txType = taxTypes.find((t) => String(t.id) === tl.taxType)
                const rate = txType ? Number(txType.rate) || parseFloat(tl.rate) || 0 : parseFloat(tl.rate) || 0
                const taxAmt = (lineTotals * rate) / 100
                return (
                  <div key={tl.key} className="grid grid-cols-[1fr_80px_100px_32px] items-center gap-2">
                    <select value={tl.taxType}
                      onChange={(e) => {
                        const selected = taxTypes.find((t) => String(t.id) === e.target.value)
                        setTaxLines((ts) => ts.map((t) => t.key === tl.key ? { ...t, taxType: e.target.value, rate: selected ? String(selected.rate) : t.rate } : t))
                      }}
                      className="w-full rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500">
                      <option value="">Select tax type</option>
                      {taxTypes.filter((t) => t.nature === 'additive' && t.active !== false)
                        .map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code} · {t.rate}%)</option>)}
                    </select>
                    <div className="text-right font-mono text-xs text-slate-500">{rate}%</div>
                    <div className="text-right font-mono text-sm font-medium text-slate-700">{fmt(taxAmt)}</div>
                    <button type="button" onClick={() => setTaxLines((ts) => ts.filter((t) => t.key !== tl.key))}
                      className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                )
              })}
              <div className="flex justify-end border-t border-slate-100 pt-2 text-sm">
                <span className="text-slate-500">Total Tax: </span>
                <span className="ml-2 font-mono font-medium text-slate-700">{fmt(vatTotal)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TDS Toggle ────────────────────────────────────────── */}
      {isTaxable && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <button type="button" onClick={() => setTdsEnabled((e) => !e)}
            className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <div className={`relative h-7 w-12 rounded-full transition-colors ${tdsEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <div className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${tdsEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            TDS is applicable
          </button>
          {tdsEnabled && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="text-sm text-slate-700">
                TDS Account <span className="text-red-500">*</span>
                <select required value={tdsAccountId} onChange={(e) => setTdsAccountId(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500">
                  <option value="">Select Account</option>
                  {accounts.filter((a) => a.type === 'liability' || a.name.toLowerCase().includes('tds') || a.name.toLowerCase().includes('withhold'))
                    .map((a) => <option key={a.id} value={a.id}>{a.code ? `${a.code} · ` : ''}{a.name}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                TDS Type <span className="text-red-500">*</span>
                <select required value={tdsTypeId}
                  onChange={(e) => { setTdsTypeId(e.target.value); setTdsAmountManual('') }}
                  className="mt-1 w-full rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500">
                  <option value="">TDS Type</option>
                  {taxTypes.filter((t) => t.nature === 'withholding' && t.active !== false)
                    .map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code} · {t.rate}%)</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                TDS Amount <span className="text-red-500">*</span>
                <input type="number" min="0" step="0.01" required
                  value={tdsAmountManual || (tdsAutoAmount > 0 ? String(tdsAutoAmount.toFixed(2)) : '')}
                  onChange={(e) => setTdsAmountManual(e.target.value)}
                  placeholder={tdsAutoAmount > 0 ? fmt(tdsAutoAmount) : 'TDS Amount'}
                  className="mt-1 w-full rounded border border-slate-300 px-3 min-h-[40px] py-2.5 font-mono text-sm outline-none focus:border-slate-500" />
                {tdsRate > 0 && <span className="mt-1 block text-xs text-slate-400">Calculated: {tdsRate}% × {fmt(lineTotals)} = {fmt(tdsAutoAmount)}</span>}
              </label>
            </div>
          )}
        </div>
      )}

      {/* ── Cash/Payment fields ───────────────────────────────── */}
      {isCash && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-700">
              Payment Method
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500">
                <option value="bank">Bank</option><option value="cash">Cash</option>
              </select>
            </label>
            {paymentMethod === 'bank' && (
              <label className="text-sm text-slate-700">
                Bank Account
                <select value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500">
                  <option value="">— default —</option>
                  {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            )}
          </div>
        </div>
      )}

      {/* ── Notes / Remarks ───────────────────────────────────── */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <label className="text-sm font-medium text-slate-700">Notes or Remarks</label>
          <textarea rows={4} value={narration} onChange={(e) => setNarration(e.target.value)}
            placeholder="Enter note or description..."
            className="mt-2 w-full resize-none rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500" />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Total Amount</label>
              {vatTotal > 0 && (
                <div className="mt-1 flex justify-between text-xs text-slate-500">
                  <span>Sub Total</span><span className="font-mono">Rs. {fmt(lineTotals)}</span>
                </div>
              )}
              {vatTotal > 0 && (
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Tax</span><span className="font-mono">Rs. {fmt(vatTotal)}</span>
                </div>
              )}
              <div className="mt-1 rounded border border-slate-200 bg-slate-50 px-3 min-h-[40px] py-2.5 font-mono text-lg font-semibold text-slate-800">
                Rs. {fmt(grandTotal)}
              </div>
            </div>
            {isCash && (
              <div>
                <label className="text-sm font-medium text-slate-700">Payment Mode</label>
                <div className="mt-1 rounded border border-slate-200 bg-slate-50 px-3 min-h-[40px] py-2.5 text-sm text-slate-700">
                  {paymentMethod === 'cash' ? 'Cash' : 'Bank Transfer'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Attach Images ─────────────────────────────────────── */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
        <label className="text-sm font-medium text-slate-700">Attach Images</label>
        <div className="mt-2 flex items-center gap-3">
          <button type="button"
            className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-500">
            <Camera size={24} />
          </button>
          <span className="text-xs text-slate-400">Upload receipts, invoices, or supporting documents</span>
        </div>
      </div>

      {/* ── Bottom action bar ─────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-6 py-3 print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button type="button" onClick={() => navigate('/vouchers')}
            className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={() => submit(false)} disabled={saving}
              className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button type="button" onClick={() => submit(true)} disabled={saving}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40">
              Save & Post
            </button>
          </div>
        </div>
      </div>
      {/* ── Add Party Popup ──────────────────────────────── */}
      {showPartyPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900">Add New Party</h2>
            <p className="mt-1 text-sm text-slate-500">Create a new customer or vendor</p>
            <div className="mt-4 space-y-3">
              <label className="text-sm text-slate-700">
                Name *
                <input type="text" required value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  className="mt-1 h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  placeholder="Party name" autoFocus />
              </label>
              <label className="text-sm text-slate-700">
                Type *
                <select value={newPartyType} onChange={(e) => setNewPartyType(e.target.value as 'customer' | 'vendor')}
                  className="mt-1 w-full rounded border border-slate-300 px-3 min-h-[40px] py-2.5 text-sm outline-none focus:border-slate-500">
                  <option value="customer">Customer</option>
                  <option value="vendor">Vendor</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-700">
                  Phone
                  <input type="tel" value={newPartyPhone}
                    onChange={(e) => setNewPartyPhone(e.target.value)}
                    className="mt-1 h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500" />
                </label>
                <label className="text-sm text-slate-700">
                  Email
                  <input type="email" value={newPartyEmail}
                    onChange={(e) => setNewPartyEmail(e.target.value)}
                    className="mt-1 h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500" />
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => { setShowPartyPopup(false); setNewPartyName(''); setNewPartyPhone(''); setNewPartyEmail('') }}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={!newPartyName || newPartySaving}
                onClick={async () => {
                  setNewPartySaving(true)
                  try {
                    const created = await api<{ doc: Party }>('/parties', {
                      method: 'POST',
                      body: { name: newPartyName, type: newPartyType, phone: newPartyPhone || undefined, email: newPartyEmail || undefined, ...(tenantId ? { tenant: tenantId } : {}) },
                    })
                    setParties((ps) => [...ps, created.doc])
                    setParty(String(created.doc.id))
                    setPartySearch(created.doc.name)
                    setShowPartyPopup(false)
                    setNewPartyName(''); setNewPartyPhone(''); setNewPartyEmail('')
                  } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to create party') }
                  setNewPartySaving(false)
                }}
                className="rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50">
                {newPartySaving ? 'Creating…' : 'Create Party'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Add Item Popup ────────────────────────────────── */}
      {showItemPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900">Add New Item</h2>
            <p className="mt-1 text-sm text-slate-500">Create a new inventory item</p>
            <div className="mt-4 space-y-3">
              <label className="text-sm text-slate-700">
                Name *
                <input type="text" required value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="mt-1 h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                  placeholder="Item name" autoFocus />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-700">
                  Code
                  <input type="text" value={newItemCode}
                    onChange={(e) => setNewItemCode(e.target.value)}
                    className="mt-1 h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                    placeholder="SKU / code" />
                </label>
                <label className="text-sm text-slate-700">
                  Unit
                  <input type="text" value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    className="mt-1 h-[42px] w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-slate-500"
                    placeholder="e.g. pcs, kg" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-700">
                  Sale Price
                  <input type="number" min="0" step="0.01" value={newItemSalePrice}
                    onChange={(e) => setNewItemSalePrice(e.target.value)}
                    className="mt-1 h-[42px] w-full rounded border border-slate-300 px-3 font-mono text-sm outline-none focus:border-slate-500"
                    placeholder="0.00" />
                </label>
                <label className="text-sm text-slate-700">
                  Purchase Price
                  <input type="number" min="0" step="0.01" value={newItemPurchasePrice}
                    onChange={(e) => setNewItemPurchasePrice(e.target.value)}
                    className="mt-1 h-[42px] w-full rounded border border-slate-300 px-3 font-mono text-sm outline-none focus:border-slate-500"
                    placeholder="0.00" />
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => { setShowItemPopup(false); setNewItemName(''); setNewItemCode(''); setNewItemUnit(''); setNewItemSalePrice(''); setNewItemPurchasePrice('') }}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={!newItemName || newItemSaving}
                onClick={async () => {
                  setNewItemSaving(true)
                  try {
                    const created = await api<{ doc: Item }>('/items', {
                      method: 'POST',
                      body: {
                        name: newItemName,
                        code: newItemCode || undefined,
                        unit: newItemUnit || undefined,
                        salePrice: newItemSalePrice ? Number(newItemSalePrice) : undefined,
                        purchasePrice: newItemPurchasePrice ? Number(newItemPurchasePrice) : undefined,
                        ...(tenantId ? { tenant: tenantId } : {}),
                      },
                    })
                    setItems((is) => [...is, created.doc])
                    // Auto-select in the line that triggered the popup
                    if (newItemTargetLine) {
                      setLine(newItemTargetLine, {
                        item: String(created.doc.id),
                        description: created.doc.name,
                        rate: String(created.doc.salePrice || ''),
                      })
                    }
                    setShowItemPopup(false)
                    setNewItemName(''); setNewItemCode(''); setNewItemUnit(''); setNewItemSalePrice(''); setNewItemPurchasePrice('')
                  } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to create item') }
                  setNewItemSaving(false)
                }}
                className="rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50">
                {newItemSaving ? 'Creating…' : 'Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
