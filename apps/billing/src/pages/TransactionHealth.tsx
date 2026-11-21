/* ================================================================
 * Transaction Health — diagnostic audit report.
 *
 * Scans posted/draft documents and ledger entries for common issues.
 * Each check links to the relevant list page for drill-down.
 * ================================================================ */

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, list } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { exportReportPdf } from '../lib/pdf'
import { useTenant, useTenantQuery } from '../lib/tenant'
import ReportLayout from '../components/ReportLayout'
import { ReportSkeleton } from '../components/Skeleton'
import DataStatus from '../components/DataStatus'
import { useT } from '../lib/i18n'
import type { Document, JournalEntry, Account, Item, Party } from '../lib/types'

interface HealthIssue {
  id: string
  title: string
  description: string
  count: number
  severity: 'error' | 'warning' | 'info'
  route: string
  icon: React.ReactNode
}

const ICONS = {
  error: <AlertCircle size={14} className="text-red-500" />,
  warning: <AlertTriangle size={14} className="text-amber-500" />,
  info: <Info size={14} className="text-blue-500" />,
}

export default function TransactionHealth() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const t = useT()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [issues, setIssues] = useState<HealthIssue[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [journals, setJournals] = useState<JournalEntry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [parties, setParties] = useState<Party[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const [dRes, jRes, aRes, iRes, pRes] = await Promise.all([
          list<Document>('documents', { depth: 0, sort: 'date', limit: 5000, ...tenantQuery }),
          list<JournalEntry>('journal-entries', { depth: 0, sort: 'date', limit: 5000, ...tenantQuery }),
          list<Account>('accounts', { depth: 0, sort: 'code', limit: 2000, ...tenantQuery }),
          list<Item>('items', { depth: 0, sort: 'name', limit: 2000, ...tenantQuery }),
          list<Party>('parties', { depth: 0, sort: 'name', limit: 1000, ...tenantQuery }),
        ])
        setDocuments(dRes.docs)
        setJournals(jRes.docs)
        setAccounts(aRes.docs)
        setItems(iRes.docs)
        setParties(pRes.docs)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    })()
  }, [tenantId])

  // Run health checks when data is loaded
  useEffect(() => {
    if (loading || documents.length === 0 && journals.length === 0) return

    const checkResults: HealthIssue[] = []

    // 1. Draft/pending transactions
    const draftCount = documents.filter((d) => d.status === 'draft').length
    if (draftCount > 0) {
      checkResults.push({
        id: 'draft-transactions',
        title: t('health.draftTransactions', 'Draft Transactions'),
        description: t('health.draftTransactionsDesc', 'Transactions not yet posted to the general ledger'),
        count: draftCount,
        severity: 'info',
        route: '/daybooks?status=draft',
        icon: ICONS.info,
      })
    }

    // 2. Posted journals with unbalanced debits/credits
    const unbalancedJournals = journals.filter((j) => {
      const debits = j.lines?.reduce((s, l) => s + (l.debit || 0), 0) || 0
      const credits = j.lines?.reduce((s, l) => s + (l.credit || 0), 0) || 0
      return Math.abs(debits - credits) > 0.01
    }).length
    if (unbalancedJournals > 0) {
      checkResults.push({
        id: 'unbalanced-journals',
        title: t('health.unbalancedJournals', 'Unbalanced Journal Entries'),
        description: t('health.unbalancedJournalsDesc', 'Posted journals where debits ≠ credits'),
        count: unbalancedJournals,
        severity: 'error',
        route: '/journal-entries?unbalanced=true',
        icon: ICONS.error,
      })
    }

    // 3. Missing account mappings on posted documents
    const missingAccountMappings = documents
      .filter((d) => d.status === 'posted')
      .filter((d) => d.lines?.some((l) => !l.account) ?? false).length
    if (missingAccountMappings > 0) {
      checkResults.push({
        id: 'missing-account-mappings',
        title: t('health.missingAccountMappings', 'Missing Account Mappings'),
        description: t('health.missingAccountMappingsDesc', 'Posted documents with lines lacking GL account'),
        count: missingAccountMappings,
        severity: 'warning',
        route: '/vouchers?missingAccount=true',
        icon: ICONS.warning,
      })
    }

    // 4. Missing tax codes on taxable transactions
    const missingTaxCodes = documents
      .filter((d) => d.status === 'posted')
      .filter((d) => (d.docType === 'sales-invoice' || d.docType === 'purchase-invoice') && (!d.taxRate || d.taxRate === 0))
      .length
    if (missingTaxCodes > 0) {
      checkResults.push({
        id: 'missing-tax-codes',
        title: t('health.missingTaxCodes', 'Missing Tax Codes'),
        description: t('health.missingTaxCodesDesc', 'Sales/purchase invoices without tax rate'),
        count: missingTaxCodes,
        severity: 'warning',
        route: '/vouchers?missingTax=true',
        icon: ICONS.warning,
      })
    }

    // 5. Duplicate transaction references (same number for same type)
    const numberCounts = new Map<string, number>()
    documents.forEach((d) => {
      if (d.number) {
        const key = `${d.docType}:${d.number}`
        numberCounts.set(key, (numberCounts.get(key) || 0) + 1)
      }
    })
    const duplicateCount = Array.from(numberCounts.values()).filter((c) => c > 1).length
    if (duplicateCount > 0) {
      checkResults.push({
        id: 'duplicate-references',
        title: t('health.duplicateReferences', 'Duplicate Transaction References'),
        description: t('health.duplicateReferencesDesc', 'Same document number used for same type'),
        count: duplicateCount,
        severity: 'warning',
        route: '/vouchers?duplicates=true',
        icon: ICONS.warning,
      })
    }

    // 6. Overdue receivables (using aging logic from receivables)
    // We'll approximate: sales invoices > 30 days unpaid
    const asOf = new Date()
    const thirtyDaysAgo = new Date(asOf.getTime() - 30 * 24 * 60 * 60 * 1000)
    const overdueReceivables = documents.filter((d) =>
      d.status === 'posted' &&
      d.docType === 'sales-invoice' &&
      d.date &&
      new Date(d.date) < thirtyDaysAgo &&
      !documents.some((p) =>
        p.docType === 'receipt-voucher' &&
        p.party === d.party &&
        p.referenceTo === d.id
      )
    ).length
    if (overdueReceivables > 0) {
      checkResults.push({
        id: 'overdue-receivables',
        title: t('health.overdueReceivables', 'Overdue Receivables'),
        description: t('health.overdueReceivablesDesc', 'Sales invoices > 30 days without receipt'),
        count: overdueReceivables,
        severity: 'warning',
        route: '/reports/receivables',
        icon: ICONS.warning,
      })
    }

    // 7. Overdue payables
    const overduePayables = documents.filter((d) =>
      d.status === 'posted' &&
      d.docType === 'purchase-invoice' &&
      d.date &&
      new Date(d.date) < thirtyDaysAgo &&
      !documents.some((p) =>
        p.docType === 'payment-voucher' &&
        p.party === d.party &&
        p.referenceTo === d.id
      )
    ).length
    if (overduePayables > 0) {
      checkResults.push({
        id: 'overdue-payables',
        title: t('health.overduePayables', 'Overdue Payables'),
        description: t('health.overduePayablesDesc', 'Purchase invoices > 30 days without payment'),
        count: overduePayables,
        severity: 'warning',
        route: '/reports/payables',
        icon: ICONS.warning,
      })
    }

    // 8. Negative inventory (items with negative stock)
    // We need stock ledger - approximate from documents
    // For now, skip as it requires stock movement calculation

    // 9. Fixed assets missing depreciation settings (skip - items don't track this)

    // 10. Transactions posted to inactive accounts
    const inactiveAccountIds = new Set(accounts.filter((a) => a.active === false).map((a) => a.id))
    const postedToInactive = documents
      .filter((d) => d.status === 'posted')
      .filter((d) => d.lines?.some((l) => l.account && inactiveAccountIds.has(typeof l.account === 'number' ? l.account : l.account.id)) ?? false)
      .length
    if (postedToInactive > 0) {
      checkResults.push({
        id: 'posted-to-inactive',
        title: t('health.postedToInactive', 'Posted to Inactive Accounts'),
        description: t('health.postedToInactiveDesc', 'Posted documents with lines using inactive accounts'),
        count: postedToInactive,
        severity: 'error',
        route: '/accounts?status=inactive',
        icon: ICONS.error,
      })
    }

    // 11. Orphaned journal entries (no source document)
    const orphanedJournals = journals.filter((j) => !j.referenceDoc).length
    if (orphanedJournals > 0) {
      checkResults.push({
        id: 'orphaned-journals',
        title: t('health.orphanedJournals', 'Orphaned Journal Entries'),
        description: t('health.orphanedJournalsDesc', 'Journal entries without a source document reference'),
        count: orphanedJournals,
        severity: 'info',
        route: '/journal-entries?orphaned=true',
        icon: ICONS.info,
      })
    }

    setIssues(checkResults)
  }, [loading, documents, journals, accounts, items, parties, t])

  const totalIssues = useMemo(() => issues.reduce((s, i) => s + i.count, 0), [issues])
  const errorCount = useMemo(() => issues.filter((i) => i.severity === 'error').reduce((s, i) => s + i.count, 0), [issues])
  const warningCount = useMemo(() => issues.filter((i) => i.severity === 'warning').reduce((s, i) => s + i.count, 0), [issues])
  const infoCount = useMemo(() => issues.filter((i) => i.severity === 'info').reduce((s, i) => s + i.count, 0), [issues])

  const exportCsv = () => {
    const headers = ['Issue', 'Description', 'Count', 'Severity']
    const rows = issues.map((i) => [i.title, i.description, i.count, i.severity.toUpperCase()])
    rows.push(['TOTAL', '', totalIssues, ''])
    downloadCsv(`transaction-health-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
  }

  const exportPdf = () => {
    exportReportPdf({
      filename: `transaction-health-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: t('reports.transactionHealth', 'Transaction Health'),
      subtitle: t('reports.transactionHealthDesc', 'Diagnostic audit of transaction integrity'),
      meta: [
        ['Generated', new Date().toLocaleString()],
        ['Total Issues', totalIssues.toString()],
        ['Errors', errorCount.toString()],
        ['Warnings', warningCount.toString()],
        ['Info', infoCount.toString()],
      ],
      tables: [
        {
          title: 'Transaction Health Checks',
          columns: ['Check', 'Description', 'Count', 'Severity'],
          rows: issues.map((i) => [i.title, i.description, i.count, i.severity.toUpperCase()]),
        },
      ],
    })
  }

  return (
    <ReportLayout
      title={t('reports.transactionHealth', 'Transaction Health')}
      titleKey="reports.transactionHealth"
      description={t('reports.transactionHealthDesc', 'Diagnostic audit of transaction integrity')}
      descriptionKey="reports.transactionHealthDesc"
      backTo="/reports"
      loading={loading}
      error={error}
      hasData={issues.length > 0}
      onExportCsv={exportCsv}
      onExportPdf={exportPdf}
      pdfTitle={t('reports.transactionHealth', 'Transaction Health')}
      pdfMeta={[
        ['Generated', new Date().toLocaleString()],
        ['Total Issues', totalIssues.toString()],
        ['Errors', errorCount.toString()],
        ['Warnings', warningCount.toString()],
        ['Info', infoCount.toString()],
      ]}
    >
      <div className="mt-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('health.totalIssues', 'Total Issues')}</p>
            <p className="text-2xl font-mono font-semibold text-slate-900">{totalIssues}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('health.errors', 'Errors')}</p>
            <p className="text-2xl font-mono font-semibold text-red-600">{errorCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('health.warnings', 'Warnings')}</p>
            <p className="text-2xl font-mono font-semibold text-amber-600">{warningCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('health.info', 'Info')}</p>
            <p className="text-2xl font-mono font-semibold text-blue-600">{infoCount}</p>
          </div>
        </div>

        {loading && <ReportSkeleton sections={3} />}

        {!loading && issues.length === 0 && !error && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
            <CheckCircle size={48} className="mx-auto mb-2 text-emerald-500" />
            <p className="text-sm text-slate-500">{t('health.noIssues', 'No issues detected. All transactions appear healthy.')}</p>
          </div>
        )}

        {issues.length > 0 && (
          <div className="mt-6 space-y-4 px-2">
            {issues.map((issue) => (
              <button
                key={issue.id}
                onClick={() => navigate(issue.route)}
                className="w-full flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-slate-100">
                  {issue.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-900 truncate">{issue.title}</h3>
                  <p className="text-xs text-slate-500 truncate">{issue.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    issue.severity === 'error' ? 'bg-red-50 text-red-700' :
                    issue.severity === 'warning' ? 'bg-amber-50 text-amber-700' :
                    'bg-blue-50 text-blue-700'
                  }`}>
                    {issue.severity.toUpperCase()}
                  </span>
                  <span className="text-lg font-mono font-semibold text-slate-700">{issue.count}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2">
        <DataStatus />
      </div>
    </ReportLayout>
  )
}
