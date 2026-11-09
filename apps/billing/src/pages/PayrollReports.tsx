/**
 * Payroll Reports — payslips list/preview, statutory registers (SSF/PF/CIT), variance reports.
 *
 * Route: /payroll/reports
 */
import { useCallback, useEffect, useState } from 'react'
import { FileText, Printer, Clock, Banknote } from 'lucide-react'
import { api, fmt, list } from '../lib/api'
import { useTenantQuery } from '../lib/tenant'
import { pushToast } from '../lib/toast'

export default function PayrollReports() {
  const tenantQuery = useTenantQuery()
  const [slips, setSlips] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await list<any>('/payroll-slips', {
        ...tenantQuery,
        sort: '-period',
      })
      setSlips(res.docs || [])
    } catch {
      /* api() toasted */
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(tenantQuery)])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-6 mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">
          <FileText size={20} className="mr-2 text-crimson-600" />
          Payroll Reports
        </h1>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Statutory register summary cards */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <div className="text-xs font-medium text-slate-500 uppercase">SSF Register</div>
          <div className="mt-1 text-lg font-mono text-slate-900">{fmt(0)}</div>
          <div className="mt-1 text-xs text-slate-500">Employee + employer contributions</div>
        </div>
        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <div className="text-xs font-medium text-slate-500 uppercase">PF Register</div>
          <div className="mt-1 text-lg font-mono text-slate-900">{fmt(0)}</div>
          <div className="mt-1 text-xs text-slate-500">Provident Fund contributions</div>
        </div>
        <div className="p-4 rounded-lg border border-slate-200 bg-white">
          <div className="text-xs font-medium text-slate-500 uppercase">CIT Withheld</div>
          <div className="mt-1 text-lg font-mono text-slate-900">{fmt(0)}</div>
          <div className="mt-1 text-xs text-slate-500">Income tax this period</div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h2 className="text-sm font-medium text-slate-800">Payslips</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {loading ? 'Loading…' : slips.length} slip(s)
            </span>
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : slips.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No payslips yet — generate and post a payroll batch first.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-3">Slip #</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3 text-right">Gross</th>
                <th className="px-4 py-3 text-right">Deductions</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {slips.map((s, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{s.slipNumber || `SS-${i + 1}`}</td>
                  <td className="px-4 py-3">{s.employeeName || '—'}</td>
                  <td className="px-4 py-3">{s.period || '—'}</td>
                  <td className="px-4 py-3 text-right">{fmt(s.grossPay)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">−{fmt(s.totalDeductionsAmount)}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmt(s.netPay)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        s.status === 'Posted'
                          ? 'bg-emerald-100 text-emerald-700'
                          : s.status === 'Cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {s.status || 'Draft'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-medium text-slate-800 mb-4">Statutory Registers</h2>
        <p className="text-sm text-slate-500 mb-4">
          Export SSF, PF, and CIT registers for statutory filing. Registers are
          generated from posted payroll runs and grouped by employee.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => pushToast('info', 'SSF register export — coming in next release')}
            className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Clock size={14} /> Export SSF (CSV)
          </button>
          <button
            onClick={() => pushToast('info', 'PF register export — coming in next release')}
            className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Clock size={14} /> Export PF (CSV)
          </button>
          <button
            onClick={() => pushToast('info', 'CIT statement export — coming in next release')}
            className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Banknote size={14} /> Export CIT (CSV)
          </button>
        </div>
      </div>
    </div>
  )
}
