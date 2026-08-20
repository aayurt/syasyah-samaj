import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  FileText,
  FilePenLine,
  MoreVertical,
  Pencil,
  Plus,
  Printer,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react'
import { api, fmt, getEngine, list, useSyncState } from '../lib/api'
import { useSortSearch } from '../lib/useSortSearch'
import type { OutboxEntry } from '../lib/offline/types'
import {
  DOC_TYPE_LABELS,
  type Account,
  type DocType,
  type Document,
  type DocumentLine,
  type Item,
  type Party,
  type TaxLine,
  type TaxNature,
  type TaxType,
} from '../lib/types'
import { StatusPill } from './Dashboard'
import SearchBox from '../components/SearchBox'
import SortableTh from '../components/SortableTh'
import { TableSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { exportInvoicePdf } from '../lib/pdf'

interface DocTypeMeta {
  value: DocType
  label: string
  direction: 'outbound' | 'inbound' | 'internal'
  needsParty: boolean
  cashMode: boolean
  lineMode: 'item' | 'journal' | 'contra'
  group: 'primary' | 'more'
}

const DOC_TYPES: DocTypeMeta[] = [
  { value: 'journal-voucher', label: 'Journal Entry', direction: 'internal', needsParty: false, cashMode: false, lineMode: 'journal', group: 'primary' },
  { value: 'payment-voucher', label: 'Payment Entry', direction: 'outbound', needsParty: true, cashMode: true, lineMode: 'item', group: 'primary' },
  { value: 'receipt-voucher', label: 'Receipt Entry', direction: 'inbound', needsParty: true, cashMode: true, lineMode: 'item', group: 'primary' },
  { value: 'sales-invoice', label: 'Sales Entry', direction: 'outbound', needsParty: true, cashMode: false, lineMode: 'item', group: 'primary' },
  { value: 'purchase-invoice', label: 'Purchase Entry', direction: 'inbound', needsParty: true, cashMode: false, lineMode: 'item', group: 'primary' },
  { value: 'contra', label: 'Contra Entry', direction: 'internal', needsParty: false, cashMode: false, lineMode: 'contra', group: 'primary' },
  { value: 'credit-note', label: 'Credit Note', direction: 'outbound', needsParty: true, cashMode: false, lineMode: 'item', group: 'more' },
  { value: 'debit-note', label: 'Debit Note', direction: 'outbound', needsParty: true, cashMode: false, lineMode: 'item', group: 'more' },
  { value: 'petty-cash-voucher', label: 'Petty Cash Voucher', direction: 'internal', needsParty: false, cashMode: false, lineMode: 'item', group: 'more' },
  { value: 'grn', label: 'Goods Received Note', direction: 'inbound', needsParty: true, cashMode: false, lineMode: 'item', group: 'more' },
  { value: 'delivery-challan', label: 'Delivery Challan', direction: 'outbound', needsParty: true, cashMode: false, lineMode: 'item', group: 'more' },
]


const DIRECTION_ICON: Record<string, typeof ArrowUpRight> = {
  outbound: ArrowUpRight,
  inbound: ArrowDownLeft,
  internal: FilePenLine,
}

interface LineDraft {
  key: string
  id?: string
  item: string
  description: string
  qty: string
  rate: string
  amount: string
}

const INVENTORY_TYPES = ['sales-invoice', 'delivery-challan', 'grn']

interface JLineDraft {
  key: string
  id?: string
  account: string
  debit: string
  credit: string
  memo: string
}

interface TaxLineDraft {
  key: string
  id?: string
  taxType: string
  nature: TaxNature
  rate: string
}

const emptyTaxLine = (): TaxLineDraft => ({
  key: crypto.randomUUID(),
  taxType: '',
  nature: 'additive',
  rate: '',
})

const emptyItemLine = (): LineDraft => ({
  key: crypto.randomUUID(),
  item: '',
  description: '',
  qty: '',
  rate: '',
  amount: '',
})

const emptyJLine = (): JLineDraft => ({
  key: crypto.randomUUID(),
  account: '',
  debit: '',
  credit: '',
  memo: '',
})

interface FormState {
  docType: DocType | ''
  date: string
  narration: string
  party: string
  taxRate: string
  paymentMethod: string
  bankAccount: string
  fromAccount: string
  toAccount: string
  contraAmount: string
  taxLines: TaxLineDraft[]
  lines: LineDraft[]
  journalLines: JLineDraft[]
}

const emptyForm = (): FormState => ({
  docType: '',
  date: new Date().toISOString().slice(0, 10),
  narration: '',
  party: '',
  taxRate: '0',
  paymentMethod: 'bank',
  bankAccount: '',
  fromAccount: '',
  toAccount: '',
  contraAmount: '',
  taxLines: [],
  lines: [emptyItemLine()],
  journalLines: [emptyJLine(), emptyJLine()],
})

export default function Vouchers() {
  const { cacheVersion } = useSyncState()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const [docs, setDocs] = useState<Document[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [taxTypes, setTaxTypes] = useState<TaxType[]>([])
  const [error, setError] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [nextNumber, setNextNumber] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const { formatDate } = useCalendar()
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [viewDoc, setViewDoc] = useState<Document | null>(null)
  /** Outbox seq of a conflicted create being resumed into this form. */
  const resumedSeqRef = useRef<number | null>(null)
  // TDS toggle state (separate from tax lines for cleaner UX)
  const [tdsEnabled, setTdsEnabled] = useState(false)
  const [tdsAccountId, setTdsAccountId] = useState('')
  const [tdsTypeId, setTdsTypeId] = useState('')
  const [tdsAmountManual, setTdsAmountManual] = useState('')

  const load = async () => {
    try {
      const [d, p, a, it, tx] = await Promise.all([
        list<Document>('documents', { depth: 1, sort: '-date', ...tenantQuery }),
        list<Party>('parties', { depth: 0, sort: 'name', ...tenantQuery }),
        list<Account>('gl-accounts', { depth: 0, sort: 'name', ...tenantQuery }),
        list<Item>('items', { depth: 0, sort: 'name', ...tenantQuery }),
        list<TaxType>('tax-types', { depth: 0, sort: 'name', ...tenantQuery }),
      ])
      setDocs(d.docs)
      setParties(p.docs)
      setAccounts(a.docs)
      setItems(it.docs)
      setTaxTypes(tx.docs.filter((t) => t.active !== false))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load vouchers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [cacheVersion, tenantId])

  // Resume a conflicted queued create into the entry form (dispatched by the
  // sync banner's "Edit" action). The queued entry is kept until the user
  // actually saves, so nothing is lost if they cancel.
  useEffect(() => {
    const onResume = (e: Event) => {
      const seq = (e as CustomEvent<{ seq?: number }>).detail?.seq
      if (seq == null) return
      void (async () => {
        const entry = await getEngine().getEntry(seq)
        if (!entry || !entry.body) return
        const b = entry.body as Record<string, unknown>
        const isJ = b.docType === 'journal-voucher'
        const idOf = (v: unknown): string =>
          v && typeof v === 'object'
            ? String((v as { id: unknown }).id)
            : String(v ?? '')
        resumedSeqRef.current = seq
        setViewDoc(null)
        setMenuFor(null)
        setError('')
        setEditingId(null)
        setShowPicker(false)
        setForm({
          docType: ((b.docType as string) || '') as DocType,
          date:
            (b.date as string | undefined)?.slice(0, 10) ||
            new Date().toISOString().slice(0, 10),
          narration: (b.narration as string) || '',
          party: idOf(b.party),
          taxRate: String(b.taxRate ?? 0),
          paymentMethod: (b.paymentMethod as string) || 'bank',
          bankAccount: idOf(b.bankAccount),
          fromAccount: idOf(b.fromAccount),
          toAccount: idOf(b.toAccount),
          contraAmount:
            b.contraAmount !== undefined
              ? String(b.contraAmount)
              : b.grossTotal !== undefined
                ? String(b.grossTotal)
                : '',
          taxLines: ((b.taxLines as Record<string, unknown>[]) || []).map(
            (tl) => ({
              key: crypto.randomUUID(),
              id: undefined,
              taxType: idOf(tl.taxType),
              nature: (tl.nature as TaxNature) || 'additive',
              rate: tl.rate !== undefined ? String(tl.rate) : '',
            }),
          ),
          lines: isJ
            ? [emptyItemLine()]
            : ((b.lines as Record<string, unknown>[]) || []).map((l) => ({
                key: crypto.randomUUID(),
                id: undefined,
                item: idOf(l.item),
                description: (l.description as string) || '',
                qty: l.qty !== undefined ? String(l.qty) : '',
                rate: l.rate !== undefined ? String(l.rate) : '',
                amount: l.amount !== undefined ? String(l.amount) : '',
              })),
          journalLines: isJ
            ? ((b.journalLines as Record<string, unknown>[]) || []).map(
                (l) => ({
                  key: crypto.randomUUID(),
                  id: undefined,
                  account: idOf(l.account),
                  debit: l.debit !== undefined ? String(l.debit) : '',
                  credit: l.credit !== undefined ? String(l.credit) : '',
                  memo: (l.memo as string) || '',
                }),
              )
            : [emptyJLine(), emptyJLine()],
        })
        // Scroll the form into view.
        requestAnimationFrame(() => {
          document
            .querySelector('#voucher-form')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      })()
    }
    window.addEventListener('afno:resume-queued', onResume)
    return () => window.removeEventListener('afno:resume-queued', onResume)
  }, [])

  // Preview the next voucher number for the selected type + date.
  useEffect(() => {
    if (!form.docType) {
      setNextNumber('')
      return
    }
    api<{ number: string }>('/documents/number/next', {
      query: { type: form.docType, date: form.date, ...tenantQuery },
    })
      .then((r) => setNextNumber(r.number))
      .catch(() => setNextNumber(''))
  }, [form.docType, form.date, tenantId])

  const meta = DOC_TYPES.find((t) => t.value === form.docType)
  const isItem = meta?.lineMode === 'item'
  const isJournal = meta?.lineMode === 'journal'
  const isContra = meta?.lineMode === 'contra'
  const isCash = meta?.cashMode
  const isInventory = form.docType !== '' && INVENTORY_TYPES.includes(form.docType)
  const bankAccounts = accounts.filter((a) => a.class === 'bank')
  const cashBankAccounts = accounts.filter(
    (a) => a.class === 'cash' || a.class === 'bank',
  )
  const isTaxable = [
    'sales-invoice',
    'purchase-invoice',
    'payment-voucher',
    'receipt-voucher',
  ].includes(form.docType)
  const taxOptions = taxTypes.filter((t) =>
    isCash ? t.nature === 'withholding' : true,
  )

  // TDS computed values
  const tdsTaxType = taxTypes.find((t) => String(t.id) === tdsTypeId)
  const tdsRate = tdsTaxType ? Number(tdsTaxType.rate) || 0 : 0
  const tdsAutoAmount = useMemo(() => {
    const gross = totals.gross
    return gross > 0 && tdsRate > 0 ? (gross * tdsRate) / 100 : 0
  }, [totals.gross, tdsRate])
  const tdsAmount = tdsAmountManual ? parseFloat(tdsAmountManual) || 0 : tdsAutoAmount
  const addTaxLine = () =>
    setForm((f) => ({
      ...f,
      taxLines: [...f.taxLines, emptyTaxLine()],
    }))
  const removeTaxLine = (key: string) =>
    setForm((f) => ({
      ...f,
      taxLines: f.taxLines.filter((x) => x.key !== key),
    }))
  const taxLineAmount = (tl: TaxLineDraft): number => {
    const rate = parseFloat(tl.rate) || 0
    if (rate <= 0) return 0
    let lineSum = 0
    for (const l of form.lines) {
      const amt =
        l.amount !== ''
          ? parseFloat(l.amount) || 0
          : (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0)
      lineSum += amt
    }
    if (tl.nature === 'inclusive') {
      return lineSum - lineSum / (1 + rate / 100)
    }
    let inclusive = 0
    for (const x of form.taxLines) {
      if (x.nature === 'inclusive') {
        const r = parseFloat(x.rate) || 0
        if (r > 0) inclusive += lineSum - lineSum / (1 + r / 100)
      }
    }
    return ((lineSum - inclusive) * rate) / 100
  }

  const totals = useMemo(() => {
    if (isContra) {
      const amount = parseFloat(form.contraAmount) || 0
      return { net: amount, tax: 0, gross: amount }
    }
    let net = 0
    for (const l of form.lines) {
      const explicit = l.amount !== ''
      const amt = explicit
        ? parseFloat(l.amount) || 0
        : (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0)
      net += amt
    }
    const lineSum = net
    if (form.taxLines.length > 0) {
      // Mirror the server semantics: inclusive strips from the line sum,
      // additive adds on top, withholding deducts.
      let inclusive = 0
      for (const tl of form.taxLines) {
        if (tl.nature === 'inclusive') {
          const rate = parseFloat(tl.rate) || 0
          if (rate > 0) inclusive += lineSum - lineSum / (1 + rate / 100)
        }
      }
      const base = lineSum - inclusive
      let addInc = inclusive
      let withheld = 0
      for (const tl of form.taxLines) {
        if (tl.nature === 'inclusive') continue
        const rate = parseFloat(tl.rate) || 0
        const amount = (base * rate) / 100
        if (tl.nature === 'withholding') withheld += amount
        else addInc += amount
      }
      return {
        net: base,
        tax: addInc - withheld,
        gross: base + addInc - withheld,
        base,
        addInc,
        withheld,
      }
    }
    const taxRate = parseFloat(form.taxRate) || 0
    const tax = (lineSum * taxRate) / 100
    return { net: lineSum, tax, gross: lineSum + tax, base: lineSum, addInc: tax, withheld: 0 }
  }, [form.lines, form.taxRate, form.contraAmount, isContra, form.taxLines])

  const jTotals = useMemo(() => {
    let debit = 0
    let credit = 0
    for (const l of form.journalLines) {
      debit += parseFloat(l.debit) || 0
      credit += parseFloat(l.credit) || 0
    }
    return { debit, credit, diff: debit - credit }
  }, [form.journalLines])

  const canPost = isContra
    ? totals.gross > 0 && !!form.fromAccount && !!form.toAccount
    : isItem
      ? totals.gross > 0
      : Math.abs(jTotals.diff) < 0.001 && jTotals.debit > 0

  const setLine = (key: string, patch: Partial<LineDraft>) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }))
  }

  const setJLine = (key: string, patch: Partial<JLineDraft>) => {
    setForm((f) => ({
      ...f,
      journalLines: f.journalLines.map((l) =>
        l.key === key ? { ...l, ...patch } : l,
      ),
    }))
  }

  const buildBody = () => {
    const base: Record<string, unknown> = {
      docType: form.docType,
      date: form.date,
      narration: form.narration || undefined,
      party: form.party ? Number(form.party) : undefined,
      status: 'draft',
      ...(tenantId ? { tenant: tenantId } : {}),
    }
    if (isItem) {
      base.lines = form.lines.map((l) => ({
        // Preserve the row id when editing so Payload updates existing lines
        // instead of treating them as new ones.
        ...(l.id ? { id: l.id } : {}),
        item: l.item ? Number(l.item) : undefined,
        description: l.description,
        qty: l.qty !== '' ? Number(l.qty) : undefined,
        rate: l.rate !== '' ? Number(l.rate) : undefined,
        amount: l.amount !== '' ? Number(l.amount) : undefined,
      }))
      base.taxRate = parseFloat(form.taxRate) || 0
    } else if (isContra) {
      base.fromAccount = form.fromAccount ? Number(form.fromAccount) : undefined
      base.toAccount = form.toAccount ? Number(form.toAccount) : undefined
      base.netTotal = totals.net
      base.grossTotal = totals.gross
      base.taxTotal = 0
      base.taxRate = 0
    } else {
      base.journalLines = form.journalLines.map((l) => ({
        ...(l.id ? { id: l.id } : {}),
        account: Number(l.account),
        debit: l.debit ? parseFloat(l.debit) : undefined,
        credit: l.credit ? parseFloat(l.credit) : undefined,
        memo: l.memo || undefined,
      }))
    }
    // Merge manual tax lines + TDS toggle
    const allTaxLines = [...form.taxLines]
    if (tdsEnabled && tdsAmount > 0 && tdsTypeId) {
      allTaxLines.push({
        key: '__tds__',
        taxType: tdsTypeId,
        nature: 'withholding' as TaxNature,
        rate: String(tdsRate),
      })
    }
    if (allTaxLines.length > 0) {
      base.taxLines = allTaxLines.map((tl) => ({
        ...(tl.id ? { id: tl.id } : {}),
        taxType: Number(tl.taxType),
        nature: tl.nature,
        rate: parseFloat(tl.rate) || 0,
      }))
    }
    if (isCash) {
      base.paymentMethod = form.paymentMethod || 'bank'
      if (form.bankAccount) base.bankAccount = Number(form.bankAccount)
    }
    return base
  }

  const submit = async (post: boolean) => {
    setSaving(true)
    setError('')
    try {
      if (editingId !== null) {
        // Editing an existing draft: patch it, then post if requested.
        await api(`/documents/${editingId}`, {
          method: 'PATCH',
          body: buildBody(),
        })
        if (post) {
          await api(`/documents/${editingId}/post`, { method: 'POST' })
        }
      } else {
        const created = await api<{ doc: Document }>('/documents', {
          method: 'POST',
          body: buildBody(),
        })
        if (post) {
          await api(`/documents/${created.doc.id}/post`, { method: 'POST' })
        }
      }
      const date = form.date
      // A resumed conflicted create was saved successfully — drop the queued
      // copy so the outbox doesn't push a duplicate.
      if (resumedSeqRef.current !== null) {
        const seq = resumedSeqRef.current
        resumedSeqRef.current = null
        await getEngine().discard(seq)
      }
      setForm(emptyForm())
      setForm((f) => ({ ...f, date }))
      setEditingId(null)
      setShowPicker(false)
      setTdsEnabled(false)
      setTdsAccountId('')
      setTdsTypeId('')
      setTdsAmountManual('')
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save voucher')
    }
    setSaving(false)
  }

  // Load a draft into the entry form for editing.
  const editDraft = (d: Document) => {
    setViewDoc(null)
    setMenuFor(null)
    setError('')
    setEditingId(d.id)
    const isJ = d.docType === 'journal-voucher'
    const idOf = (v: unknown): string =>
      v && typeof v === 'object' ? String((v as { id: unknown }).id) : String(v ?? '')
    setForm({
      docType: d.docType,
      date: d.date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      narration: d.narration || '',
      party: idOf(d.party),
      taxRate: String(d.taxRate ?? 0),
      paymentMethod: d.paymentMethod || 'bank',
      bankAccount: idOf(d.bankAccount),
      fromAccount: idOf(d.fromAccount),
      toAccount: idOf(d.toAccount),
      contraAmount: d.grossTotal !== undefined ? String(d.grossTotal) : '',
      taxLines: (d.taxLines || []).map((tl) => ({
        key: crypto.randomUUID(),
        id: tl.id,
        taxType: idOf(tl.taxType),
        nature: tl.nature || 'additive',
        rate: tl.rate !== undefined ? String(tl.rate) : '',
      })),
      lines: isJ
        ? [emptyItemLine()]
        : (d.lines || []).map((l) => ({
            key: crypto.randomUUID(),
            id: l.id,
            item: idOf(l.item),
            description: l.description || '',
            qty: l.qty !== undefined ? String(l.qty) : '',
            rate: l.rate !== undefined ? String(l.rate) : '',
            amount: l.amount !== undefined ? String(l.amount) : '',
          })),
      journalLines: isJ
        ? (d.journalLines || []).map((l) => ({
            key: crypto.randomUUID(),
            id: l.id,
            account: idOf(l.account),
            debit: l.debit !== undefined ? String(l.debit) : '',
            credit: l.credit !== undefined ? String(l.credit) : '',
            memo: l.memo || '',
          }))
        : [emptyJLine(), emptyJLine()],
    })
    // Auto-populate TDS toggle from existing withholding tax lines
    const withholdingLine = (d.taxLines || []).find((tl) => tl.nature === 'withholding')
    if (withholdingLine) {
      setTdsEnabled(true)
      setTdsTypeId(idOf(withholdingLine.taxType))
      setTdsAccountId('') // Will be set from the tax type's account mapping
      setTdsAmountManual('') // Auto-calc from rate
    } else {
      setTdsEnabled(false)
      setTdsTypeId('')
      setTdsAccountId('')
      setTdsAmountManual('')
    }
  }

  const voidDoc = async (id: number) => {
    if (!window.confirm('Void this document? This posts a reversal and cannot be undone.')) return
    try {
      await api(`/documents/${id}/void`, { method: 'POST' })
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to void document')
    }
  }

  const deleteDoc = async (id: number) => {
    if (!window.confirm('Delete this draft? It has not been posted and will be removed permanently.')) return
    try {
      await api(`/documents/${id}`, { method: 'DELETE' })
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete document')
    }
  }

  const downloadPdf = async (doc: Document) => {
    try {
      // Payload returns the single document directly (not wrapped in { doc }).
      const full = await api<Document>(`/documents/${doc.id}`, {
        query: { depth: 1 },
      })
      const party =
        full.party && typeof full.party === 'object'
          ? (full.party as Party)
          : parties.find((p) => p.id === full.party)
      exportInvoicePdf(full, party)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to export PDF')
    }
  }

  const filtered = docs.filter(
    (d) =>
      (!typeFilter || d.docType === typeFilter) &&
      (!statusFilter || d.status === statusFilter),
  )

  const partyName = (d: Document) =>
    d.party && typeof d.party === 'object' ? d.party.name : '—'

  const { query, setQuery, sort, toggleSort, visible } = useSortSearch(filtered, {
    searchable: (d) =>
      [
        d.number || '',
        d.narration || '',
        DOC_TYPE_LABELS[d.docType] || '',
        partyName(d),
      ].join(' '),
    valueOf: (d, key) => {
      switch (key) {
        case 'party':
          return partyName(d)
        case 'type':
          return DOC_TYPE_LABELS[d.docType] || d.docType
        case 'amount':
          return Number(d.grossTotal) || 0
        default:
          return (d as unknown as Record<string, unknown>)[key] as
            | string
            | number
            | undefined
      }
    },
    defaultSort: { key: 'date', dir: 'desc' },
  })

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Vouchers</h1>
        <button
          data-tour="new-voucher"
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus size={14} />
          New voucher
        </button>
      </div>

      <div className="mt-2">
        <DataStatus />
      </div>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* New-voucher type picker */}
      {showPicker && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">
              New voucher — pick a type
            </div>
            <button
              onClick={() => setShowPicker(false)}
              className="text-slate-400 hover:text-slate-700"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {DOC_TYPES.filter((t) => t.group === 'primary').map((t) => {
              const Icon = DIRECTION_ICON[t.direction]
              return (
                <button
                  key={t.value}
                  onClick={() => {
                    setForm((f) => ({ ...emptyForm(), date: f.date, docType: t.value }))
                    setShowPicker(false)
                  }}
                  className="flex flex-col items-start gap-1.5 rounded border border-slate-300 bg-slate-50/60 p-3 text-left hover:border-slate-500 hover:bg-slate-50"
                >
                  <Icon size={14} className="text-slate-500" />
                  <span className="text-sm font-medium text-slate-800">
                    {t.label}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              More
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {DOC_TYPES.filter((t) => t.group === 'more').map((t) => {
                const Icon = DIRECTION_ICON[t.direction]
                return (
                  <button
                    key={t.value}
                    onClick={() => {
                      setForm((f) => ({ ...emptyForm(), date: f.date, docType: t.value }))
                      setShowPicker(false)
                    }}
                    className="flex flex-col items-start gap-1.5 rounded border border-slate-200 p-3 text-left hover:border-slate-400 hover:bg-slate-50"
                  >
                    <Icon size={14} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-800">
                      {t.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Entry form */}
      {form.docType && meta && (
        <form
          id="voucher-form"
          onSubmit={(e) => {
            e.preventDefault()
            submit(false)
          }}
          className="mt-4 rounded-lg border border-slate-200 bg-white p-4"
        >
          {editingId !== null && (
            <div className="mb-3 flex items-center justify-between rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span className="flex items-center gap-1.5">
                <Pencil size={13} />
                Editing draft — changes apply to this voucher
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null)
                  setForm(emptyForm())
                  setTdsEnabled(false); setTdsTypeId(''); setTdsAccountId(''); setTdsAmountManual('')
                }}
                className="text-xs font-medium underline"
              >
                Cancel edit
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="text-sm text-slate-700">
              Type
              <select
                value={form.docType}
                onChange={(e) => {
                  setTdsEnabled(false); setTdsTypeId(''); setTdsAccountId(''); setTdsAmountManual('')
                  setForm((f) => ({
                    ...emptyForm(),
                    date: f.date,
                    docType: e.target.value as DocType,
                  }))
                }}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Date
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
            {meta.needsParty && (
              <label className="text-sm text-slate-700">
                Party
                <select
                  required
                  value={form.party}
                  onChange={(e) => setForm({ ...form, party: e.target.value })}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                >
                  <option value="">— select —</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-sm text-slate-700">
              Number (on post)
              <input
                readOnly
                value={nextNumber || 'auto'}
                className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-500 outline-none"
              />
            </label>
            {isContra && (
              <>
                <label className="text-sm text-slate-700">
                  From account (credited)
                  <select
                    required
                    value={form.fromAccount}
                    onChange={(e) =>
                      setForm({ ...form, fromAccount: e.target.value })
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  >
                    <option value="">— select —</option>
                    {cashBankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-700">
                  To account (debited)
                  <select
                    required
                    value={form.toAccount}
                    onChange={(e) =>
                      setForm({ ...form, toAccount: e.target.value })
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  >
                    <option value="">— select —</option>
                    {cashBankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-700">
                  Amount
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={form.contraAmount}
                    onChange={(e) =>
                      setForm({ ...form, contraAmount: e.target.value })
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-500"
                    placeholder="0.00"
                  />
                </label>
              </>
            )}
            {isCash && (
              <>
                <label className="text-sm text-slate-700">
                  Payment method
                  <select
                    value={form.paymentMethod}
                    onChange={(e) =>
                      setForm({ ...form, paymentMethod: e.target.value })
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  >
                    <option value="bank">Bank</option>
                    <option value="cash">Cash</option>
                  </select>
                </label>
                {form.paymentMethod === 'bank' && (
                  <label className="text-sm text-slate-700">
                    Bank account
                    <select
                      value={form.bankAccount}
                      onChange={(e) =>
                        setForm({ ...form, bankAccount: e.target.value })
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    >
                      <option value="">— default —</option>
                      {bankAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
            <label className="col-span-2 text-sm text-slate-700 md:col-span-3">
              Narration
              <input
                value={form.narration}
                onChange={(e) => setForm({ ...form, narration: e.target.value })}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                placeholder="Description of the transaction…"
              />
            </label>
          </div>

          {/* ── TDS Toggle ─────────────────────────────── */}
          {isTaxable && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
              <button
                type="button"
                onClick={() => setTdsEnabled((e) => !e)}
                className="flex items-center gap-3 text-sm font-medium text-slate-700"
              >
                {tdsEnabled ? (
                  <ToggleRight size={28} className="text-emerald-500" />
                ) : (
                  <ToggleLeft size={28} className="text-slate-300" />
                )}
                TDS is applicable
              </button>
              {tdsEnabled && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="text-sm text-slate-700">
                    TDS Account *
                    <select
                      required
                      value={tdsAccountId}
                      onChange={(e) => setTdsAccountId(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    >
                      <option value="">— select account —</option>
                      {accounts
                        .filter((a) =>
                          a.type === 'liability' ||
                          a.name.toLowerCase().includes('tds') ||
                          a.name.toLowerCase().includes('withhold'),
                        )
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code ? `${a.code} · ` : ''}{a.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="text-sm text-slate-700">
                    TDS Type *
                    <select
                      required
                      value={tdsTypeId}
                      onChange={(e) => {
                        setTdsTypeId(e.target.value)
                        setTdsAmountManual('')
                      }}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    >
                      <option value="">— select type —</option>
                      {taxTypes
                        .filter((t) => t.nature === 'withholding' && t.active !== false)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.code} · {t.rate}%)
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="text-sm text-slate-700">
                    TDS Amount *
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={tdsAmountManual || (tdsAutoAmount > 0 ? String(tdsAutoAmount.toFixed(2)) : '')}
                      onChange={(e) => setTdsAmountManual(e.target.value)}
                      placeholder={tdsAutoAmount > 0 ? fmt(tdsAutoAmount) : '0.00'}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-500"
                    />
                    {tdsRate > 0 && (
                      <span className="mt-1 block text-xs text-slate-400">
                        Calculated: {tdsRate}% × {fmt(totals.gross)} = {fmt(tdsAutoAmount)}
                      </span>
                    )}
                  </label>
                </div>
              )}
            </div>
          )}

          {isItem ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-end gap-3">
                {isTaxable ? (
                  <div className="w-full">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Taxes {isCash ? '(TDS withholding)' : '(VAT / GST / TDS)'}
                      </div>
                      <button
                        type="button"
                        onClick={addTaxLine}
                        className="text-xs font-medium text-slate-500 hover:text-slate-800"
                      >
                        + Add tax
                      </button>
                    </div>
                    {form.taxLines.length > 0 && (
                      <table className="mt-2 w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="py-1 pr-2">Tax type</th>
                            <th className="py-1 pr-2">Nature</th>
                            <th className="w-24 py-1 pr-2">Rate %</th>
                            <th className="w-28 py-1 pr-2 text-right">Amount</th>
                            <th className="w-8 py-1"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {form.taxLines.map((tl) => {
                            const tt = taxTypes.find(
                              (t) => String(t.id) === tl.taxType,
                            )
                            return (
                              <tr
                                key={tl.key}
                                className="border-t border-slate-50"
                              >
                                <td className="py-1 pr-2">
                                  <select
                                    value={tl.taxType}
                                    onChange={(e) => {
                                      const t = taxTypes.find(
                                        (x) => String(x.id) === e.target.value,
                                      )
                                      setForm((f) => ({
                                        ...f,
                                        taxLines: f.taxLines.map((x) =>
                                          x.key === tl.key
                                            ? {
                                                ...x,
                                                taxType: e.target.value,
                                                nature:
                                                  t?.nature || x.nature,
                                                rate:
                                                  t?.rate !== undefined
                                                    ? String(t.rate)
                                                    : x.rate,
                                              }
                                            : x,
                                        ),
                                      }))
                                    }}
                                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
                                  >
                                    <option value="">— select —</option>
                                    {taxOptions.map((t) => (
                                      <option
                                        key={t.id}
                                        value={t.id}
                                        disabled={form.taxLines.some(
                                          (x) =>
                                            x.key !== tl.key &&
                                            x.taxType === String(t.id),
                                        )}
                                      >
                                        {t.name} ({t.code} · {t.nature})
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-1 pr-2 text-xs capitalize text-slate-500">
                                  {tt?.nature || tl.nature}
                                </td>
                                <td className="py-1 pr-2">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={tl.rate}
                                    onChange={(e) =>
                                      setForm((f) => ({
                                        ...f,
                                        taxLines: f.taxLines.map((x) =>
                                          x.key === tl.key
                                            ? { ...x, rate: e.target.value }
                                            : x,
                                        ),
                                      }))
                                    }
                                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-right font-mono text-sm outline-none focus:border-slate-500"
                                  />
                                </td>
                                <td className="py-1 pr-2 text-right font-mono text-slate-700">
                                  {tl.taxType
                                    ? fmt(taxLineAmount(tl))
                                    : '—'}
                                </td>
                                <td className="py-1">
                                  <button
                                    type="button"
                                    onClick={() => removeTaxLine(tl.key)}
                                    className="text-slate-400 hover:text-red-600"
                                    aria-label="Remove tax"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                    {form.taxLines.length > 0 && (
                      <div className="mt-1 text-xs text-slate-500">
                        Net <span className="font-mono">{fmt(totals.net)}</span>
                        {' · '}Tax{' '}
                        <span className="font-mono">{fmt(totals.tax)}</span>
                        {' · '}Gross{' '}
                        <span className="font-mono font-medium text-slate-800">
                          {fmt(totals.gross)}
                        </span>
                      </div>
                    )}
                  </div>
                ) : !isCash ? (
                  <label className="text-sm text-slate-700">
                    Tax rate (%)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.taxRate}
                      onChange={(e) =>
                        setForm({ ...form, taxRate: e.target.value })
                      }
                      className="mt-1 w-24 rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                    />
                  </label>
                ) : null}
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      {isInventory && (
                        <th className="w-40 py-2 pr-2">Item</th>
                      )}
                      <th className="py-2 pr-2">Description</th>
                      <th className="w-20 py-2 pr-2">Qty</th>
                      <th className="w-28 py-2 pr-2">Rate</th>
                      <th className="w-28 py-2 pr-2">Amount</th>
                      <th className="w-8 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.lines.map((l) => (
                      <tr key={l.key}>
                        {isInventory && (
                          <td className="py-1.5 pr-2">
                            <select
                              value={l.item}
                              onChange={(e) =>
                                setLine(l.key, { item: e.target.value })
                              }
                              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
                            >
                              <option value="">— none (service) —</option>
                              {items.map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.code ? `${it.code} · ` : ''}
                                  {it.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td className="py-1.5 pr-2">
                          <input
                            required
                            value={l.description}
                            onChange={(e) =>
                              setLine(l.key, { description: e.target.value })
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
                            placeholder="Item / service description"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={l.qty}
                            onChange={(e) =>
                              setLine(l.key, { qty: e.target.value })
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-right font-mono outline-none focus:border-slate-500"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.rate}
                            onChange={(e) =>
                              setLine(l.key, { rate: e.target.value })
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-right font-mono outline-none focus:border-slate-500"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.amount}
                            onChange={(e) =>
                              setLine(l.key, { amount: e.target.value })
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-right font-mono outline-none focus:border-slate-500"
                            placeholder="auto (qty × rate)"
                          />
                        </td>
                        <td className="py-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) =>
                                f.lines.length > 1
                                  ? {
                                      ...f,
                                      lines: f.lines.filter(
                                        (x) => x.key !== l.key,
                                      ),
                                    }
                                  : f,
                              )
                            }
                            className="text-slate-400 hover:text-red-600"
                            aria-label="Remove line"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-100">
                      <td
                        colSpan={isInventory ? 2 : 1}
                        className="py-2 pr-2 text-xs uppercase tracking-wide text-slate-500"
                      >
                        Totals
                      </td>
                      <td className="py-2 pr-2"></td>
                      <td className="py-2 pr-2"></td>
                      <td className="py-2 pr-2 text-right font-mono text-slate-800">
                        {fmt(totals.gross)}
                      </td>
                      <td></td>
                    </tr>
                    {totals.tax > 0 && (
                      <tr className="text-xs text-slate-500">
                        <td
                          colSpan={isInventory ? 3 : 2}
                          className="py-1 pr-2 text-right"
                        >
                          Net {fmt(totals.net)} · Tax {fmt(totals.tax)}
                        </td>
                        <td className="py-1 pr-2 text-right font-mono">
                          {fmt(totals.gross)}
                        </td>
                        <td></td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, lines: [...f.lines, emptyItemLine()] }))
                }
                className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                + Add line
              </button>
            </div>
          ) : isContra ? (
            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Contra transfer
              </div>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <p>
                  Transfer{' '}
                  <span className="font-mono font-medium text-slate-900">
                    {fmt(totals.gross)}
                  </span>{' '}
                  from{' '}
                  <span className="font-medium">
                    {cashBankAccounts.find(
                      (a) => String(a.id) === form.fromAccount,
                    )?.name || '—'}
                  </span>{' '}
                  →{' '}
                  <span className="font-medium">
                    {cashBankAccounts.find(
                      (a) => String(a.id) === form.toAccount,
                    )?.name || '—'}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Debit the target account, credit the source account. No tax,
                  no party, no stock involved.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2">Account</th>
                    <th className="w-28 py-2 pr-2">Debit</th>
                    <th className="w-28 py-2 pr-2">Credit</th>
                    <th className="py-2 pr-2">Memo</th>
                    <th className="w-8 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.journalLines.map((l) => (
                    <tr key={l.key}>
                      <td className="py-1.5 pr-2">
                        <select
                          required
                          value={l.account}
                          onChange={(e) =>
                            setJLine(l.key, { account: e.target.value })
                          }
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
                        >
                          <option value="">— select account —</option>
                          {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code ? `${a.code} · ` : ''}
                                {a.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={l.debit}
                          onChange={(e) =>
                            setJLine(l.key, {
                              debit: e.target.value,
                              credit: l.credit ? '' : l.credit,
                            })
                          }
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-right font-mono outline-none focus:border-slate-500"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={l.credit}
                          onChange={(e) =>
                            setJLine(l.key, {
                              credit: e.target.value,
                              debit: l.debit ? '' : l.debit,
                            })
                          }
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-right font-mono outline-none focus:border-slate-500"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input
                          value={l.memo}
                          onChange={(e) =>
                            setJLine(l.key, { memo: e.target.value })
                          }
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
                        />
                      </td>
                      <td className="py-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) =>
                              f.journalLines.length > 1
                                ? {
                                    ...f,
                                    journalLines: f.journalLines.filter(
                                      (x) => x.key !== l.key,
                                    ),
                                  }
                                : f,
                            )
                          }
                          className="text-slate-400 hover:text-red-600"
                          aria-label="Remove line"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-100">
                    <td className="py-2 pr-2 text-xs uppercase tracking-wide text-slate-500">
                      Totals
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-800">
                      {fmt(jTotals.debit)}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-800">
                      {fmt(jTotals.credit)}
                    </td>
                    <td
                      className={`py-2 pl-4 text-xs font-medium ${
                        Math.abs(jTotals.diff) < 0.001
                          ? 'text-emerald-600'
                          : 'text-red-600'
                      }`}
                    >
                      {Math.abs(jTotals.diff) < 0.001
                        ? '✓ balanced'
                        : `difference ${fmt(jTotals.diff)}`}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    journalLines: [...f.journalLines, emptyJLine()],
                  }))
                }
                className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                + Add line
              </button>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {saving
                ? 'Saving…'
                : editingId !== null
                  ? 'Save changes'
                  : 'Save draft'}
            </button>
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={saving || !canPost}
              className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              title={
                isItem
                  ? 'Create the draft and post it to the ledger'
                  : 'Entry must be balanced to post'
              }
            >
              {saving ? 'Posting…' : 'Save & post'}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(emptyForm())
                setEditingId(null)
              }}
              className="rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      {loading ? (
        <TableSkeleton rows={7} />
      ) : (
        <>
      <div data-tour="voucher-filters" className="mt-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Type
          </span>
          <button
            onClick={() => setTypeFilter('')}
            className={`rounded px-2.5 py-1 text-xs font-medium ${
              typeFilter === ''
                ? 'bg-crimson-600 text-white'
                : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            all
          </button>
          {DOC_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                typeFilter === t.value
                  ? 'bg-crimson-600 text-white'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Status
          </span>
          {['', 'draft', 'posted', 'void'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                statusFilter === s
                  ? 'bg-crimson-600 text-white'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s || 'all'}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-slate-400">
            {visible.length} of {filtered.length}
          </span>
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Search number, party, narration…"
          />
        </div>
      </div>

      {/* List */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <SortableTh label="Date" sortKey="date" sort={sort} onSort={toggleSort} />
              <SortableTh label="Number" sortKey="number" sort={sort} onSort={toggleSort} />
              <SortableTh label="Type" sortKey="type" sort={sort} onSort={toggleSort} />
              <SortableTh label="Party" sortKey="party" sort={sort} onSort={toggleSort} />
              <SortableTh label="Amount" sortKey="amount" sort={sort} onSort={toggleSort} align="right" />
              <SortableTh label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No vouchers yet.
                </td>
              </tr>
            )}
            {visible.map((d) => (
              <tr key={d.id} className="border-b border-slate-50">
                <td className="px-4 py-2 text-slate-600">
                  {formatDate(d.date)}
                </td>
                <td className="px-4 py-2 font-mono text-slate-700">
                  {d.number || (
                    <span className="text-slate-400">— draft —</span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {DOC_TYPE_LABELS[d.docType] || d.docType}
                </td>
                <td className="px-4 py-2 text-slate-700">{partyName(d)}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-800">
                  {fmt(Number(d.grossTotal) || 0)}
                </td>
                <td className="px-4 py-2">
                  <StatusPill status={d.status} />
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="relative inline-block">
                    <button
                      onClick={() => setMenuFor(menuFor === d.id ? null : d.id)}
                      className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      aria-label="Actions"
                      aria-expanded={menuFor === d.id}
                    >
                      <MoreVertical size={14} />
                    </button>
                    {menuFor === d.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setMenuFor(null)}
                        />
                        <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                          <button
                            onClick={() => {
                              setMenuFor(null)
                              setViewDoc(d)
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <Eye size={13} />
                            View
                          </button>
                          {d.status === 'draft' && (
                            <button
                              onClick={() => editDraft(d)}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil size={13} />
                              Edit draft
                            </button>
                          )}
                          {d.status === 'draft' && (
                            <button
                              onClick={() => {
                                setMenuFor(null)
                                deleteDoc(d.id)
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={13} />
                              Delete draft
                            </button>
                          )}
                          {d.status === 'posted' && d.docType === 'sales-invoice' && (
                            <button
                              onClick={() => {
                                setMenuFor(null)
                                downloadPdf(d)
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Printer size={13} />
                              Export PDF
                            </button>
                          )}
                          {d.status === 'posted' && (
                            <button
                              onClick={() => {
                                setMenuFor(null)
                                voidDoc(d.id)
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              Void
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}

      {/* Voucher detail modal */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop is visual only — the modal closes via the Close button,
              the X, or the footer action, never on an outside click. */}
          <div className="fixed inset-0 bg-slate-900/50" />
          <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    {DOC_TYPE_LABELS[viewDoc.docType] || viewDoc.docType}
                  </h2>
                  <StatusPill status={viewDoc.status} />
                </div>
                <div className="mt-0.5 font-mono text-sm text-slate-500">
                  {viewDoc.number || '— draft —'}
                </div>
              </div>
              <button
                onClick={() => setViewDoc(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-4">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Date</dt>
                  <dd className="mt-0.5 text-slate-700">{formatDate(viewDoc.date)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">Party</dt>
                  <dd className="mt-0.5 text-slate-700">{partyName(viewDoc)}</dd>
                </div>
                {viewDoc.narration && (
                  <div className="col-span-2 md:col-span-1">
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Narration</dt>
                    <dd className="mt-0.5 text-slate-700">{viewDoc.narration}</dd>
                  </div>
                )}
                {viewDoc.paymentMethod && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Payment</dt>
                    <dd className="mt-0.5 capitalize text-slate-700">{viewDoc.paymentMethod}</dd>
                  </div>
                )}
                {viewDoc.taxRate ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Tax rate</dt>
                    <dd className="mt-0.5 text-slate-700">{viewDoc.taxRate}%</dd>
                  </div>
                ) : null}
                {viewDoc.referenceTo && (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">Ref</dt>
                    <dd className="mt-0.5 text-slate-700">#{String(viewDoc.referenceTo)}</dd>
                  </div>
                )}
              </dl>

              {viewDoc.lines && viewDoc.lines.length > 0 ? (
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-2 pr-2">Item</th>
                      <th className="py-2 pr-2">Description</th>
                      <th className="w-16 py-2 pr-2 text-right">Qty</th>
                      <th className="w-24 py-2 pr-2 text-right">Rate</th>
                      <th className="w-28 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewDoc.lines.map((l, i) => (
                      <tr key={l.id || i} className="border-b border-slate-50">
                        <td className="py-2 pr-2 text-slate-700">
                          {l.item && typeof l.item === 'object'
                            ? l.item.name
                            : l.item
                              ? `#${String(l.item)}`
                              : '—'}
                        </td>
                        <td className="py-2 pr-2 text-slate-600">{l.description}</td>
                        <td className="py-2 pr-2 text-right font-mono text-slate-700">
                          {l.qty ?? '—'}
                        </td>
                        <td className="py-2 pr-2 text-right font-mono text-slate-700">
                          {l.rate !== undefined ? fmt(l.rate) : '—'}
                        </td>
                        <td className="py-2 text-right font-mono text-slate-800">
                          {fmt(l.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200">
                      <td
                        colSpan={3}
                        className="py-2 pr-2 text-xs uppercase tracking-wide text-slate-500"
                      >
                        Totals
                      </td>
                      <td colSpan={2} className="py-2 text-right">
                        {viewDoc.taxTotal ? (
                          <div className="text-xs text-slate-500">
                            Net {fmt(viewDoc.netTotal)} · Tax {fmt(viewDoc.taxTotal)}
                            <div className="text-sm font-semibold text-slate-800">
                              {fmt(viewDoc.grossTotal)}
                            </div>
                          </div>
                        ) : (
                          <span className="font-semibold text-slate-800">
                            {fmt(viewDoc.grossTotal)}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                viewDoc.journalLines &&
                viewDoc.journalLines.length > 0 && (
                  <table className="mt-4 w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                        <th className="py-2 pr-2">Account</th>
                        <th className="w-28 py-2 pr-2 text-right">Debit</th>
                        <th className="w-28 py-2 pr-2 text-right">Credit</th>
                        <th className="py-2">Memo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewDoc.journalLines.map((l, i) => {
                        const accId =
                          l.account && typeof l.account === 'object'
                            ? (l.account as { id: unknown }).id
                            : l.account
                        const a = accounts.find((x) => x.id === Number(accId))
                        return (
                          <tr key={l.id || i} className="border-b border-slate-50">
                            <td className="py-2 pr-2 text-slate-700">
                              {a
                                ? `${a.code ? a.code + ' · ' : ''}${a.name}`
                                : accId
                                  ? `#${String(accId)}`
                                  : '—'}
                            </td>
                            <td className="py-2 pr-2 text-right font-mono text-slate-800">
                              {l.debit ? fmt(l.debit) : ''}
                            </td>
                            <td className="py-2 pr-2 text-right font-mono text-slate-800">
                              {l.credit ? fmt(l.credit) : ''}
                            </td>
                            <td className="py-2 text-slate-500">{l.memo || ''}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {(() => {
                      const db = (viewDoc.journalLines || []).reduce(
                        (s, l) => s + (l.debit || 0),
                        0,
                      )
                      const cr = (viewDoc.journalLines || []).reduce(
                        (s, l) => s + (l.credit || 0),
                        0,
                      )
                      const balanced = Math.abs(db - cr) < 0.001
                      return (
                        <tfoot>
                          <tr className="border-t border-slate-200">
                            <td className="py-2 pr-2 text-xs uppercase tracking-wide text-slate-500">
                              Totals
                            </td>
                            <td className="py-2 pr-2 text-right font-mono text-slate-800">
                              {fmt(db)}
                            </td>
                            <td className="py-2 pr-2 text-right font-mono text-slate-800">
                              {fmt(cr)}
                            </td>
                            <td
                              className={`py-2 text-xs font-medium ${
                                balanced ? 'text-emerald-600' : 'text-red-600'
                              }`}
                            >
                              {balanced ? '✓ balanced' : `difference ${fmt(db - cr)}`}
                            </td>
                          </tr>
                        </tfoot>
                      )
                    })()}
                  </table>
                )
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-3">
              {viewDoc.status === 'draft' && (
                <>
                  <button
                    onClick={() => {
                      setViewDoc(null)
                      deleteDoc(viewDoc.id)
                    }}
                    className="rounded border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete draft
                  </button>
                  <button
                    onClick={() => editDraft(viewDoc)}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Edit draft
                  </button>
                </>
              )}
              <button
                onClick={() => setViewDoc(null)}
                className="rounded bg-crimson-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-crimson-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
