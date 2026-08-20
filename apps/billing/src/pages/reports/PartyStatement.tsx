import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, FileText, Printer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, fmt, list } from '../../lib/api'
import { downloadCsv } from '../../lib/csv'
import { exportReportPdf } from '../../lib/pdf'
import { useCalendar } from '../../lib/calendar'
import { useTenant, useTenantQuery } from '../../lib/tenant'
import { ReportSkeleton } from '../../components/Skeleton'
import DataStatus from '../../components/DataStatus'
import SearchBox from '../../components/SearchBox'
import { DOC_TYPE_LABELS, type Document, type Party } from '../../lib/types'

interface PartyDoc extends Document {
  partyName?: string
}

export default function PartyStatement() {
  const navigate = useNavigate()
  const { tenantId } = useTenant()
  const tenantQuery = useTenantQuery()
  const { formatDate } = useCalendar()
  const [parties, setParties] = useState<Party[]>([])
  const [selectedParty, setSelectedParty] = useState('')
  const [docs, setDocs] = useState<PartyDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const loadParties = useCallback(async () => {
    try {
      const p = await list<Party>('parties', { depth: 0, sort: 'name', ...tenantQuery })
      setParties(p.docs)
    } catch { /* ignore */ }
  }, [tenantId])

  useEffect(() => { loadParties() }, [loadParties])

  const loadDocs = useCallback(async () => {
    if (!selectedParty) { setDocs([]); return }
    setLoading(true); setError('')
    try {
      const res = await list<Document>('documents', {
        depth: 1, sort: 'date', ...tenantQuery,
        where: JSON.stringify({ party: { equals: Number(selectedParty) } }),
      })
      setDocs(res.docs.map((d) => ({ ...d, partyName: parties.find((p) => p.id === d.party)?.name || '' })))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load party statement')
    } finally { setLoading(false) }
  }, [selectedParty, tenantId])

  useEffect(() => { loadDocs() }, [loadDocs])

  const running = useMemo(() => {
    let bal = 0
    return docs.map((d) => {
      // For sales: debit the customer (positive = they owe us)
      // For purchase: credit the vendor (positive = we owe them)
      const amt = Number(d.grossTotal) || 0
      if (d.docType === 'sales-invoice' || d.docType === 'receipt-voucher') bal += amt
      else if (d.docType === 'purchase-invoice' || d.docType === 'payment-voucher') bal -= amt
      else if (d.docType === 'credit-note') bal -= amt
      else if (d.docType === 'debit-note') bal += amt
      return { ...d, runningBalance: bal }
    })
  }, [docs])

  const filtered = useMemo(() =>
    running.filter((d) => {
      if (!query) return true
      return `${d.number || ''} ${d.narration || ''} ${DOC_TYPE_LABELS[d.docType] || d.docType}`.toLowerCase().includes(query.toLowerCase())
    }), [running, query])

  const party = parties.find((p) => String(p.id) === selectedParty)
  const totalDebit = docs.filter((d) => ['sales-invoice', 'debit-note'].includes(d.docType)).reduce((s, d) => s + (Number(d.grossTotal) || 0), 0)
  const totalCredit = docs.filter((d) => ['purchase-invoice', 'credit-note', 'receipt-voucher', 'payment-voucher'].includes(d.docType)).reduce((s, d) => s + (Number(d.grossTotal) || 0), 0)

  const csv = () => downloadCsv(`${party?.name || 'party'}-statement.csv`,
    ['Date', 'Type', 'Number', 'Narration', 'Amount', 'Running Balance'],
    filtered.map((d) => [formatDate(d.date), DOC_TYPE_LABELS[d.docType] || d.docType, d.number || '', d.narration || '', d.grossTotal || 0, d.runningBalance]))

  const pdf = () => exportReportPdf({
    filename: `${party?.name || 'party'}-statement.pdf`, title: `Party Statement — ${party?.name || ''}`,
    meta: [['Total Debit', fmt(totalDebit)], ['Total Credit', fmt(totalCredit)], ['Balance', fmt(running[running.length - 1]?.runningBalance || 0)]],
    tables: [{ columns: ['Date', 'Type', 'Number', 'Narration', 'Amount', 'Balance'],
      rows: filtered.map((d) => [formatDate(d.date), DOC_TYPE_LABELS[d.docType] || d.docType, d.number || '', d.narration || '', Number(d.grossTotal) || 0, d.runningBalance]) }],
  })

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-semibold text-slate-900">Party Statement</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={csv} disabled={!selectedParty} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Download size={14} /> CSV</button>
          <button onClick={pdf} disabled={!selectedParty} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><FileText size={14} /> PDF</button>
          <button onClick={() => window.print()} disabled={!selectedParty} className="flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Printer size={14} /> Print</button>
        </div>
      </div>
      <div className="mt-2"><DataStatus /></div>

      <div className="mt-4 flex items-center gap-3">
        <label className="text-sm text-slate-700">
          Party
          <select value={selectedParty} onChange={(e) => setSelectedParty(e.target.value)}
            className="ml-2 rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500">
            <option value="">— select party —</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
          </select>
        </label>
        {selectedParty && <SearchBox value={query} onChange={setQuery} placeholder="Filter transactions…" />}
      </div>

      {error && <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? <ReportSkeleton sections={1} /> : selectedParty && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Total Debit</div>
              <div className="mt-1 font-mono text-lg font-semibold text-amber-700">{fmt(totalDebit)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Total Credit</div>
              <div className="mt-1 font-mono text-lg font-semibold text-amber-700">{fmt(totalCredit)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Balance</div>
              <div className={`mt-1 font-mono text-lg font-semibold ${(running[running.length - 1]?.runningBalance || 0) >= 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                {fmt(running[running.length - 1]?.runningBalance || 0)}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Number</th>
                  <th className="px-4 py-2">Narration</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-right">Running</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No transactions for this party.</td></tr>
                )}
                {filtered.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50">
                    <td className="px-4 py-2 text-slate-600">{formatDate(d.date)}</td>
                    <td className="px-4 py-2 text-slate-600">{DOC_TYPE_LABELS[d.docType] || d.docType}</td>
                    <td className="px-4 py-2 font-mono text-slate-700">{d.number || '—'}</td>
                    <td className="px-4 py-2 text-slate-800">{d.narration || '—'}</td>
                    <td className="px-4 py-2 text-right font-mono text-slate-800">{fmt(Number(d.grossTotal) || 0)}</td>
                    <td className="px-4 py-2 text-right font-mono font-medium text-slate-800">{fmt(d.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!selectedParty && !loading && (
        <p className="mt-8 text-center text-sm text-slate-400">Select a party to view its transaction statement.</p>
      )}
    </div>
  )
}
