import type { Document, TaxLine, Account } from '../lib/types'
import { DOC_TYPE_LABELS } from '../lib/types'

/* ── Amount in words (Nepali/Indian numbering) ──────────────────── */

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function numToWords(n: number): string {
  if (n === 0) return 'Zero'
  if (n < 0) return 'Minus ' + numToWords(-n)

  const intPart = Math.floor(n)
  const decPart = Math.round((n - intPart) * 100)

  let result = ''
  if (intPart >= 10000000) {
    result += numToWords(Math.floor(intPart / 10000000)) + ' Crore '
    n = intPart % 10000000
  } else { n = intPart }
  if (n >= 100000) {
    result += numToWords(Math.floor(n / 100000)) + ' Lakh '
    n = n % 100000
  }
  if (n >= 1000) {
    result += numToWords(Math.floor(n / 1000)) + ' Thousand '
    n = n % 1000
  }
  if (n >= 100) {
    result += ONES[Math.floor(n / 100)] + ' Hundred '
    n = n % 100
  }
  if (n >= 20) {
    result += TENS[Math.floor(n / 10)] + ' '
    n = n % 10
  }
  if (n > 0) {
    result += ONES[n] + ' '
  }

  result = result.trim()
  if (decPart > 0) {
    result += ' and ' + numToWords(decPart) + ' Paisa'
  }
  return result + ' Only'
}

/* ── Component ─────────────────────────────────────────────────── */

interface Props {
  doc: Document
  accounts: Account[]
  partyName: string
  orgName?: string
  orgAddress?: string
  orgPan?: string
  orgContact?: string
  orgEmail?: string
  orgLogo?: string
}

export default function PrintVoucher({ doc, accounts, partyName, orgName, orgAddress, orgPan, orgContact, orgEmail, orgLogo }: Props) {
  const label = DOC_TYPE_LABELS[doc.docType] || doc.docType
  const additiveTaxLines = (doc.taxLines || []).filter((tl) => tl.nature === 'additive')
  const withholdingTaxLines = (doc.taxLines || []).filter((tl) => tl.nature === 'withholding')
  const totalTax = additiveTaxLines.reduce((s, tl) => s + (tl.amount || 0), 0)
  const totalWithholding = withholdingTaxLines.reduce((s, tl) => s + (tl.amount || 0), 0)
  const netTotal = doc.netTotal || doc.grossTotal || 0
  const grandTotal = doc.grossTotal || 0
  const amountInWords = numToWords(grandTotal)

  return (
    <div className="print-voucher">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-voucher, .print-voucher * { visibility: visible; }
          .print-voucher {
            position: absolute;
            left: 0; top: 0;
            width: 100%;
            padding: 20mm;
            font-size: 12px;
            color: #000;
            background: #fff;
          }
          .print-voucher .no-print { display: none !important; }
          .print-voucher table { page-break-inside: avoid; }
          .print-voucher .print-border { border: 1px solid #000; }
        }
        @page { margin: 15mm; size: A4; }
      `}</style>

      {/* Close button (hidden in print) */}
      <button
        onClick={() => window.print()}
        className="no-print mb-4 rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
      >
        🖨️ Print Voucher
      </button>

      {/* ── Company Header ─────────────────────────────────── */}
      <div className="print-border rounded-t-lg border-b-0 p-4 text-center">
        {orgLogo && (
          <img
            src={orgLogo}
            alt="Company logo"
            className="mx-auto mb-2 h-12 w-auto object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {orgName || 'Syasha धुकू'}
        </h1>
        {orgAddress && (
          <p className="mt-0.5 text-xs text-slate-500">{orgAddress}</p>
        )}
        <div className="mt-1 flex items-center justify-center gap-4 text-[10px] text-slate-400">
          {orgPan && <span>PAN: {orgPan}</span>}
          {orgContact && <span>Tel: {orgContact}</span>}
          {orgEmail && <span>{orgEmail}</span>}
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-400">
          Tax Invoice / Voucher
        </p>
      </div>

      {/* ── Voucher Info ───────────────────────────────────── */}
      <div className="print-border border-t-0 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">{label}</h2>
            <div className="mt-1 space-y-0.5 text-xs text-slate-600">
              <div><span className="font-medium">Number:</span> {doc.number || '— draft —'}</div>
              <div><span className="font-medium">Date:</span> {doc.date}</div>
            </div>
          </div>
          <div className="text-right">
            <div className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
              doc.status === 'posted' ? 'bg-emerald-100 text-emerald-700' :
              doc.status === 'void' ? 'bg-red-100 text-red-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {doc.status?.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Party info */}
        {partyName && partyName !== '—' && (
          <div className="mt-3 border-t border-dashed border-slate-300 pt-2">
            <div className="text-xs text-slate-500">
              {['sales-invoice', 'receipt-voucher', 'credit-note'].includes(doc.docType) ? 'Bill To' : 'Pay To'}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-slate-800">{partyName}</div>
          </div>
        )}
      </div>

      {/* ── Items Table ────────────────────────────────────── */}
      {doc.lines && doc.lines.length > 0 && (
        <div className="print-border border-t-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50 text-left uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Description</th>
                <th className="w-14 px-3 py-2 text-right">Qty</th>
                <th className="w-20 px-3 py-2 text-right">Rate</th>
                <th className="w-24 px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, i) => (
                <tr key={l.id || i} className="border-b border-slate-200">
                  <td className="px-3 py-1.5 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-1.5 text-slate-800">
                    {l.item && typeof l.item === 'object' ? l.item.name : l.description || '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">{l.qty ?? '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{l.rate != null ? `Rs. ${l.rate.toLocaleString()}` : '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-medium">Rs. {(l.amount || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Journal Lines (for journal-voucher) ────────────── */}
      {doc.journalLines && doc.journalLines.length > 0 && (
        <div className="print-border border-t-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50 text-left uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Account</th>
                <th className="w-24 px-3 py-2 text-right">Debit</th>
                <th className="w-24 px-3 py-2 text-right">Credit</th>
                <th className="px-3 py-2">Memo</th>
              </tr>
            </thead>
            <tbody>
              {doc.journalLines.map((l, i) => {
                const accId = l.account && typeof l.account === 'object' ? (l.account as { id: unknown }).id : l.account
                const a = accounts.find((x) => x.id === Number(accId))
                return (
                  <tr key={l.id || i} className="border-b border-slate-200">
                    <td className="px-3 py-1.5 text-slate-800">
                      {a ? `${a.code ? a.code + ' · ' : ''}${a.name}` : `#${accId}`}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{l.debit ? `Rs. ${l.debit.toLocaleString()}` : ''}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{l.credit ? `Rs. ${l.credit.toLocaleString()}` : ''}</td>
                    <td className="px-3 py-1.5 text-slate-500">{l.memo || ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Contra fields ──────────────────────────────────── */}
      {doc.docType === 'contra' && (
        <div className="print-border border-t-0 p-3 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-slate-500">From Account:</span>{' '}
              <span className="font-medium text-slate-800">
                {accounts.find((a) => a.id === Number(doc.fromAccount))?.name || `#${doc.fromAccount}`}
              </span>
            </div>
            <div>
              <span className="text-slate-500">To Account:</span>{' '}
              <span className="font-medium text-slate-800">
                {accounts.find((a) => a.id === Number(doc.toAccount))?.name || `#${doc.toAccount}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tax Breakdown + Totals ─────────────────────────── */}
      <div className="print-border border-t-0 p-4">
        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Sub Total</span>
              <span className="font-mono">Rs. {netTotal.toLocaleString()}</span>
            </div>
            {additiveTaxLines.map((tl, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-slate-500">Tax ({tl.rate}%)</span>
                <span className="font-mono">Rs. {(tl.amount || 0).toLocaleString()}</span>
              </div>
            ))}
            {totalWithholding > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>TDS Withheld</span>
                <span className="font-mono">(Rs. {totalWithholding.toLocaleString()})</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-300 pt-1 font-bold text-slate-900">
              <span>Total Amount</span>
              <span className="font-mono">Rs. {grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Amount in words */}
        <div className="mt-3 border-t border-dashed border-slate-300 pt-2 text-xs">
          <span className="font-medium text-slate-600">Amount in Words: </span>
          <span className="italic text-slate-800">{amountInWords}</span>
        </div>

        {/* Narration */}
        {doc.narration && (
          <div className="mt-2 text-xs">
            <span className="font-medium text-slate-600">Remarks: </span>
            <span className="text-slate-700">{doc.narration}</span>
          </div>
        )}
      </div>

      {/* ── Signature Lines ────────────────────────────────── */}
      <div className="print-border border-t-0 rounded-b-lg p-4">
        <div className="flex justify-between pt-8 text-xs text-slate-500">
          <div className="text-center">
            <div className="w-32 border-t border-slate-400 pt-1">Prepared By</div>
          </div>
          <div className="text-center">
            <div className="w-32 border-t border-slate-400 pt-1">Approved By</div>
          </div>
          <div className="text-center">
            <div className="w-32 border-t border-slate-400 pt-1">Received By</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-2 text-center text-[9px] text-slate-400">
        Generated by {orgName || 'Syasha धुकू'} · {new Date().toLocaleString()}
      </div>
    </div>
  )
}
