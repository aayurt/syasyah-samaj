/**
 * Payroll Batch — 6-stage wizard:
 *
 *   Period & Setup → Review & Exclusion → Validate → Calculate → Review & Variance → Release & Post
 *
 * Route: /payroll/batch
 */
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Banknote, Calendar, CheckCircle2, Clock, RefreshCw, Trash2 } from 'lucide-react'
import { api, fmt, list } from '../lib/api'
import { useTenantQuery } from '../lib/tenant'
import { pushToast } from '../lib/toast'

type Stage =
  | 'setup'
  | 'review'
  | 'validate'
  | 'calculate'
  | 'variance'
  | 'release'

const STAGES: { key: Stage; label: string }[] = [
  { key: 'setup', label: 'Period & Setup' },
  { key: 'review', label: 'Review & Exclusion' },
  { key: 'validate', label: 'Validate' },
  { key: 'calculate', label: 'Calculate' },
  { key: 'variance', label: 'Review & Variance' },
  { key: 'release', label: 'Release & Post' },
]

const STAGE_ICONS: Record<Stage, any> = {
  setup: Calendar,
  review: Banknote,
  validate: Clock,
  calculate: RefreshCw,
  variance: CheckCircle2,
  release: ArrowRight,
}

export default function PayrollBatch() {
  const tenantQuery = useTenantQuery()
  const [stage, setStage] = useState<Stage>('setup')
  const [runs, setRuns] = useState<any[]>([])
  const [selectedRun, setSelectedRun] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState<Stage | null>(null)

  const period = new Date().toISOString().slice(0, 7)
  const payDate = new Date().toISOString().slice(0, 10)

  const loadRuns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await list<any>('/payroll-runs', {
        ...tenantQuery,
        sort: '-period',
      })
      setRuns(res.docs || [])
    } catch {
      /* api() toasted */
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(tenantQuery)])

  useEffect(() => { loadRuns() }, [loadRuns])

  const next = () => {
    const idx = STAGES.findIndex((s) => s.key === stage)
    if (idx < STAGES.length - 1) setStage(STAGES[idx + 1].key)
  }
  const prev = () => {
    const idx = STAGES.findIndex((s) => s.key === stage)
    if (idx > 0) setStage(STAGES[idx - 1].key)
  }

  const handleGenerate = async () => {
    setRunning('setup')
    try {
      const res = await api<any>('/payroll-runs/generate', {
        method: 'POST',
        immediate: true,
        body: { period, payDate, ...(tenantQuery.tenant ? { tenant: tenantQuery.tenant } : {}) },
      })
      const doc = res.doc
      setSelectedRun(doc)
      setRuns((prev) => [doc, ...prev.filter((r) => r.id !== doc.id)])
      next()
      pushToast('success', 'Draft run generated', doc.period)
    } catch (err) {
      pushToast('error', 'Generate failed', err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(null)
    }
  }

  const handleValidate = async () => {
    if (!selectedRun) return
    setRunning('validate')
    try {
      await api(`/payroll-runs/${selectedRun.id}/validate`, {
        method: 'POST',
        immediate: true,
      })
      pushToast('success', 'Validation passed')
      next()
    } catch (err) {
      pushToast('error', 'Validation failed', err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(null)
    }
  }

  const handleCalculate = async () => {
    if (!selectedRun) return
    setRunning('calculate')
    try {
      const res = await api<any>(`/payroll-runs/${selectedRun.id}/calculate`, {
        method: 'POST',
        immediate: true,
      })
      setSelectedRun(res.doc)
      pushToast('success', 'Calculation complete')
      next()
    } catch (err) {
      pushToast('error', 'Calculation failed', err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(null)
    }
  }

  const handleRelease = async () => {
    if (!selectedRun) return
    setRunning('release')
    try {
      await api(`/payroll-runs/${selectedRun.id}/release`, {
        method: 'POST',
        immediate: true,
      })
      pushToast('success', 'Released for approval')
      next()
    } catch (err) {
      pushToast('error', 'Release failed', err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(null)
    }
  }

  const handlePost = async () => {
    if (!selectedRun) return
    setRunning('release')
    try {
      await api(`/payroll-runs/${selectedRun.id}/post`, {
        method: 'POST',
        immediate: true,
      })
      pushToast('success', 'Payroll posted')
      setSelectedRun(null)
      await loadRuns()
    } catch (err) {
      pushToast('error', 'Post failed', err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(null)
    }
  }

  const stageIdx = STAGES.findIndex((s) => s.key === stage)
  const progress = ((stageIdx + 1) / STAGES.length) * 100

  return (
    <div className="p-6 mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900 mb-2">Payroll Batch</h1>
      <p className="text-sm text-slate-500 mb-6">
        Six-stage payroll batch: generate draft → validate → calculate → release → post.
      </p>

      {/* Progress */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2/3 bg-slate-200 rounded-full h-2">
            <div className="bg-crimson-600 h-2 rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-medium text-slate-600">
            Stage {stageIdx + 1} of {STAGES.length} — {STAGES[stageIdx]?.label}
          </span>
        </div>
        <div className="flex gap-1 text-xs">
          {STAGES.map((s, i) => (
            <div
              key={s.key}
              className={`flex-1 px-2 py-1 rounded text-center ${
                i < stageIdx
                  ? 'bg-emerald-100 text-emerald-700'
                  : i === stageIdx
                    ? 'bg-crimson-100 text-crimson-700'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Stage content */}
      {stage === 'setup' && (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">1. Period & Setup</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Period (YYYY-MM)</label>
              <input
                type="month"
                value={period}
                readOnly
                className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Pay Date</label>
              <input
                type="date"
                value={payDate}
                readOnly
                className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div className="col-span-2 sm:col-span-2">
              <p className="text-sm text-slate-500">
                Generates a draft payroll run from the active employee roster for {period}.
              </p>
            </div>
            <div>
              <button
                onClick={handleGenerate}
                disabled={running === 'setup' || selectedRun}
                className="rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
              >
                {running === 'setup' ? 'Generating…' : 'Generate Draft Run'}
              </button>
              {selectedRun && (
                <p className="mt-2 text-xs text-emerald-700">
                  Draft run {selectedRun.runNumber} ready → proceed to Review.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {stage === 'review' && selectedRun && (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">2. Review & Exclusion</h2>
          <p className="text-sm text-slate-500 mb-4">
            Review the per-employee lines. Exclude employees who should not be paid this period.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2 text-right">Basic</th>
                  <th className="px-3 py-2 text-right">Gross</th>
                  <th className="px-3 py-2 text-right">Net</th>
                  <th className="px-3 py-2 text-right">Include</th>
                </tr>
              </thead>
              <tbody>
                {(selectedRun.lines || []).map((line: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{line.empCode}</td>
                    <td className="px-3 py-2">{line.name}</td>
                    <td className="px-3 py-2 text-right">{fmt(line.basic)}</td>
                    <td className="px-3 py-2 text-right">{fmt(line.gross)}</td>
                    <td className="px-3 py-2 text-right">{fmt(line.net)}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="rounded border-slate-300"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={prev} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              Back
            </button>
            <button onClick={next} className="rounded bg-crimson-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-crimson-700">
              Validate
            </button>
          </div>
        </section>
      )}

      {stage === 'validate' && (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">3. Validate</h2>
          <p className="text-sm text-slate-500 mb-4">
            Pre-flight checks: roster active, period open, accounts configured.
          </p>
          <div className="mb-4 p-3 rounded bg-slate-50 border border-slate-200">
            <p className="text-sm text-slate-700">
              <strong className="text-slate-900">Run:</strong> {selectedRun?.runNumber || '—'}
              <br />
              <strong className="text-slate-900">Period:</strong> {selectedRun?.period || '—'}
              <br />
              <strong className="text-slate-900">Employees:</strong> {(selectedRun?.lines || []).length}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={prev} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              Back
            </button>
            <button
              onClick={handleValidate}
              disabled={running === 'validate' || !selectedRun}
              className="rounded bg-crimson-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
            >
              {running === 'validate' ? 'Validating…' : 'Run Validation'}
            </button>
          </div>
        </section>
      )}

      {stage === 'calculate' && (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">4. Calculate</h2>
          <p className="text-sm text-slate-500 mb-4">
            Recompute totals from lines and apply employer statutory contributions.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={prev} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              Back
            </button>
            <button
              onClick={handleCalculate}
              disabled={running === 'calculate' || !selectedRun}
              className="rounded bg-crimson-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
            >
              {running === 'calculate' ? 'Calculating…' : 'Calculate Totals'}
            </button>
          </div>
          {selectedRun && (
            <div className="mt-4 p-3 rounded bg-emerald-50 border border-emerald-200">
              <p className="text-sm text-emerald-800">
                Gross: {fmt(selectedRun.grossPay)} &nbsp;|&nbsp;
                Deductions: {fmt(selectedRun.totalDeductions)} &nbsp;|&nbsp;
                Net: {fmt(selectedRun.netPay)}
              </p>
            </div>
          )}
        </section>
      )}

      {stage === 'variance' && selectedRun && (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">5. Review & Variance</h2>
          <p className="text-sm text-slate-500 mb-4">
            Compare against prior period. Flag large variances before release.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="p-3 rounded bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Gross Pay</div>
              <div className="text-lg font-mono text-slate-900">{fmt(selectedRun.grossPay)}</div>
            </div>
            <div className="p-3 rounded bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Net Pay</div>
              <div className="text-lg font-mono text-slate-900">{fmt(selectedRun.netPay)}</div>
            </div>
            <div className="p-3 rounded bg-white border border-slate-200">
              <div className="text-xs text-slate-500">Lines</div>
              <div className="text-lg font-mono text-slate-900">{selectedRun.lines?.length}</div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={prev} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              Back
            </button>
            <button
              onClick={handleRelease}
              disabled={running === 'release' || !selectedRun}
              className="rounded bg-crimson-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
            >
              {running === 'release' ? 'Releasing…' : 'Release for Approval'}
            </button>
          </div>
        </section>
      )}

      {stage === 'release' && selectedRun && (
        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">6. Release & Post</h2>
          <p className="text-sm text-slate-500 mb-4">
            Release the run for approval, then post the journal entry.
          </p>
          <div className="mb-4 p-3 rounded bg-slate-50 border border-slate-200">
            <p className="text-sm text-slate-700">
              <strong className="text-slate-900">Status:</strong> {selectedRun.approvalStatus || 'Draft'}
              <br />
              <strong className="text-slate-900">Net Pay:</strong> {fmt(selectedRun.netPay)}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={prev} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              Back
            </button>
            <button
              onClick={handlePost}
              disabled={running === 'release' || !selectedRun}
              className="rounded bg-crimson-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
            >
              {running === 'release' ? 'Posting…' : 'Post Journal Entry'}
            </button>
          </div>
        </section>
      )}

      {!selectedRun && stage !== 'setup' && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No draft run selected. Go back to Stage 1 and generate one.
        </div>
      )}
    </div>
  )
}
