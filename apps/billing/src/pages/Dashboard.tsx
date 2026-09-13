import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpenText,
  Clock3,
  CreditCard,
  Download,
  FilePlus,
  FileText,
  IndianRupee,
  Receipt,
  TrendingDown,
  TrendingUp,
  Upload,
  UserPlus,
  Wallet,
} from 'lucide-react'
import { api, fmt, useSyncState } from '../lib/api'
import { useT } from '../lib/i18n'
import DataStatus from '../components/DataStatus'
import SetupChecklist from '../components/SetupChecklist'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { useFiscalYear } from '../lib/fiscalYear'
import { useCachedList } from '../lib/useCachedList'
import { parseImportFile, type ParsedImport } from '../lib/importExport'
import ImportPreviewModal from '../components/ImportPreviewModal'
import ExportModal from '../components/ExportModal'
import { pushToast } from '../lib/toast'
import type {
  Account,
  AgingResponse,
  Document,
  JournalEntry,
  PnlResponse,
} from '../lib/types'

interface TrialBalanceSummary {
  totals: { debit: number; credit: number }
  balanced: boolean
}

interface MonthData {
  label: string
  income: number
  expense: number
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short' })
}
function last12Months(): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({ key: monthKey(d), label: monthLabel(d) })
  }
  return result
}

/* ── Mini bar chart (pure CSS) ─────────────────────────────────── */

function MiniBarChart({
  months,
  data,
}: {
  months: { key: string; label: string }[]
  data: Map<string, MonthData>
}) {
  const maxVal = useMemo(() => {
    let m = 1
    for (const m2 of months) {
      const d = data.get(m2.key)
      if (d) {
        m = Math.max(m, d.income, d.expense)
      }
    }
    return m
  }, [months, data])

  return (
    <div className="flex items-end gap-1" style={{ height: 120 }}>
      {months.map((m) => {
        const d = data.get(m.key) || { income: 0, expense: 0 }
        const incH = maxVal > 0 ? (d.income / maxVal) * 100 : 0
        const expH = maxVal > 0 ? (d.expense / maxVal) * 100 : 0
        return (
          <div
            key={m.key}
            className="group flex flex-1 flex-col items-center gap-0.5"
          >
            <div className="pointer-events-none absolute -mt-8 hidden rounded bg-slate-800 px-2 py-1 text-[10px] text-white group-hover:block">
              +{fmt(d.income)} / −{fmt(d.expense)}
            </div>
            <div className="flex w-full items-end justify-center gap-px">
              <div
                className="w-2 rounded-t bg-emerald-500 transition-all"
                style={{ height: `${incH}%`, minHeight: incH > 0 ? 2 : 0 }}
              />
              <div
                className="w-2 rounded-t bg-red-500 transition-all"
                style={{ height: `${expH}%`, minHeight: expH > 0 ? 2 : 0 }}
              />
            </div>
            <div className="text-[9px] text-slate-400">{m.label.slice(0, 1)}</div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Status pill ────────────────────────────────────────────────── */

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800 border-amber-200',
    posted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    void: 'bg-red-100 text-red-800 border-red-200',
  }
  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

/* ── Main Dashboard Component ───────────────────────────────────── */

export default function Dashboard() {
  const t = useT()
  const navigate = useNavigate()
  const { cacheVersion, online } = useSyncState()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()
  const { selectedYear } = useFiscalYear()

  // Modals for Import & Export
  const [showExportModal, setShowExportModal] = useState(false)
  const [importData, setImportData] = useState<ParsedImport<Record<string, unknown>> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Cache-first lists
  const { docs: accounts } = useCachedList<Account>('gl-accounts', tenantQuery)
  const { docs: allEntries } = useCachedList<JournalEntry>('journal-entries', {
    sort: '-date',
    ...tenantQuery,
  })
  const { docs: allDocuments } = useCachedList<Document>('documents', {
    sort: '-date',
    ...tenantQuery,
  })

  // Additional Async States
  const [trialBalance, setTrialBalance] = useState<TrialBalanceSummary | null>(null)
  const [trend, setTrend] = useState<Map<string, MonthData>>(new Map())
  const [trendLoading, setTrendLoading] = useState(false)
  const [arData, setArData] = useState<AgingResponse | null>(null)
  const [apData, setApData] = useState<AgingResponse | null>(null)
  const [tableFilter, setTableFilter] = useState<'all' | 'posted' | 'draft'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const months = useMemo(() => last12Months(), [])

  // Keyboard shortcuts F1 (Receipt), F2 (Payment), F3 (Journal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault()
        navigate('/vouchers/new/receipt')
      } else if (e.key === 'F2') {
        e.preventDefault()
        navigate('/vouchers/new/payment')
      } else if (e.key === 'F3') {
        e.preventDefault()
        navigate('/vouchers/new/journal')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  // Load Trial balance, Aging and P&L trend in background
  useEffect(() => {
    let alive = true

    api<TrialBalanceSummary>('/journal-entries/trial-balance', { query: { ...tenantQuery } })
      .then((tb) => { if (alive) setTrialBalance(tb) })
      .catch(() => {})

    api<AgingResponse>('/documents/aging', { query: { side: 'ar', ...tenantQuery } })
      .then((ar) => { if (alive) setArData(ar) })
      .catch(() => {})

    api<AgingResponse>('/documents/aging', { query: { side: 'ap', ...tenantQuery } })
      .then((ap) => { if (alive) setApData(ap) })
      .catch(() => {})

    // Trend: P&L
    setTrendLoading(true)
    const trendMap = new Map<string, MonthData>()
    const now = new Date()
    const promises: Promise<void>[] = []

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      const to = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
      const key = monthKey(d)
      const p = api<PnlResponse>('/journal-entries/profit-loss', {
        query: { from, to, ...tenantQuery },
      })
        .then((pnl) => {
          trendMap.set(key, {
            label: monthLabel(d),
            income: pnl.totals.income,
            expense: pnl.totals.expense,
          })
        })
        .catch(() => {
          trendMap.set(key, { label: monthLabel(d), income: 0, expense: 0 })
        })
      promises.push(p)
    }

    Promise.all(promises).then(() => {
      if (alive) {
        setTrend(new Map(trendMap))
        setTrendLoading(false)
      }
    })

    return () => { alive = false }
  }, [tenantId, cacheVersion, online])

  // Filter journal entries by Fiscal Year
  const fyFrom = selectedYear?.startDate ? String(selectedYear.startDate).slice(0, 10) : ''
  const fyTo = selectedYear?.endDate ? String(selectedYear.endDate).slice(0, 10) : ''
  const inYear = useCallback(
    (e: JournalEntry) =>
      (!fyFrom || (e.date && e.date >= fyFrom)) &&
      (!fyTo || (e.date && e.date <= fyTo + 'T23:59:59')),
    [fyFrom, fyTo],
  )

  const recentEntries = useMemo(() => {
    return allEntries.filter(inYear)
  }, [allEntries, inYear])

  const filteredEntries = useMemo(() => {
    return recentEntries.filter((entry) => {
      if (tableFilter !== 'all' && entry.status !== tableFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const narrationMatch = entry.narration?.toLowerCase().includes(q)
        const numMatch = String(entry.docNumber || entry.id || '').toLowerCase().includes(q)
        return narrationMatch || numMatch
      }
      return true
    })
  }, [recentEntries, tableFilter, searchQuery])

  // Pending Drafts
  const pendingDrafts = useMemo(() => {
    return allDocuments.filter((d) => d.status === 'draft').slice(0, 5)
  }, [allDocuments])

  // Cash and Bank accounts
  const cashAccounts = useMemo(() => {
    return accounts.filter((a: any) => a.class === 'cash' && a.type === 'asset')
  }, [accounts])

  const bankAccounts = useMemo(() => {
    return accounts.filter((a: any) => a.class === 'bank' && a.type === 'asset')
  }, [accounts])

  // Approximate liquidity from entries if trial balance isn't populated
  const totalCash = cashAccounts.reduce((acc, a: any) => acc + (Number(a.openingBalance) || 0), 0)
  const totalBank = bankAccounts.reduce((acc, a: any) => acc + (Number(a.openingBalance) || 0), 0)
  const arTotal = arData?.totals?.total || 0
  const apTotal = apData?.totals?.total || 0

  const entryTotals = (entry: JournalEntry) =>
    (Array.isArray(entry.lines) ? entry.lines : []).reduce(
      (acc, l) => ({
        debit: acc.debit + (Number(l.debit) || 0),
        credit: acc.credit + (Number(l.credit) || 0),
      }),
      { debit: 0, credit: 0 },
    )

  // Handle file import trigger
  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = await parseImportFile<Record<string, unknown>>(file)
      setImportData(parsed)
    } catch (err) {
      pushToast('error', 'आयात त्रुटि (Import Error)', err instanceof Error ? err.message : String(err))
    }
    e.target.value = ''
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* ── Top Header & Title ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {t('dashboard.title', 'लेखा तथा बिलिङ्ग ड्यासबोर्ड (Dashboard)')}
          </h1>
          <p className="text-xs text-slate-500">
            {selectedYear ? `आ.व. ${selectedYear.label || selectedYear.startDate?.slice(0, 4)}` : ''} • दैनिक हिसाब, काउन्टर मौज्दात तथा द्रुत प्रविष्टि
          </p>
        </div>
        <DataStatus />
      </div>

      {/* ── Operator Command Ribbon ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/vouchers/new/receipt"
            className="inline-flex items-center gap-1.5 rounded-lg bg-crimson-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-crimson-700"
          >
            <Receipt size={14} />
            <span>+ {t('vouchers.receipt', 'रसिद (Receipt)')}</span>
            <span className="rounded bg-white/20 px-1 py-0.5 text-[10px] font-mono">F1</span>
          </Link>
          <Link
            to="/vouchers/new/payment"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FilePlus size={14} className="text-slate-500" />
            <span>+ {t('vouchers.payment', 'भुक्तानी (Payment)')}</span>
            <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-mono text-slate-600">F2</span>
          </Link>
          <Link
            to="/vouchers/new/journal"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <FileText size={14} className="text-slate-500" />
            <span>+ {t('vouchers.journal', 'जर्नल (Journal)')}</span>
            <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-mono text-slate-600">F3</span>
          </Link>
          <Link
            to="/members"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <UserPlus size={14} className="text-slate-500" />
            <span>सदस्य दर्ता (+Member)</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Export button */}
          <button
            onClick={() => setShowExportModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download size={14} className="text-slate-500" />
            <span>थोक निर्यात (Export)</span>
          </button>

          {/* Import button */}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-crimson-200 bg-crimson-50 px-3 py-1.5 text-xs font-semibold text-crimson-800 hover:bg-crimson-100">
            <Upload size={14} className="text-crimson-700" />
            <span>आयात (Import CSV)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={onFileSelected}
            />
          </label>
        </div>
      </div>

      {/* ── Onboarding Checklist ──────────────────────────────────────── */}
      <SetupChecklist />

      {/* ── Key Metrics & KPI Strip ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <BookOpenText size={18} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t('dashboard.accounts', 'खाता संख्या')}
            </div>
            <div className="font-mono text-lg font-bold text-slate-800">
              {accounts.length}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Receipt size={18} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t('dashboard.journalEntries', 'कुल भौचरहरू')}
            </div>
            <div className="font-mono text-lg font-bold text-slate-800">
              {recentEntries.length}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <TrendingUp size={18} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t('dashboard.posted', 'प्रमाणित (Posted)')}
            </div>
            <div className="font-mono text-lg font-bold text-slate-800">
              {recentEntries.filter((entry) => entry.status === 'posted').length}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              trialBalance?.balanced ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}
          >
            <TrendingDown size={18} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t('dashboard.trialBalance', 'ट्रायल ब्यालेन्स')}
            </div>
            <div className="font-mono text-lg font-bold text-slate-800">
              {trialBalance ? fmt(trialBalance.totals.debit) : '–'}
            </div>
            <div
              className={`text-[11px] font-medium ${
                trialBalance?.balanced ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {trialBalance?.balanced ? '✓ सन्तुलित (Balanced)' : '✗ फरक (Unbalanced)'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main 2-Column Split: Operative Balances & Recent Ledger ───── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left 1-col: Cash Desk & Pending Drafts */}
        <div className="space-y-4">
          {/* Cash & Bank Position */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800">
                  {t('dashboard.cashPosition', 'मौज्दात स्थिति (Liquidity)')}
                </h3>
              </div>
              <Link to="/reports/cash-statement" className="text-xs text-crimson-600 hover:underline">
                विवरण →
              </Link>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-2.5">
                <div className="flex items-center gap-2">
                  <IndianRupee size={14} className="text-emerald-600" />
                  <span className="text-xs font-medium text-slate-700">
                    {t('dashboard.cashInHand', 'कार्यालय नगद (Cash)')}
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-700">
                  {fmt(totalCash)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-blue-50 p-2.5">
                <div className="flex items-center gap-2">
                  <CreditCard size={14} className="text-blue-600" />
                  <span className="text-xs font-medium text-slate-700">
                    {t('dashboard.bankBalance', 'बैंक मौज्दात (Bank)')}
                  </span>
                </div>
                <span className="font-mono text-xs font-bold text-blue-700">
                  {fmt(totalBank)}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                <span className="font-medium text-slate-600">
                  {t('dashboard.totalLiquid', 'कुल तरल सम्पत्ति (Total)')}
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {fmt(totalCash + totalBank)}
                </span>
              </div>
            </div>
          </div>

          {/* Pending Drafts Queue */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Clock3 size={16} className="text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-800">
                  स्वीकृति पर्खिएका मस्यौदा ({pendingDrafts.length})
                </h3>
              </div>
              <Link to="/posting" className="text-xs text-crimson-600 hover:underline">
                सबै पोष्टिङ →
              </Link>
            </div>

            {pendingDrafts.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                कुनै मस्यौदा भौचर बाँकी छैन।
              </p>
            ) : (
              <div className="space-y-2">
                {pendingDrafts.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">
                        {doc.number || `Doc #${doc.id}`}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                        {doc.narration || doc.docType}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-slate-700">
                        {fmt(doc.grossTotal || 0)}
                      </span>
                      <Link
                        to={`/vouchers/edit/${doc.id}`}
                        className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                      >
                        खोल्नुहोस्
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outstanding Dues Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-semibold text-slate-800">
                {t('dashboard.outstandingDues', 'बक्यौता स्थिति')}
              </h3>
              <Link to="/aging" className="text-xs text-crimson-600 hover:underline">
                विस्तृत →
              </Link>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1 text-slate-600">
                  <ArrowUpRight size={14} className="text-emerald-600" />
                  उठ्न बाँकी (Receivables):
                </span>
                <span className="font-mono font-bold text-emerald-700">{fmt(arTotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1 text-slate-600">
                  <ArrowDownLeft size={14} className="text-red-600" />
                  तिर्न बाँकी (Payables):
                </span>
                <span className="font-mono font-bold text-red-700">{fmt(apTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 2-cols: Live Journal Table & P&L Trend */}
        <div className="space-y-4 lg:col-span-2">
          {/* Live Recent Transactions Feed */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {t('dashboard.recentJournalEntries', 'पछिल्ला भौचरहरू (Journal Feed)')}
                </h3>
                <p className="text-xs text-slate-500">हालसालै प्रविष्टि गरिएका लेखा भौचरहरू</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                  <button
                    onClick={() => setTableFilter('all')}
                    className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                      tableFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    सबै ({recentEntries.length})
                  </button>
                  <button
                    onClick={() => setTableFilter('posted')}
                    className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                      tableFilter === 'posted'
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    प्रमाणित
                  </button>
                  <button
                    onClick={() => setTableFilter('draft')}
                    className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                      tableFilter === 'draft'
                        ? 'bg-white text-amber-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    मस्यौदा
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="भौचर नं. वा विवरण खोज..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-crimson-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 font-medium text-slate-500">
                    <th className="px-4 py-2.5">{t('common.date', 'मिति')}</th>
                    <th className="px-4 py-2.5">भौचर नं.</th>
                    <th className="px-4 py-2.5">{t('dashboard.narration', 'विवरण')}</th>
                    <th className="px-4 py-2.5 text-right">{t('common.debit', 'डेबिट (Dr)')}</th>
                    <th className="px-4 py-2.5 text-right">{t('common.credit', 'क्रेडिट (Cr)')}</th>
                    <th className="px-4 py-2.5 text-center">{t('common.status', 'स्थिति')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        कुनै भौचर फेला परेन।
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.slice(0, 10).map((entry) => {
                      const rowTotals = entryTotals(entry)
                      return (
                        <tr key={entry.id} className="transition-colors hover:bg-slate-50/80">
                          <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                            {formatDate(entry.date)}
                          </td>
                          <td className="px-4 py-2 font-mono font-semibold text-crimson-700 whitespace-nowrap">
                            {entry.docNumber || `#${entry.id}`}
                          </td>
                          <td className="px-4 py-2 text-slate-800 max-w-xs truncate">
                            {entry.narration || '—'}
                          </td>
                          <td className="px-4 py-2 font-mono text-right font-medium text-slate-700 whitespace-nowrap">
                            {fmt(rowTotals.debit)}
                          </td>
                          <td className="px-4 py-2 font-mono text-right font-medium text-slate-700 whitespace-nowrap">
                            {fmt(rowTotals.credit)}
                          </td>
                          <td className="px-4 py-2 text-center whitespace-nowrap">
                            <StatusPill status={entry.status} />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 12-Month P&L Trend Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-800">
                  मासिक आय-व्यय तुलना (Revenue vs Expenses - 12 Months)
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  आम्दानी (Income)
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                  खर्च (Expenses)
                </span>
              </div>
            </div>
            {trendLoading ? (
              <div className="flex h-32 items-center justify-center text-xs text-slate-400">
                चार्ट लोड हुँदैछ...
              </div>
            ) : (
              <MiniBarChart months={months} data={trend} />
            )}
          </div>
        </div>
      </div>

      {/* ── Modals: Export & Import ───────────────────────────────────── */}
      {showExportModal && (
        <ExportModal onClose={() => setShowExportModal(false)} />
      )}

      {importData && (
        <ImportPreviewModal
          collection={importData.collection}
          docs={importData.docs}
          onClose={() => setImportData(null)}
          onImported={() => setImportData(null)}
        />
      )}
    </div>
  )
}
