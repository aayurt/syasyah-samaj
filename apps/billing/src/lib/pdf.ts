import { jsPDF } from 'jspdf'
import type { Document, DocumentLine, Party } from './types'
import { fmt } from './api'

const ORG = 'स्यस्यः धुकू'
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

// --- Generic report export (trial balance, P&L, balance sheet, daybooks) --

/** One tabular section of a report. Amount cells should be numbers; text
 * cells strings. The last column and any numeric cell are right-aligned. */
export interface PdfReportTable {
  title?: string
  columns: string[]
  rows: (string | number | null | undefined)[][]
  /** Bold summary row shown under the table with a rule above it. */
  totals?: (string | number | null | undefined)[]
}

export interface ReportPdfOptions {
  filename: string
  title: string
  subtitle?: string
  meta?: [string, string][]
  tables: PdfReportTable[]
  /** Bold closing lines rendered under all tables (e.g. net profit). */
  foot?: { label: string; value: number }[]
}

/** Renders a report to an A4 PDF: header, meta, tables with page breaks and
 * repeated column headers, and optional closing foot lines. */
export function exportReportPdf(opts: ReportPdfOptions) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const ROW_H = 14
  const MAX_Y = PAGE_H - 56
  let y = 0

  const nextPage = () => {
    pdf.addPage()
    y = 52
  }

  const cell = (v: unknown, x: number, right: boolean) =>
    pdf.text(
      v == null || v === '' ? '' : typeof v === 'number' ? fmt(v) : String(v),
      x,
      y,
      { align: right ? 'right' : 'left' },
    )

  // Header block
  y = 52
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.setTextColor(20)
  pdf.text(ORG, M, y)
  y += 24
  pdf.setFontSize(13)
  pdf.text(opts.title, M, y)
  y += 16
  if (opts.subtitle) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(80)
    pdf.text(opts.subtitle, M, y)
    y += 14
  }
  if (opts.meta && opts.meta.length > 0) {
    pdf.setFontSize(9)
    pdf.setTextColor(110)
    for (const [k, v] of opts.meta) {
      pdf.text(`${k}: ${v}`, M, y)
      y += 11
    }
    y += 4
  }
  pdf.setDrawColor(200)
  pdf.setLineWidth(0.8)
  pdf.line(M, y, PAGE_W - M, y)
  y += 12

  for (const table of opts.tables) {
    const n = table.columns.length
    const w = (PAGE_W - M * 2) / n
    if (table.title) {
      if (y + 18 > MAX_Y) nextPage()
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(20)
      pdf.text(table.title, M, y)
      y += 14
    }
    const headers = () => {
      if (y + 22 > MAX_Y) nextPage()
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.setTextColor(90)
      table.columns.forEach((c, i) => {
        const right = i === n - 1
        pdf.text(c, M + i * w + (right ? w : 0), y, {
          align: right ? 'right' : 'left',
        })
      })
      y += 6
      pdf.setDrawColor(220)
      pdf.setLineWidth(0.5)
      pdf.line(M, y, PAGE_W - M, y)
      y += 8
    }
    headers()
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(40)
    for (const cells of table.rows) {
      if (y + ROW_H > MAX_Y) {
        nextPage()
        headers()
      }
      cells.forEach((v, i) => {
        const right = typeof v === 'number' || i === n - 1
        cell(v, M + i * w + (right ? w : 0), right)
      })
      y += ROW_H
    }
    if (table.totals) {
      if (y + ROW_H > MAX_Y) {
        nextPage()
        headers()
      }
      pdf.setDrawColor(200)
      pdf.setLineWidth(0.6)
      pdf.line(M, y - 4, PAGE_W - M, y - 4)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(20)
      table.totals.forEach((v, i) => {
        const right = typeof v === 'number' || i === n - 1
        cell(v, M + i * w + (right ? w : 0), right)
      })
      y += ROW_H + 10
    }
  }

  if (opts.foot) {
    for (const line of opts.foot) {
      if (y + 20 > MAX_Y) nextPage()
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(20)
      pdf.text(line.label, M, y)
      pdf.text(fmt(line.value), PAGE_W - M, y, { align: 'right' })
      y += 20
    }
  }

  pdf.save(opts.filename)
}

