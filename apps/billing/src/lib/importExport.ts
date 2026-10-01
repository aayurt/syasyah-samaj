/* ─────────────────────────────────────────────────────────────
   Import / Export helpers for the Billing SPA
   ───────────────────────────────────────────────────────────── */

import { api } from './api'
import ExcelJS from 'exceljs'

/* ── Export ───────────────────────────────────────────────── */

/** Fetch all docs for a collection (handles pagination). */
export async function fetchAllDocs<T>(
  slug: string,
  tenantQuery: Record<string, unknown> = {},
  limit = 500,
): Promise<T[]> {
  const all: T[] = []
  let page = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await api<{ docs: T[] }>(`/${slug}`, {
      query: { limit, page, depth: 0, ...tenantQuery },
    })
    all.push(...(res.docs || []))
    if (!res.docs || res.docs.length < limit) break
    page++
  }
  return all
}

/** Convert an array of objects to a CSV Blob with UTF-8 BOM for Excel compatibility. */
export function buildExportCsv<T extends Record<string, unknown>>(
  docs: T[],
  columns?: string[],
): Blob {
  if (docs.length === 0) {
    return new Blob(['\uFEFF'], { type: 'text/csv;charset=utf-8;' })
  }

  // Determine headers
  const headers = columns && columns.length > 0
    ? columns
    : Array.from(
        new Set(
          docs.flatMap((d) =>
            Object.keys(d).filter(
              (k) =>
                typeof d[k] !== 'object' ||
                d[k] === null ||
                (typeof d[k] === 'object' && !Array.isArray(d[k])),
            ),
          ),
        ),
      )

  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    if (typeof val === 'object') {
      const o = val as Record<string, unknown>
      val = o.name || o.title || o.fullName || o.id || JSON.stringify(o)
    }
    const str = String(val)
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const lines: string[] = []
  lines.push(headers.map(escapeCell).join(','))

  for (const doc of docs) {
    const row = headers.map((h) => escapeCell(doc[h]))
    lines.push(row.join(','))
  }

  // Prepend \uFEFF BOM for Excel Devanagari/UTF-8 support
  return new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
}

/** Build a JSON export blob with metadata header. */
export function buildExportJson<T>(
  collection: string,
  docs: T[],
  tenantName?: string,
): Blob {
  const payload = {
    _export: {
      collection,
      tenant: tenantName || null,
      exportedAt: new Date().toISOString(),
      count: docs.length,
      version: 1,
    },
    docs,
  }
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/* ── Excel Export ──────────────────────────────────────────── */

export interface ExcelExportColumn {
  key: string
  header: string
  width?: number
}

export interface ExcelExportOptions {
  sheetName?: string
  columns?: ExcelExportColumn[]
  tenantName?: string
  meta?: Record<string, unknown>
}

/** Convert an array of objects to an Excel (.xlsx) Blob with metadata sheet. */
export async function buildExportExcel<T extends Record<string, unknown>>(
  collection: string,
  docs: T[],
  options: ExcelExportOptions = {},
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Syasyah Samaj'
  workbook.created = new Date()
  workbook.modified = new Date()

  const sheetName = options.sheetName || collection
  const dataSheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  // Determine columns
  let columns: ExcelExportColumn[]
  if (options.columns && options.columns.length > 0) {
    columns = options.columns
  } else if (docs.length > 0) {
    columns = Object.keys(docs[0]).map((key) => ({ key, header: key }))
  } else {
    columns = []
  }

  // Set up headers
  dataSheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.max(c.header.length, 15),
  }))

  // Style header row
  dataSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  dataSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBE1A1A' }, // crimson-700
  }
  dataSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

  // Add data rows
  for (const doc of docs) {
    const row: Record<string, unknown> = {}
    for (const col of columns) {
      const val = doc[col.key]
      if (val === null || val === undefined) {
        row[col.key] = ''
      } else if (typeof val === 'object' && !Array.isArray(val)) {
        const o = val as Record<string, unknown>
        row[col.key] = o.name || o.title || o.fullName || o.id || JSON.stringify(o)
      } else {
        row[col.key] = val
      }
    }
    dataSheet.addRow(row)
  }

  // Auto-filter
  if (columns.length > 0) {
    dataSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: docs.length + 1, column: columns.length },
    }
  }

  // Meta sheet
  const metaSheet = workbook.addWorksheet('_Meta')
  metaSheet.columns = [
    { header: 'Property', key: 'property', width: 25 },
    { header: 'Value', key: 'value', width: 60 },
  ]
  metaSheet.getRow(1).font = { bold: true }
  metaSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBE1A1A' },
  }

  const metaData = [
    { property: 'Collection', value: collection },
    { property: 'Tenant', value: options.tenantName || 'default' },
    { property: 'Exported At', value: new Date().toISOString() },
    { property: 'Record Count', value: docs.length },
    { property: 'Version', value: 1 },
    ...Object.entries(options.meta || {}).map(([k, v]) => ({ property: k, value: String(v) })),
  ]
  metaSheet.addRows(metaData)

  // Write to buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/* ── Excel Import ──────────────────────────────────────────── */

/** Parse an Excel (.xlsx) file into ParsedImport structure. */
export async function parseExcelFile<T>(file: File): Promise<ParsedImport<T>> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)

  // Find the data sheet (first non-meta sheet)
  let dataSheet: ExcelJS.Worksheet | undefined
  for (const sheet of workbook.worksheets) {
    if (sheet.name !== '_Meta') {
      dataSheet = sheet
      break
    }
  }

  if (!dataSheet) {
    throw new Error('No data sheet found in Excel file')
  }

  // Read meta sheet if present
  let meta: ParsedImport<T>['meta'] = { count: 0, format: 'excel' }
  const metaSheet = workbook.getWorksheet('_Meta')
  if (metaSheet) {
    const metaObj: Record<string, unknown> = {}
    metaSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const prop = row.getCell(1).value as string
        const val = row.getCell(2).value
        if (prop) metaObj[prop] = val
      }
    })
    meta = {
      tenant: metaObj['Tenant'] as string | undefined,
      exportedAt: metaObj['Exported At'] as string | undefined,
      count: (metaObj['Record Count'] as number) || undefined,
      format: 'excel',
    }
  }

  // Get headers from first row
  const headerRow = dataSheet.getRow(1)
  const headers: string[] = []
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value || `Column ${colNumber}`)
  })

  // Normalize headers (same logic as CSV)
  const normalizedHeaders = headers.map((h) => {
    const clean = h.trim()
    const lower = clean.toLowerCase()
    if (lower === 'name' || lower === 'fullname' || lower === 'full name' || clean.includes('नाम')) return 'fullName'
    if (lower === 'phone' || lower === 'mobile' || lower === 'contact' || clean.includes('फोन') || clean.includes('सम्पर्क')) return 'phone'
    if (lower === 'email' || clean.includes('इमेल')) return 'email'
    if (lower === 'address' || lower === 'locality' || clean.includes('ठेगाना') || clean.includes('टोल')) return 'address'
    if (lower === 'ward' || clean.includes('वडा')) return 'ward'
    if (lower === 'blood' || lower === 'bloodgroup' || lower === 'blood group' || clean.includes('रक्त')) return 'bloodGroup'
    if (lower === 'code' || clean.includes('कोड')) return 'code'
    if (lower === 'balance' || lower === 'opening' || clean.includes('रकम') || clean.includes('मौज्दात')) return 'balance'
    return clean
  })

  // Read data rows
  const results: T[] = []
  dataSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // skip header
    const doc: Record<string, unknown> = {}
    let hasData = false
    row.eachCell((cell, colNumber) => {
      const field = normalizedHeaders[colNumber - 1]
      if (field) {
        let val: unknown = cell.value
        // Handle ExcelJS rich text, dates, formulas
        if (val && typeof val === 'object' && 'richText' in val) {
          val = (val as ExcelJS.CellRichTextValue).richText.map((rt) => rt.text).join('')
        } else if (val instanceof Date) {
          val = val.toISOString()
        } else if (typeof val === 'object' && val !== null && 'result' in val) {
          // Formula result
          val = (val as { result: unknown }).result
        }
        doc[field] = val ?? ''
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          hasData = true
        }
      }
    })
    if (hasData) {
      results.push(doc as T)
    }
  })

  return {
    collection: (meta as any).collection || guessCollection(file.name),
    docs: results,
    meta: { ...meta, count: results.length },
  }
}

/* ── Import: Parse ────────────────────────────────────────── */

export type ParsedImport<T> = {
  collection: string
  docs: T[]
  meta: { tenant?: string; exportedAt?: string; count?: number; format?: 'json' | 'csv' | 'excel' }
}

/** Robust RFC-4180 compliant CSV parser with quote unescaping. */
export function parseCsvText(text: string): Record<string, unknown>[] {
  // Strip UTF-8 BOM if present
  const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
  const lines: string[][] = []
  let currentRow: string[] = []
  let currentVal = ''
  let inQuotes = false

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i]
    const nextChar = cleanText[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentVal += '"'
        i++ // skip escaped quote
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentVal += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        currentRow.push(currentVal.trim())
        currentVal = ''
      } else if (char === '\r') {
        // Skip carriage return if followed by newline
        if (nextChar === '\n') {
          i++
        }
        currentRow.push(currentVal.trim())
        lines.push(currentRow)
        currentRow = []
        currentVal = ''
      } else if (char === '\n') {
        currentRow.push(currentVal.trim())
        lines.push(currentRow)
        currentRow = []
        currentVal = ''
      } else {
        currentVal += char
      }
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim())
    lines.push(currentRow)
  }

  // Filter empty lines
  const nonEmptyLines = lines.filter((row) => row.some((c) => c.length > 0))
  if (nonEmptyLines.length < 2) return []

  const rawHeaders = nonEmptyLines[0]
  // Normalize headers (camelCase and strip quotes/spaces)
  const headers = rawHeaders.map((h) => {
    const clean = h.trim()
    // Map common human/Nepali headers to field names
    const lower = clean.toLowerCase()
    if (lower === 'name' || lower === 'fullname' || lower === 'full name' || clean.includes('नाम')) return 'fullName'
    if (lower === 'phone' || lower === 'mobile' || lower === 'contact' || clean.includes('फोन') || clean.includes('सम्पर्क')) return 'phone'
    if (lower === 'email' || clean.includes('इमेल')) return 'email'
    if (lower === 'address' || lower === 'locality' || clean.includes('ठेगाना') || clean.includes('टोल')) return 'address'
    if (lower === 'ward' || clean.includes('वडा')) return 'ward'
    if (lower === 'blood' || lower === 'bloodgroup' || lower === 'blood group' || clean.includes('रक्त')) return 'bloodGroup'
    if (lower === 'code' || clean.includes('कोड')) return 'code'
    if (lower === 'balance' || lower === 'opening' || clean.includes('रकम') || clean.includes('मौज्दात')) return 'balance'
    return clean
  })

  const results: Record<string, unknown>[] = []
  for (let r = 1; r < nonEmptyLines.length; r++) {
    const row = nonEmptyLines[r]
    const doc: Record<string, unknown> = {}
    for (let c = 0; c < headers.length; c++) {
      const field = headers[c]
      if (field) {
        doc[field] = row[c] ?? ''
      }
    }
    results.push(doc)
  }

  return results
}

/** Parse an import file (JSON, CSV, or Excel). Returns parsed docs or throws. */
export async function parseImportFile<T>(file: File): Promise<ParsedImport<T>> {
  const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')
  const text = await file.text()
  const isCsv = file.name.toLowerCase().endsWith('.csv') || text.trim().startsWith('"') || text.includes(',')

  if (isExcel) {
    try {
      return await parseExcelFile<T>(file)
    } catch (e) {
      throw e
    }
  }

  if (isCsv) {
    try {
      const docs = parseCsvText(text) as T[]
      if (docs.length === 0) {
        throw new Error('CSV file is empty or has no data rows')
      }
      return {
        collection: guessCollection(file.name),
        docs,
        meta: { count: docs.length, format: 'csv' },
      }
    } catch (e) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        // Might be JSON, fall through
      } else {
        throw e
      }
    }
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Invalid file — expected valid CSV, Excel, or JSON format')
  }

  if (raw && typeof raw === 'object' && 'docs' in raw && Array.isArray((raw as Record<string, unknown>).docs)) {
    const obj = raw as Record<string, unknown>
    const meta = (obj._export as Record<string, unknown>) || {}
    return {
      collection: (meta.collection as string) || guessCollection(file.name),
      docs: obj.docs as T[],
      meta: {
        tenant: meta.tenant as string | undefined,
        exportedAt: meta.exportedAt as string | undefined,
        count: meta.count as number | undefined,
        format: 'json',
      },
    }
  }

  // Bare array of docs
  if (Array.isArray(raw)) {
    return {
      collection: guessCollection(file.name),
      docs: raw as T[],
      meta: { count: raw.length, format: 'json' },
    }
  }

  throw new Error('Unrecognised import format — expected CSV, Excel (.xlsx), or JSON with { docs: [...] }')
}

function guessCollection(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.includes('member')) return 'members'
  if (lower.includes('party')) return 'parties'
  if (lower.includes('item')) return 'items'
  if (lower.includes('account')) return 'accounts'
  if (lower.includes('journal')) return 'journal-entries'
  if (lower.includes('voucher') || lower.includes('document')) return 'documents'
  return 'unknown'
}

/* ── Import: Dedup ────────────────────────────────────────── */

export type DedupResult<T> = {
  /** Records with no match — safe to import directly. */
  newRecords: T[]
  /** Records that match an existing doc by id. */
  exactDuplicates: { imported: T; existing: T }[]
  /** Records that match by name (fuzzy). */
  similarRecords: { imported: T; existing: T; matchField: string }[]
}

const DEDUP_KEYS: Record<string, { key: string; field: string }[]> = {
  members: [{ key: 'fullName', field: 'fullName' }, { key: 'phone', field: 'phone' }],
  parties: [{ key: 'name', field: 'name' }, { key: 'phone', field: 'phone' }],
  items: [{ key: 'name', field: 'name' }, { key: 'code', field: 'code' }],
  accounts: [{ key: 'name', field: 'name' }, { key: 'code', field: 'code' }],
  'opening-balances': [{ key: 'accountId', field: 'accountId' }],
  'journal-entries': [{ key: 'voucherNo', field: 'voucherNo' }],
}

/* ── Accounting Excel Features ─────────────────────────────── */

/** Build hierarchical Chart of Accounts Excel with indentation. */
export async function buildCoaExcel<T extends Record<string, unknown>>(
  docs: T[],
  options: ExcelExportOptions = {},
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Syasyah Samaj'
  workbook.created = new Date()
  workbook.modified = new Date()

  const sheetName = options.sheetName || 'Chart of Accounts'
  const dataSheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  // Build hierarchy: group by group/type
  const groups = new Map<string, { name: string; children: T[] }>()
  const rootAccounts: T[] = []

  for (const doc of docs) {
    const group = String(doc.group || 'Ungrouped')
    if (!groups.has(group)) {
      groups.set(group, { name: group, children: [] })
    }
    groups.get(group)!.children.push(doc)
  }

  // Columns for CoA
  const columns: ExcelExportColumn[] = [
    { key: 'code', header: 'Code', width: 15 },
    { key: 'name', header: 'Name', width: 50 },
    { key: 'type', header: 'Type', width: 15 },
    { key: 'class', header: 'Class', width: 15 },
    { key: 'group', header: 'Group', width: 20 },
    { key: 'openingBalance', header: 'Opening Balance', width: 20 },
    { key: 'openingBalanceType', header: 'Dr/Cr', width: 10 },
  ]

  dataSheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.max(c.header.length, 15),
  }))

  // Style header row
  dataSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  dataSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBE1A1A' },
  }
  dataSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

  // Add grouped rows with indentation
  let rowIndex = 1
  for (const [groupName, { children }] of groups) {
    rowIndex++
    // Group header row
    const groupRow = dataSheet.addRow({
      name: groupName,
      type: '',
      class: '',
      group: '',
      openingBalance: 0,
      openingBalanceType: '',
    })
    groupRow.font = { bold: true, size: 12 }
    groupRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    groupRow.height = 25
    // Merge first two cells for group name
    dataSheet.mergeCells(rowIndex, 1, rowIndex, 2)

    // Child accounts with indentation
    for (const child of children) {
      rowIndex++
      const row = dataSheet.addRow({
        code: child.code,
        name: `  ${child.name}`, // indent with spaces
        type: child.type,
        class: child.class,
        group: groupName,
        openingBalance: child.openingBalance || 0,
        openingBalanceType: child.openingBalanceType || '',
      })
      row.alignment = { indent: 1 }
    }
  }

  // Auto-filter
  if (columns.length > 0) {
    dataSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rowIndex, column: columns.length },
    }
  }

  // Meta sheet
  const metaSheet = workbook.addWorksheet('_Meta')
  metaSheet.columns = [
    { header: 'Property', key: 'property', width: 25 },
    { header: 'Value', key: 'value', width: 60 },
  ]
  metaSheet.getRow(1).font = { bold: true }
  metaSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFBE1A1A' },
  }

  const metaData = [
    { property: 'Collection', value: 'accounts' },
    { property: 'Tenant', value: options.tenantName || 'default' },
    { property: 'Exported At', value: new Date().toISOString() },
    { property: 'Record Count', value: docs.length },
    { property: 'Version', value: 1 },
    { property: 'Format', value: 'Hierarchical CoA' },
    ...Object.entries(options.meta || {}).map(([k, v]) => ({ property: k, value: String(v) })),
  ]
  metaSheet.addRows(metaData)

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Parse hierarchical CoA Excel import. */
export async function parseCoaExcel<T>(file: File): Promise<ParsedImport<T>> {
  // Reuse parseExcelFile but with special handling for indented names
  const parsed = await parseExcelFile<T>(file)

  // Detect and flatten hierarchy: indented names indicate child of previous non-indented
  const results: T[] = []
  let currentGroup = ''

  for (const doc of parsed.docs) {
    const name = String((doc as any).name || '').trim()
    if (name && !name.startsWith('  ') && !name.startsWith('\t')) {
      currentGroup = name
      // This is a group header - we might skip it or add as a group account
      const withGroup = { ...doc, group: currentGroup } as T
      results.push(withGroup)
    } else if (name) {
      // This is an account under current group
      const withGroup = { ...doc, group: currentGroup } as T
      results.push(withGroup)
    }
  }

  return {
    ...parsed,
    docs: results,
  }
}

/** Build Journal Voucher 2-sheet Excel (Headers + Lines). */
export async function buildJournalExcel<T extends Record<string, unknown>>(
  docs: T[],
  options: ExcelExportOptions = {},
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Syasyah Samaj'
  workbook.created = new Date()
  workbook.modified = new Date()

  // Sheet 1: Journal Headers
  const headerSheet = workbook.addWorksheet('Journal Headers', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  const headerColumns: ExcelExportColumn[] = [
    { key: 'voucherNo', header: 'Voucher No', width: 20 },
    { key: 'date', header: 'Date', width: 15 },
    { key: 'type', header: 'Type', width: 15 },
    { key: 'narration', header: 'Narration', width: 50 },
    { key: 'fy', header: 'Fiscal Year', width: 15 },
    { key: 'status', header: 'Status', width: 15 },
    { key: 'totalAmount', header: 'Total Amount', width: 20 },
  ]

  headerSheet.columns = headerColumns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.max(c.header.length, 15),
  }))
  headerSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  headerSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE1A1A' } }

  // Group docs by voucherNo for headers
  const voucherMap = new Map<string, T>()
  for (const doc of docs) {
    const vn = String(doc.voucherNo || '')
    if (!voucherMap.has(vn)) {
      voucherMap.set(vn, doc)
    }
  }

  for (const [vn, doc] of voucherMap) {
    const debit = Number(doc.debit || 0)
    const credit = Number(doc.credit || 0)
    headerSheet.addRow({
      voucherNo: vn,
      date: doc.date,
      type: doc.type,
      narration: doc.narration,
      fy: doc.fy,
      status: doc.status,
      totalAmount: Math.max(debit, credit),
    })
  }

  // Sheet 2: Journal Lines
  const lineSheet = workbook.addWorksheet('Journal Lines', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  const lineColumns: ExcelExportColumn[] = [
    { key: 'voucherNo', header: 'Voucher No', width: 20 },
    { key: 'account', header: 'Account', width: 30 },
    { key: 'accountCode', header: 'Account Code', width: 15 },
    { key: 'debit', header: 'Debit', width: 15 },
    { key: 'credit', header: 'Credit', width: 15 },
    { key: 'description', header: 'Description', width: 50 },
  ]

  lineSheet.columns = lineColumns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.max(c.header.length, 15),
  }))
  lineSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  lineSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE1A1A' } }

  for (const doc of docs) {
    lineSheet.addRow({
      voucherNo: doc.voucherNo,
      account: doc.account || doc.party,
      accountCode: doc.accountCode,
      debit: doc.debit || 0,
      credit: doc.credit || 0,
      description: doc.description || doc.narration,
    })
  }

  // Data validation on voucherNo column (must exist in Headers sheet)
  if (voucherMap.size > 0) {
    const voucherNos = Array.from(voucherMap.keys())
    // Note: ExcelJS dataValidations API may vary by version
    // This is a simplified version - full data validation would need proper API
    console.log('Data validation would be applied for voucherNos:', voucherNos)
  }

  // Meta sheet
  const metaSheet = workbook.addWorksheet('_Meta')
  metaSheet.columns = [
    { header: 'Property', key: 'property', width: 25 },
    { header: 'Value', key: 'value', width: 60 },
  ]
  metaSheet.getRow(1).font = { bold: true }
  metaSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE1A1A' } }

  const metaData = [
    { property: 'Collection', value: 'journal-entries' },
    { property: 'Tenant', value: options.tenantName || 'default' },
    { property: 'Exported At', value: new Date().toISOString() },
    { property: 'Voucher Count', value: voucherMap.size },
    { property: 'Line Count', value: docs.length },
    { property: 'Version', value: 1 },
    { property: 'Format', value: '2-Sheet Journal (Headers + Lines)' },
    ...Object.entries(options.meta || {}).map(([k, v]) => ({ property: k, value: String(v) })),
  ]
  metaSheet.addRows(metaData)

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Parse Journal 2-sheet Excel import. */
export async function parseJournalExcel<T extends Record<string, unknown>>(file: File): Promise<ParsedImport<T>> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)

  const headerSheet = workbook.getWorksheet('Journal Headers')
  const lineSheet = workbook.getWorksheet('Journal Lines')

  if (!headerSheet || !lineSheet) {
    throw new Error('Excel file must have "Journal Headers" and "Journal Lines" sheets')
  }

  // Read headers
  const headerRow = headerSheet.getRow(1)
  const headerHeaders: string[] = []
  headerRow.eachCell((cell, colNumber) => {
    headerHeaders[colNumber - 1] = String(cell.value || `Column ${colNumber}`)
  })

  const headers: T[] = []
  headerSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const doc: Record<string, unknown> = {}
    let hasData = false
    row.eachCell((cell, colNumber) => {
      const field = headerHeaders[colNumber - 1]
      if (field) {
        doc[field] = cell.value ?? ''
        hasData = true
      }
    })
    if (hasData) headers.push(doc as T)
  })

  // Read lines
  const lineRow = lineSheet.getRow(1)
  const lineHeaders: string[] = []
  lineRow.eachCell((cell, colNumber) => {
    lineHeaders[colNumber - 1] = String(cell.value || `Column ${colNumber}`)
  })

  const lines: T[] = []
  lineSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const doc: Record<string, unknown> = {}
    let hasData = false
    row.eachCell((cell, colNumber) => {
      const field = lineHeaders[colNumber - 1]
      if (field) {
        let val: unknown = cell.value
        if (val && typeof val === 'object' && 'richText' in val) {
          val = (val as ExcelJS.CellRichTextValue).richText.map((rt) => rt.text).join('')
        } else if (val instanceof Date) {
          val = val.toISOString()
        } else if (typeof val === 'object' && val !== null && 'result' in val) {
          val = (val as { result: unknown }).result
        }
        doc[field] = val ?? ''
        hasData = true
      }
    })
    if (hasData) lines.push(doc as T)
  })

  // Combine headers and lines - merge line data with header data by voucherNo
  const results: T[] = []
  for (const line of lines) {
    const vn = String((line as any).voucherNo || '')
    const header = headers.find((h) => String((h as any).voucherNo || '') === vn)
    if (header) {
      results.push({ ...header, ...line } as T)
    } else {
      // Orphan line - include with warning
      results.push({ ...line, _orphan: true } as T)
    }
  }

  return {
    collection: 'journal-entries',
    docs: results,
    meta: { count: results.length, format: 'excel' },
  }
}

/** Build Opening Balances Excel template. */
export async function buildOpeningBalancesExcel<T extends Record<string, unknown>>(
  docs: T[],
  options: ExcelExportOptions = {},
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Syasyah Samaj'
  workbook.created = new Date()
  workbook.modified = new Date()

  const sheetName = options.sheetName || 'Opening Balances'
  const dataSheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  const columns: ExcelExportColumn[] = [
    { key: 'accountCode', header: 'Account Code', width: 15 },
    { key: 'accountName', header: 'Account Name', width: 40 },
    { key: 'accountType', header: 'Account Type', width: 15 },
    { key: 'fiscalYear', header: 'Fiscal Year', width: 15 },
    { key: 'debitOpening', header: 'Debit Opening', width: 20 },
    { key: 'creditOpening', header: 'Credit Opening', width: 20 },
    { key: 'isBalanced', header: 'Balanced', width: 10 },
  ]

  dataSheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.max(c.header.length, 15),
  }))
  dataSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  dataSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE1A1A' } }

  for (const doc of docs) {
    const debit = Number((doc as any).debitOpening || 0)
    const credit = Number((doc as any).creditOpening || 0)
    dataSheet.addRow({
      accountCode: (doc as any).accountCode || (doc as any).code,
      accountName: (doc as any).accountName || (doc as any).name,
      accountType: (doc as any).accountType || (doc as any).type,
      fiscalYear: (doc as any).fiscalYear,
      debitOpening: debit,
      creditOpening: credit,
      isBalanced: debit === credit ? '✓' : '✗',
    })
  }

  // Formula row for totals
  const totalRow = docs.length + 2
  dataSheet.getRow(totalRow).font = { bold: true }
  dataSheet.getCell(`E${totalRow}`).value = { formula: `SUM(E2:E${docs.length + 1})` }
  dataSheet.getCell(`F${totalRow}`).value = { formula: `SUM(F2:F${docs.length + 1})` }

  // Meta sheet
  const metaSheet = workbook.addWorksheet('_Meta')
  metaSheet.columns = [
    { header: 'Property', key: 'property', width: 25 },
    { header: 'Value', key: 'value', width: 60 },
  ]
  metaSheet.getRow(1).font = { bold: true }
  metaSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBE1A1A' } }

  const metaData = [
    { property: 'Collection', value: 'opening-balances' },
    { property: 'Tenant', value: options.tenantName || 'default' },
    { property: 'Exported At', value: new Date().toISOString() },
    { property: 'Record Count', value: docs.length },
    { property: 'Version', value: 1 },
    { property: 'Format', value: 'Opening Balances with Totals' },
    ...Object.entries(options.meta || {}).map(([k, v]) => ({ property: k, value: String(v) })),
  ]
  metaSheet.addRows(metaData)

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Parse Opening Balances Excel import. */
export async function parseOpeningBalancesExcel<T extends Record<string, unknown>>(file: File): Promise<ParsedImport<T>> {
  const parsed = await parseExcelFile<T>(file)

  // Validate: only balance sheet accounts, debits = credits
  const results: T[] = []
  let totalDebit = 0
  let totalCredit = 0

  for (const doc of parsed.docs) {
    const debit = Number((doc as any).debitOpening || 0)
    const credit = Number((doc as any).creditOpening || 0)
    totalDebit += debit
    totalCredit += credit

    // Add validation flag
    const validated = { ...doc, _balanced: debit === credit } as T
    results.push(validated)
  }

  // Add summary row
  results.push({
    accountCode: 'TOTAL',
    accountName: 'SUM',
    debitOpening: totalDebit,
    creditOpening: totalCredit,
    isBalanced: totalDebit === totalCredit ? '✓' : '✗',
  } as unknown as T)

  return {
    ...parsed,
    docs: results,
  }
}

/** Compare imported docs against existing docs to find duplicates. */
export function classifyRecords<T extends Record<string, unknown>>(
  imported: T[],
  existing: T[],
  collection: string,
): DedupResult<T> {
  const result: DedupResult<T> = { newRecords: [], exactDuplicates: [], similarRecords: [] }
  const keys = DEDUP_KEYS[collection] || []

  // Build lookup maps from existing
  const byId = new Map<string | number, T>()
  for (const doc of existing) {
    const id = (doc as Record<string, unknown>).id ?? (doc as Record<string, unknown>)._id
    if (id != null) byId.set(id as string | number, doc)
  }

  const byName = new Map<string, T>()
  for (const doc of existing) {
    for (const k of keys) {
      const val = String(doc[k.key] || '').toLowerCase().trim()
      if (val) byName.set(val, doc)
    }
  }

  for (const doc of imported) {
    // Check exact id match
    const id = (doc as Record<string, unknown>).id ?? (doc as Record<string, unknown>)._id
    if (id != null && byId.has(id as string | number)) {
      result.exactDuplicates.push({ imported: doc, existing: byId.get(id as string | number)! })
      continue
    }

    // Check fuzzy/unique key match
    let foundSimilar = false
    for (const k of keys) {
      const val = String(doc[k.key] || '').toLowerCase().trim()
      if (val && byName.has(val)) {
        result.similarRecords.push({
          imported: doc,
          existing: byName.get(val)!,
          matchField: k.field,
        })
        foundSimilar = true
        break
      }
    }

    if (!foundSimilar) {
      result.newRecords.push(doc)
    }
  }

  return result
}

/* ── Import: Execute ──────────────────────────────────────── */

export type ImportAction = 'skip' | 'create' | 'update'

/* ── Collection Export Configurations ─────────────────────── */

export const EXPORT_COLUMNS: Record<string, ExcelExportColumn[]> = {
  members: [
    { key: 'memberId', header: 'Member ID', width: 15 },
    { key: 'fullName', header: 'Full Name', width: 30 },
    { key: 'phone', header: 'Phone', width: 20 },
    { key: 'email', header: 'Email', width: 30 },
    { key: 'address', header: 'Address', width: 40 },
    { key: 'ward', header: 'Ward', width: 10 },
    { key: 'bloodGroup', header: 'Blood Group', width: 15 },
    { key: 'membershipType', header: 'Membership Type', width: 20 },
    { key: 'appliedDateBs', header: 'Applied Date (BS)', width: 20 },
    { key: 'familyMembers', header: 'Family Members', width: 50 },
  ],
  parties: [
    { key: 'name', header: 'Name', width: 30 },
    { key: 'phone', header: 'Phone', width: 20 },
    { key: 'email', header: 'Email', width: 30 },
    { key: 'address', header: 'Address', width: 40 },
    { key: 'pan', header: 'PAN', width: 20 },
    { key: 'gstin', header: 'GSTIN', width: 20 },
    { key: 'type', header: 'Type', width: 15 },
    { key: 'openingBalance', header: 'Opening Balance', width: 20 },
  ],
  items: [
    { key: 'name', header: 'Name', width: 30 },
    { key: 'code', header: 'Code', width: 15 },
    { key: 'unit', header: 'Unit', width: 15 },
    { key: 'rate', header: 'Rate', width: 15 },
    { key: 'taxType', header: 'Tax Type', width: 15 },
    { key: 'openingStock', header: 'Opening Stock', width: 15 },
    { key: 'openingValue', header: 'Opening Value', width: 15 },
  ],
  accounts: [
    { key: 'code', header: 'Code', width: 15 },
    { key: 'name', header: 'Name', width: 30 },
    { key: 'type', header: 'Type', width: 15 },
    { key: 'class', header: 'Class', width: 15 },
    { key: 'group', header: 'Group', width: 20 },
    { key: 'openingBalance', header: 'Opening Balance', width: 20 },
  ],
  documents: [
    { key: 'voucherNo', header: 'Voucher No', width: 20 },
    { key: 'date', header: 'Date', width: 15 },
    { key: 'type', header: 'Type', width: 15 },
    { key: 'party', header: 'Party', width: 30 },
    { key: 'narration', header: 'Narration', width: 50 },
    { key: 'fy', header: 'Fiscal Year', width: 15 },
    { key: 'status', header: 'Status', width: 15 },
  ],
  'journal-entries': [
    { key: 'voucherNo', header: 'Voucher No', width: 20 },
    { key: 'date', header: 'Date', width: 15 },
    { key: 'type', header: 'Type', width: 15 },
    { key: 'party', header: 'Party', width: 30 },
    { key: 'narration', header: 'Narration', width: 50 },
    { key: 'fy', header: 'Fiscal Year', width: 15 },
    { key: 'status', header: 'Status', width: 15 },
  ],
}

export const EXPORT_CONFIGS: Record<string, { sheetName: string; isHierarchical?: boolean }> = {
  members: { sheetName: 'Members' },
  parties: { sheetName: 'Parties' },
  items: { sheetName: 'Items' },
  accounts: { sheetName: 'Chart of Accounts', isHierarchical: true },
  documents: { sheetName: 'Vouchers' },
  'journal-entries': { sheetName: 'Journal Entries' },
}

/* ── Validation Schemas (inline for now, will extract to validationSchemas.ts) ─────────────────────── */

// Export types for validation
export type ValidationError = {
  row: number
  field: string
  message: string
  severity: 'error' | 'warning'
}

export function validateImportRows<T extends Record<string, unknown>>(
  docs: T[],
  collection: string,
): { valid: T[]; errors: ValidationError[] } {
  const valid: T[] = []
  const errors: ValidationError[] = []

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]
    const rowNum = i + 2 // +1 for header, +1 for 0-index

    // Collection-specific validation
    if (collection === 'members') {
      if (!doc.fullName || String(doc.fullName).trim() === '') {
        errors.push({ row: rowNum, field: 'fullName', message: 'Full name is required', severity: 'error' })
      }
      if (doc.phone && !/^\+?[0-9]{10,15}$/.test(String(doc.phone))) {
        errors.push({ row: rowNum, field: 'phone', message: 'Invalid phone format', severity: 'warning' })
      }
      if (doc.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(doc.email))) {
        errors.push({ row: rowNum, field: 'email', message: 'Invalid email format', severity: 'warning' })
      }
    } else if (collection === 'accounts') {
      if (!doc.name || String(doc.name).trim() === '') {
        errors.push({ row: rowNum, field: 'name', message: 'Account name is required', severity: 'error' })
      }
      if (!['asset', 'liability', 'equity', 'income', 'expense'].includes(String(doc.type || ''))) {
        errors.push({ row: rowNum, field: 'type', message: 'Invalid account type', severity: 'error' })
      }
    } else if (collection === 'parties') {
      if (!doc.name || String(doc.name).trim() === '') {
        errors.push({ row: rowNum, field: 'name', message: 'Party name is required', severity: 'error' })
      }
    } else if (collection === 'items') {
      if (!doc.name || String(doc.name).trim() === '') {
        errors.push({ row: rowNum, field: 'name', message: 'Item name is required', severity: 'error' })
      }
    }

    if (errors.filter((e) => e.row === rowNum && e.severity === 'error').length === 0) {
      valid.push(doc)
    }
  }

  return { valid, errors }
}

import { queueImportJob, processImportQueue } from './offlineImport'

export async function executeImport<T extends Record<string, unknown>>(
  collection: string,
  records: { doc: T; action: ImportAction }[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ created: number; updated: number; skipped: number; errors: string[] }> {
  // Rather than directly making API calls sequentially which fails offline and
  // blocks UI for large imports, we use the offline import queue.
  // It handles chunking and offline processing natively.

  await queueImportJob(collection, records)

  // Immediately process if online, this runs asynchronously.
  processImportQueue().catch(console.error)

  // We return a "queued" successful response for the UI to close the modal.
  // Sync Status and DataManagement badges will track the ongoing status.
  onProgress?.(records.length, records.length)

  return {
    created: 0, // values are tracked asynchronously in the job now
    updated: 0,
    skipped: 0,
    errors: [],
  }
}
