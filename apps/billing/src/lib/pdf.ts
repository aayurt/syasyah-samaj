import { jsPDF } from 'jspdf'
import type { Document, DocumentLine, Party } from './types'
import { fmt } from './api'

const ORG = 'Syasya Accounting'
const M = 48 // left/right margin (pt)
const PAGE_H = 842 // A4 height (pt)
const PAGE_W = 595 // A4 width (pt)

/**
 * Renders a posted sales invoice to an A4 PDF (Billable-style invoice layout).
 */
export function exportInvoicePdf(doc: Document, party?: Party) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = 52

  // Header: org name left, INVOICE right
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.setTextColor(20)
  pdf.text(ORG, M, y)
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text('INVOICE', PAGE_W - M, y, { align: 'right' })
  y += 14
  pdf.setFontSize(9)
  pdf.setTextColor(110)
  pdf.text(`Invoice #: ${doc.number || '—'}`, PAGE_W - M, y, { align: 'right' })
  y += 12
  pdf.text(
    `Date: ${(doc.date || '').slice(0, 10) || '—'}`,
    PAGE_W - M,
    y,
    { align: 'right' },
  )

  // Bill to
  y += 30
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(120)
  pdf.text('BILL TO', M, y)
  y += 15
  pdf.setFontSize(11)
  pdf.setTextColor(25)
  pdf.text(party?.name || '—', M, y)
  if (party?.address) {
    y += 14
    pdf.setFontSize(9)
    pdf.setTextColor(90)
    const lines = pdf.splitTextToSize(party.address, 240)
    for (const line of lines) {
      pdf.text(line, M, y)
      y += 12
    }
  }
  if (party?.taxId) {
    y += 12
    pdf.setFontSize(9)
    pdf.setTextColor(90)
    pdf.text(`Tax ID: ${party.taxId}`, M, y)
  }

  // Line-items table
  const colX = { no: M, desc: M + 34, qty: 330, rate: 400, amount: 500 }
  y += 30
  pdf.setFillColor(241, 245, 249)
  pdf.rect(M, y - 11, PAGE_W - M * 2, 18, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(90)
  pdf.text('#', colX.no, y)
  pdf.text('Description', colX.desc, y)
  pdf.text('Qty', colX.qty, y, { align: 'right' })
  pdf.text('Rate', colX.rate, y, { align: 'right' })
  pdf.text('Amount', colX.amount, y, { align: 'right' })
  y += 18

  const lines: DocumentLine[] = doc.lines || []
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(35)
  lines.forEach((line, i) => {
    if (y > PAGE_H - 120) {
      pdf.addPage()
      y = 52
    }
    pdf.text(String(i + 1), colX.no, y)
    const desc = pdf.splitTextToSize(
      line.description || '—',
      colX.qty - colX.desc - 16,
    )
    pdf.text(desc, colX.desc, y)
    y += 12 * Math.max(1, desc.length)
    if (line.qty !== undefined && line.qty !== null && line.qty !== 0) {
      pdf.text(String(line.qty), colX.qty, y - 12 * (desc.length - 1), {
        align: 'right',
      })
    }
    if (line.rate !== undefined && line.rate !== null && line.rate !== 0) {
      pdf.text(fmt(Number(line.rate)), colX.rate, y - 12 * (desc.length - 1), {
        align: 'right',
      })
    }
    pdf.text(fmt(Number(line.amount) || 0), colX.amount, y - 12 * (desc.length - 1), {
      align: 'right',
    })
    y += 8
  })

  // Totals
  y += 14
  const row = (label: string, value: number, bold = false) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(bold ? 11 : 9)
    pdf.setTextColor(bold ? 20 : 80)
    pdf.text(label, colX.rate - 60, y, { align: 'right' })
    pdf.text(fmt(value), colX.amount, y, { align: 'right' })
    y += bold ? 18 : 14
  }
  row('Net total', Number(doc.netTotal) || 0)
  if (Number(doc.taxTotal) > 0) {
    row(
      `Tax (${Number(doc.taxRate) || 0}%)`,
      Number(doc.taxTotal) || 0,
    )
  }
  row('Total', Number(doc.grossTotal) || 0, true)

  // Footer note
  if (doc.narration) {
    y += 8
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(8)
    pdf.setTextColor(120)
    pdf.text(`Note: ${doc.narration}`, M, y)
  }

  pdf.save(`${doc.number || `invoice-${doc.id}`}.pdf`)
}
