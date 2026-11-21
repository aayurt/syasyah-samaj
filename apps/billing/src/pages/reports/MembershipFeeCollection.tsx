/* ================================================================
 * Membership Fee Collection — members with fee payment status,
 * renewal dates, and outstanding amounts.
 *
 * Data from GET /members (Members collection) + GET /membership-types.
 * ================================================================ */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, list } from '../../lib/api'
import { downloadCsv } from '../../lib/csv'
import { exportReportPdf } from '../../lib/pdf'
import { useTenant, useTenantQuery } from '../../lib/tenant'
import ReportLayout from '../../components/ReportLayout'
import { ReportSkeleton } from '../../components/Skeleton'
import DataStatus from '../../components/DataStatus'
import { useT } from '../../lib/i18n'
import SearchBox from '../../components/SearchBox'
import ReportFilterBar from '../../components/ReportFilterBar'
import { ReportBreakdownBar, ReportMetricGauge } from '../../components/ReportCharts'

interface MemberRow {
  id: string
  memberId: string
  fullName: string
  email: string
  phoneNumber: string
  status: string
  paymentStatus: string
  joinedDate: string
  renewalDate: string | null
  membershipType: { id: string; name: string; fee: number } | null
  lastReceipt: { id: string; number: string } | null
}

export default function MembershipFeeCollection() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const t = useT()
  const [rows, setRows] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [membersRes, typesRes] = await Promise.all([
        api<any>('/members', { query: { ...tenantQuery, sort: 'fullName', limit: 1000 } }),
        api<any>('/membership-types', { query: { ...tenantQuery, sort: 'name', limit: 1000 } }),
      ])
      const members: any[] = Array.isArray(membersRes) ? membersRes : (membersRes?.docs || [])
      const types: any[] = Array.isArray(typesRes) ? typesRes : (typesRes?.docs || [])
      const typeMap = new Map<string, any>(types.map((t) => [String(t.id), t]))
      const memberRows: MemberRow[] = members.map((m) => {
        const typeId = typeof m.membershipType === 'number' || typeof m.membershipType === 'string'
          ? String(m.membershipType)
          : (m.membershipType?.id ?? null)
        const mtype = typeId ? typeMap.get(typeId) : null
        return {
          id: m.id,
          memberId: m.memberId || '',
          fullName: m.fullName,
          email: m.email || '',
          phoneNumber: m.phoneNumber || '',
          status: m.status || 'active',
          paymentStatus: m.paymentStatus || 'unpaid',
          joinedDate: m.joinedDate || '',
          renewalDate: m.renewalDate || null,
          membershipType: mtype ? { id: mtype.id, name: mtype.name, fee: Number(mtype.fee) || 0 } : null,
          lastReceipt: m.lastReceipt ? { id: m.lastReceipt.id, number: m.lastReceipt.number } : null,
        }
      })
      setRows(memberRows)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load members')
    } finally { setLoading(false) }
  }, [tenantQuery])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() =>
    rows.filter((r) => {
      if (from && r.joinedDate && r.joinedDate < from) return false
      if (to && r.joinedDate && r.joinedDate > to) return false
      if (paymentStatusFilter !== 'all' && r.paymentStatus !== paymentStatusFilter) return false
      if (query && !`${r.fullName} ${r.memberId} ${r.email} ${r.phoneNumber}`.toLowerCase().includes(query.toLowerCase())) return false
      return true
    }),
    [rows, query, from, to, paymentStatusFilter]
  )

  const totals = useMemo(() => {
    const totalMembers = filtered.length
    const paid = filtered.filter((r) => r.paymentStatus === 'paid').length
    const unpaid = filtered.filter((r) => r.paymentStatus === 'unpaid').length
    const overdue = filtered.filter((r) => r.paymentStatus === 'overdue').length
    const totalExpected = filtered.reduce((s, r) => s + (r.membershipType?.fee || 0), 0)
    const totalPaid = filtered.reduce((s, r) => s + (r.paymentStatus === 'paid' ? (r.membershipType?.fee || 0) : 0), 0)
    return { totalMembers, paid, unpaid, overdue, totalExpected, totalPaid }
  }, [filtered])

  const exportCsv = () => {
    downloadCsv('membership-fee-collection.csv',
      ['Member ID', 'Name', 'Email', 'Phone', 'Status', 'Payment Status', 'Membership Type', 'Fee', 'Renewal Date'],
      filtered.map((r) => [
        r.memberId, r.fullName, r.email, r.phoneNumber, r.status, r.paymentStatus,
        r.membershipType?.name || '—', (r.membershipType?.fee || 0).toFixed(2), r.renewalDate || '—',
      ]),
    )
  }

  const exportPdf = () => {
    exportReportPdf({
      filename: 'membership-fee-collection.pdf',
      title: t('reports.membershipFeeCollection', 'Membership Fee Collection'),
      subtitle: t('reports.membershipFeeCollectionDesc', 'Member fee payment status and renewal dates'),
      meta: [['Generated', new Date().toLocaleString()]],
      tables: [{
        columns: ['Member ID', 'Name', 'Membership Type', 'Fee', 'Payment Status', 'Renewal Date'],
        rows: filtered.map((r) => [
          r.memberId, r.fullName, r.membershipType?.name || '—',
          (r.membershipType?.fee || 0).toFixed(2), r.paymentStatus, r.renewalDate || '—',
        ]),
        totals: ['TOTAL', '', '', totals.totalExpected.toFixed(2), '', ''],
      }],
    })
  }

  return (
    <ReportLayout
      title={t('reports.membershipFeeCollection', 'Membership Fee Collection')}
      titleKey="reports.membershipFeeCollection"
      description={t('reports.membershipFeeCollectionDesc', 'Member fee payment status and renewal dates')}
      descriptionKey="reports.membershipFeeCollectionDesc"
      backTo="/reports"
      loading={loading}
      error={error}
      hasData={rows.length > 0}
      onExportCsv={exportCsv}
      onExportPdf={exportPdf}
      pdfTitle={t('reports.membershipFeeCollection', 'Membership Fee Collection')}
      pdfMeta={[['Generated', new Date().toLocaleString()]]}
    >
      <div className="mt-4 px-2">
        <ReportFilterBar
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          className="mb-4"
          extraControls={
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={query} onChange={setQuery} placeholder={t('common.search', 'Search members...')} />
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-hidden"
              >
                <option value="all">All Payment Status</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          }
        />

        {/* Visual Fee Collection Status Chart */}
        {totals.totalMembers > 0 && (
          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ReportBreakdownBar
                title={t('reports.collectionStatus', 'Membership Dues Collection Status')}
                totalLabel={t('reports.memberRoster', 'Total Members')}
                segments={[
                  { label: t('reports.paid', 'Paid Up-to-date'), value: totals.paid, color: 'bg-emerald-500' },
                  { label: t('reports.unpaid', 'Unpaid Current'), value: totals.unpaid, color: 'bg-amber-500' },
                  { label: t('reports.overdue', 'Overdue Arrears'), value: totals.overdue, color: 'bg-rose-500' },
                ]}
              />
            </div>
            <div>
              <ReportMetricGauge
                label={t('reports.collectionRate', 'Fee Recovery Rate')}
                value={`${totals.totalMembers > 0 ? ((totals.paid / totals.totalMembers) * 100).toFixed(1) : 0}%`}
                percentage={totals.totalMembers > 0 ? (totals.paid / totals.totalMembers) * 100 : 0}
                statusColor="text-emerald-700"
                barColor="bg-emerald-500"
                description={`${totals.paid} of ${totals.totalMembers} active roster members current on dues`}
              />
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('reports.totalMembers', 'Total Members')}</p>
            <p className="text-lg font-mono font-semibold text-slate-900">{totals.totalMembers}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('reports.paid', 'Paid')}</p>
            <p className="text-lg font-mono font-semibold text-emerald-700">{totals.paid}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('reports.unpaid', 'Unpaid')}</p>
            <p className="text-lg font-mono font-semibold text-amber-700">{totals.unpaid}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{t('reports.overdue', 'Overdue')}</p>
            <p className="text-lg font-mono font-semibold text-red-700">{totals.overdue}</p>
          </div>
        </div>

        {loading && <ReportSkeleton sections={1} />}

        {!loading && filtered.length === 0 && !error && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white px-6 py-12 text-center">
            <Search size={18} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-500">{t('reports.noMembers', 'No members found.')}</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">{t('reports.memberId', 'Member ID')}</th>
                  <th className="px-3 py-3">{t('common.name', 'Name')}</th>
                  <th className="px-3 py-3">{t('reports.membershipType', 'Membership Type')}</th>
                  <th className="px-3 py-3 text-right">{t('reports.fee', 'Fee')}</th>
                  <th className="px-3 py-3">{t('reports.paymentStatus', 'Payment Status')}</th>
                  <th className="px-3 py-3">{t('reports.renewalDate', 'Renewal Date')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id || i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2 text-left text-sm text-slate-700">{r.memberId}</td>
                    <td className="px-3 py-2 text-left text-sm text-slate-700">{r.fullName}</td>
                    <td className="px-3 py-2 text-sm text-slate-600">{r.membershipType?.name || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-slate-700">{r.membershipType?.fee?.toFixed(2) || '0.00'}</td>
                    <td className="px-3 py-2 text-sm">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        r.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' :
                        r.paymentStatus === 'overdue' ? 'bg-red-50 text-red-700' :
                        'bg-slate-50 text-slate-700'
                      }`}>{r.paymentStatus}</span>
                    </td>
                    <td className="px-3 py-2 text-sm font-mono text-slate-600">{r.renewalDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-2"><DataStatus /></div>
    </ReportLayout>
  )
}
