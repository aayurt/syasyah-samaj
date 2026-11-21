/* ================================================================
 * Tax Reconciliation — reconcile tax report totals to tax control ledger accounts.
 *
 * Compares computed tax from documents vs posted GL balances in tax accounts.
 * ================================================================ */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, FileText, Printer, AlertTriangle, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, fmt, list } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { exportReportPdf } from '../lib/pdf'
import { useCalendar } from '../lib/calendar'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { ReportSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useT } from '../lib/i18n'
import type { Document, TaxType, Account, JournalEntry } from '../lib/types'
import NepaliDateInput from '../components/NepaliDateInput'

const QUICK_RANGES = [
  { label: 'This Month', from: () => monthStart(0), to: () => monthEnd(0) },
  { label: 'Last Month', from: () => monthStart(-1), to: () => monthEnd(-1) },
  { label: 'This FY', from: () => fyStart(), to: () => fyEnd() },
  { label: 'All Time', from: () => '', to: () => '' },
]
function monthStart(o: number): string { const d = new Date(); d.setMonth(d.getMonth() + o, 1); return d.toISOString().slice(0, 10) }
function monthEnd(o: number): string { const d = new Date(); d.setMonth(d.getMonth() + o + 1, 0); return d.toISOString().slice(0, 10) }
function fyStart(): string { const n = new Date(); return (n.getMonth() >= 6 ? n.getFullYear() : n.getFullYear() - 1) + '-07-16' }
function fyEnd(): string { const n = new Date(); return (n.getMonth() >= 6 ? n.getFullYear() + 1 : n.getFullYear()) + '-07-15' }

function getTaxTypeId(taxType: number | string | { id?: number } | null): number {
  if (typeof taxType === 'number') return taxType
  if (typeof taxType === 'string') {
    const parsed = parseInt(taxType, 10)
    return isNaN(parsed) ? 0 : parsed
  }
  return taxType?.id ?? 0
}

function getAccountId(account: number | string | { id?: number } | null | undefined): number {
  if (typeof account === 'number') return account
  if (typeof account === 'string') {
    const parsed = parseInt(account, 10)
    return isNaN(parsed) ? 0 : parsed
  }
  return account?.id ?? 0
}

interface ReconciliationRow {
  taxType: { id: number; code: string; name: string; rate: number; nature: string }
  salesAccount?: { id: number; code: string; name: string }
  purchaseAccount?: { id: number; code: string; name: string }
  reportSalesTax: number
  reportPurchaseTax: number
  glSalesBalance: number
  glPurchaseBalance: number
  salesVariance: number
  purchaseVariance: number
  status: 'matched' | 'variance' | 'missing-account'
}

export default function TaxReconciliation() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const t = useT()
  const { formatDate } = useCalendar()
  const [rows, setRows] = useState<ReconciliationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q: Record<string, string | number> = { sort: '-date', depth: 1, ...tenantQuery }
      if (from && to) {
        q.where = JSON.stringify({ and: [
          { date: { greater_than_equal: from } },
          { date: { less_than_equal: to + 'T23:59:59' } },
        ]})
      } else if (from) {
        q.where = JSON.stringify({ date: { greater_than_equal: from } })
      }
      const [d, tx, ac, je] = await Promise.all([
        list<Document>('documents', q),
        list<TaxType>('tax-types', { depth: 1, ...tenantQuery }),
        list<Account>('accounts', { depth: 0, ...tenantQuery }),
        list<JournalEntry>('journal-entries', { depth: 1, sort: 'date', limit: 5000, ...tenantQuery }),
      ])
      const taxTypeMap = new Map<number, TaxType>(tx.docs.map((t) => [t.id, t]))
      const accountMap = new Map<number, Account>(ac.docs.map((a) => [a.id, a]))

      // Calculate tax from documents
      const reportTax = new Map<number, { salesTax: number; purchaseTax: number }>()
      for (const doc of d.docs) {
        if (doc.status !== 'posted') continue
        if (!doc.taxLines?.length) continue
        for (const tl of doc.taxLines) {
          const taxTypeId = getTaxTypeId(tl.taxType)
          if (!taxTypeId) continue
          const tt = taxTypeMap.get(taxTypeId)
          if (!tt) continue
          const rate = Number(tl.rate) || Number(tt.rate) || 0
          const lineSum = doc.netTotal || 0
          const taxAmt = (lineSum * rate) / 100
          const existing = reportTax.get(taxTypeId) || { salesTax: 0, purchaseTax: 0 }
          if (doc.docType === 'sales-invoice' || doc.docType === 'receipt-voucher') {
            existing.salesTax += taxAmt
          } else if (doc.docType === 'purchase-invoice' || doc.docType === 'payment-voucher') {
            existing.purchaseTax += taxAmt
          }
          reportTax.set(taxTypeId, existing)
        }
      }

      // Calculate GL balances from journal entries (filter by tax accounts)
      const glBalances = new Map<number, { sales: number; purchase: number }>()
      for (const entry of je.docs) {
        if (entry.status !== 'posted') continue
        for (const line of entry.lines || []) {
          const accountId = getAccountId(line.account)
          if (!accountId) continue
          // Check if this account is a tax account
          for (const [ttId, tt] of taxTypeMap) {
            const salesAccId = getAccountId(tt.salesAccount)
            const purchaseAccId = getAccountId(tt.purchaseAccount)
            if (accountId === salesAccId) {
              const existing = glBalances.get(ttId) || { sales: 0, purchase: 0 }
              existing.sales += (line.credit || 0) - (line.debit || 0)
              glBalances.set(ttId, existing)
            }
            if (accountId === purchaseAccId) {
              const existing = glBalances.get(ttId) || { sales: 0, purchase: 0 }
              existing.purchase += (line.credit || 0) - (line.debit || 0)
              glBalances.set(ttId, existing)
            }
          }
        }
      }

      // Build reconciliation rows
      const result: ReconciliationRow[] = []
      for (const [ttId, rt] of reportTax) {
        const tt = taxTypeMap.get(ttId)
        if (!tt) continue
        const salesAccId = typeof tt.salesAccount === 'number' ? tt.salesAccount : (typeof tt.salesAccount === 'object' && tt.salesAccount ? tt.salesAccount.id : 0)
        const purchaseAccId = typeof tt.purchaseAccount === 'number' ? tt.purchaseAccount : (typeof tt.purchaseAccount === 'object' && tt.purchaseAccount ? tt.purchaseAccount.id : 0)
        const salesAcc = salesAccId ? accountMap.get(salesAccId) : undefined
        const purchaseAcc = purchaseAccId ? accountMap.get(purchaseAccId) : undefined
        const gl = glBalances.get(ttId) || { sales: 0, purchase: 0 }
        const salesVar = rt.salesTax - gl.sales
        const purchaseVar = rt.purchaseTax - gl.purchase
        let status: 'matched' | 'variance' | 'missing-account' = 'matched'
        if (!salesAccId || !purchaseAccId) status = 'missing-account'
        else if (Math.abs(salesVar) > 0.01 || Math.abs(purchaseVar) > 0.01) status = 'variance'
        result.push({
          taxType: { id: tt.id, code: tt.code, name: tt.name, rate: Number(tt.rate), nature: tt.nature },
          salesAccount: salesAcc ? { id: salesAcc.id, code: salesAcc.code ?? '', name: salesAcc.name } : undefined,
          purchaseAccount: purchaseAcc ? { id: purchaseAcc.id, code: purchaseAcc.code ?? '', name: purchaseAcc.name } : undefined,
          reportSalesTax: rt.salesTax,
          reportPurchaseTax: rt.purchaseTax,
          glSalesBalance: gl.sales,
          glPurchaseBalance: gl.purchase,
          salesVariance: salesVar,
          purchaseVariance: purchaseVar,
          status,
        })
      }
      result.sort((a, b) => a.taxType.code.localeCompare(b.taxType.code))
      setRows(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tax reconciliation')
    } finally { setLoading(false) }
  }, [from, to, tenantId])

  useEffect(() => { load() }, [load])

  const totals = useMemo(() => rows.reduce((s, r) => ({
    reportSalesTax: s.reportSalesTax + r.reportSalesTax,
    reportPurchaseTax: s.reportPurchaseTax + r.reportPurchaseTax,
    glSalesBalance: s.glSalesBalance + r.glSalesBalance,
    glPurchaseBalance: s.glPurchaseBalance + r.glPurchaseBalance,
    salesVariance: s.salesVariance + r.salesVariance,
    purchaseVariance: s.purchaseVariance + r.purchaseVariance,
  }), { reportSalesTax: 0, reportPurchaseTax: 0, glSalesBalance: 0, glPurchaseBalance: 0, salesVariance: 0, purchaseVariance: 0 }), [rows])

  const csv = () => downloadCsv(`tax-reconciliation-${from || 'all'}-${to || 'all'}.csv`,
    ['Tax Code', 'Tax Name', 'Sales Account', 'Purchase Account', 'Report Sales Tax', 'GL Sales Balance', 'Sales Variance', 'Report Purchase Tax', 'GL Purchase Balance', 'Purchase Variance', 'Status'],
    rows.map((r) => [
      r.taxType.code, r.taxType.name,
      r.salesAccount ? `${r.salesAccount.code} ${r.salesAccount.name}` : '—',
      r.purchaseAccount ? `${r.purchaseAccount.code} ${r.purchaseAccount.name}` : '—',
      r.reportSalesTax.toFixed(2), r.glSalesBalance.toFixed(2), r.salesVariance.toFixed(2),
      r.reportPurchaseTax.toFixed(2), r.glPurchaseBalance.toFixed(2), r.purchaseVariance.toFixed(2),
      r.status,
    ]),
  )

  const pdf = () => exportReportPdf({
    filename: `tax-reconciliation-${from || 'all'}-${to || 'all'}.pdf`,
    title: t('reports.taxReconciliation', 'Tax Reconciliation'),
    subtitle: t('reports.taxReconciliationDesc', 'Reconcile tax report totals to tax control ledger accounts'),
    meta: [['Period', `${from || 'Earliest'} to ${to || 'Latest'}`], ['Generated', new Date().toLocaleString()]],
    tables: [{
      columns: ['Tax Code', 'Tax Name', 'Sales Account', 'Report Sales Tax', 'GL Sales', 'Sales Var', 'Purchase Account', 'Report Purchase Tax', 'GL Purchase', 'Purchase Var', 'Status'],
      rows: rows.map((r) => [
        r.taxType.code, r.taxType.name,
        r.salesAccount ? `${r.salesAccount.code} ${r.salesAccount.name}` : '—',
        fmt(r.reportSalesTax), fmt(r.glSalesBalance), fmt(r.salesVariance),
        r.purchaseAccount ? `${r.purchaseAccount.code} ${r.purchaseAccount.name}` : '—',
        fmt(r.reportPurchaseTax), fmt(r.glPurchaseBalance), fmt(r.purchaseVariance),
        r.status,
      ]),
      totals: ['TOTAL', '', '', fmt(totals.reportSalesTax), fmt(totals.glSalesBalance), fmt(totals.salesVariance), '', fmt(totals.reportPurchaseTax), fmt(totals.glPurchaseBalance), fmt(totals.purchaseVariance), ''],
    }],
  })

  return (
    <div className="w-full pb-28">
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{t('reports.taxReconciliation', 'Tax Reconciliation')}</h1>
            <p className="text-sm text-slate-500">{t('reports.taxReconciliationDesc', 'Reconcile tax report totals to tax control ledger accounts')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {rows.length > 0 && (
            <>
              <button onClick={csv} className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <Download size={14} /> {t('common.export', 'Export')}
              </button>
              <button onClick={pdf} className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <FileText size={14} /> {t('common.pdf', 'PDF')}
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <Printer size={14} /> {t('common.print', 'Print')}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>}

      <div className="mt-4 flex flex-wrap items-end gap-4 px-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t('reports.from', 'From Date')}</label>
          <NepaliDateInput value={from} onChange={(v) => setFrom(v)} disabled={loading} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t('reports.to', 'To Date')}</label>
          <NepaliDateInput value={to} onChange={(v) => setTo(v)} disabled={loading} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t('reports.quick', 'Quick')}</label>
          <div className="flex gap-1">
            {QUICK_RANGES.map((r) => (
              <button key={r.label} type="button" onClick={() => { setFrom(r.from()); setTo(r.to()); }} disabled={loading} className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <ReportSkeleton sections={1} />}

      {!loading && rows.length === 0 && !error && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">{t('reports.noTaxData', 'No tax data for the selected period.')}</p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">{t('reports.taxCode', 'Tax Code')}</th>
                <th className="px-3 py-3">{t('reports.taxName', 'Tax Name')}</th>
                <th className="px-3 py-3">{t('reports.salesAccount', 'Sales Tax Account')}</th>
                <th className="px-3 py-3 text-right">{t('reports.reportSalesTax', 'Report Sales Tax')}</th>
                <th className="px-3 py-3 text-right">{t('reports.glSalesBalance', 'GL Sales Balance')}</th>
                <th className="px-3 py-3 text-right">{t('reports.salesVariance', 'Sales Variance')}</th>
                <th className="px-3 py-3">{t('reports.purchaseAccount', 'Purchase Tax Account')}</th>
                <th className="px-3 py-3 text-right">{t('reports.reportPurchaseTax', 'Report Purchase Tax')}</th>
                <th className="px-3 py-3 text-right">{t('reports.glPurchaseBalance', 'GL Purchase Balance')}</th>
                <th className="px-3 py-3 text-right">{t('reports.purchaseVariance', 'Purchase Variance')}</th>
                <th className="px-3 py-3">{t('reports.status', 'Status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-3 py-2">{r.taxType.code}</td>
                  <td className="px-3 py-2">{r.taxType.name}</td>
                  <td className="px-3 py-2">{r.salesAccount ? `${r.salesAccount.code} ${r.salesAccount.name}` : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.reportSalesTax)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.glSalesBalance)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.salesVariance)}</td>
                  <td className="px-3 py-2">{r.purchaseAccount ? `${r.purchaseAccount.code} ${r.purchaseAccount.name}` : '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.reportPurchaseTax)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.glPurchaseBalance)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(r.purchaseVariance)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      r.status === 'matched' ? 'bg-emerald-50 text-emerald-700' :
                      r.status === 'variance' ? 'bg-red-50 text-red-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      {r.status === 'matched' && <CheckCircle size={10} className="mr-1" />}
                      {r.status === 'variance' && <AlertTriangle size={10} className="mr-1" />}
                      {r.status === 'missing-account' && <AlertTriangle size={10} className="mr-1" />}
                      {t(`reports.reconcileStatus.${r.status}`, r.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <td className="px-3 py-2 font-semibold" colSpan={3}>{t('common.total', 'Total')}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(totals.reportSalesTax)}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(totals.glSalesBalance)}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(totals.salesVariance)}</td>
                <td className="px-3 py-2 font-semibold"> </td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(totals.reportPurchaseTax)}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(totals.glPurchaseBalance)}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{fmt(totals.purchaseVariance)}</td>
                <td className="px-3 py-2"> </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="mt-2"><DataStatus /></div>
    </div>
  )
}