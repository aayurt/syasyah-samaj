import { useCallback, useEffect, useState } from 'react'
import { Banknote, Plus, Trash2, Users } from 'lucide-react'
import { api, fmt } from '../lib/api'
import { useTenant, useTenantQuery } from '../lib/tenant'
import { todayAD } from '../lib/nepaliDate'
import { pushToast } from '../lib/toast'
import type { Account, Employee, PayrollRun } from '../lib/types'

/**
 * Payroll (MVP payroll run).
 *
 * Runs tab: generate a draft run for a pay period from the active roster,
 * review its per-employee lines, then post it (journal entry) or void it.
 * Employees tab: the roster master with the salary structure
 * (basic + allowances − deductions) that runs compute from.
 */
type Tab = 'runs' | 'employees'

type AllowanceRow = { label: string; amount: string }
type DeductionRow = { label: string; amount: string; accountId: string }

type EmployeeForm = {
  employeeId: string
  name: string
  position: string
  phone: string
  pan: string
  active: boolean
  basicSalary: string
  allowances: AllowanceRow[]
  deductions: DeductionRow[]
}

const emptyForm = (): EmployeeForm => ({
  employeeId: '',
  name: '',
  position: '',
  phone: '',
  pan: '',
  active: true,
  basicSalary: '',
  allowances: [{ label: '', amount: '' }],
  deductions: [{ label: '', amount: '', accountId: '' }],
})

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  posted: 'bg-emerald-100 text-emerald-700',
  void: 'bg-red-100 text-red-600',
}
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  posted: 'Posted',
  void: 'Void',
}

export default function Payroll({ initialTab = 'runs' }: { initialTab?: Tab } = {}) {
  const tenantQuery = useTenantQuery()
  const { tenantId } = useTenant()

  const [tab, setTab] = useState<Tab>(initialTab)
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [linesFor, setLinesFor] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const [runsRes, empsRes, accRes] = await Promise.all([
        api<{ docs: PayrollRun[] }>('/payroll-runs', {
          query: { limit: 200, sort: '-period', depth: 0, ...tenantQuery },
        }),
        api<{ docs: Employee[] }>('/employees', {
          query: { limit: 500, sort: 'employeeId', ...tenantQuery },
        }),
        api<{ docs: Account[] }>('/accounts', {
          query: { limit: 500, sort: 'name', ...tenantQuery },
        }),
      ])
      setRuns(runsRes.docs || [])
      setEmployees(empsRes.docs || [])
      setAccounts(accRes.docs || [])
    } catch {
      /* lists keep their last value; api() already toasted the error */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(tenantQuery)])

  useEffect(() => {
    load()
  }, [load])

  /* ── Generate ───────────────────────────────────────────────── */

  const [period, setPeriod] = useState(() => todayAD().slice(0, 7))
  const [payDate, setPayDate] = useState(() => todayAD())
  const [genError, setGenError] = useState('')
  const [generating, setGenerating] = useState(false)

  const handleGenerate = async () => {
    setGenError('')
    if (!period) {
      setGenError('Period is required (YYYY-MM).')
      return
    }
    setGenerating(true)
    try {
      const res = await api<{ doc: PayrollRun }>('/payroll-runs/generate', {
        method: 'POST',
        // Server-side transaction: never queue — the run must reflect the
        // roster at this moment, and a replay would duplicate the period.
        immediate: true,
        body: {
          period,
          payDate,
          ...(tenantId ? { tenant: tenantId } : {}),
        },
      })
      const doc = res?.doc
      if (doc) {
        setRuns((prev) => [doc, ...prev.filter((r) => r.id !== doc.id)])
        setLinesFor(doc.id)
      }
      pushToast('success', 'Payroll run generated', period)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate run')
    } finally {
      setGenerating(false)
    }
  }

  /* ── Run actions ────────────────────────────────────────────── */

  const runAction = async (id: number, action: 'post' | 'void') => {
    try {
      await api(`/payroll-runs/${id}/${action}`, { method: 'POST', immediate: true })
      await load()
    } catch {
      /* api() toasted */
    }
  }

  const deleteRun = async (id: number) => {
    try {
      await api(`/payroll-runs/${id}`, { method: 'DELETE', immediate: true })
      await load()
    } catch {
      /* api() toasted */
    }
  }

  /* ── Employee form ──────────────────────────────────────────── */

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<EmployeeForm>(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const setField = <K extends keyof EmployeeForm>(key: K, value: EmployeeForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const setRow = <T extends AllowanceRow | DeductionRow>(
    list: T[],
    idx: number,
    patch: Partial<T>,
  ): T[] => list.map((row, i) => (i === idx ? { ...row, ...patch } : row))

  const handleSaveEmployee = async () => {
    if (!form.name.trim()) {
      setFormError('Name is required.')
      return
    }
    setFormError('')
    setSaving(true)
    try {
      await api('/employees', {
        method: 'POST',
        body: {
          employeeId:
            form.employeeId.trim() || `EMP-${Date.now().toString(36).toUpperCase()}`,
          name: form.name.trim(),
          position: form.position.trim(),
          phone: form.phone.trim(),
          pan: form.pan.trim(),
          active: form.active,
          basicSalary: Number(form.basicSalary) || 0,
          allowances: form.allowances
            .filter((a) => a.label.trim() && Number(a.amount))
            .map((a) => ({ label: a.label.trim(), amount: Number(a.amount) })),
          deductions: form.deductions
            .filter((d) => d.label.trim() && Number(d.amount))
            .map((d) => ({
              label: d.label.trim(),
              amount: Number(d.amount),
              ...(d.accountId ? { account: Number(d.accountId) } : {}),
            })),
          ...(tenantId ? { tenant: tenantId } : {}),
        },
      })
      setShowForm(false)
      setForm(emptyForm())
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save employee')
    } finally {
      setSaving(false)
    }
  }

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="p-6 mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <Banknote size={20} className="text-crimson-600" />
          Payroll
        </h1>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          <button
            onClick={() => setTab('runs')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === 'runs' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'
            }`}
          >
            Runs
          </button>
          <button
            onClick={() => setTab('employees')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === 'employees' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'
            }`}
          >
            Employees
          </button>
        </div>
      </div>

      {tab === 'runs' && (
        <section>
          {/* Generate bar */}
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <label htmlFor="payroll-period" className="block text-xs font-medium text-slate-500">
                Period
              </label>
              <input
                id="payroll-period"
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="payroll-paydate" className="block text-xs font-medium text-slate-500">
                Pay date
              </label>
              <input
                id="payroll-paydate"
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 rounded bg-crimson-600 px-3 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
            >
              <Plus size={15} />
              Generate run
            </button>
            {genError && (
              <p role="alert" className="w-full text-sm text-red-600">
                {genError}
              </p>
            )}
          </div>

          {/* Runs table */}
          {runs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No payroll runs yet — pick a period and generate one above.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">Run #</th>
                    <th className="px-3 py-2">Period</th>
                    <th className="px-3 py-2">Pay date</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Gross</th>
                    <th className="px-3 py-2 text-right">Deductions</th>
                    <th className="px-3 py-2 text-right">Net</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <RunRow
                      key={run.id}
                      run={run}
                      expanded={linesFor === run.id}
                      onToggleLines={() =>
                        setLinesFor((cur) => (cur === run.id ? null : run.id))
                      }
                      onPost={() => runAction(run.id, 'post')}
                      onVoid={() => runAction(run.id, 'void')}
                      onDelete={() => deleteRun(run.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'employees' && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-medium text-slate-800">
              <Users size={18} className="text-slate-500" />
              Employee roster
            </h2>
            {!showForm && (
              <button
                onClick={() => {
                  setForm(emptyForm())
                  setFormError('')
                  setShowForm(true)
                }}
                className="flex items-center gap-1.5 rounded bg-crimson-600 px-3 py-2 text-sm font-medium text-white hover:bg-crimson-700"
              >
                <Plus size={15} />
                New employee
              </button>
            )}
          </div>

          {showForm && (
            <form
              data-testid="employee-form"
              onSubmit={(e) => e.preventDefault()}
              className="mb-4 space-y-4 rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block text-sm">
                  <span className="text-xs font-medium text-slate-500">Employee ID</span>
                  <input
                    value={form.employeeId}
                    onChange={(e) => setField('employeeId', e.target.value)}
                    placeholder="EMP-001"
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-medium text-slate-500">Name</span>
                  <input
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-medium text-slate-500">Position</span>
                  <input
                    value={form.position}
                    onChange={(e) => setField('position', e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-medium text-slate-500">Phone</span>
                  <input
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-medium text-slate-500">PAN</span>
                  <input
                    value={form.pan}
                    onChange={(e) => setField('pan', e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-medium text-slate-500">Basic salary</span>
                  <input
                    type="number"
                    min={0}
                    value={form.basicSalary}
                    onChange={(e) => setField('basicSalary', e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setField('active', e.target.checked)}
                />
                Active (included in payroll runs)
              </label>

              {/* Allowances */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-slate-500">
                    Allowances
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        allowances: [...f.allowances, { label: '', amount: '' }],
                      }))
                    }
                    className="text-xs font-medium text-crimson-600 hover:text-crimson-700"
                  >
                    Add allowance
                  </button>
                </div>
                {form.allowances.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      placeholder="Allowance head"
                      value={row.label}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          allowances: setRow(f.allowances, i, { label: e.target.value }),
                        }))
                      }
                      className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      placeholder="Allowance amount"
                      type="number"
                      min={0}
                      value={row.amount}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          allowances: setRow(f.allowances, i, { amount: e.target.value }),
                        }))
                      }
                      className="w-32 rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      aria-label={`Remove allowance ${i + 1}`}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          allowances: f.allowances.filter((_, idx) => idx !== i),
                        }))
                      }
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Deductions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-slate-500">
                    Deductions
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        deductions: [...f.deductions, { label: '', amount: '', accountId: '' }],
                      }))
                    }
                    className="text-xs font-medium text-crimson-600 hover:text-crimson-700"
                  >
                    Add deduction
                  </button>
                </div>
                {form.deductions.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      placeholder="Deduction head"
                      value={row.label}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          deductions: setRow(f.deductions, i, { label: e.target.value }),
                        }))
                      }
                      className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      placeholder="Deduction amount"
                      type="number"
                      min={0}
                      value={row.amount}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          deductions: setRow(f.deductions, i, { amount: e.target.value }),
                        }))
                      }
                      className="w-32 rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <select
                      aria-label={`Deduction account ${i + 1}`}
                      value={row.accountId}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          deductions: setRow(f.deductions, i, { accountId: e.target.value }),
                        }))
                      }
                      className="w-44 rounded border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Accrued payables (default)</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={String(a.id)}>
                          {a.code ? `${a.code} — ` : ''}
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`Remove deduction ${i + 1}`}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          deductions: f.deductions.filter((_, idx) => idx !== i),
                        }))
                      }
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {formError && (
                <p role="alert" className="text-sm text-red-600">
                  {formError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveEmployee}
                  disabled={saving}
                  className="rounded bg-crimson-600 px-4 py-2 text-sm font-medium text-white hover:bg-crimson-700 disabled:opacity-50"
                >
                  Save employee
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setFormError('')
                  }}
                  className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Roster table */}
          {employees.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No employees yet — add your roster to run payroll.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">Employee ID</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Position</th>
                    <th className="px-3 py-2 text-right">Basic</th>
                    <th className="px-3 py-2 text-right">Allowances</th>
                    <th className="px-3 py-2 text-right">Deductions</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const allowanceTotal = (emp.allowances || []).reduce(
                      (s, a) => s + (Number(a.amount) || 0),
                      0,
                    )
                    const deductionTotal = (emp.deductions || []).reduce(
                      (s, d) => s + (Number(d.amount) || 0),
                      0,
                    )
                    return (
                      <tr key={emp.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 font-mono text-xs">{emp.employeeId}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{emp.name}</td>
                        <td className="px-3 py-2 text-slate-600">{emp.position || '—'}</td>
                        <td className="px-3 py-2 text-right">{fmt(emp.basicSalary)}</td>
                        <td className="px-3 py-2 text-right text-emerald-700">
                          +{fmt(allowanceTotal)}
                        </td>
                        <td className="px-3 py-2 text-right text-red-600">
                          −{fmt(deductionTotal)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              emp.active !== false
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {emp.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

/* ── Run row with expandable lines ─────────────────────────────── */

function RunRow({
  run,
  expanded,
  onToggleLines,
  onPost,
  onVoid,
  onDelete,
}: {
  run: PayrollRun
  expanded: boolean
  onToggleLines: () => void
  onPost: () => void
  onVoid: () => void
  onDelete: () => void
}) {
  const lines = run.lines || []
  return (
    <>
      <tr className="border-b border-slate-100">
        <td className="px-3 py-2 font-medium text-slate-800">{run.runNumber}</td>
        <td className="px-3 py-2">{run.period}</td>
        <td className="px-3 py-2">{run.payDate}</td>
        <td className="px-3 py-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              STATUS_STYLES[run.status] || STATUS_STYLES.draft
            }`}
          >
            {STATUS_LABELS[run.status] || run.status}
          </span>
        </td>
        <td className="px-3 py-2 text-right">{fmt(run.grossPay)}</td>
        <td className="px-3 py-2 text-right text-red-600">−{fmt(run.totalDeductions)}</td>
        <td className="px-3 py-2 text-right font-medium">{fmt(run.netPay)}</td>
        <td className="px-3 py-2 text-right">
          <div className="flex justify-end gap-1.5">
            <button
              onClick={onToggleLines}
              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {expanded ? 'Hide lines' : 'View lines'}
            </button>
            {run.status === 'draft' && (
              <>
                <button
                  onClick={onPost}
                  className="rounded bg-crimson-600 px-2 py-1 text-xs font-medium text-white hover:bg-crimson-700"
                >
                  Post
                </button>
                <button
                  onClick={onDelete}
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  Delete
                </button>
              </>
            )}
            {run.status === 'posted' && (
              <button
                onClick={onVoid}
                className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Void
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr data-testid="run-lines">
          <td colSpan={8} className="bg-slate-50 px-3 py-3">
            <div className="rounded border border-slate-200 bg-white">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left uppercase text-slate-400">
                    <th className="px-2 py-1.5">Code</th>
                    <th className="px-2 py-1.5">Employee</th>
                    <th className="px-2 py-1.5 text-right">Basic</th>
                    <th className="px-2 py-1.5 text-right">Allowances</th>
                    <th className="px-2 py-1.5 text-right">Gross</th>
                    <th className="px-2 py-1.5 text-right">Deductions</th>
                    <th className="px-2 py-1.5 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const allowanceTotal = (line.allowances || []).reduce(
                      (s, a) => s + (Number(a.amount) || 0),
                      0,
                    )
                    const deductionTotal = (line.deductions || []).reduce(
                      (s, d) => s + (Number(d.amount) || 0),
                      0,
                    )
                    return (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="px-2 py-1.5 font-mono">{line.empCode}</td>
                        <td className="px-2 py-1.5">{line.name}</td>
                        <td className="px-2 py-1.5 text-right">{fmt(line.basic)}</td>
                        <td className="px-2 py-1.5 text-right text-emerald-700">
                          +{fmt(allowanceTotal)}
                        </td>
                        <td className="px-2 py-1.5 text-right">{fmt(line.gross)}</td>
                        <td className="px-2 py-1.5 text-right text-red-600">
                          −{fmt(deductionTotal)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium">{fmt(line.net)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
