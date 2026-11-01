import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, Download } from 'lucide-react'
import { api, fmt } from '../lib/api'
import { useTenantQuery } from '../lib/tenant'
import { pushToast } from '../lib/toast'
import type { PayrollRun, PayrollSettings, PayrollStatutorySnapshot } from '../lib/types'

/**
 * Statutory Registers — the india-payroll register reports
 * (EPF, ESIC, Professional Tax, LWF).
 *
 * Every column comes from the per-line `statutory` snapshot stored on runs
 * at generate time, so registers always reproduce what was actually
 * deducted — the same invariant frappe's register reports hold (they read
 * submitted salary slips, never recompute).
 *
 * Registration numbers (PF account, ESIC number) print in the header;
 * each register exports as CSV.
 */

type RegisterKind = 'pf' | 'esic' | 'pt' | 'lwf'

const REGISTER_LABELS: Record<RegisterKind, string> = {
  pf: 'PF Register',
  esic: 'ESIC Register',
  pt: 'Professional Tax Register',
  lwf: 'LWF Register',
}

interface RegisterRow {
  empCode: string
  name: string
  cells: Array<string | number>
  totals: number[]
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

function buildRows(run: PayrollRun, kind: RegisterKind): RegisterRow[] {
  const rows: RegisterRow[] = []
  for (const line of run.lines || []) {
    const s: PayrollStatutorySnapshot = line.statutory || {}
    if (kind === 'pf') {
      if (!s.epf && s.pfWage == null) continue
      const epf = s.epf || { cappedWage: 0, employee: 0, eps: 0, employerEpf: 0, edli: 0, admin: 0 }
      const total = round2(epf.employee + epf.eps + epf.employerEpf + epf.edli + epf.admin)
      rows.push({
        empCode: line.empCode || '',
        name: line.name,
        cells: [
          line.empCode || '',
          line.name,
          s.pfWage ?? 0,
          epf.employee,
          epf.eps,
          epf.employerEpf,
          epf.edli,
          epf.admin,
          total,
        ],
        totals: [s.pfWage ?? 0, epf.employee, epf.eps, epf.employerEpf, epf.edli, epf.admin, total],
      })
    } else if (kind === 'esic') {
      if (!s.esi) continue
      const total = round2(s.esi.employee + s.esi.employer)
      rows.push({
        empCode: line.empCode || '',
        name: line.name,
        cells: [line.empCode || '', line.name, s.esiWage ?? 0, s.esi.employee, s.esi.employer, total],
        totals: [s.esiWage ?? 0, s.esi.employee, s.esi.employer, total],
      })
    } else if (kind === 'pt') {
      if (s.pt == null) continue
      rows.push({
        empCode: line.empCode || '',
        name: line.name,
        cells: [line.empCode || '', line.name, s.pt],
        totals: [s.pt],
      })
    } else if (kind === 'lwf') {
      if (!s.lwf) continue
      const total = round2(s.lwf.employee + s.lwf.employer)
      rows.push({
        empCode: line.empCode || '',
        name: line.name,
        cells: [line.empCode || '', line.name, s.lwf.employee, s.lwf.employer, total],
        totals: [s.lwf.employee, s.lwf.employer, total],
      })
    }
  }
  return rows
}

const HEADERS: Record<RegisterKind, string[]> = {
  pf: ['Employee', 'Name', 'PF wage', 'Employee 12%', 'EPS 8.33%', 'Employer EPF', 'EDLI 0.5%', 'Admin 0.5%', 'Total'],
  esic: ['Employee', 'Name', 'ESI wage', 'Employee 0.75%', 'Employer 3.25%', 'Total'],
  pt: ['Employee', 'Name', 'PT deducted'],
  lwf: ['Employee', 'Name', 'Employee', 'Employer', 'Total'],
}

/** CSV export of the visible register (headers + rows + totals). */
function exportCsv(
  kind: RegisterKind,
  run: PayrollRun,
  rows: RegisterRow[],
  totals: number[],
) {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines: string[] = [HEADERS[kind].map(esc).join(',')]
  for (const r of rows) lines.push(r.cells.map(esc).join(','))
  lines.push(['', 'TOTAL', ...totals.map((t) => String(round2(t)))].map(esc).join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${kind}-register-${run.period}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function PayrollRegisters() {
  const tenantQuery = useTenantQuery()
  const [kind, setKind] = useState<RegisterKind>('pf')
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [settings, setSettings] = useState<PayrollSettings>({})
  const [selected, setSelected] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [runsRes, settingsRes] = await Promise.all([
        api<{ docs: PayrollRun[] }>('/payroll-runs', {
          query: { limit: 100, sort: '-period', depth: 0, ...tenantQuery },
        }),
        api<PayrollSettings>('/globals/payroll-settings', { query: { depth: 0 } }),
      ])
      const docs = (runsRes.docs || []).filter((r) => r.status !== 'void')
      setRuns(docs)
      setSettings(settingsRes || {})
      setSelected((prev) =>
        prev != null && docs.some((r) => r.id === prev)
          ? prev
          : (docs[0]?.id ?? null),
      )
    } catch {
      /* api() already toasted */
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(tenantQuery)])

  useEffect(() => {
    load()
  }, [load])

  const run = useMemo(
    () => runs.find((r) => r.id === selected) || null,
    [runs, selected],
  )
  const rows = useMemo(() => (run ? buildRows(run, kind) : []), [run, kind])
  const totals = useMemo(() => {
    if (rows.length === 0) return []
    const out = rows[0].totals.map(() => 0)
    for (const r of rows) r.totals.forEach((v, i) => (out[i] = round2(out[i] + v)))
    return out
  }, [rows])

  const regNumber =
    kind === 'pf' ? settings.pfNumber : kind === 'esic' ? settings.esiNumber : settings.lwfNumber

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading registers…</div>
  }

  return (
    <div className="p-6 mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
          <ClipboardList size={20} className="text-crimson-600" />
          Statutory Registers
        </h1>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {(Object.keys(REGISTER_LABELS) as RegisterKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                kind === k ? 'bg-white text-slate-900 shadow' : 'text-slate-600'
              }`}
            >
              {REGISTER_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Period picker + export */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="block text-sm">
          <span className="text-xs font-medium text-slate-500">Pay period</span>
          <select
            value={selected ?? ''}
            onChange={(e) => setSelected(Number(e.target.value))}
            className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            {runs.length === 0 && <option value="">— no runs —</option>}
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.period} · {r.runNumber} ({r.status})
              </option>
            ))}
          </select>
        </label>
        <div className="text-right text-xs text-slate-500">
          {regNumber && (
            <div>
              Reg. no.: <span className="font-mono text-slate-700">{regNumber}</span>
            </div>
          )}
          <button
            disabled={!run || rows.length === 0}
            onClick={() => {
              if (!run) return
              try {
                exportCsv(kind, run, rows, totals)
              } catch (err) {
                pushToast(
                  'error',
                  'Export failed',
                  err instanceof Error ? err.message : 'CSV export failed',
                )
              }
            }}
            className="mt-1 inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Register table */}
      {!run ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No payroll runs yet — generate a run first, then its statutory
          registers appear here.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No {REGISTER_LABELS[kind]} rows for {run.period} — the scheme was
          probably not enabled when this run was generated.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                {HEADERS[kind].map((h) => (
                  <th key={h} className={`px-3 py-2 font-semibold ${h === 'Name' || h === 'Employee' ? '' : 'text-right'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  {r.cells.map((c, j) => (
                    <td
                      key={j}
                      className={`px-3 py-2 ${
                        typeof c === 'number'
                          ? 'text-right font-mono tabular-nums'
                          : 'text-slate-700'
                      }`}
                    >
                      {typeof c === 'number' ? fmt(c) : c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 text-sm font-semibold">
                <td className="px-3 py-2" colSpan={2}>
                  TOTAL ({rows.length} employee{rows.length === 1 ? '' : 's'})
                </td>
                {totals.map((t, i) => (
                  <td key={i} className="px-3 py-2 text-right font-mono tabular-nums">
                    {fmt(t)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
