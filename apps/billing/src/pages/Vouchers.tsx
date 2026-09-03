import NepaliDateInput from '../components/NepaliDateInput'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
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
  RefreshCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react'
import { api, fmt, getEngine, list, useSyncState } from '../lib/api'
import { pushToast } from '../lib/toast'
import { type SortState, useSortSearch } from '../lib/useSortSearch'
import type { OutboxEntry } from '../lib/offline/types'
import {
  DOC_TYPE_LABELS,
  type Account,
  type BillingSettings,
  type DocType,
  effectiveAmount,
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
import PrintVoucher from '../components/PrintVoucher'

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
  const navigate = useNavigate()
  const { cacheVersion } = useSyncState()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const [docs, setDocs] = useState<Document[]>([])
  const [parties, setParties] = useState<Party[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [taxTypes, setTaxTypes] = useState<TaxType[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [nextNumber, setNextNumber] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '')
  const [dateTo, setDateTo] = useState(searchParams.get('to') || '')
  const [loading, setLoading] = useState(false)

  // Sync type/status filters to URL search params
  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    if (typeFilter) params.set('type', typeFilter); else params.delete('type')
    if (statusFilter) params.set('status', statusFilter); else params.delete('status')
    if (dateFrom) params.set('from', dateFrom); else params.delete('from')
    if (dateTo) params.set('to', dateTo); else params.delete('to')
    setSearchParams(params, { replace: true })
  }, [typeFilter, statusFilter, dateFrom, dateTo]) // eslint-disable-line react-hooks/exhaustive-deps
  const { formatDate, formatDateTime } = useCalendar()
  const [printDoc, setPrintDoc] = useState<Document | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [viewDoc, setViewDoc] = useState<Document | null>(null)
  const [voidDialogDoc, setVoidDialogDoc] = useState<Document | null>(null)
  const [voidItems, setVoidItems] = useState<Array<{itemIndex: number; quantity: number; reason: string}>>([])
  const [voidLoading, setVoidLoading] = useState(false)
  const [receiptSortAsc, setReceiptSortAsc] = useState(true)
  /** Outbox seq of a conflicted create being resumed into this form. */
  const resumedSeqRef = useRef<number | null>(null)
  // TDS toggle state (separate from tax lines for cleaner UX)
  const [tdsEnabled, setTdsEnabled] = useState(false)
  const [tdsAccountId, setTdsAccountId] = useState('')
  const [tdsTypeId, setTdsTypeId] = useState('')
  const [tdsAmountManual, setTdsAmountManual] = useState('')
  const [simplifiedInv, setSimplifiedInv] = useState({ enabled: true, threshold: 5000 })
  const [companyProfile, setCompanyProfile] = useState<{
    companyName?: string; companyPan?: string; companyContact?: string
    companyEmail?: string; companyAddress?: string; companyLogo?: string
  }>({})

  // Load billing settings (simplified invoice + company profile)
  useEffect(() => {
    api<BillingSettings>('/globals/billing-settings', { query: { depth: 0 } })
      .then((s) => {
        setSimplifiedInv({
          enabled: s.simplifiedInvoiceEnabled !== false,
          threshold: s.simplifiedInvoiceThreshold || 5000,
        })
        setCompanyProfile({
          companyName: s.companyName,
          companyPan: s.companyPan,
          companyContact: s.companyContact,
          companyEmail: s.companyEmail,
          companyAddress: s.companyAddress,
          companyLogo: s.companyLogo,
        })
      })
      .catch(() => {})
  }, [])

  const load = async () => {
    setLoading(true)
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
    let lineSum = 0
    for (const l of form.lines) {
      lineSum +=
        l.amount !== ''
          ? parseFloat(l.amount) || 0
          : (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0)
    }
    return lineSum > 0 && tdsRate > 0 ? (lineSum * tdsRate) / 100 : 0
  }, [form.lines, tdsRate])
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
      // Pre-supply totals so the server hook can skip recomputation
      // (Payload 3.x REST API doesn't flatten array data before hooks).
      base.netTotal = totals.net
      base.taxTotal = totals.tax
      base.grossTotal = totals.gross
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
      // Pre-supply totals for journal vouchers so the server hook skips
      // recomputation (Payload 3.x REST API doesn't flatten array data before hooks).
      base.netTotal = jTotals.debit
      base.grossTotal = jTotals.debit
      base.taxTotal = 0
      base.taxRate = 0
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
        // Queued to outbox — saves locally first, syncs in background.
        await api(`/documents/${editingId}`, {
          method: 'PATCH',
          body: buildBody(),
          query: tenantQuery,
        })
        if (post) {
          await api(`/documents/${editingId}/post`, { method: 'POST' })
        }
      } else {
        // Saves locally first, syncs in background.
        const created = await api<Document | { doc: Document }>('/documents', {
          method: 'POST',
          body: buildBody(),
          query: tenantQuery,
        })
        // Payload REST API returns doc directly; offline outbox returns { doc: { id } }
        const docId = 'doc' in created ? (created as { doc: Document }).doc.id : (created as Document).id
        if (post) {
          await api(`/documents/${docId}/post`, { method: 'POST' })
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
    // Fetch the document to show in the void dialog
    try {
      const doc = await api<Document>(`/documents/${id}`, { query: { depth: 1 } })
      setVoidDialogDoc(doc)
      // Pre-select all items for full void
      const lines = doc.lines || []
      setVoidItems(lines.map((_: any, idx: number) => ({
        itemIndex: idx,
        quantity: 1,
        reason: '',
      })))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load document')
    }
  }

  const submitPartialVoid = async () => {
    if (!voidDialogDoc || voidItems.length === 0) return
    setVoidLoading(true); setError('')
    try {
      if (voidItems.length === (voidDialogDoc.lines || []).length) {
        // Full void
        const combinedReason = voidItems.map(vi => vi.reason).filter(Boolean).join('; ') || 'Full void'
        await api(`/documents/${voidDialogDoc.id}/void`, { method: 'POST', body: JSON.stringify({ reason: combinedReason }) })
      } else {
        // Partial void
        await api(`/documents/${voidDialogDoc.id}/partial-void`, {
          method: 'POST',
          body: JSON.stringify({ items: voidItems }),
        })
      }
      setVoidDialogDoc(null)
      setVoidItems([])
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to void document')
    }
    setVoidLoading(false)
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

  // Bulk actions
  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (prev.size === visible.length) return new Set()
      return new Set(visible.map((d) => d.id))
    })
  }

  const bulkPost = async () => {
    const drafts = visible.filter((d) => selected.has(d.id) && d.status === 'draft')
    if (drafts.length === 0) return
    if (!window.confirm(`Post ${drafts.length} draft voucher(s)?`)) return
    setBulkLoading(true); setError('')
    try {
      for (const d of drafts) {
        await api(`/documents/${d.id}/post`, { method: 'POST' })
      }
      setSelected(new Set())
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to batch post')
    }
    setBulkLoading(false)
  }

  const bulkVoid = async () => {
    const posted = visible.filter((d) => selected.has(d.id) && d.status === 'posted')
    if (posted.length === 0) return
    if (!window.confirm(`Void ${posted.length} posted voucher(s)? This posts reversals and cannot be undone.`)) return
    setBulkLoading(true); setError('')
    try {
      for (const d of posted) {
        await api(`/documents/${d.id}/void`, { method: 'POST' })
      }
      setSelected(new Set())
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to batch void')
    }
    setBulkLoading(false)
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
      (!statusFilter || d.status === statusFilter) &&
      (!dateFrom || (d.date && d.date >= dateFrom)) &&
      (!dateTo || (d.date && d.date <= dateTo + 'T23:59:59')),
  )

  const partyName = (d: Document) =>
    d.party && typeof d.party === 'object' ? d.party.name : '—'

  /** Calculate payment status for a sales/purchase invoice from loaded docs */
  const getPaymentStatus = (inv: Document): { status: 'paid' | 'partial' | 'unpaid'; paid: number; outstanding: number } => {
    const gross = effectiveAmount(inv)
    const invParty = inv.party && typeof inv.party === 'object' ? (inv.party as { id: number }).id : inv.party
    const invId = inv.id

    // Find linked receipts for this invoice
    const linkedPaid = docs
      .filter((d) => {
        if (d.status !== 'posted') return false
        if (d.docType !== 'receipt-voucher' && d.docType !== 'payment-voucher') return false
        const raw = (d as any).linkedInvoice
        const lid = raw && typeof raw === 'object' ? raw.id : raw
        return Number(lid) === invId
      })
      .reduce((sum, d) => sum + (Number(d.grossTotal) || 0), 0)

    // Find unlinked receipts for same party (pro-rate oldest-first)
    const unlinkedTotal = docs
      .filter((d) => {
        if (d.status !== 'posted') return false
        if (d.docType !== 'receipt-voucher' && d.docType !== 'payment-voucher') return false
        const raw = (d as any).linkedInvoice
        const lid = raw && typeof raw === 'object' ? raw.id : raw
        if (lid) return false
        const dParty = d.party && typeof d.party === 'object' ? (d.party as { id: number }).id : d.party
        return Number(dParty) === Number(invParty)
      })
      .reduce((sum, d) => sum + (Number(d.grossTotal) || 0), 0)

    const totalPaid = linkedPaid + Math.min(unlinkedTotal, gross - linkedPaid)
    const outstanding = Math.max(0, gross - totalPaid)
    const pct = gross > 0 ? (totalPaid / gross) * 100 : 0

    if (outstanding <= 0.01) return { status: 'paid', paid: totalPaid, outstanding: 0 }
    if (totalPaid > 0.01) return { status: 'partial', paid: totalPaid, outstanding }
    return { status: 'unpaid', paid: 0, outstanding }
  }

  // Parse initial sort/search from URL params
  const urlSortKey = searchParams.get('sort') || 'date'
  const urlSortDir = (searchParams.get('dir') as 'asc' | 'desc') || 'desc'
  const urlQuery = searchParams.get('q') || ''

  const syncToUrl = useCallback((q: string, s: SortState) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (q) params.set('q', q); else params.delete('q')
      if (s.key && s.key !== 'date') params.set('sort', s.key); else params.delete('sort')
      if (s.key && s.dir !== 'desc') params.set('dir', s.dir); else params.delete('dir')
      return params
    }, { replace: true })
  }, [setSearchParams])

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
    initialQuery: urlQuery,
    initialSort: { key: urlSortKey, dir: urlSortDir },
    onChange: syncToUrl,
  })

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Vouchers</h1>
        <button
          data-tour="new-voucher"
          onClick={() => navigate(typeFilter ? `/vouchers/new/${typeFilter}` : '/vouchers/new')}
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
            <NepaliDateInput
              label="Date"
              required
              value={form.date}
              onChange={(v) => setForm({ ...form, date: v })}
            />
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
      {loading && docs.length === 0 ? (
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Date
          </span>
          <NepaliDateInput compact value={dateFrom} onChange={setDateFrom} />
          <span className="text-xs text-slate-400">to</span>
          <NepaliDateInput compact value={dateTo} onChange={setDateTo} />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="rounded px-2 py-1 text-xs font-medium text-crimson-600 hover:bg-crimson-50"
            >
              clear dates
            </button>
          )}
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

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
          <span className="text-sm font-medium text-blue-700">
            {selected.size} selected
          </span>
          {visible.some((d) => selected.has(d.id) && d.status === 'draft') && (
            <button
              onClick={bulkPost}
              disabled={bulkLoading}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              {bulkLoading ? 'Posting…' : `Post ${visible.filter((d) => selected.has(d.id) && d.status === 'draft').length} Draft(s)`}
            </button>
          )}
          {visible.some((d) => selected.has(d.id) && d.status === 'posted') && (
            <button
              onClick={bulkVoid}
              disabled={bulkLoading}
              className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              {bulkLoading ? 'Voiding…' : `Void ${visible.filter((d) => selected.has(d.id) && d.status === 'posted').length} Posted`}
            </button>
          )}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-blue-600 hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* List */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  checked={visible.length > 0 && selected.size === visible.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 text-crimson-600 focus:ring-crimson-500"
                />
              </th>
              <SortableTh label="Date" sortKey="date" sort={sort} onSort={toggleSort} />
              <SortableTh label="Updated" sortKey="updatedAt" sort={sort} onSort={toggleSort} />
              <SortableTh label="Number" sortKey="number" sort={sort} onSort={toggleSort} />
              <SortableTh label="Type" sortKey="type" sort={sort} onSort={toggleSort} />
              <SortableTh label="Party" sortKey="party" sort={sort} onSort={toggleSort} />
              <SortableTh label="Amount" sortKey="amount" sort={sort} onSort={toggleSort} align="right" />
              <SortableTh label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-2 text-center">Payment</th>
              <th className="px-4 py-2 text-center">Voided</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-slate-400">
                  No vouchers yet.
                </td>
              </tr>
            )}
            {visible.map((d) => (
              <tr key={d.id} className={`border-b border-slate-50 ${selected.has(d.id) ? 'bg-blue-50' : ''}`}>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(d.id)}
                    onChange={() => toggleSelect(d.id)}
                    className="h-4 w-4 rounded border-slate-300 text-crimson-600 focus:ring-crimson-500"
                  />
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {formatDate(d.date)}
                </td>
                <td className="px-4 py-2 text-xs text-slate-400">
                  {d.updatedAt ? formatDateTime(d.updatedAt) : '—'}
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
                  {fmt(effectiveAmount(d))}
                </td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <StatusPill status={d.status} />
                    {'_pendingSync' in d && (d as { _pendingSync?: boolean })._pendingSync && (
                      <span title="Pending sync to server" className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        <RefreshCw size={10} className="animate-spin" />
                        sync
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  {(d.docType === 'sales-invoice' || d.docType === 'purchase-invoice') && d.status === 'posted' ? (() => {
                    const ps = getPaymentStatus(d)
                    return (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        ps.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        ps.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {ps.status === 'paid' ? 'Paid' : ps.status === 'partial' ? `Partial (${Math.round((ps.paid / (effectiveAmount(d) || 1)) * 100)}%)` : 'Unpaid'}
                      </span>
                    )
                  })() : '—'}
                </td>
                <td className="px-4 py-2 text-center">
                  {d.voidedItems && d.voidedItems.length > 0 ? (
                    <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      {d.voidedItems.length} item{d.voidedItems.length > 1 ? 's' : ''} voided
                    </span>
                  ) : d.status === 'void' ? (
                    <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      Full void
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="relative inline-block">
                    <button
                      onClick={(e) => {
                        if (menuFor === d.id) { setMenuFor(null); return }
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
                        setMenuFor(d.id)
                      }}
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
                        <div className="fixed z-50 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg" style={{ top: menuPos.top, right: menuPos.right }}>
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
                            <>
                              <button
                                onClick={() => {
                                  setMenuFor(null)
                                  voidDoc(d.id)
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                              >
                                Void
                              </button>
                              <button
                                onClick={async () => {
                                  setMenuFor(null)
                                  if (!window.confirm('Reopen this voucher? This will delete the journal entry and clear the voucher number. You can then edit and re-post it.')) return
                                  try {
                                    await api(`/documents/${d.id}/reopen`, { method: 'POST' })
                                    pushToast('success', 'Voucher reopened — edit and re-post when ready')
                                    navigate(`/vouchers/edit/${d.id}`)
                                  } catch (err) {
                                    pushToast('error', 'Reopen failed', err instanceof Error ? err.message : String(err))
                                  }
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-amber-600 hover:bg-amber-50"
                              >
                                Reopen
                              </button>
                            </>
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

      {/* Print modal */}
      {printDoc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
          <PrintVoucher
            doc={printDoc}
            accounts={accounts}
            partyName={partyName(printDoc)}
            orgName={companyProfile.companyName}
            orgAddress={companyProfile.companyAddress}
            orgPan={companyProfile.companyPan}
            orgContact={companyProfile.companyContact}
            orgEmail={companyProfile.companyEmail}
            orgLogo={companyProfile.companyLogo}
          />
        </div>
      )}

      {/* Voucher detail modal */}
      {viewDoc && (() => {
        const additiveTaxLines = (viewDoc.taxLines || []).filter((tl: TaxLine) => tl.nature === 'additive')
        const withholdingTaxLines = (viewDoc.taxLines || []).filter((tl: TaxLine) => tl.nature === 'withholding')
        const totalAdditiveTax = additiveTaxLines.reduce((s: number, tl: TaxLine) => s + (tl.amount || 0), 0)
        const totalWithholding = withholdingTaxLines.reduce((s: number, tl: TaxLine) => s + (tl.amount || 0), 0)
        const subTotal = viewDoc.netTotal || viewDoc.grossTotal || 0
        const discountAmt = viewDoc.discountTotal || 0
        const taxable = subTotal - discountAmt
        const grandTotal = viewDoc.grossTotal || 0

        function numWords(n: number): string {
          if (n === 0) return 'Zero'
          const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
          const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
          const conv = (v: number): string => {
            if (v === 0) return ''
            if (v < 20) return ones[v]
            if (v < 100) return tens[Math.floor(v / 10)] + (v % 10 ? ' ' + ones[v % 10] : '')
            if (v < 1000) return ones[Math.floor(v / 100)] + ' Hundred' + (v % 100 ? ' and ' + conv(v % 100) : '')
            if (v < 100000) return conv(Math.floor(v / 1000)) + ' Thousand' + (v % 1000 ? ' ' + conv(v % 1000) : '')
            if (v < 10000000) return conv(Math.floor(v / 100000)) + ' Lakh' + (v % 100000 ? ' ' + conv(v % 100000) : '')
            return conv(Math.floor(v / 10000000)) + ' Crore' + (v % 10000000 ? ' ' + conv(v % 10000000) : '')
          }
          const whole = Math.floor(Math.abs(n))
          const dec = Math.round((Math.abs(n) - whole) * 100)
          let r = conv(whole) + ' Rupees'
          if (dec > 0) r += ' and ' + conv(dec) + ' Paisa'
          return r + ' Only'
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/50" />
            <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl print:shadow-none print:max-w-full print:max-h-full print:rounded-none">

              {/* ── Header ──────────────────────────────────── */}
              {(() => {
                const isSimplified = simplifiedInv.enabled && grandTotal > 0 && grandTotal < simplifiedInv.threshold
                return (
                  <div className="border-b border-slate-200 bg-slate-50 px-8 py-5 text-center rounded-t-xl print:bg-white print:rounded-none">
                    <h1 className="text-xl font-bold tracking-tight text-slate-900">स्यस्यः धुकू</h1>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {isSimplified ? 'Tax Invoice (VAT Inclusive)' : 'Tax Invoice / Voucher'}
                    </p>
                  </div>
                )
              })()}

              {/* ── Voucher Info Bar ────────────────────────── */}
              <div className="flex items-center justify-between border-b border-slate-200 px-8 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {DOC_TYPE_LABELS[viewDoc.docType] || viewDoc.docType}
                  </h2>
                  <div className="mt-0.5 font-mono text-sm text-slate-500">
                    {viewDoc.number || '— draft —'}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                    viewDoc.status === 'posted' ? 'bg-emerald-100 text-emerald-700' :
                    viewDoc.status === 'void' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {viewDoc.status}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{formatDate(viewDoc.date)}</div>
                </div>
              </div>

              {/* ── Party Info ──────────────────────────────── */}
              <div className="border-b border-slate-200 px-8 py-4">
                <div className="grid grid-cols-2 gap-6 text-sm">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Bill To</span>
                    <p className="mt-1 font-semibold text-slate-900">{partyName(viewDoc) || '—'}</p>
                  </div>
                  {viewDoc.paymentMethod && (
                    <div className="text-right">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Payment</span>
                      <p className="mt-1 capitalize text-slate-700">{viewDoc.paymentMethod}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Items Table ─────────────────────────────── */}
              {viewDoc.lines && viewDoc.lines.length > 0 ? (
                <div className="px-8 py-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="w-8 py-2.5">#</th>
                        <th className="py-2.5">Item / Description</th>
                        <th className="w-16 py-2.5 text-right">Qty</th>
                        <th className="w-24 py-2.5 text-right">Rate</th>
                        <th className="w-28 py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewDoc.lines.map((l, i) => (
                        <tr key={l.id || i} className="border-b border-slate-100">
                          <td className="py-2.5 text-center text-slate-400">{i + 1}</td>
                          <td className="py-2.5">
                            <span className="font-medium text-slate-800">
                              {l.item && typeof l.item === 'object' ? l.item.name : l.description || '—'}
                            </span>
                          </td>
                          <td className="py-2.5 text-right font-mono text-slate-700">{l.qty ?? '—'}</td>
                          <td className="py-2.5 text-right font-mono text-slate-700">{l.rate !== undefined ? fmt(l.rate) : '—'}</td>
                          <td className="py-2.5 text-right font-mono font-medium text-slate-800">{fmt(l.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* ── Summary ──────────────────────────── */}
                  <div className="mt-4 px-0 py-0">
                    {simplifiedInv.enabled && grandTotal > 0 && grandTotal < simplifiedInv.threshold ? (
                      /* ── Simplified: VAT Inclusive ────────── */
                      <div className="text-center">
                        <div className="text-sm text-slate-500">Total Amount (VAT Inclusive)</div>
                        <div className="mt-1 font-mono text-2xl font-bold text-slate-900">Rs. {fmt(grandTotal)}</div>
                        <p className="mt-2 text-sm font-medium text-slate-600">
                          In words: {numWords(grandTotal)}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">Includes all applicable taxes</p>
                      </div>
                    ) : (
                      /* ── Full breakdown ──────────────────── */
                      <div className="ml-auto w-72 space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Sub Total</span>
                          <span className="font-mono text-slate-700">{fmt(subTotal)}</span>
                        </div>
                        {discountAmt > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Discount</span>
                            <span className="font-mono text-red-600">−{fmt(discountAmt)}</span>
                          </div>
                        )}
                        {discountAmt > 0 && (
                          <div className="flex justify-between border-t border-slate-200 pt-1.5">
                            <span className="text-slate-500">Taxable Amount</span>
                            <span className="font-mono text-slate-700">{fmt(taxable)}</span>
                          </div>
                        )}
                        {totalAdditiveTax > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Tax</span>
                            <span className="font-mono text-slate-700">+{fmt(totalAdditiveTax)}</span>
                          </div>
                        )}
                        {totalWithholding > 0 && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">TDS</span>
                            <span className="font-mono text-red-600">−{fmt(totalWithholding)}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t-2 border-slate-300 pt-2 text-base">
                          <span className="font-bold text-slate-900">Total</span>
                          <span className="font-mono font-bold text-slate-900">Rs. {fmt(grandTotal)}</span>
                        </div>
                        <p className="pt-1 text-sm font-medium text-slate-600">
                          In words: {numWords(grandTotal)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : viewDoc.journalLines && viewDoc.journalLines.length > 0 ? (
                <div className="px-8 py-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2.5">Account</th>
                        <th className="w-28 py-2.5 text-right">Debit</th>
                        <th className="w-28 py-2.5 text-right">Credit</th>
                        <th className="py-2.5">Memo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewDoc.journalLines.map((l, i) => {
                        const accId = l.account && typeof l.account === 'object' ? (l.account as { id: unknown }).id : l.account
                        const a = accounts.find((x) => x.id === Number(accId))
                        return (
                          <tr key={l.id || i} className="border-b border-slate-100">
                            <td className="py-2.5 text-slate-700">{a ? `${a.code ? a.code + ' · ' : ''}${a.name}` : accId ? `#${String(accId)}` : '—'}</td>
                            <td className="py-2.5 text-right font-mono text-slate-800">{l.debit ? fmt(l.debit) : ''}</td>
                            <td className="py-2.5 text-right font-mono text-slate-800">{l.credit ? fmt(l.credit) : ''}</td>
                            <td className="py-2.5 text-slate-500">{l.memo || ''}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {(() => {
                      const db = (viewDoc.journalLines || []).reduce((s: number, l: { debit?: number }) => s + (l.debit || 0), 0)
                      const cr = (viewDoc.journalLines || []).reduce((s: number, l: { credit?: number }) => s + (l.credit || 0), 0)
                      const balanced = Math.abs(db - cr) < 0.001
                      return (
                        <tfoot>
                          <tr className="border-t-2 border-slate-300">
                            <td className="py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500">Totals</td>
                            <td className="py-2.5 text-right font-mono font-medium text-slate-800">{fmt(db)}</td>
                            <td className="py-2.5 text-right font-mono font-medium text-slate-800">{fmt(cr)}</td>
                            <td className={`py-2.5 text-xs font-medium ${balanced ? 'text-emerald-600' : 'text-red-600'}`}>
                              {balanced ? '✓ balanced' : `diff ${fmt(db - cr)}`}
                            </td>
                          </tr>
                        </tfoot>
                      )
                    })()}
                  </table>
                </div>
              ) : null}

              {/* ── Narration ──────────────────────────────── */}
              {viewDoc.narration && (
                <div className="border-t border-slate-200 px-8 py-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Remarks</span>
                  <p className="mt-0.5 text-sm text-slate-600">{viewDoc.narration}</p>
                </div>
              )}

              {/* ── Linked Receipts (sales/purchase invoices only) ── */}
              {viewDoc.status === 'posted' && (viewDoc.docType === 'sales-invoice' || viewDoc.docType === 'purchase-invoice') && (() => {
                const invId = viewDoc.id
                const invParty = viewDoc.party && typeof viewDoc.party === 'object' ? (viewDoc.party as { id: number }).id : viewDoc.party
                const receipts = docs.filter((d) => {
                  if (d.status !== 'posted') return false
                  if (d.docType !== 'receipt-voucher' && d.docType !== 'payment-voucher') return false
                  const raw = (d as any).linkedInvoice
                  const lid = raw && typeof raw === 'object' ? raw.id : raw
                  return Number(lid) === invId
                })
                const unlinkedReceipts = docs.filter((d) => {
                  if (d.status !== 'posted') return false
                  if (d.docType !== 'receipt-voucher' && d.docType !== 'payment-voucher') return false
                  const raw = (d as any).linkedInvoice
                  const lid = raw && typeof raw === 'object' ? raw.id : raw
                  if (lid) return false
                  const dParty = d.party && typeof d.party === 'object' ? (d.party as { id: number }).id : d.party
                  return Number(dParty) === Number(invParty)
                })
                const allReceipts = [...receipts, ...unlinkedReceipts].sort((a, b) => {
                  const cmp = (a.date || '').localeCompare(b.date || '')
                  return receiptSortAsc ? cmp : -cmp
                })
                const totalPaid = allReceipts.reduce((s, d) => s + (Number(d.grossTotal) || 0), 0)
                const ps = getPaymentStatus(viewDoc)

                return (
                  <>
                  <div className="border-t border-slate-200 px-8 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-700">
                        Receipts & Payments ({allReceipts.length})
                      </h3>
                      <button
                        onClick={() => {
                          const type = viewDoc.docType === 'sales-invoice' ? 'receipt-voucher' : 'payment-voucher'
                          const params = new URLSearchParams()
                          if (invParty) params.set('party', String(invParty))
                          params.set('linkedInvoice', String(invId))
                          setViewDoc(null)
                          navigate(`/vouchers/new/${type}?${params.toString()}`)
                        }}
                        className="flex items-center gap-1 rounded bg-crimson-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-crimson-700"
                      >
                        <span>+ Create Receipt</span>
                      </button>
                    </div>

                    {allReceipts.length === 0 ? (
                      <p className="text-sm text-slate-400">No receipts recorded yet.</p>
                    ) : (
                      <>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                              <th className="py-2 cursor-pointer select-none hover:text-slate-700" onClick={() => setReceiptSortAsc(!receiptSortAsc)}>
                                Date {receiptSortAsc ? '↑' : '↓'}
                              </th>
                              <th className="py-2">Number</th>
                              <th className="py-2 text-right">Amount</th>
                              <th className="py-2 text-center">Type</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allReceipts.map((r) => {
                              const raw = (r as any).linkedInvoice
                              const lid = raw && typeof raw === 'object' ? raw.id : raw
                              const isLinked = Number(lid) === invId
                              return (
                                <tr key={r.id} className="border-b border-slate-50">
                                  <td className="py-2 text-slate-600">{formatDate(r.date)}</td>
                                  <td className="py-2 font-mono text-slate-700">{r.number || `#${r.id}`}</td>
                                  <td className="py-2 text-right font-mono font-medium text-slate-800">Rs. {fmt(Number(r.grossTotal) || 0)}</td>
                                  <td className="py-2 text-center">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                      isLinked ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      {isLinked ? 'Linked' : 'General'}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-slate-300 font-medium">
                              <td colSpan={2} className="py-2 text-xs uppercase text-slate-500">Total Paid</td>
                              <td className="py-2 text-right font-mono text-slate-800">Rs. {fmt(totalPaid)}</td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <span className={`rounded-full px-2 py-0.5 font-bold ${
                            ps.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                            ps.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {ps.status === 'paid' ? 'Fully Paid' : ps.status === 'partial' ? `Partial (${Math.round((ps.paid / (effectiveAmount(viewDoc) || 1)) * 100)}%)` : 'Unpaid'}
                          </span>
                          <span className="text-slate-500">
                            Outstanding: Rs. {fmt(ps.outstanding)} of Rs. {fmt(effectiveAmount(viewDoc))}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  </>
                  )
              })()}

              {/* ── Voided Items Section ──────────────────── */}
                  {viewDoc.voidedItems && viewDoc.voidedItems.length > 0 && (
                    <div className="border-t border-slate-200 px-8 py-4 bg-red-50/50">
                      <h3 className="text-sm font-semibold text-red-700 mb-3">
                        Voided Items ({viewDoc.voidedItems.length})
                      </h3>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-red-200 text-left text-xs uppercase tracking-wide text-red-600">
                            <th className="py-2">#</th>
                            <th className="py-2">Item</th>
                            <th className="py-2 text-right">Qty Voided</th>
                            <th className="py-2 text-right">Amount</th>
                            <th className="py-2">Reason</th>
                            <th className="py-2">Credit/Debit Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewDoc.voidedItems.map((vi: any, idx: number) => {
                            const line = viewDoc.lines?.[vi.itemIndex]
                            const amt = (Number(line?.rate) || 0) * vi.quantity
                            return (
                              <tr key={idx} className="border-b border-red-100">
                                <td className="py-2 text-red-600">{vi.itemIndex + 1}</td>
                                <td className="py-2 text-red-700 line-through">{line?.description || 'Item'}</td>
                                <td className="py-2 text-right text-red-600">{vi.quantity} / {line?.qty || 1}</td>
                                <td className="py-2 text-right font-mono text-red-700">Rs. {fmt(amt)}</td>
                                <td className="py-2 text-red-600 text-xs">{vi.reason || '—'}</td>
                                <td className="py-2">
                                  {vi.noteNumber ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                      {vi.noteNumber}
                                    </span>
                                  ) : vi.creditNoteId ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                                      CN/DN #{vi.creditNoteId}
                                    </span>
                                  ) : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-red-300 font-medium">
                            <td colSpan={3} className="py-2 text-xs uppercase text-red-600">Total Voided</td>
                            <td className="py-2 text-right font-mono text-red-700">Rs. {fmt(viewDoc.voidedAmount || 0)}</td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                            {/* ── Action Bar ─────────────────────────────── */}
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-8 py-4 rounded-b-xl print:hidden">
                <div>
                  {viewDoc.status === 'draft' && (
                    <div className="flex gap-2">
                      <button onClick={() => { setViewDoc(null); deleteDoc(viewDoc.id) }}
                        className="rounded border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
                        Delete
                      </button>
                      <button onClick={() => editDraft(viewDoc)}
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        Edit Draft
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {viewDoc.status === 'posted' && (
                    <>
                      <button onClick={() => setPrintDoc(viewDoc)}
                        className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <Printer size={14} /> Print
                      </button>
                      <button
                        onClick={async () => {
                          if (!window.confirm('Reopen this voucher? This will delete the journal entry and clear the voucher number. You can then edit and re-post it.')) return
                          try {
                            await api(`/documents/${viewDoc.id}/reopen`, { method: 'POST' })
                            pushToast('success', 'Voucher reopened — edit and re-post when ready')
                            setViewDoc(null)
                            navigate(`/vouchers/edit/${viewDoc.id}`)
                          } catch (err) {
                            pushToast('error', 'Reopen failed', err instanceof Error ? err.message : String(err))
                          }
                        }}
                        className="flex items-center gap-1.5 rounded border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50"
                      >
                        Reopen
                      </button>
                    </>
                  )}
                  {viewDoc.docType === 'sales-quote' && (
                    <button
                      onClick={async () => {
                        try {
                          const res = await api<{ invoiceId: number; grossTotal: number }>(
                            `/documents/${viewDoc.id}/copy-to-invoice`,
                            { method: 'POST', immediate: true }, // server-side copy; needs the created id back
                          )
                          pushToast('success', 'Invoice created from quote', `Draft sales invoice #${res.invoiceId} — review and post it.`)
                          setViewDoc(null)
                          navigate(`/vouchers/edit/${res.invoiceId}`)
                        } catch (err) {
                          pushToast('error', 'Copy failed', err instanceof Error ? err.message : String(err))
                        }
                      }}
                      className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      <FileText size={14} /> Copy to Invoice
                    </button>
                  )}
                  <button onClick={() => setViewDoc(null)}
                    className="rounded bg-crimson-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-crimson-700">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Void Items Dialog ──────────────────────────── */}
      {voidDialogDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 print:hidden">
          <div className="mx-4 w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Void Items</h2>
                <p className="text-sm text-slate-500">
                  {voidDialogDoc.number || 'Draft'} — {voidDialogDoc.docType}
                </p>
              </div>
              <button onClick={() => { setVoidDialogDoc(null); setVoidItems([]) }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              <p className="mb-3 text-sm text-slate-600">
                Select items to void. A credit/debit note will be created for the voided amounts.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                    <th className="w-10 py-2"></th>
                    <th className="py-2">Item</th>
                    <th className="w-20 py-2 text-right">Qty</th>
                    <th className="w-24 py-2 text-right">Amount</th>
                    <th className="w-24 py-2 text-right">Void Qty</th>
                    <th className="w-40 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {(voidDialogDoc.lines || []).map((line: any, idx: number) => {
                    const isSelected = voidItems.some(vi => vi.itemIndex === idx)
                    const voidItem = voidItems.find(vi => vi.itemIndex === idx)
                    return (
                      <tr key={idx} className={"border-b border-slate-100 " + (isSelected ? 'bg-amber-50' : '')}>
                        <td className="py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setVoidItems(prev => prev.filter(vi => vi.itemIndex !== idx))
                              } else {
                                setVoidItems(prev => [...prev, {
                                  itemIndex: idx,
                                  quantity: Number(line.qty) || 1,
                                  reason: '',
                                }])
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </td>
                        <td className="py-2 text-slate-700">{line.description || 'Item ' + (idx + 1)}</td>
                        <td className="py-2 text-right text-slate-600">{line.qty || 1}</td>
                        <td className="py-2 text-right text-slate-700">Rs. {fmt(Number(line.amount) || 0)}</td>
                        <td className="py-2 text-right">
                          {isSelected && (
                            <input
                              type="number"
                              min={1}
                              max={Number(line.qty) || 1}
                              value={voidItem?.quantity || 1}
                              onChange={(e) => {
                                const qty = Math.min(Number(e.target.value) || 1, Number(line.qty) || 1)
                                setVoidItems(prev => prev.map(vi =>
                                  vi.itemIndex === idx ? { ...vi, quantity: qty } : vi
                                ))
                              }}
                              className="w-16 rounded border border-slate-300 px-2 py-1 text-right text-sm"
                            />
                          )}
                        </td>
                        <td className="py-2">
                          {isSelected && (
                            <input
                              type="text"
                              value={voidItem?.reason || ''}
                              onChange={(e) => {
                                setVoidItems(prev => prev.map(vi =>
                                  vi.itemIndex === idx ? { ...vi, reason: e.target.value } : vi
                                ))
                              }}
                              placeholder="Reason for void"
                              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {voidItems.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-amber-800">Total Void Amount:</span>
                    <span className="font-semibold text-amber-900">
                      Rs. {fmt(voidItems.reduce((sum, vi) => {
                        const line = voidDialogDoc.lines?.[vi.itemIndex]
                        return sum + (Number(line?.rate) || 0) * vi.quantity
                      }, 0))}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-amber-700">
                    A {voidItems.length === (voidDialogDoc.lines || []).length ? 'full void' : 'credit/debit note'} will be created for this amount.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button onClick={() => { setVoidDialogDoc(null); setVoidItems([]) }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={submitPartialVoid}
                disabled={voidItems.length === 0 || voidLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {voidLoading ? 'Voiding...' : voidItems.length === (voidDialogDoc.lines || []).length ? 'Full Void' : 'Create Credit/Debit Note & Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
